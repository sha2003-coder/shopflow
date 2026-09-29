const { db, hasFullServiceAccount } = require('../config/firebaseAdmin');
const { fallbackStore, getShopForUser } = require('./shopService');
const { generateNextBarcode, generateBarcodeImage } = require('../utils/barcodeGenerator');

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

  for (const [key, valObj] of Object.entries(doc.fields)) {
    if ('stringValue' in valObj) result[key] = valObj.stringValue;
    else if ('integerValue' in valObj) result[key] = parseInt(valObj.integerValue, 10);
    else if ('doubleValue' in valObj) result[key] = parseFloat(valObj.doubleValue);
    else if ('booleanValue' in valObj) result[key] = valObj.booleanValue;
    else if ('timestampValue' in valObj) result[key] = valObj.timestampValue;
    else if ('nullValue' in valObj) result[key] = null;
    else result[key] = valObj;
  }
  return result;
}

/**
 * Resolves the authenticated user's shop. Rejects if user does not own a shop.
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
 * Retrieves all products belonging to a specific shop.
 */
async function fetchProductsForShopId(shopId, idToken) {
  // 1. Admin SDK approach
  if (hasFullServiceAccount && db) {
    try {
      const snap = await db.collection('products').where('shopId', '==', shopId).get();
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      return list;
    } catch (err) {
      console.warn('[Product Service] Admin SDK fetchProducts error:', err.message);
    }
  }

  // 2. REST API approach (runQuery)
  if (idToken) {
    try {
      const queryRes = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'products' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'shopId' },
                op: 'EQUAL',
                value: { stringValue: shopId },
              },
            },
          },
        }),
      });

      if (queryRes.ok) {
        const rows = await queryRes.json();
        const list = [];
        for (const row of rows) {
          if (row.document) {
            list.push(fromFirestoreDoc(row.document));
          }
        }
        if (list.length > 0) return list;
      }
    } catch (err) {
      // Fallback
    }
  }

  // 3. Fallback store
  const list = [];
  for (const product of fallbackStore.products.values()) {
    if (product.shopId === shopId) {
      list.push(product);
    }
  }
  return list;
}

/**
 * Validates input parameters for creating or updating a product.
 */
