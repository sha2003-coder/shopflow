const { admin, db, hasFullServiceAccount } = require('../config/firebaseAdmin');
const { fallbackStore, getShopForUser } = require('./shopService');
const productService = require('./productService');

/**
 * Resolves the authenticated user's shop. Rejects if user does not own a shop.
 * Enforces strict shop isolation: never trusts client parameters.
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
 * Normalizes any timestamp representation (Firestore Timestamp, ISO string, seconds, or Date)
 * into a valid JavaScript Date object.
 */
function parseTimestamp(raw) {
  if (!raw) return null;
  if (typeof raw.toDate === 'function') {
    return raw.toDate();
  }
  if (typeof raw._seconds === 'number') {
    return new Date(raw._seconds * 1000 + ((raw._nanoseconds || 0) / 1000000));
  }
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Formats a Date object into a readable day label (e.g. "01 Oct").
 */
function formatDayLabel(dateObj) {
  const day = String(dateObj.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[dateObj.getMonth()];
  return `${day} ${month}`;
}

/**
 * Generates an array of YYYY-MM-DD date strings between start and end inclusive.
 * Capped at 90 days to avoid performance issues if someone queries years.
 */
function getDaysInRange(startDateStr, endDateStr) {
  const days = [];
  const [startY, startM, startD] = startDateStr.split('-').map(Number);
  const [endY, endM, endD] = endDateStr.split('-').map(Number);

  const cur = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));

  let count = 0;
  while (cur <= end && count < 90) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
    count++;
  }
  return days;
}

/**
 * Fetches all sales belonging strictly to a shopId from Firestore and fallbackStore.
 */
async function fetchAllSalesForShop(shopId) {
  const salesMap = new Map();

  // 1. Admin SDK Firestore query
  if (hasFullServiceAccount && db) {
    try {
      const snap = await db.collection('sales').where('shopId', '==', shopId).get();
      snap.forEach((doc) => {
        const data = doc.data();
        salesMap.set(doc.id, {
          id: doc.id,
          ...data,
        });
      });
    } catch (err) {
      console.warn('[Report Service] Firestore sales query warning:', err.message);
    }
  }

  // 2. Fallback Store (for local/testing sync)
  if (fallbackStore && fallbackStore.sales) {
    for (const [id, sale] of fallbackStore.sales.entries()) {
      if (sale.shopId === shopId && !salesMap.has(id)) {
        salesMap.set(id, sale);
      }
    }
  }

  return Array.from(salesMap.values());
}

/**
 * Calculates Sales Report for the authenticated user's shop over a date range.
 *
 * @param {Object} user - Authenticated user payload
 * @param {string} idToken - Firebase auth token
 * @param {Object} query - Query parameters (startDate, endDate, tzOffset)
 * @returns {Promise<Object>} Formatted report object
 */
