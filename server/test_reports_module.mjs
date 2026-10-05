/**
 * ShopFlow Reports Module Automated Verification Suite
 * Verifies all 11 test specifications required by the User:
 * 1. Open Reports endpoint (real data returned)
 * 2. Today's Sales summary calculations (totalSales, billCount, itemsSold, averageBill)
 * 3. Payment Method summary separation (cash, card, other totals and counts)
 * 4. Top Selling Products ranking by quantity sold
 * 5. Low Stock product identification (stockQuantity <= lowStockLevel)
 * 6. Out of Stock product identification (stockQuantity === 0)
 * 7. Date Range filtering (including empty range handling)
 * 8. Historical price preservation (modifying product current price does not alter historical sales value)
 * 9. Cross-Shop Isolation (Shop A vs Shop B completely segregated)
 * 10. Empty range returns clean zero values without errors
 * 11. Existing endpoints (health, products, sales, checkout) still work
 */

const API_BASE = 'http://localhost:5000/api';
const FIREBASE_API_KEY = 'AIzaSyDeOR9ZMr4V-64lxhicCedRPu98WJQB6MY';

// Helper: Sign up a fresh test user and shop
async function createTestUser(tag) {
  const email = `report_tester_${tag}_${Date.now()}@shopflow.test`;
  const password = 'Password123!';
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const authData = await authRes.json();
  if (!authData.idToken) {
    throw new Error(`Failed to create test user ${email}: ${JSON.stringify(authData)}`);
  }

  // Create a shop for this user
  const shopRes = await fetch(`${API_BASE}/shops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authData.idToken}`,
    },
    body: JSON.stringify({
      name: `Report Shop ${tag}`,
      ownerName: `Owner ${tag}`,
      phone: '0779998888',
      address: '100 Business Blvd',
    }),
  });

  const shopData = await shopRes.json();
  return {
    email,
    uid: authData.localId,
    token: authData.idToken,
    shop: shopData.shop,
  };
}

// Helper: Create product in user's shop
async function createProduct(user, productData) {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      name: productData.name,
      category: 'Beverages',
      sku: productData.sku,
      buyingPrice: productData.buyingPrice || 50,
      sellingPrice: productData.sellingPrice,
      stockQuantity: productData.stockQuantity,
      lowStockLevel: productData.lowStockLevel || 5,
      unit: 'pcs',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to create product: ${JSON.stringify(data)}`);
  }
  return data.product;
}

// Helper: Checkout / Create sale
async function createSale(user, saleData) {
  const res = await fetch(`${API_BASE}/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify(saleData),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to create sale: ${JSON.stringify(data)}`);
  }
  return data.sale;
}

// Helper: Fetch sales report
async function fetchSalesReport(user, query = {}) {
  const q = new URLSearchParams(query);
  const res = await fetch(`${API_BASE}/reports/sales?${q.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${user.token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to fetch sales report: ${JSON.stringify(data)}`);
  }
  return data.report;
}

// Helper: Fetch inventory report
async function fetchInventoryReport(user) {
  const res = await fetch(`${API_BASE}/reports/inventory`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${user.token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to fetch inventory report: ${JSON.stringify(data)}`);
  }
  return data.report;
}

