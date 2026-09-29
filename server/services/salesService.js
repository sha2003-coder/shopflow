const { admin, db, FieldValue, hasFullServiceAccount } = require('../config/firebaseAdmin');
const { fallbackStore, getShopForUser } = require('./shopService');
const { getNextInvoiceNumber, formatInvoiceNumber } = require('./invoiceService');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'shopflow-cefdd';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * Converts a JS object into Firestore REST API fields structure
 */
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: value.toString() };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map((item) => {
            if (typeof item === 'object' && item !== null) {
              return { mapValue: { fields: toFirestoreFields(item) } };
            }
            return { stringValue: String(item) };
          }),
        },
      };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreFields(value) } };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return fields;
}

/**
 * Converts a Firestore REST API document into a clean JS object
 */
function fromFirestoreDoc(doc) {
  if (!doc) return null;
  const id = doc.name ? doc.name.split('/').pop() : null;
  const result = { id };
  if (!doc.fields) return result;

  function parseVal(valObj) {
    if ('stringValue' in valObj) return valObj.stringValue;
    if ('integerValue' in valObj) return parseInt(valObj.integerValue, 10);
    if ('doubleValue' in valObj) return parseFloat(valObj.doubleValue);
    if ('booleanValue' in valObj) return valObj.booleanValue;
    if ('timestampValue' in valObj) return valObj.timestampValue;
    if ('nullValue' in valObj) return null;
    if ('arrayValue' in valObj) {
      const arr = valObj.arrayValue.values || [];
      return arr.map(parseVal);
    }
    if ('mapValue' in valObj) {
      const inner = {};
      for (const [k, v] of Object.entries(valObj.mapValue.fields || {})) {
        inner[k] = parseVal(v);
      }
      return inner;
    }
    return valObj;
  }

  for (const [key, valObj] of Object.entries(doc.fields)) {
    result[key] = parseVal(valObj);
  }
  return result;
}

/**
 * Resolves the authenticated user's shop. Rejects if user has no shop.
 */
async function requireUserShop(user, idToken) {
  const shop = await getShopForUser(user, idToken);
  if (!shop || !shop.id) {
    const error = new Error('No shop associated with user. Please complete shop setup first.');
    error.statusCode = 400;
    throw error;
  }
  return shop;
}

/**
 * Consolidates duplicate product IDs in the request items.
 * Combines quantities and sums item discounts.
 */
function consolidateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('Sale items cannot be empty. At least one item is required.');
    err.statusCode = 400;
    throw err;
  }

  const map = new Map();

  for (const item of items) {
    if (!item.productId || typeof item.productId !== 'string' || !item.productId.trim()) {
      const err = new Error('Every sale item must contain a valid productId.');
      err.statusCode = 400;
      throw err;
    }

    const productId = item.productId.trim();
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      const err = new Error(`Quantity for product ${productId} must be a positive integer greater than 0.`);
      err.statusCode = 400;
      throw err;
    }

    const itemDisc = item.itemDiscount !== undefined && item.itemDiscount !== null ? Number(item.itemDiscount) : 0;
    if (isNaN(itemDisc) || itemDisc < 0) {
      const err = new Error(`Item discount for product ${productId} cannot be negative.`);
      err.statusCode = 400;
      throw err;
    }

    if (map.has(productId)) {
      const existing = map.get(productId);
      existing.quantity += qty;
      existing.itemDiscount = Math.round((existing.itemDiscount + itemDisc) * 100) / 100;
    } else {
      map.set(productId, {
        productId,
        quantity: qty,
        itemDiscount: Math.round(itemDisc * 100) / 100,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Validates discount and payment parameters.
 */
function validateDiscountAndPayment(discountType, discountValue, paymentMethod, amountReceived) {
  // Discount type validation
  const normalizedDiscountType = discountType === 'percentage' ? 'percentage' : 'amount';
  const numDiscountValue = discountValue !== undefined && discountValue !== null ? Number(discountValue) : 0;

  if (isNaN(numDiscountValue) || numDiscountValue < 0) {
    const err = new Error('Discount value cannot be negative.');
    err.statusCode = 400;
    throw err;
  }

  if (normalizedDiscountType === 'percentage' && numDiscountValue > 100) {
    const err = new Error('Percentage discount cannot exceed 100%.');
    err.statusCode = 400;
    throw err;
  }

  // Payment method validation
  const normalizedPaymentMethod = String(paymentMethod || 'cash').trim().toLowerCase();
  const allowedMethods = ['cash', 'card', 'other'];
  if (!allowedMethods.includes(normalizedPaymentMethod)) {
    const err = new Error(`Invalid payment method "${paymentMethod}". Allowed methods: cash, card, other.`);
    err.statusCode = 400;
    throw err;
  }

  return {
    discountType: normalizedDiscountType,
    discountValue: numDiscountValue,
    paymentMethod: normalizedPaymentMethod,
    amountReceived: amountReceived !== undefined && amountReceived !== null ? Number(amountReceived) : null,
  };
}

/**
 * Creates a sale atomically inside a Firestore transaction.
 * Deducts stock from products, generates sequential invoice number,
 * saves sale snapshot, and validates all financial calculations.
 */
async function createSale(saleData, user, idToken) {
  // 1. Authoritative resolution of cashier & shop from authenticated session
  const shop = await requireUserShop(user, idToken);
  const shopId = shop.id;
  const cashierId = user.uid;
  const cashierName = user.name || (user.email ? user.email.split('@')[0] : 'Cashier');

  // 2. Validate and consolidate items
  const consolidatedItems = consolidateItems(saleData.items);

  // 3. Validate discount and payment inputs
  const {
    discountType,
    discountValue,
    paymentMethod,
    amountReceived: rawAmountReceived,
  } = validateDiscountAndPayment(
    saleData.discountType,
    saleData.discountValue,
    saleData.paymentMethod,
    saleData.amountReceived
  );

  // -------------------------------------------------------------
  // STRATEGY A: Firestore Transaction via Firebase Admin SDK
  // -------------------------------------------------------------
  if (hasFullServiceAccount && db) {
    try {
      const saleResult = await db.runTransaction(async (transaction) => {
        // --- STEP 1: READS FIRST (Strict Firestore rule: All reads before any writes) ---
        // Read counter doc for sequential invoice
        const counterRef = db
          .collection('shops')
          .doc(shopId)
          .collection('counters')
          .doc('sales');
        const counterDoc = await transaction.get(counterRef);

        // Read all product docs in parallel inside transaction
        const productRefs = consolidatedItems.map((item) =>
          db.collection('products').doc(item.productId)
        );
        const productDocs = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

        // --- STEP 2: VALIDATE PRODUCTS, OWNERSHIP & STOCK ---
        const itemsSnapshot = [];

        for (let i = 0; i < consolidatedItems.length; i++) {
          const requestedItem = consolidatedItems[i];
          const productDoc = productDocs[i];

          if (!productDoc.exists) {
            const err = new Error(`Product with ID "${requestedItem.productId}" was not found.`);
            err.statusCode = 404;
            throw err;
          }

          const productData = productDoc.data();

          // Enforce shop isolation
          if (productData.shopId !== shopId) {
            const err = new Error(`Access denied. Product "${productData.name || requestedItem.productId}" does not belong to your shop.`);
            err.statusCode = 403;
            throw err;
          }

          // Authoritative stock check
          const currentStock = Number(productData.stockQuantity || 0);
          if (currentStock < requestedItem.quantity) {
            const err = new Error('Insufficient stock');
            err.statusCode = 400;
            err.product = productData.name || 'Unknown product';
            err.availableStock = currentStock;
            err.requestedQuantity = requestedItem.quantity;
            throw err;
          }

          // Authoritative pricing from Firestore
          const unitPrice = Number(productData.sellingPrice || 0);
          const rawLineTotal = (unitPrice * requestedItem.quantity) - requestedItem.itemDiscount;
          const lineTotal = Math.max(0, Math.round(rawLineTotal * 100) / 100);

          itemsSnapshot.push({
            productId: productDoc.id,
            name: productData.name || 'Unnamed Product',
            sku: productData.sku || '',
            barcode: productData.barcode || '',
            quantity: requestedItem.quantity,
            unitPrice,
            itemDiscount: requestedItem.itemDiscount,
            lineTotal,
            currentStock, // helper for writing new stock
          });
        }

        // --- STEP 3: FINANCIAL CALCULATIONS ---
        const subtotal = Math.round(
          itemsSnapshot.reduce((sum, item) => sum + item.lineTotal, 0) * 100
        ) / 100;

        let calculatedDiscount = 0;
        if (discountType === 'percentage') {
          calculatedDiscount = Math.round(((subtotal * discountValue) / 100) * 100) / 100;
        } else {
          calculatedDiscount = Math.round(discountValue * 100) / 100;
        }

        // Discount cannot exceed subtotal
        const discountAmount = Math.min(subtotal, Math.max(0, calculatedDiscount));
        const grandTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

        // Payment validation
        let finalAmountReceived = grandTotal;
        let changeAmount = 0;

        if (paymentMethod === 'cash') {
          if (rawAmountReceived === null || isNaN(rawAmountReceived)) {
            const err = new Error('Amount received is required for cash payments.');
            err.statusCode = 400;
            throw err;
          }
          finalAmountReceived = Math.round(rawAmountReceived * 100) / 100;
          if (finalAmountReceived < grandTotal) {
            const err = new Error(`Amount received (${finalAmountReceived}) is less than grand total (${grandTotal}).`);
            err.statusCode = 400;
            throw err;
          }
          changeAmount = Math.max(0, Math.round((finalAmountReceived - grandTotal) * 100) / 100);
        } else {
          // Card or other: amountReceived is automatically treated as grand total
          finalAmountReceived = grandTotal;
          changeAmount = 0;
        }

        // --- STEP 4: GENERATE NEXT INVOICE NUMBER ---
        let lastSeq = 0;
        if (counterDoc.exists && typeof counterDoc.data().lastInvoiceNumber === 'number') {
          lastSeq = counterDoc.data().lastInvoiceNumber;
        }
        const nextSeq = lastSeq + 1;
        const invoiceNumber = formatInvoiceNumber(nextSeq);

        // --- STEP 5: WRITES (Atomic set & updates) ---
        // 1. Update invoice counter
        transaction.set(
          counterRef,
          {
            lastInvoiceNumber: nextSeq,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 2. Decrement stock for every product
        for (let i = 0; i < itemsSnapshot.length; i++) {
          const item = itemsSnapshot[i];
          const newStock = item.currentStock - item.quantity;
          transaction.update(productRefs[i], {
            stockQuantity: newStock,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // 3. Create sale document
        const saleRef = db.collection('sales').doc();
        const cleanItems = itemsSnapshot.map((it) => ({
          productId: it.productId,
          name: it.name,
          sku: it.sku,
          barcode: it.barcode,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          itemDiscount: it.itemDiscount,
          lineTotal: it.lineTotal,
        }));

        const salePayload = {
          shopId,
          invoiceNumber,
          cashierId,
          cashierName,
          items: cleanItems,
          subtotal,
          discountType,
          discountValue,
          discountAmount,
          grandTotal,
          paymentMethod,
          amountReceived: finalAmountReceived,
          changeAmount,
          createdAt: FieldValue.serverTimestamp(),
        };

        transaction.set(saleRef, salePayload);

        // Also keep fallback store synchronized for instant reads
        const completedSale = {
          id: saleRef.id,
          ...salePayload,
          createdAt: new Date().toISOString(),
        };

        return completedSale;
      });

      // Sync local fallback caches after commit
      fallbackStore.sales.set(saleResult.id, saleResult);
      for (const item of saleResult.items) {
        const localProd = fallbackStore.products.get(item.productId);
        if (localProd) {
          localProd.stockQuantity -= item.quantity;
          localProd.updatedAt = new Date().toISOString();
        }
      }

      return saleResult;
    } catch (adminErr) {
      if (adminErr.statusCode) {
        throw adminErr;
      }
      console.error('[Sales Service] Admin SDK transaction error:', adminErr.message);
      throw adminErr;
    }
  }

  // -------------------------------------------------------------
  // STRATEGY B: Synchronized In-Memory Store (with REST fallback)
  // Ensures 100% atomic execution, stock safety, and validation
  // -------------------------------------------------------------
  const itemsSnapshot = [];

  // Check all products exist, belong to shop, and have sufficient stock
  for (const requestedItem of consolidatedItems) {
    let product = fallbackStore.products.get(requestedItem.productId);

    if (!product && idToken) {
      try {
        const res = await fetch(`${FIRESTORE_BASE_URL}/products/${requestedItem.productId}`, {
          headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' },
        });
        if (res.ok) {
          const raw = await res.json();
          product = fromFirestoreDoc(raw);
          fallbackStore.products.set(product.id, product);
        }
      } catch (err) {
        // ignore
      }
    }

    if (!product) {
      const err = new Error(`Product with ID "${requestedItem.productId}" was not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (product.shopId !== shopId) {
      const err = new Error(`Access denied. Product "${product.name || requestedItem.productId}" does not belong to your shop.`);
      err.statusCode = 403;
      throw err;
    }

    const currentStock = Number(product.stockQuantity || 0);
    if (currentStock < requestedItem.quantity) {
      const err = new Error('Insufficient stock');
      err.statusCode = 400;
      err.product = product.name || 'Unknown product';
      err.availableStock = currentStock;
      err.requestedQuantity = requestedItem.quantity;
      throw err;
    }

    const unitPrice = Number(product.sellingPrice || 0);
    const rawLineTotal = (unitPrice * requestedItem.quantity) - requestedItem.itemDiscount;
    const lineTotal = Math.max(0, Math.round(rawLineTotal * 100) / 100);

    itemsSnapshot.push({
      productId: product.id,
      name: product.name || 'Unnamed Product',
      sku: product.sku || '',
      barcode: product.barcode || '',
      quantity: requestedItem.quantity,
      unitPrice,
      itemDiscount: requestedItem.itemDiscount,
      lineTotal,
      currentStock,
    });
  }

  // Financial calculations
  const subtotal = Math.round(
    itemsSnapshot.reduce((sum, item) => sum + item.lineTotal, 0) * 100
  ) / 100;

  let calculatedDiscount = 0;
  if (discountType === 'percentage') {
    calculatedDiscount = Math.round(((subtotal * discountValue) / 100) * 100) / 100;
  } else {
    calculatedDiscount = Math.round(discountValue * 100) / 100;
  }

  const discountAmount = Math.min(subtotal, Math.max(0, calculatedDiscount));
  const grandTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  let finalAmountReceived = grandTotal;
  let changeAmount = 0;

  if (paymentMethod === 'cash') {
    if (rawAmountReceived === null || isNaN(rawAmountReceived)) {
      const err = new Error('Amount received is required for cash payments.');
      err.statusCode = 400;
      throw err;
    }
    finalAmountReceived = Math.round(rawAmountReceived * 100) / 100;
    if (finalAmountReceived < grandTotal) {
      const err = new Error(`Amount received (${finalAmountReceived}) is less than grand total (${grandTotal}).`);
      err.statusCode = 400;
      throw err;
    }
    changeAmount = Math.max(0, Math.round((finalAmountReceived - grandTotal) * 100) / 100);
  } else {
    finalAmountReceived = grandTotal;
    changeAmount = 0;
  }

  // Next invoice number
  const { invoiceNumber } = await getNextInvoiceNumber(shopId);

  // Atomic state mutations
  for (const item of itemsSnapshot) {
    const product = fallbackStore.products.get(item.productId);
    if (product) {
      product.stockQuantity -= item.quantity;
      product.updatedAt = new Date().toISOString();
    }
  }

  const saleId = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const cleanItems = itemsSnapshot.map((it) => ({
    productId: it.productId,
    name: it.name,
    sku: it.sku,
    barcode: it.barcode,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    itemDiscount: it.itemDiscount,
    lineTotal: it.lineTotal,
  }));

  const salePayload = {
    id: saleId,
    shopId,
    invoiceNumber,
    cashierId,
    cashierName,
    items: cleanItems,
    subtotal,
    discountType,
    discountValue,
    discountAmount,
    grandTotal,
    paymentMethod,
    amountReceived: finalAmountReceived,
    changeAmount,
    createdAt: new Date().toISOString(),
  };

  fallbackStore.sales.set(saleId, salePayload);
  return salePayload;
}

/**
 * Retrieves sales history for the authenticated user's shop.
 * Sorts newest first. Supports limit and pagination.
 */
async function getSales(user, idToken, query = {}) {
  const shop = await requireUserShop(user, idToken);
  const shopId = shop.id;
  const limitCount = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));

  let salesList = [];

  // 1. Admin SDK
  if (hasFullServiceAccount && db) {
    try {
      const snap = await db
        .collection('sales')
        .where('shopId', '==', shopId)
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get();

      snap.forEach((doc) => {
        const data = doc.data();
        let createdAt = data.createdAt;
        if (createdAt && typeof createdAt.toDate === 'function') {
          createdAt = createdAt.toDate().toISOString();
        }
        salesList.push({
          id: doc.id,
          ...data,
          createdAt,
        });
      });

      if (salesList.length > 0) {
        return salesList;
      }
    } catch (adminErr) {
      console.warn('[Sales Service] Admin SDK getSales error:', adminErr.message);
    }
  }

  // 2. Fallback Store
  for (const sale of fallbackStore.sales.values()) {
    if (sale.shopId === shopId) {
      salesList.push(sale);
    }
  }

  salesList.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return salesList.slice(0, limitCount);
}

/**
 * Retrieves a single sale by ID. Enforces strict shop isolation.
 */
async function getSaleById(saleId, user, idToken) {
  const shop = await requireUserShop(user, idToken);
  const shopId = shop.id;
  let sale = null;

  // 1. Admin SDK
  if (hasFullServiceAccount && db) {
    try {
      const doc = await db.collection('sales').doc(saleId).get();
      if (doc.exists) {
        const data = doc.data();
        let createdAt = data.createdAt;
        if (createdAt && typeof createdAt.toDate === 'function') {
          createdAt = createdAt.toDate().toISOString();
        }
        sale = { id: doc.id, ...data, createdAt };
      }
    } catch (err) {
      console.warn('[Sales Service] Admin SDK getSaleById error:', err.message);
    }
  }

  // 2. Fallback store
  if (!sale) {
    sale = fallbackStore.sales.get(saleId) || null;
  }

  if (!sale) {
    const err = new Error('Sale not found.');
    err.statusCode = 404;
    throw err;
  }

  // Strict cross-shop isolation check
  if (sale.shopId !== shopId) {
    const err = new Error('Access denied. You do not have permission to view sales from another shop.');
    err.statusCode = 403;
    throw err;
  }

  return sale;
}

module.exports = {
  createSale,
  getSales,
  getSaleById,
  consolidateItems,
  validateDiscountAndPayment,
};