async function getSalesReport(user, idToken, query = {}) {
  const shop = await requireUserShop(user, idToken);
  const shopId = shop.id;

  // Determine date bounds
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let startDateStr = (query.startDate || todayStr).trim();
  let endDateStr = (query.endDate || startDateStr).trim();

  // Validate format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDateStr)) startDateStr = todayStr;
  if (!dateRegex.test(endDateStr)) endDateStr = startDateStr;

  // Swap if start is after end
  if (startDateStr > endDateStr) {
    const temp = startDateStr;
    startDateStr = endDateStr;
    endDateStr = temp;
  }

  // Handle timezone offset if passed (in minutes, from Date.getTimezoneOffset())
  const tzOffset = parseInt(query.tzOffset, 10);
  const hasTzOffset = !isNaN(tzOffset);

  // Construct start and end timestamp boundaries
  const [startY, startM, startD] = startDateStr.split('-').map(Number);
  const [endY, endM, endD] = endDateStr.split('-').map(Number);

  let startBoundMs;
  let endBoundMs;

  if (hasTzOffset) {
    // Client sent local timezone offset in minutes: UTC = Local + tzOffset * 60000
    startBoundMs = Date.UTC(startY, startM - 1, startD, 0, 0, 0, 0) + (tzOffset * 60 * 1000);
    endBoundMs = Date.UTC(endY, endM - 1, endD, 23, 59, 59, 999) + (tzOffset * 60 * 1000);
  } else {
    // Default: use local machine bounds
    startBoundMs = new Date(startY, startM - 1, startD, 0, 0, 0, 0).getTime();
    endBoundMs = new Date(endY, endM - 1, endD, 23, 59, 59, 999).getTime();
  }

  // Retrieve all sales for the authenticated shop
  const allShopSales = await fetchAllSalesForShop(shopId);

  // Filter sales strictly within the date range
  const salesInRange = [];
  for (const sale of allShopSales) {
    const dateObj = parseTimestamp(sale.createdAt);
    if (!dateObj) continue;

    const timeMs = dateObj.getTime();
    if (timeMs >= startBoundMs && timeMs <= endBoundMs) {
      salesInRange.push({
        ...sale,
        _parsedDate: dateObj,
      });
    }
  }

  // 1. Calculate Summary
  let totalSales = 0;
  let itemsSold = 0;
  const billCount = salesInRange.length;

  const paymentMethods = {
    cash: 0,
    card: 0,
    other: 0,
    counts: {
      cash: 0,
      card: 0,
      other: 0,
    },
  };

  const productAggregates = new Map();
  const dailySalesMap = new Map();

  // Initialize daily sales slots for every day in range
  const dayKeys = getDaysInRange(startDateStr, endDateStr);
  for (const dKey of dayKeys) {
    const [y, m, d] = dKey.split('-').map(Number);
    const dateInstance = new Date(y, m - 1, d);
    dailySalesMap.set(dKey, {
      date: dKey,
      formattedDate: formatDayLabel(dateInstance),
      sales: 0,
      billCount: 0,
    });
  }

  for (const sale of salesInRange) {
    const grandTotal = Number(sale.grandTotal) || 0;
    totalSales += grandTotal;

    // Payment method breakdown
    const pm = String(sale.paymentMethod || '').toLowerCase().trim();
    if (pm === 'cash') {
      paymentMethods.cash += grandTotal;
      paymentMethods.counts.cash += 1;
    } else if (pm === 'card') {
      paymentMethods.card += grandTotal;
      paymentMethods.counts.card += 1;
    } else {
      paymentMethods.other += grandTotal;
      paymentMethods.counts.other += 1;
    }

    // Items sold & Top-selling product aggregation using historical snapshot
    if (Array.isArray(sale.items)) {
      for (const item of sale.items) {
        const qty = Number(item.quantity) || 0;
        itemsSold += qty;

        const pKey = item.productId || item.sku || item.name;
        if (!pKey) continue;

        const lineTotal = Number(item.lineTotal) || 0;
        if (!productAggregates.has(pKey)) {
          productAggregates.set(pKey, {
            productId: item.productId || '',
            name: item.name || 'Unnamed Product',
            sku: item.sku || '-',
            barcode: item.barcode || '-',
            quantitySold: 0,
            salesValue: 0,
          });
        }
        const agg = productAggregates.get(pKey);
        agg.quantitySold += qty;
        agg.salesValue = Math.round((agg.salesValue + lineTotal) * 100) / 100;
      }
    }

    // Daily sales trend aggregation
    const saleDate = sale._parsedDate;
    // Map sale to YYYY-MM-DD
    let dayKey;
    if (hasTzOffset) {
      const localTime = new Date(saleDate.getTime() - (tzOffset * 60000));
      dayKey = `${localTime.getUTCFullYear()}-${String(localTime.getUTCMonth() + 1).padStart(2, '0')}-${String(localTime.getUTCDate()).padStart(2, '0')}`;
    } else {
      dayKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}-${String(saleDate.getDate()).padStart(2, '0')}`;
    }

    if (!dailySalesMap.has(dayKey)) {
      dailySalesMap.set(dayKey, {
        date: dayKey,
        formattedDate: formatDayLabel(saleDate),
        sales: 0,
        billCount: 0,
      });
    }

    const dayEntry = dailySalesMap.get(dayKey);
    dayEntry.sales = Math.round((dayEntry.sales + grandTotal) * 100) / 100;
    dayEntry.billCount += 1;
  }

  // Format numerical summaries
  totalSales = Math.round(totalSales * 100) / 100;
  paymentMethods.cash = Math.round(paymentMethods.cash * 100) / 100;
  paymentMethods.card = Math.round(paymentMethods.card * 100) / 100;
  paymentMethods.other = Math.round(paymentMethods.other * 100) / 100;

  const averageBill = billCount > 0 ? Math.round((totalSales / billCount) * 100) / 100 : 0;

  // Rank top selling products (top 10 by quantity sold)
  const topProducts = Array.from(productAggregates.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10);

  // Convert daily sales map to sorted array
  const dailySales = Array.from(dailySalesMap.values()).sort((a, b) => (a.date > b.date ? 1 : -1));

  // Also include inventory status for full comprehensive report
  const inventoryReport = await getInventoryReport(user, idToken);

  return {
    dateRange: {
      startDate: startDateStr,
      endDate: endDateStr,
    },
    summary: {
      totalSales,
      billCount,
      itemsSold,
      averageBill,
    },
    paymentMethods,
    topProducts,
    dailySales,
    lowStockProducts: inventoryReport.lowStockProducts,
    outOfStockProducts: inventoryReport.outOfStockProducts,
    inventorySummary: {
      totalProducts: inventoryReport.totalProducts,
      lowStockCount: inventoryReport.lowStockCount,
      outOfStockCount: inventoryReport.outOfStockCount,
    },
  };
}

/**
 * Calculates current Inventory Report for the authenticated user's shop.
 *
 * @param {Object} user - Authenticated user payload
 * @param {string} idToken - Firebase auth token
 * @returns {Promise<Object>} Formatted inventory report
 */
async function getInventoryReport(user, idToken) {
  // Retrieve all products belonging strictly to this user's shop
  const products = await productService.getProducts(user, idToken);

  const lowStockProducts = [];
  const outOfStockProducts = [];

  for (const prod of products) {
    const stockQuantity = Number(prod.stockQuantity) || 0;
    const lowStockLevel = Number(prod.lowStockLevel) || 0;

    const item = {
      id: prod.id,
      name: prod.name || 'Unnamed Product',
      sku: prod.sku || '-',
      barcode: prod.barcode || '-',
      currentStock: stockQuantity,
      lowStockLevel,
      status: stockQuantity === 0 ? 'Out of Stock' : (stockQuantity <= lowStockLevel ? 'Low Stock' : 'In Stock'),
    };

    if (stockQuantity === 0) {
      outOfStockProducts.push(item);
    }

    if (stockQuantity <= lowStockLevel) {
      lowStockProducts.push(item);
    }
  }

  // Sort: Out of stock first, then ascending by current stock
  lowStockProducts.sort((a, b) => {
    if (a.currentStock === 0 && b.currentStock !== 0) return -1;
    if (b.currentStock === 0 && a.currentStock !== 0) return 1;
    return a.currentStock - b.currentStock;
  });

  return {
    totalProducts: products.length,
    lowStockCount: lowStockProducts.length,
    outOfStockCount: outOfStockProducts.length,
    lowStockProducts,
    outOfStockProducts,
  };
}

module.exports = {
  getSalesReport,
  getInventoryReport,
  requireUserShop,
};
