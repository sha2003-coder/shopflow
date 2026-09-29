/**
 * ShopFlow Real Sales & Checkout Verification Suite
 * Validates all 12 test specifications required by the User:
 * 1. Simple sale (stock deduction)
 * 2. Multiple products in one sale (atomic multi-stock deduction)
 * 3. Insufficient stock (rejection, no deduction)
 * 4. Cash payment (change calculation)
 * 5. Insufficient payment (rejection, no stock deduction)
 * 6. Percentage & Fixed Discounts
 * 7. Sequential invoice numbers (INV-000001, INV-000002...)
 * 8. Product price changed after sale (historical snapshot integrity)
 * 9. Cross-shop isolation (forbidden cross-tenant sales & access)
 * 10. Tampered frontend price (authoritative server pricing)
 * 11. Concurrent stock safety (no race conditions, no negative stock)
 * 12. Existing endpoints (health, products, barcode lookup)
 */

const API_BASE = 'http://localhost:5000/api';
const FIREBASE_API_KEY = 'AIzaSyDeOR9ZMr4V-64lxhicCedRPu98WJQB6MY';

// Helper: Sign up a fresh test user
async function createTestUser(tag) {
  const email = `pos_tester_${tag}_${Date.now()}@shopflow.test`;
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
      name: `Test Shop ${tag}`,
      ownerName: `Tester ${tag}`,
      phone: '0771234567',
      address: '123 Market St',
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
async function createProduct(user, { name, sku, buyingPrice, sellingPrice, stockQuantity }) {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({
      name,
      category: 'General',
      sku,
      buyingPrice,
      sellingPrice,
      stockQuantity,
      lowStockLevel: 5,
      unit: 'pcs',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Product creation failed: ${JSON.stringify(data)}`);
  }
  return data.product;
}

// Helper: Get product by ID
async function getProduct(user, productId) {
  const res = await fetch(`${API_BASE}/products/${productId}`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  const data = await res.json();
  return data.product;
}

// Helper: Checkout / Create sale
async function createSale(user, payload) {
  const res = await fetch(`${API_BASE}/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTestSuite() {
  console.log('🚀 Starting Comprehensive Sales & Checkout Backend Verification Suite\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Setup Primary Test Shop User
    console.log('--- Provisioning Test Environment ---');
    const userA = await createTestUser('ShopA');
    console.log(`User A provisioned: ${userA.email} (Shop: ${userA.shop.name})\n`);

    // -------------------------------------------------------------
    // Test 1: Simple Sale (Stock = 10, Sell = 2 -> Stock = 8)
    // -------------------------------------------------------------
    console.log('--- Test 1: Simple Sale (Stock Deduction) ---');
    const prod1 = await createProduct(userA, {
      name: 'Test Milk 1L',
      sku: `MILK-${Date.now()}`,
      buyingPrice: 80,
      sellingPrice: 100,
      stockQuantity: 10,
    });

    const sale1Res = await createSale(userA, {
      items: [{ productId: prod1.id, quantity: 2, itemDiscount: 0 }],
      paymentMethod: 'cash',
      amountReceived: 200,
    });

    assert(sale1Res.ok, 'Sale 1 created successfully');
    assert(sale1Res.data.sale.grandTotal === 200, 'Sale 1 grand total is Rs. 200');
    assert(sale1Res.data.sale.changeAmount === 0, 'Sale 1 change is Rs. 0');

    const updatedProd1 = await getProduct(userA, prod1.id);
    assert(updatedProd1.stockQuantity === 8, `Stock reduced from 10 to 8 (Actual: ${updatedProd1.stockQuantity})`);

    // -------------------------------------------------------------
    // Test 2: Multiple Products (Prod A x 2, Prod B x 3)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Multiple Products in One Sale ---');
    const prod2A = await createProduct(userA, {
      name: 'Product A (Bread)',
      sku: `BREAD-${Date.now()}`,
      buyingPrice: 40,
      sellingPrice: 60,
      stockQuantity: 10,
    });
    const prod2B = await createProduct(userA, {
      name: 'Product B (Butter)',
      sku: `BUTTER-${Date.now()}`,
      buyingPrice: 70,
      sellingPrice: 90,
      stockQuantity: 15,
    });

    // Also include a duplicate entry for product A to test consolidation!
    // Bread x 1 + Bread x 1 = Bread x 2; Butter x 3
    const sale2Res = await createSale(userA, {
      items: [
        { productId: prod2A.id, quantity: 1, itemDiscount: 0 },
        { productId: prod2A.id, quantity: 1, itemDiscount: 0 },
        { productId: prod2B.id, quantity: 3, itemDiscount: 0 },
      ],
      paymentMethod: 'card',
    });

    assert(sale2Res.ok, 'Sale 2 created successfully with multiple products & consolidated duplicates');
    // Expected grand total: (60 * 2) + (90 * 3) = 120 + 270 = 390
    assert(sale2Res.data.sale.grandTotal === 390, `Sale 2 grand total is Rs. 390 (Actual: ${sale2Res.data.sale.grandTotal})`);

    const updatedProd2A = await getProduct(userA, prod2A.id);
    const updatedProd2B = await getProduct(userA, prod2B.id);
    assert(updatedProd2A.stockQuantity === 8, `Prod A stock reduced from 10 to 8 (Actual: ${updatedProd2A.stockQuantity})`);
    assert(updatedProd2B.stockQuantity === 12, `Prod B stock reduced from 15 to 12 (Actual: ${updatedProd2B.stockQuantity})`);

    // -------------------------------------------------------------
    // Test 3: Insufficient Stock (Stock = 2, Try selling 5)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Insufficient Stock (Rejection & Immutability) ---');
    const prod3 = await createProduct(userA, {
      name: 'Low Stock Jam',
      sku: `JAM-${Date.now()}`,
      buyingPrice: 120,
      sellingPrice: 150,
      stockQuantity: 2,
    });

    const sale3Res = await createSale(userA, {
      items: [{ productId: prod3.id, quantity: 5, itemDiscount: 0 }],
      paymentMethod: 'cash',
      amountReceived: 1000,
    });

    assert(!sale3Res.ok, 'Sale 3 correctly rejected due to insufficient stock');
    assert(sale3Res.status === 400, 'Returns 400 Bad Request');
    assert(sale3Res.data.message === 'Insufficient stock', 'Response message is "Insufficient stock"');
    assert(sale3Res.data.availableStock === 2, `Reports availableStock: 2 (Actual: ${sale3Res.data.availableStock})`);
    assert(sale3Res.data.requestedQuantity === 5, `Reports requestedQuantity: 5 (Actual: ${sale3Res.data.requestedQuantity})`);

    const updatedProd3 = await getProduct(userA, prod3.id);
    assert(updatedProd3.stockQuantity === 2, `Stock strictly remained 2 (Actual: ${updatedProd3.stockQuantity})`);

    // -------------------------------------------------------------
    // Test 4: Cash Payment & Change Calculation
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Cash Payment & Change Calculation ---');
    const prod4 = await createProduct(userA, {
      name: 'Item Rs 1500',
      sku: `ITEM1500-${Date.now()}`,
      buyingPrice: 1000,
      sellingPrice: 1500,
      stockQuantity: 5,
    });

    const sale4Res = await createSale(userA, {
      items: [{ productId: prod4.id, quantity: 1 }],
      paymentMethod: 'cash',
      amountReceived: 2000,
    });

    assert(sale4Res.ok, 'Sale 4 completed');
    assert(sale4Res.data.sale.grandTotal === 1500, 'Grand Total is Rs. 1500');
    assert(sale4Res.data.sale.amountReceived === 2000, 'Amount Received is Rs. 2000');
    assert(sale4Res.data.sale.changeAmount === 500, `Change is Rs. 500 (Actual: ${sale4Res.data.sale.changeAmount})`);

    // -------------------------------------------------------------
    // Test 5: Insufficient Payment Rejection
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Insufficient Cash Tendered ---');
    const sale5Res = await createSale(userA, {
      items: [{ productId: prod4.id, quantity: 1 }],
      paymentMethod: 'cash',
      amountReceived: 1000, // Grand total is 1500!
    });

    assert(!sale5Res.ok, 'Sale 5 rejected due to insufficient payment');
    assert(sale5Res.status === 400, 'Returns 400 Bad Request');

    const updatedProd4 = await getProduct(userA, prod4.id);
    assert(updatedProd4.stockQuantity === 4, `Stock unchanged after rejected sale (Actual: ${updatedProd4.stockQuantity})`);

    // -------------------------------------------------------------
    // Test 6: Discounts (Percentage & Fixed Amount)
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Discounts (Percentage & Fixed Amount) ---');
    const prod6 = await createProduct(userA, {
      name: 'Item Rs 2000',
      sku: `ITEM2000-${Date.now()}`,
      buyingPrice: 1200,
      sellingPrice: 2000,
      stockQuantity: 10,
    });

    // 10% discount on 2000 -> 200 discount -> grandTotal = 1800
    const sale6PercRes = await createSale(userA, {
      items: [{ productId: prod6.id, quantity: 1 }],
      discountType: 'percentage',
      discountValue: 10,
      paymentMethod: 'cash',
      amountReceived: 1800,
    });

    assert(sale6PercRes.ok, 'Percentage discount sale created');
    assert(sale6PercRes.data.sale.discountAmount === 200, `Discount amount is 200 (Actual: ${sale6PercRes.data.sale.discountAmount})`);
    assert(sale6PercRes.data.sale.grandTotal === 1800, `Grand total is 1800 (Actual: ${sale6PercRes.data.sale.grandTotal})`);

    // Fixed amount discount: 250 off 2000 -> 1750
    const sale6FixedRes = await createSale(userA, {
      items: [{ productId: prod6.id, quantity: 1 }],
      discountType: 'amount',
      discountValue: 250,
      paymentMethod: 'card',
    });

    assert(sale6FixedRes.ok, 'Fixed discount sale created');
    assert(sale6FixedRes.data.sale.discountAmount === 250, 'Discount amount is 250');
    assert(sale6FixedRes.data.sale.grandTotal === 1750, 'Grand total is 1750');

    // -------------------------------------------------------------
    // Test 7: Invoice Number Sequence & Format
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Sequential Invoice Numbers ---');
    const invoiceNumbers = [
      sale1Res.data.sale.invoiceNumber,
      sale2Res.data.sale.invoiceNumber,
      sale4Res.data.sale.invoiceNumber,
      sale6PercRes.data.sale.invoiceNumber,
      sale6FixedRes.data.sale.invoiceNumber,
    ];

    console.log(`Generated sequence: ${invoiceNumbers.join(', ')}`);
    assert(
      invoiceNumbers.every((inv) => /^INV-\d{6}$/.test(inv)),
      'All invoice numbers match INV-XXXXXX format'
    );
    const uniqueInvoices = new Set(invoiceNumbers);
    assert(uniqueInvoices.size === invoiceNumbers.length, 'No duplicate invoice numbers generated');
    assert(invoiceNumbers[0] === 'INV-000001', `First invoice starts at INV-000001 (Actual: ${invoiceNumbers[0]})`);
    assert(invoiceNumbers[1] === 'INV-000002', `Second invoice is INV-000002 (Actual: ${invoiceNumbers[1]})`);

    // -------------------------------------------------------------
    // Test 8: Historical Snapshot Immutability (Price edit after sale)
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Historical Price Snapshot Immutability ---');
    const prod8 = await createProduct(userA, {
      name: 'Price Shift Product',
      sku: `PRICE-${Date.now()}`,
      buyingPrice: 60,
      sellingPrice: 100,
      stockQuantity: 10,
    });

    const sale8Res = await createSale(userA, {
      items: [{ productId: prod8.id, quantity: 1 }],
      paymentMethod: 'card',
    });
    const sale8Id = sale8Res.data.sale.id;

    // Now edit the product price to Rs. 120
    await fetch(`${API_BASE}/products/${prod8.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({ sellingPrice: 120 }),
    });

    // Verify current product price changed
    const freshProd8 = await getProduct(userA, prod8.id);
    assert(freshProd8.sellingPrice === 120, `Product price edited to Rs. 120 (Actual: ${freshProd8.sellingPrice})`);

    // Re-fetch the historical sale from GET /api/sales/:id
    const sale8Fetch = await fetch(`${API_BASE}/sales/${sale8Id}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const sale8Data = await sale8Fetch.json();
    assert(sale8Data.sale.items[0].unitPrice === 100, `Old sale snapshot still records unitPrice = 100 (Actual: ${sale8Data.sale.items[0].unitPrice})`);
    assert(sale8Data.sale.grandTotal === 100, `Old sale grand total remains 100 (Actual: ${sale8Data.sale.grandTotal})`);

    // -------------------------------------------------------------
    // Test 9: Multi-Tenant Cross-Shop Isolation
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Cross-Shop Tenant Isolation ---');
    const userB = await createTestUser('ShopB');

    // 9a: User B attempts to sell User A's product
    const crossSaleRes = await createSale(userB, {
      items: [{ productId: prod1.id, quantity: 1 }],
      paymentMethod: 'card',
    });
    assert(!crossSaleRes.ok, 'Cross-shop sale attempt rejected');
    assert(crossSaleRes.status === 403, `Returns 403 Forbidden (Actual: ${crossSaleRes.status})`);

    // 9b: User B attempts to view User A's sale by ID
    const crossGetRes = await fetch(`${API_BASE}/sales/${sale1Res.data.sale.id}`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    assert(crossGetRes.status === 403, `Direct access to other shop sale returns 403 (Actual: ${crossGetRes.status})`);

    // 9c: User B sales list does not contain User A sales
    const userBSalesRes = await fetch(`${API_BASE}/sales`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    const userBSalesData = await userBSalesRes.json();
    assert(
      !userBSalesData.sales.some((s) => s.id === sale1Res.data.sale.id),
      'User B sales history list does not contain any of User A sales'
    );

    // -------------------------------------------------------------
    // Test 10: Protection against Tampered Frontend Prices
    // -------------------------------------------------------------
    console.log('\n--- Test 10: Tampered Frontend Price Resistance ---');
    const prod10 = await createProduct(userA, {
      name: 'Expensive Item',
      sku: `EXP-${Date.now()}`,
      buyingPrice: 800,
      sellingPrice: 1000,
      stockQuantity: 5,
    });

    // Malicious request attempts to pass unitPrice = 1, grandTotal = 1, shopId = 'hacked'
    const tamperedSaleRes = await createSale(userA, {
      items: [{ productId: prod10.id, quantity: 1, unitPrice: 1 }],
      shopId: 'malicious-shop',
      cashierId: 'fake-cashier',
      grandTotal: 1,
      paymentMethod: 'cash',
      amountReceived: 1000,
    });

    assert(tamperedSaleRes.ok, 'Sale created with authoritative recalculation');
    assert(
      tamperedSaleRes.data.sale.items[0].unitPrice === 1000,
      `Backend used Firestore price Rs. 1000, ignoring fake client unitPrice = 1 (Actual: ${tamperedSaleRes.data.sale.items[0].unitPrice})`
    );
    assert(
      tamperedSaleRes.data.sale.grandTotal === 1000,
      `Backend calculated grand total Rs. 1000, ignoring fake grandTotal = 1 (Actual: ${tamperedSaleRes.data.sale.grandTotal})`
    );
    assert(
      tamperedSaleRes.data.sale.shopId === userA.shop.id,
      `Backend enforced authoritative shopId ${userA.shop.id}, ignoring malicious shopId`
    );

    // -------------------------------------------------------------
    // Test 11: Concurrent Stock Safety
    // -------------------------------------------------------------
    console.log('\n--- Test 11: Concurrent Stock Safety (Stock = 5, Req A = 4, Req B = 4) ---');
    const prod11 = await createProduct(userA, {
      name: 'Limited Edition Widget',
      sku: `LIMITED-${Date.now()}`,
      buyingPrice: 100,
      sellingPrice: 150,
      stockQuantity: 5,
    });

    // Dispatch two checkout requests concurrently
    const [reqA, reqB] = await Promise.all([
      createSale(userA, {
        items: [{ productId: prod11.id, quantity: 4 }],
        paymentMethod: 'card',
      }),
      createSale(userA, {
        items: [{ productId: prod11.id, quantity: 4 }],
        paymentMethod: 'card',
      }),
    ]);

    const reqASucceeded = reqA.ok;
    const reqBSucceeded = reqB.ok;

    assert(
      (reqASucceeded && !reqBSucceeded) || (!reqASucceeded && reqBSucceeded),
      `Exactly one of the concurrent checkouts succeeded (ReqA: ${reqASucceeded}, ReqB: ${reqBSucceeded})`
    );

    const updatedProd11 = await getProduct(userA, prod11.id);
    assert(updatedProd11.stockQuantity >= 0, `Final stock is non-negative: ${updatedProd11.stockQuantity}`);
    assert(updatedProd11.stockQuantity === 1, `Final stock correctly reduced from 5 to 1 (Actual: ${updatedProd11.stockQuantity})`);

    // -------------------------------------------------------------
    // Test 12: Existing Functionality Intact
    // -------------------------------------------------------------
    console.log('\n--- Test 12: Existing Functionality Verification ---');
    // Health check
    const healthRes = await fetch('http://localhost:5000/api/health');
    const healthData = await healthRes.json();
    assert(healthData.success === true, 'GET /api/health is OK (success: true)');

    // Barcode lookup
    const barcodeLookupRes = await fetch(`${API_BASE}/products/barcode/${prod1.barcode}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const barcodeLookupData = await barcodeLookupRes.json();
    assert(barcodeLookupData.success && barcodeLookupData.product.id === prod1.id, 'Product barcode lookup works');

    // Sales list endpoint
    const salesListRes = await fetch(`${API_BASE}/sales`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const salesListData = await salesListRes.json();
    assert(salesListData.success && salesListData.sales.length > 0, `GET /api/sales returns ${salesListData.sales.length} sales`);

    console.log('\n======================================================');
    console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error in test runner:', err);
    process.exit(1);
  }
}

runTestSuite();