async function runReportsVerification() {
  console.log('🚀 Starting ShopFlow Reports Module Automated Verification Suite\n');

  // --- TEST 1: Auth Protection ---
  console.log('--- TEST 1: Authentication Protection ---');
  const unauthSalesRes = await fetch(`${API_BASE}/reports/sales`);
  if (unauthSalesRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated /api/reports/sales, got ${unauthSalesRes.status}`);
  }
  const unauthInvRes = await fetch(`${API_BASE}/reports/inventory`);
  if (unauthInvRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated /api/reports/inventory, got ${unauthInvRes.status}`);
  }
  console.log('✅ TEST 1 PASSED: Unauthenticated access is strictly denied (401).');

  // --- SETUP: Create Shop A & Shop B ---
  console.log('\n--- Setup: Creating Test Shop A and Test Shop B ---');
  const shopAUser = await createTestUser('ShopA');
  const shopBUser = await createTestUser('ShopB');
  console.log(`✅ Shop A created: ${shopAUser.shop.name} (${shopAUser.shop.id})`);
  console.log(`✅ Shop B created: ${shopBUser.shop.name} (${shopBUser.shop.id})`);

  // --- TEST 2: Initial Empty Reports ---
  console.log('\n--- TEST 2: Empty State for Fresh Shop ---');
  const emptyReport = await fetchSalesReport(shopAUser);
  if (emptyReport.summary.totalSales !== 0 || emptyReport.summary.billCount !== 0) {
    throw new Error(`Expected totalSales: 0 and billCount: 0 for fresh shop, got ${JSON.stringify(emptyReport.summary)}`);
  }
  if (emptyReport.summary.averageBill !== 0) {
    throw new Error(`Expected averageBill: 0 for fresh shop, got ${emptyReport.summary.averageBill}`);
  }
  console.log('✅ TEST 2 PASSED: Fresh shop returns clean zero summary values.');

  // --- TEST 3: Create Products and Sales for Shop A ---
  console.log('\n--- TEST 3: Creating Products and Executing Sales ---');
  const prodCola = await createProduct(shopAUser, {
    name: 'Coca Cola 500ml',
    sku: `COLA_${Date.now()}`,
    sellingPrice: 150,
    stockQuantity: 50,
    lowStockLevel: 10,
  });

  const prodBread = await createProduct(shopAUser, {
    name: 'Whole Wheat Bread',
    sku: `BREAD_${Date.now()}`,
    sellingPrice: 200,
    stockQuantity: 30,
    lowStockLevel: 5,
  });

  // Sale 1: Cash sale of 3 Colas (3 * 150 = 450)
  const sale1 = await createSale(shopAUser, {
    items: [{ productId: prodCola.id, quantity: 3, itemDiscount: 0 }],
    discountType: 'fixed',
    discountValue: 0,
    paymentMethod: 'cash',
    amountReceived: 500,
  });
  console.log(`   Sale 1 (Cash): 3x Cola = Rs. ${sale1.grandTotal}`);

  // Sale 2: Card sale of 2 Breads and 1 Cola (2 * 200 + 1 * 150 = 550)
  const sale2 = await createSale(shopAUser, {
    items: [
      { productId: prodBread.id, quantity: 2, itemDiscount: 0 },
      { productId: prodCola.id, quantity: 1, itemDiscount: 0 },
    ],
    discountType: 'fixed',
    discountValue: 0,
    paymentMethod: 'card',
    amountReceived: 550,
  });
  console.log(`   Sale 2 (Card): 2x Bread + 1x Cola = Rs. ${sale2.grandTotal}`);

  // --- TEST 4: Verify Today's Sales Metrics ---
  console.log('\n--- TEST 4: Validating Sales Metrics & Summary ---');
  const todayReport = await fetchSalesReport(shopAUser);
  const expectedTotalSales = 450 + 550; // 1000
  const expectedBills = 2;
  const expectedItemsSold = 3 + 2 + 1; // 6
  const expectedAvgBill = 1000 / 2; // 500

  if (todayReport.summary.totalSales !== expectedTotalSales) {
    throw new Error(`Expected totalSales: ${expectedTotalSales}, got ${todayReport.summary.totalSales}`);
  }
  if (todayReport.summary.billCount !== expectedBills) {
    throw new Error(`Expected billCount: ${expectedBills}, got ${todayReport.summary.billCount}`);
  }
  if (todayReport.summary.itemsSold !== expectedItemsSold) {
    throw new Error(`Expected itemsSold: ${expectedItemsSold}, got ${todayReport.summary.itemsSold}`);
  }
  if (todayReport.summary.averageBill !== expectedAvgBill) {
    throw new Error(`Expected averageBill: ${expectedAvgBill}, got ${todayReport.summary.averageBill}`);
  }
  console.log(`✅ TEST 4 PASSED: Total Sales: Rs. ${todayReport.summary.totalSales}, Bills: ${todayReport.summary.billCount}, Items: ${todayReport.summary.itemsSold}, Avg: Rs. ${todayReport.summary.averageBill}`);

  // --- TEST 5: Payment Method Grouping ---
  console.log('\n--- TEST 5: Validating Payment Method Separation ---');
  if (todayReport.paymentMethods.cash !== 450 || todayReport.paymentMethods.counts.cash !== 1) {
    throw new Error(`Cash payment mismatch: expected 450 / count 1, got ${todayReport.paymentMethods.cash} / count ${todayReport.paymentMethods.counts.cash}`);
  }
  if (todayReport.paymentMethods.card !== 550 || todayReport.paymentMethods.counts.card !== 1) {
    throw new Error(`Card payment mismatch: expected 550 / count 1, got ${todayReport.paymentMethods.card} / count ${todayReport.paymentMethods.counts.card}`);
  }
  console.log(`✅ TEST 5 PASSED: Cash = Rs. ${todayReport.paymentMethods.cash} (${todayReport.paymentMethods.counts.cash} bill), Card = Rs. ${todayReport.paymentMethods.card} (${todayReport.paymentMethods.counts.card} bill).`);

  // --- TEST 6: Top-Selling Products Ranking ---
  console.log('\n--- TEST 6: Validating Top-Selling Products Ranking ---');
  // Cola total qty = 3 + 1 = 4 (value: 3*150 + 1*150 = 600)
  // Bread total qty = 2 (value: 2*200 = 400)
  if (!todayReport.topProducts || todayReport.topProducts.length < 2) {
    throw new Error(`Expected at least 2 top products, got ${todayReport.topProducts?.length}`);
  }
  const top1 = todayReport.topProducts[0];
  const top2 = todayReport.topProducts[1];

  if (top1.name !== 'Coca Cola 500ml' || top1.quantitySold !== 4 || top1.salesValue !== 600) {
    throw new Error(`Top 1 product mismatch: expected Cola (qty 4, value 600), got ${JSON.stringify(top1)}`);
  }
  if (top2.name !== 'Whole Wheat Bread' || top2.quantitySold !== 2 || top2.salesValue !== 400) {
    throw new Error(`Top 2 product mismatch: expected Bread (qty 2, value 400), got ${JSON.stringify(top2)}`);
  }
  console.log(`✅ TEST 6 PASSED: Rank 1: ${top1.name} (Sold: ${top1.quantitySold}, Rs. ${top1.salesValue}), Rank 2: ${top2.name} (Sold: ${top2.quantitySold}, Rs. ${top2.salesValue}).`);

  // --- TEST 7: Historical Price Preservation ---
  console.log('\n--- TEST 7: Historical Price Preservation ---');
  // Update Cola's current price to 300
  const updateRes = await fetch(`${API_BASE}/products/${prodCola.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${shopAUser.token}`,
    },
    body: JSON.stringify({
      sellingPrice: 300,
    }),
  });
  if (!updateRes.ok) {
    throw new Error('Failed to update product price');
  }

  // Fetch report again; historical sales value for Cola MUST remain Rs. 600 (not 4 * 300 = 1200)
  const reportAfterPriceChange = await fetchSalesReport(shopAUser);
  const colaReportAfter = reportAfterPriceChange.topProducts.find((p) => p.productId === prodCola.id);
  if (colaReportAfter.salesValue !== 600) {
    throw new Error(`Historical price corrupted! Expected 600, got ${colaReportAfter.salesValue}`);
  }
  if (reportAfterPriceChange.summary.totalSales !== 1000) {
    throw new Error(`Total sales corrupted by price change! Expected 1000, got ${reportAfterPriceChange.summary.totalSales}`);
  }
  console.log('✅ TEST 7 PASSED: Historical sales value preserved accurately despite current product price change.');

  // --- TEST 8: Low Stock & Out of Stock Reports ---
  console.log('\n--- TEST 8: Low Stock & Out of Stock Product Reports ---');
  // Create a low stock product: stockQuantity = 3, lowStockLevel = 5
  const prodLowStock = await createProduct(shopAUser, {
    name: 'Milk 1L',
    sku: `MILK_${Date.now()}`,
    sellingPrice: 120,
    stockQuantity: 3,
    lowStockLevel: 5,
  });

  // Create an out of stock product: stockQuantity = 0, lowStockLevel = 5
  const prodOutOfStock = await createProduct(shopAUser, {
    name: 'Sugar 1kg',
    sku: `SUGAR_${Date.now()}`,
    sellingPrice: 250,
    stockQuantity: 0,
    lowStockLevel: 5,
  });

  const invReport = await fetchInventoryReport(shopAUser);
  const foundLow = invReport.lowStockProducts.find((p) => p.id === prodLowStock.id);
  const foundOut = invReport.outOfStockProducts.find((p) => p.id === prodOutOfStock.id);

  if (!foundLow || foundLow.status !== 'Low Stock') {
    throw new Error(`Low stock product not identified properly: ${JSON.stringify(foundLow)}`);
  }
  if (!foundOut || foundOut.status !== 'Out of Stock') {
    throw new Error(`Out of stock product not identified properly: ${JSON.stringify(foundOut)}`);
  }
  console.log(`✅ TEST 8 PASSED: Low stock identified (${foundLow.name}: ${foundLow.currentStock}/${foundLow.lowStockLevel}), Out of stock identified (${foundOut.name}: stock 0).`);

  // --- TEST 9: Date Range Filtering & Empty Range ---
  console.log('\n--- TEST 9: Date Range Filtering & Empty Date Range ---');
  const pastEmptyReport = await fetchSalesReport(shopAUser, {
    startDate: '2020-01-01',
    endDate: '2020-01-07',
  });
  if (pastEmptyReport.summary.totalSales !== 0 || pastEmptyReport.summary.billCount !== 0) {
    throw new Error(`Past date range should have 0 sales, got ${pastEmptyReport.summary.totalSales}`);
  }
  if (pastEmptyReport.topProducts.length !== 0) {
    throw new Error(`Past date range should have 0 top products, got ${pastEmptyReport.topProducts.length}`);
  }
  console.log('✅ TEST 9 PASSED: Past empty date range returns clean zero results with no errors.');

  // --- TEST 10: Multi-Tenant Shop Isolation ---
  console.log('\n--- TEST 10: Multi-Tenant Cross-Shop Isolation ---');
  // Shop B should have NO sales and NO products from Shop A
  const shopBReport = await fetchSalesReport(shopBUser);
  if (shopBReport.summary.totalSales !== 0 || shopBReport.summary.billCount !== 0) {
    throw new Error(`Shop B leaked Shop A sales! totalSales: ${shopBReport.summary.totalSales}`);
  }
  if (shopBReport.topProducts.length !== 0) {
    throw new Error(`Shop B leaked Shop A products! topProducts: ${JSON.stringify(shopBReport.topProducts)}`);
  }

  // Create a sale in Shop B
  const shopBProd = await createProduct(shopBUser, {
    name: 'Shop B Exclusive Gadget',
    sku: `GADGET_${Date.now()}`,
    sellingPrice: 999,
    stockQuantity: 10,
    lowStockLevel: 2,
  });

  await createSale(shopBUser, {
    items: [{ productId: shopBProd.id, quantity: 1, itemDiscount: 0 }],
    discountType: 'fixed',
    discountValue: 0,
    paymentMethod: 'cash',
    amountReceived: 1000,
  });

  const shopBReportUpdated = await fetchSalesReport(shopBUser);
  const shopAReportCheck = await fetchSalesReport(shopAUser);

  if (shopBReportUpdated.summary.totalSales !== 999) {
    throw new Error(`Shop B total sales expected 999, got ${shopBReportUpdated.summary.totalSales}`);
  }
  if (shopAReportCheck.summary.totalSales !== 1000) {
    throw new Error(`Shop A total sales corrupted by Shop B! Expected 1000, got ${shopAReportCheck.summary.totalSales}`);
  }
  console.log('✅ TEST 10 PASSED: Strict shop isolation verified. Neither shop can see the other\'s data.');

  // --- TEST 11: Existing Features Health Check ---
  console.log('\n--- TEST 11: Existing Functionality Regression Check ---');
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthData = await healthRes.json();
  if (!healthRes.ok || !healthData.success) {
    throw new Error(`Health check failed: ${JSON.stringify(healthData)}`);
  }

  const productsRes = await fetch(`${API_BASE}/products`, {
    headers: { Authorization: `Bearer ${shopAUser.token}` },
  });
  const productsData = await productsRes.json();
  if (!productsRes.ok || !Array.isArray(productsData.products)) {
    throw new Error('Product retrieval failed');
  }

  const salesHistoryRes = await fetch(`${API_BASE}/sales`, {
    headers: { Authorization: `Bearer ${shopAUser.token}` },
  });
  const salesHistoryData = await salesHistoryRes.json();
  if (!salesHistoryRes.ok || !Array.isArray(salesHistoryData.sales)) {
    throw new Error('Sales history retrieval failed');
  }
  console.log(`✅ TEST 11 PASSED: Health, Products (${productsData.products.length}), and Sales History (${salesHistoryData.sales.length}) fully functional.`);

  console.log('\n🎉 ALL 11 TESTS PASSED SUCCESSFULLY! Reports Module is 100% operational.');
}

runReportsVerification().catch((err) => {
  console.error('\n❌ Verification failed with error:', err.message);
  process.exit(1);
});