function validateProductInput(input, isUpdate = false) {
  const {
    name,
    category,
    sku,
    buyingPrice,
    sellingPrice,
    stockQuantity,
    lowStockLevel,
    unit,
  } = input;

  if (!isUpdate || name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      const err = new Error('Product name is required.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!isUpdate || category !== undefined) {
    if (!category || typeof category !== 'string' || !category.trim()) {
      const err = new Error('Category is required.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!isUpdate || sku !== undefined) {
    if (!sku || typeof sku !== 'string' || !sku.trim()) {
      const err = new Error('SKU is required.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!isUpdate || buyingPrice !== undefined) {
    const bp = Number(buyingPrice);
    if (isNaN(bp) || bp < 0) {
      const err = new Error('Buying price must be a valid number greater than or equal to 0.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!isUpdate || sellingPrice !== undefined) {
    const sp = Number(sellingPrice);
    if (isNaN(sp) || sp < 0) {
      const err = new Error('Selling price must be a valid number greater than or equal to 0.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!isUpdate || stockQuantity !== undefined) {
    const sq = Number(stockQuantity);
    if (isNaN(sq) || sq < 0) {
      const err = new Error('Stock quantity must be a valid number greater than or equal to 0.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!isUpdate || lowStockLevel !== undefined) {
    const lsl = Number(lowStockLevel);
    if (isNaN(lsl) || lsl < 0) {
      const err = new Error('Low stock level must be a valid number greater than or equal to 0.');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!isUpdate || unit !== undefined) {
    if (!unit || typeof unit !== 'string' || !unit.trim()) {
      const err = new Error('Unit is required.');
      err.statusCode = 400;
      throw err;
    }
  }
}

/**
 * Creates a new product for the authenticated user's shop.
 */
async function createProduct(input, user, idToken) {
  // Frontend-supplied barcode is strictly ignored; backend is the authoritative generator
  const sanitizedInput = { ...input };
  delete sanitizedInput.barcode;

  if (sanitizedInput.shopId !== undefined) {
    const err = new Error('Shop ID cannot be specified manually. It is automatically derived from your authenticated profile.');
    err.statusCode = 400;
    throw err;
  }

  if (sanitizedInput.id !== undefined) {
    const err = new Error('Product ID cannot be specified manually.');
    err.statusCode = 400;
    throw err;
  }

  // Validate input
  validateProductInput(sanitizedInput, false);

  // Resolve shop
  const shop = await requireUserShop(user, idToken);
  const normalizedSku = sanitizedInput.sku.trim().toUpperCase();

  // Check SKU uniqueness within the shop
  const existingProducts = await fetchProductsForShopId(shop.id, idToken);
  const skuCollision = existingProducts.some(
    (p) => String(p.sku || '').toUpperCase() === normalizedSku
  );

  if (skuCollision) {
    const err = new Error(`Product with SKU "${sanitizedInput.sku.trim()}" already exists in your shop.`);
    err.statusCode = 400;
    throw err;
  }

  // Generate unique predictable internal barcode for the shop
  const existingBarcodes = existingProducts.map((p) => p.barcode).filter(Boolean);
  const barcode = await generateNextBarcode(shop.id, existingBarcodes);

  const nowIso = new Date().toISOString();
  const productPayload = {
    shopId: shop.id,
    name: sanitizedInput.name.trim(),
    category: sanitizedInput.category.trim(),
    sku: normalizedSku,
    barcode,
    buyingPrice: Number(sanitizedInput.buyingPrice),
    sellingPrice: Number(sanitizedInput.sellingPrice),
    stockQuantity: Number(sanitizedInput.stockQuantity),
    lowStockLevel: Number(sanitizedInput.lowStockLevel),
    unit: sanitizedInput.unit.trim(),
    description: (sanitizedInput.description || '').trim(),
    imageUrl: sanitizedInput.imageUrl || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 1. Admin SDK
  if (hasFullServiceAccount && db) {
    try {
      const docRef = await db.collection('products').add(productPayload);
      const productDoc = await docRef.get();
      const product = { id: docRef.id, ...productDoc.data() };
      fallbackStore.products.set(docRef.id, product);
      return product;
    } catch (adminErr) {
      console.warn('[Product Service] Admin SDK createProduct error:', adminErr.message);
    }
  }

  // 2. REST API
  if (idToken) {
    try {
      const createRes = await fetch(`${FIRESTORE_BASE_URL}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: toFirestoreFields({
            shopId: productPayload.shopId,
            name: productPayload.name,
            category: productPayload.category,
            sku: productPayload.sku,
            barcode: productPayload.barcode,
            buyingPrice: productPayload.buyingPrice,
            sellingPrice: productPayload.sellingPrice,
            stockQuantity: productPayload.stockQuantity,
            lowStockLevel: productPayload.lowStockLevel,
            unit: productPayload.unit,
            description: productPayload.description,
            imageUrl: productPayload.imageUrl,
            createdAt: nowIso,
            updatedAt: nowIso,
          }),
        }),
      });

      if (createRes.ok) {
        const rawCreated = await createRes.json();
        const product = fromFirestoreDoc(rawCreated);
        fallbackStore.products.set(product.id, product);
        return product;
      }
    } catch (restErr) {
      // Fallback
    }
  }

  // 3. Fallback store
  const generatedId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const localProduct = {
    id: generatedId,
    ...productPayload,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  fallbackStore.products.set(generatedId, localProduct);
  return localProduct;
}

/**
 * Retrieves all products belonging to the user's shop with search and filtering.
 */
async function getProducts(user, idToken, query = {}) {
  const shop = await requireUserShop(user, idToken);
  const products = await fetchProductsForShopId(shop.id, idToken);

  let filtered = [...products];

  // Search filter (name, SKU, barcode)
  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    filtered = filtered.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const sku = String(p.sku || '').toLowerCase();
      const barcode = String(p.barcode || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || barcode.includes(q);
    });
  }

  // Category filter
  if (query.category && typeof query.category === 'string' && query.category.trim()) {
    const cat = query.category.trim().toLowerCase();
    filtered = filtered.filter((p) => String(p.category || '').toLowerCase() === cat);
  }

  // Low stock filter
  if (query.lowStock === 'true' || query.lowStock === '1' || query.lowStock === true) {
    filtered = filtered.filter((p) => Number(p.stockQuantity) <= Number(p.lowStockLevel));
  }

  // Sort by createdAt descending
  filtered.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return filtered;
}

/**
 * Retrieves a single product by ID, enforcing shop ownership.
 */
async function getProductById(productId, user, idToken) {
  const shop = await requireUserShop(user, idToken);
  let product = null;

  // 1. Admin SDK
  if (hasFullServiceAccount && db) {
    try {
      const doc = await db.collection('products').doc(productId).get();
      if (doc.exists) {
        product = { id: doc.id, ...doc.data() };
      }
    } catch (err) {
      // fallback
    }
  }

  // 2. REST API
  if (!product && idToken) {
    try {
      const res = await fetch(`${FIRESTORE_BASE_URL}/products/${productId}`, {
        headers: { 'Authorization': `Bearer ${idToken}`, 'Accept': 'application/json' },
      });
      if (res.ok) {
        const raw = await res.json();
        product = fromFirestoreDoc(raw);
      }
    } catch (err) {
      // fallback
    }
  }

  // 3. Fallback store
  if (!product) {
    product = fallbackStore.products.get(productId) || null;
  }

  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  // Multi-tenant isolation check
  if (product.shopId !== shop.id) {
    const err = new Error('Access denied. You do not have permission to view products from another shop.');
    err.statusCode = 403;
    throw err;
  }

  return product;
}

/**
 * Retrieves a single product by barcode within the user's shop.
 */
async function getProductByBarcode(barcode, user, idToken) {
  const shop = await requireUserShop(user, idToken);
  const cleanBarcode = String(barcode || '').trim();

  if (!cleanBarcode) {
    const err = new Error('Barcode parameter is required.');
    err.statusCode = 400;
    throw err;
  }

  const products = await fetchProductsForShopId(shop.id, idToken);
  const matching = products.find((p) => String(p.barcode || '').trim() === cleanBarcode);

  if (!matching) {
    const err = new Error(`Product with barcode "${cleanBarcode}" not found in your shop.`);
    err.statusCode = 404;
    throw err;
  }

  return matching;
}

/**
 * Updates an existing product. Ensures immutable fields (id, shopId, createdAt, barcode) are preserved.
 */
async function updateProduct(productId, updateInput, user, idToken) {
  // Reject forbidden updates
  if (updateInput.id !== undefined && updateInput.id !== productId) {
    const err = new Error('Product ID cannot be changed.');
    err.statusCode = 400;
    throw err;
  }

  if (updateInput.shopId !== undefined) {
    const err = new Error('Shop ID cannot be changed.');
    err.statusCode = 400;
    throw err;
  }

  if (updateInput.barcode !== undefined) {
    const err = new Error('Barcode cannot be modified once generated.');
    err.statusCode = 400;
    throw err;
  }

  // Verify product exists and belongs to user's shop
  const existing = await getProductById(productId, user, idToken);
  const shop = await requireUserShop(user, idToken);

  validateProductInput(updateInput, true);

  // If SKU is changed, check uniqueness
  if (updateInput.sku !== undefined) {
    const normalizedSku = updateInput.sku.trim().toUpperCase();
    if (normalizedSku !== String(existing.sku || '').toUpperCase()) {
      const allProducts = await fetchProductsForShopId(shop.id, idToken);
      const collision = allProducts.some(
        (p) => p.id !== productId && String(p.sku || '').toUpperCase() === normalizedSku
      );
      if (collision) {
        const err = new Error(`Product with SKU "${updateInput.sku.trim()}" already exists in your shop.`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const nowIso = new Date().toISOString();
  const updatedPayload = {
    name: updateInput.name !== undefined ? updateInput.name.trim() : existing.name,
    category: updateInput.category !== undefined ? updateInput.category.trim() : existing.category,
    sku: updateInput.sku !== undefined ? updateInput.sku.trim().toUpperCase() : existing.sku,
    buyingPrice: updateInput.buyingPrice !== undefined ? Number(updateInput.buyingPrice) : existing.buyingPrice,
    sellingPrice: updateInput.sellingPrice !== undefined ? Number(updateInput.sellingPrice) : existing.sellingPrice,
    stockQuantity: updateInput.stockQuantity !== undefined ? Number(updateInput.stockQuantity) : existing.stockQuantity,
    lowStockLevel: updateInput.lowStockLevel !== undefined ? Number(updateInput.lowStockLevel) : existing.lowStockLevel,
    unit: updateInput.unit !== undefined ? updateInput.unit.trim() : existing.unit,
    description: updateInput.description !== undefined ? updateInput.description.trim() : existing.description,
    imageUrl: updateInput.imageUrl !== undefined ? updateInput.imageUrl : existing.imageUrl,
    updatedAt: new Date(),
  };

  // 1. Admin SDK
  if (hasFullServiceAccount && db) {
    try {
      await db.collection('products').doc(productId).update(updatedPayload);
      const updatedDoc = await db.collection('products').doc(productId).get();
      const product = { id: productId, ...updatedDoc.data() };
      fallbackStore.products.set(productId, product);
      return product;
    } catch (err) {
      console.warn('[Product Service] Admin SDK updateProduct error:', err.message);
    }
  }

  // 2. REST API
  if (idToken) {
    try {
      const patchRes = await fetch(`${FIRESTORE_BASE_URL}/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: toFirestoreFields({
            ...updatedPayload,
            updatedAt: nowIso,
          }),
        }),
      });

      if (patchRes.ok) {
        const raw = await patchRes.json();
        const product = fromFirestoreDoc(raw);
        fallbackStore.products.set(product.id, product);
        return product;
      }
    } catch (err) {
      // Fallback
    }
  }

  // 3. Fallback store
  const merged = {
    ...existing,
    ...updatedPayload,
    updatedAt: nowIso,
  };
  fallbackStore.products.set(productId, merged);
  return merged;
}

/**
 * Permanently deletes a product document after verifying shop ownership.
 */
async function deleteProduct(productId, user, idToken) {
  // Verify existence and ownership
  await getProductById(productId, user, idToken);

  // 1. Admin SDK
  if (hasFullServiceAccount && db) {
    try {
      await db.collection('products').doc(productId).delete();
      fallbackStore.products.delete(productId);
      return { id: productId };
    } catch (err) {
      console.warn('[Product Service] Admin SDK deleteProduct error:', err.message);
    }
  }

  // 2. REST API
  if (idToken) {
    try {
      const delRes = await fetch(`${FIRESTORE_BASE_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
      if (delRes.ok) {
        fallbackStore.products.delete(productId);
        return { id: productId };
      }
    } catch (err) {
      // Fallback
    }
  }

  // 3. Fallback store
  fallbackStore.products.delete(productId);
  return { id: productId };
}

/**
 * Generates an on-the-fly Code 128 barcode PNG image for a product.
 * Strictly verifies shop ownership.
 */
async function getProductBarcodeImage(productId, user, idToken) {
  const product = await getProductById(productId, user, idToken);
  if (!product.barcode) {
    const err = new Error('Product does not have a barcode assigned.');
    err.statusCode = 400;
    throw err;
  }

  const imageBuffer = await generateBarcodeImage(product.barcode);
  return {
    imageBuffer,
    barcode: product.barcode,
    product,
  };
}

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  getProductByBarcode,
  getProductBarcodeImage,
  updateProduct,
  deleteProduct,
};
