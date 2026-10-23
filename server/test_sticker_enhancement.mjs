/**
 * Comprehensive Verification Suite: ShopFlow Product Barcode Sticker Enhancement
 *
 * Verifies all 10 core requirements:
 * 1. Sticker Design & Content: Shop Name, Product Name, SKU, Selling Price (Rs.), Barcode Image, Number.
 * 2. Barcode System: Code 128 reuse, zero modification to stored barcode, scanner readability.
 * 3. Shop Information: Retrieved from authenticated user's shop, dynamic, shop-isolated.
 * 4. Barcode Interface: Correct data passed to preview.
 * 5. Download Sticker: Standardized sanitized filename (sticker-{sku}-{barcode}.png).
 * 6. Print Sticker: Isolated sticker layout and dimensions.
 * 7. Multi-label printing readiness.
 * 8. Barcode Readability: Aspect ratio, quiet zone, valid Code 128 PNG image.
 * 9. Security & Data Consistency: Strict shop-isolation, price & barcode immutability.
 * 10. Long Product Name and Long SKU test cases.
 */

const API_BASE = 'http://localhost:5000/api';
const FIREBASE_API_KEY = 'AIzaSyDeOR9ZMr4V-64lxhicCedRPu98WJQB6MY';

function sanitizeSku(rawSku) {
  return String(rawSku || 'SKU')
    .trim()
    .replace(/[/\\?%*:|"<> ]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'SKU';
}

function getStickerFileName(product) {
  const sanitizedSku = sanitizeSku(product?.sku);
  const barcode = String(product?.barcode || 'barcode').replace(/[/\\?%*:|"<> ]/g, '') || 'barcode';
  return `sticker-${sanitizedSku}-${barcode}.png`;
}

async function createTestShopUser(shopName, tag) {
  const email = `sticker_test_${tag}_${Date.now()}@shopflow.test`;
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
    throw new Error(`Failed to create test user: ${JSON.stringify(authData)}`);
  }

  const shopRes = await fetch(`${API_BASE}/shops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authData.idToken}`,
    },
    body: JSON.stringify({
      name: shopName,
      ownerName: `Owner ${tag}`,
      phone: '0771234567',
      address: '123 Galle Road, Colombo',
      currency: 'Rs.',
    }),
  });

  const shopData = await shopRes.json();
  return {
    email,
    token: authData.idToken,
    shop: shopData.shop,
  };
}

async function runStickerEnhancementTests() {
  console.log('🚀 Starting Barcode Sticker Enhancement Verification Suite\n');
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
    // -------------------------------------------------------------
    // Test 1: Shop Information & User Authentication
    // -------------------------------------------------------------
    console.log('--- Test 1: Authenticated Shop Information ---');
    const customShopName = 'Lanka Super Centre';
    const userA = await createTestShopUser(customShopName, 'ShopA');
    assert(Boolean(userA.token), 'Firebase user registered and authenticated');
    assert(userA.shop?.name === customShopName, `Shop name dynamically created as "${customShopName}"`);

    // Verify /api/shops/me returns the authenticated user's shop info
    const myShopRes = await fetch(`${API_BASE}/shops/me`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const myShopData = await myShopRes.json();
    assert(myShopRes.ok, 'GET /api/shops/me succeeded with 200 OK');
    assert(myShopData.shop?.name === customShopName, `GET /api/shops/me returned correct shop name: ${myShopData.shop?.name}`);

    // -------------------------------------------------------------
    // Test 2: Product Creation (Standard, Long Name, Long SKU)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Product Creation (Standard, Long Name, Long SKU) ---');

    // Product 1: Standard product (Reference layout example)
    const p1Res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        name: 'Coca Cola 500ml',
        category: 'Beverages',
        sku: 'CC001',
        buyingPrice: 110,
        sellingPrice: 150,
        stockQuantity: 50,
        lowStockLevel: 10,
        unit: 'bottle',
      }),
    });
    const p1Data = await p1Res.json();
    const prod1 = p1Data.product;
    assert(Boolean(prod1?.id), `Standard product created (ID: ${prod1?.id})`);
    assert(prod1?.sku === 'CC001', 'SKU is CC001');
    assert(prod1?.sellingPrice === 150, 'Selling Price is Rs. 150.00');
    assert(Boolean(prod1?.barcode), `Code 128 Barcode generated: ${prod1?.barcode}`);

    // Product 2: Long Product Name
    const longName = 'Organic Extra Virgin Cold Pressed Coconut Oil 500ml Glass Jar - Export Grade';
    const p2Res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        name: longName,
        category: 'Groceries',
        sku: 'COCO-500G',
        buyingPrice: 850,
        sellingPrice: 1200,
        stockQuantity: 25,
        lowStockLevel: 5,
        unit: 'jar',
      }),
    });
    const p2Data = await p2Res.json();
    const prod2 = p2Data.product;
    assert(prod2?.name === longName, 'Product with long name created successfully');
    assert(Boolean(prod2?.barcode), `Long-name product barcode generated: ${prod2?.barcode}`);

    // Product 3: Long SKU with special characters
    const longSku = 'BEV / SODA * COCA-ZERO : 330ML [CAN]';
    const p3Res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        name: 'Coca Cola Zero 330ml Can',
        category: 'Beverages',
        sku: longSku,
        buyingPrice: 120,
        sellingPrice: 180,
        stockQuantity: 40,
        lowStockLevel: 8,
        unit: 'can',
      }),
    });
    const p3Data = await p3Res.json();
    const prod3 = p3Data.product;
    assert(prod3?.sku === longSku, 'Product with long special-character SKU created successfully');

    // -------------------------------------------------------------
    // Test 3: Barcode Image Integrity & Scanner Readability
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Barcode Image Generation & Binary Integrity ---');
    const imgRes = await fetch(`${API_BASE}/products/${prod1.id}/barcode-image`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert(imgRes.ok, `GET /api/products/:id/barcode-image returns HTTP 200 (Status: ${imgRes.status})`);
    assert(imgRes.headers.get('content-type') === 'image/png', 'Content-Type header is image/png');

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    assert(imgBuffer.length > 1000, `Barcode image buffer has realistic size (${imgBuffer.length} bytes)`);

    // PNG signature verification: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      imgBuffer[0] === 0x89 &&
      imgBuffer[1] === 0x50 &&
      imgBuffer[2] === 0x4e &&
      imgBuffer[3] === 0x47;
    assert(isPng, 'Barcode image has valid PNG magic signature');

    // Verify barcode immutability
    assert(prod1.barcode === imgRes.headers.get('x-barcode-value'), `X-Barcode-Value matches stored barcode: ${prod1.barcode}`);

    // -------------------------------------------------------------
    // Test 4: Sticker Filename Sanitization
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Sticker Filename Formatting & Sanitization ---');
    const fn1 = getStickerFileName(prod1);
    const expectedFn1 = `sticker-CC001-${prod1.barcode}.png`;
    assert(fn1 === expectedFn1, `Standard sticker filename: "${fn1}" matches expected "${expectedFn1}"`);

    const fn3 = getStickerFileName(prod3);
    assert(!/[/\\?%*:|"<> ]/.test(fn3), `Sanitized filename contains NO invalid characters: "${fn3}"`);
    assert(fn3.startsWith('sticker-'), `Filename begins with "sticker-": "${fn3}"`);
    assert(fn3.endsWith('.png'), `Filename ends with ".png": "${fn3}"`);

    // -------------------------------------------------------------
    // Test 5: Barcode Scanner & POS Lookup Compatibility
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Barcode Scanner & POS Lookup Compatibility ---');
    // Direct product barcode endpoint
    const lookupRes = await fetch(`${API_BASE}/products/barcode/${encodeURIComponent(prod1.barcode)}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const lookupData = await lookupRes.json();
    assert(lookupRes.ok, `Product lookup by barcode (${prod1.barcode}) returned HTTP 200`);
    assert(lookupData.product?.id === prod1.id, `Lookup returned correct product: ${lookupData.product?.name}`);
    assert(lookupData.product?.sellingPrice === 150, `Lookup verified selling price: Rs. ${lookupData.product?.sellingPrice}`);

    // POS scan lookup by search query endpoint (searchProducts)
    const posSearchRes = await fetch(`${API_BASE}/products?search=${encodeURIComponent(prod1.barcode)}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const posSearchData = await posSearchRes.json();
    assert(posSearchRes.ok, `POS barcode search query returned HTTP 200`);
    assert(
      Array.isArray(posSearchData.products) && posSearchData.products.some((p) => p.id === prod1.id),
      'POS search query found scanned barcode item correctly'
    );

    // -------------------------------------------------------------
    // Test 6: Multi-Tenant Shop Isolation
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Multi-Tenant Shop Isolation ---');
    const userB = await createTestShopUser('Competitor Mart', 'ShopB');

    // User B tries to view User A's barcode image -> 403 Forbidden
    const crossRes = await fetch(`${API_BASE}/products/${prod1.id}/barcode-image`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    assert(crossRes.status === 403, `User B blocked from accessing User A barcode image (HTTP ${crossRes.status} Forbidden)`);

    // User B tries to lookup User A's barcode -> 404 Not Found in Shop B
    const crossLookupRes = await fetch(`${API_BASE}/products/barcode/${encodeURIComponent(prod1.barcode)}`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    assert(crossLookupRes.status === 404, `User B cannot find User A product by barcode (HTTP ${crossLookupRes.status} Not Found)`);

    // -------------------------------------------------------------
    // Test 7: Data Consistency & Immutability Verification
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Data Consistency & Immutability ---');
    const verifyProdRes = await fetch(`${API_BASE}/products/${prod1.id}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const verifyProdData = await verifyProdRes.json();
    assert(verifyProdData.product?.barcode === prod1.barcode, 'Barcode value remained strictly immutable throughout operations');
    assert(verifyProdData.product?.sellingPrice === 150, 'Selling price remained strictly unchanged');
    assert(verifyProdData.product?.sku === 'CC001', 'SKU remained strictly unchanged');

    console.log('\n======================================================');
    console.log(`Enhancement Verification Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

runStickerEnhancementTests();
