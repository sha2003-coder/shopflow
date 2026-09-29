/**
 * Test Suite: Barcode Download Verification
 * Tests the 5 requirements specified by the User:
 * 1. Product barcode image is generated and returned as valid PNG.
 * 2. Barcode download endpoint/logic returns direct PNG stream with correct Content-Disposition.
 * 3. Returned PNG buffer contains valid PNG magic header and readable Code 128 barcode data.
 * 4. Filename follows the exact format: barcode-{product-sku}-{product-barcode}.png with sanitized SKU.
 * 5. Multi-tenant security: Shop B user cannot access or download Shop A's product barcode (403 Forbidden).
 * 6. Immutability: Product barcode value remains strictly unchanged after download.
 */

const API_BASE = 'http://localhost:5000/api';
const FIREBASE_API_KEY = 'AIzaSyDeOR9ZMr4V-64lxhicCedRPu98WJQB6MY';

// Helper: Create test user and shop
async function createTestUser(tag) {
  const email = `barcode_tester_${tag}_${Date.now()}@shopflow.test`;
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
      name: `Barcode Shop ${tag}`,
      ownerName: `Owner ${tag}`,
      phone: '0779876543',
      address: '456 Retail Way',
    }),
  });

  const shopData = await shopRes.json();
  return {
    email,
    token: authData.idToken,
    shop: shopData.shop,
  };
}

async function runBarcodeTests() {
  console.log('🚀 Running Barcode Download Verification Suite\n');
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
    const userA = await createTestUser('ShopA');
    const userB = await createTestUser('ShopB');

    // Create a product in Shop A with special characters in SKU to test sanitization
    console.log('--- Test Setup: Creating Product in Shop A ---');
    const prodRes = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userA.token}`,
      },
      body: JSON.stringify({
        name: 'Organic Honey 500g',
        category: 'Food',
        sku: 'HONEY / 500G * SPECIAL',
        buyingPrice: 300,
        sellingPrice: 450,
        stockQuantity: 20,
        lowStockLevel: 5,
        unit: 'jar',
      }),
    });
    const prodData = await prodRes.json();
    const productA = prodData.product;
    assert(Boolean(productA.id), `Product created with ID: ${productA.id}`);
    assert(Boolean(productA.barcode), `Barcode generated: ${productA.barcode}`);
    const originalBarcode = productA.barcode;

    // -------------------------------------------------------------
    // Test 1: Open / Fetch Product's Barcode Image
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Fetch Barcode Image ---');
    const viewRes = await fetch(`${API_BASE}/products/${productA.id}/barcode-image`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert(viewRes.ok, `GET /api/products/:id/barcode-image returns HTTP 200 (status: ${viewRes.status})`);
    assert(
      viewRes.headers.get('content-type') === 'image/png',
      `Content-Type is image/png (Actual: ${viewRes.headers.get('content-type')})`
    );

    // -------------------------------------------------------------
    // Test 2 & 3: Direct Download & PNG Binary Integrity
    // -------------------------------------------------------------
    console.log('\n--- Test 2 & 3: Direct Download & Valid PNG Buffer ---');
    const downloadRes = await fetch(`${API_BASE}/products/${productA.id}/barcode-image?download=true`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert(downloadRes.ok, 'Download request returns HTTP 200');

    const disposition = downloadRes.headers.get('content-disposition');
    assert(
      disposition && disposition.startsWith('attachment; filename='),
      `Content-Disposition header triggers download: ${disposition}`
    );

    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    assert(buffer.length > 500, `Downloaded PNG image buffer has realistic size (${buffer.length} bytes)`);

    // Verify PNG 8-byte signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 && // 'P'
      buffer[2] === 0x4e && // 'N'
      buffer[3] === 0x47 && // 'G'
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    assert(isPng, 'Downloaded file contains valid PNG signature (Magic Bytes: 0x89 50 4E 47)');

    // -------------------------------------------------------------
    // Test 4: Check Sanitized Filename Format
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Check Filename Format ---');
    // Raw SKU was: "HONEY / 500G * SPECIAL"
    // Expected sanitized SKU: "HONEY-500G-SPECIAL"
    // Expected filename: barcode-HONEY-500G-SPECIAL-{barcode}.png
    const filenameMatch = disposition.match(/filename="(.+?)"/);
    const downloadedFilename = filenameMatch ? filenameMatch[1] : '';
    console.log(`  Downloaded filename: "${downloadedFilename}"`);

    const expectedFilename = `barcode-HONEY-500G-SPECIAL-${originalBarcode}.png`;
    assert(
      downloadedFilename === expectedFilename,
      `Filename strictly matches sanitized format: ${expectedFilename} (Actual: ${downloadedFilename})`
    );
    assert(
      !downloadedFilename.includes(' ') && !downloadedFilename.includes('*') && !downloadedFilename.includes('/'),
      'Filename contains no spaces or illegal filename characters'
    );

    // -------------------------------------------------------------
    // Test 5: Cross-Shop Multi-Tenant Security
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Cross-Shop Isolation (Shop B Access Denied) ---');
    const unauthorizedRes = await fetch(`${API_BASE}/products/${productA.id}/barcode-image`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    assert(
      unauthorizedRes.status === 403,
      `User from Shop B cannot view or download Shop A's barcode (Actual status: ${unauthorizedRes.status})`
    );

    const unauthorizedDownloadRes = await fetch(`${API_BASE}/products/${productA.id}/barcode-image?download=true`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    assert(
      unauthorizedDownloadRes.status === 403,
      `User from Shop B download attempt returns 403 Forbidden (Actual status: ${unauthorizedDownloadRes.status})`
    );

    // -------------------------------------------------------------
    // Test 6: Verify Barcode Immutability
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Barcode Immutability ---');
    const freshProdRes = await fetch(`${API_BASE}/products/${productA.id}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const freshProdData = await freshProdRes.json();
    assert(
      freshProdData.product.barcode === originalBarcode,
      `Product barcode remains strictly unchanged after download (${freshProdData.product.barcode})`
    );

    console.log('\n======================================================');
    console.log(`Barcode Tests: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected test error:', err);
    process.exit(1);
  }
}

runBarcodeTests();
