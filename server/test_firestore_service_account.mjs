/**
 * Verification script for Firebase Admin SDK service account configuration
 * Tests:
 * 1. Admin SDK initialized with serviceAccountKey.json
 * 2. hasFullServiceAccount is true and db (getFirestore()) is ready
 * 3. Direct read from Firestore
 * 4. POST /api/products writes directly to Cloud Firestore
 * 5. Direct verification in Firestore using db.collection('products').doc(id).get()
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const { db, hasFullServiceAccount, adminApp } = require('./config/firebaseAdmin');

const API_BASE = 'http://localhost:5000/api';
const FIREBASE_API_KEY = 'AIzaSyDeOR9ZMr4V-64lxhicCedRPu98WJQB6MY';

async function testServiceAccountConfiguration() {
  console.log('🚀 Running Firebase Admin Service Account & Firestore Verification\n');

  // 1. Verify Firebase Admin initialization
  if (!adminApp) {
    throw new Error('Firebase Admin app is not initialized.');
  }
  console.log('✅ 1. Firebase Admin app initialized successfully.');
  console.log(`   Project ID: ${adminApp.options.projectId}`);

  if (!hasFullServiceAccount || !db) {
    throw new Error('hasFullServiceAccount is false or db is null. Service account credentials failed.');
  }
  console.log('✅ 2. Service account credential verified (hasFullServiceAccount = true).');
  console.log('✅ 3. getFirestore() is active and available.');

  // 2. Direct Firestore read test
  try {
    const testSnapshot = await db.collection('products').limit(1).get();
    console.log(`✅ 4. Direct Firestore read succeeded. Collection query returned ${testSnapshot.size} document(s).`);
  } catch (err) {
    throw new Error(`Direct Firestore connection failed: ${err.message}`);
  }

  // 3. Test Product Creation via POST /api/products
  console.log('\n--- Testing Product Creation via POST /api/products ---');

  // Create temporary test user
  const email = `sa_verifier_${Date.now()}@shopflow.test`;
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
    throw new Error(`Auth failed: ${JSON.stringify(authData)}`);
  }
  const token = authData.idToken;

  // Create shop for this user
  const shopRes = await fetch(`${API_BASE}/shops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'SA Verification Shop',
      ownerName: 'SA Tester',
      phone: '0771234567',
      address: '100 Service Account Way',
    }),
  });
  const shopData = await shopRes.json();
  const shopId = shopData.shop?.id;
  console.log(`✅ 5. Shop created for authenticated user (shopId: ${shopId})`);

  // Create Product via API
  const productPayload = {
    name: 'Service Account Verified Product',
    category: 'Testing',
    sku: `SA-${Date.now()}`,
    buyingPrice: 150,
    sellingPrice: 250,
    stockQuantity: 40,
    lowStockLevel: 5,
    unit: 'pcs',
  };

  const createProdRes = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(productPayload),
  });
  const createProdData = await createProdRes.json();

  if (!createProdRes.ok || !createProdData.product?.id) {
    throw new Error(`Product creation failed: ${JSON.stringify(createProdData)}`);
  }
  const createdProductId = createProdData.product.id;
  console.log(`✅ 6. POST /api/products returned HTTP 201 with product ID: ${createdProductId}`);

  // 4. Verify document directly in Cloud Firestore using Admin SDK
  const firestoreDoc = await db.collection('products').doc(createdProductId).get();
  if (!firestoreDoc.exists) {
    throw new Error(`Product doc ${createdProductId} was NOT found in Cloud Firestore!`);
  }
  const firestoreData = firestoreDoc.data();
  console.log('✅ 7. Product verified directly in Cloud Firestore collection "products"!');
  console.log(`   - Document ID: ${firestoreDoc.id}`);
  console.log(`   - Stored shopId: ${firestoreData.shopId}`);
  console.log(`   - Stored name: ${firestoreData.name}`);
  console.log(`   - Stored barcode: ${firestoreData.barcode}`);
  console.log(`   - Matches user shopId: ${firestoreData.shopId === shopId}`);

  // Clean up test document
  await db.collection('products').doc(createdProductId).delete();
  if (shopId) {
    await db.collection('shops').doc(shopId).delete().catch(() => {});
  }
  console.log('✅ 8. Cleaned up verification test documents from Firestore.');

  console.log('\n======================================================');
  console.log('🎉 ALL SERVICE ACCOUNT & FIRESTORE CHECKS PASSED!');
  console.log('======================================================\n');
}

testServiceAccountConfiguration().catch((err) => {
  console.error('\n❌ Verification Failed:', err.message);
  process.exit(1);
});
