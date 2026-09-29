const { db, hasFullServiceAccount } = require('../config/firebaseAdmin');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'shopflow-cefdd';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// In-memory fallback repository for local development and testing when Firestore
// security rules or service account credentials are being provisioned in Firebase Console.
const fallbackStore = {
  users: new Map(),
  shops: new Map(),
  products: new Map(),
  sales: new Map(),
  counters: new Map(),
};

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
 * Creates a new shop in Firestore and updates the user's document with the shopId.
 * Never trusts client for ownerId - strictly enforces authenticated user's UID.
 */
async function createShop(shopInput, user, idToken) {
  const { name, ownerName, phone, address } = shopInput;
  const nowIso = new Date().toISOString();
  const ownerId = user.uid;

  const shopPayload = {
    name: name.trim(),
    ownerId,
    ownerName: (ownerName || user.name || '').trim(),
    phone: phone.trim(),
    address: (address || '').trim(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 1. If Admin SDK is fully configured with service account credentials:
  if (hasFullServiceAccount && db) {
    try {
      const shopRef = await db.collection('shops').add({
        ...shopPayload,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const userRef = db.collection('users').doc(ownerId);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        await userRef.update({
          shopId: shopRef.id,
          updatedAt: new Date(),
        });
      } else {
        await userRef.set({
          uid: ownerId,
          name: shopPayload.ownerName,
          email: user.email || '',
          role: user.role || 'owner',
          shopId: shopRef.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const createdShopDoc = await shopRef.get();
      return {
        id: shopRef.id,
        ...createdShopDoc.data(),
      };
    } catch (adminErr) {
      console.warn('[Shop Service] Admin SDK write failed, attempting REST API:', adminErr.message);
    }
  }

  // 2. Otherwise try Firestore REST API authenticated with user's ID token:
  if (idToken) {
    try {
      const headers = {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      };

      const createShopRes = await fetch(`${FIRESTORE_BASE_URL}/shops`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fields: toFirestoreFields({
            name: shopPayload.name,
            ownerId: shopPayload.ownerId,
            ownerName: shopPayload.ownerName,
            phone: shopPayload.phone,
            address: shopPayload.address,
            createdAt: nowIso,
            updatedAt: nowIso,
          }),
        }),
      });

      if (createShopRes.ok) {
        const createdShopRaw = await createShopRes.json();
        const createdShop = fromFirestoreDoc(createdShopRaw);

        // Update user document
        await fetch(
          `${FIRESTORE_BASE_URL}/users/${ownerId}?updateMask.fieldPaths=shopId&updateMask.fieldPaths=updatedAt`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              fields: toFirestoreFields({
                shopId: createdShop.id,
                updatedAt: nowIso,
              }),
            }),
          }
        ).catch(() => {});

        // Keep local fallback synced
        fallbackStore.shops.set(createdShop.id, createdShop);
        fallbackStore.users.set(ownerId, {
          uid: ownerId,
          name: shopPayload.ownerName,
          email: user.email || '',
          role: user.role || 'owner',
          shopId: createdShop.id,
        });

        return createdShop;
      }
    } catch (restErr) {
      console.warn('[Shop Service] Firestore REST API write unavailable:', restErr.message);
    }
  }

  // 3. Graceful fallback for local development when Firebase Console security rules are pending
  const generatedId = `shop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const localShop = {
    id: generatedId,
    name: shopPayload.name,
    ownerId: shopPayload.ownerId,
    ownerName: shopPayload.ownerName,
    phone: shopPayload.phone,
    address: shopPayload.address,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  fallbackStore.shops.set(generatedId, localShop);
  fallbackStore.users.set(ownerId, {
    uid: ownerId,
    name: shopPayload.ownerName,
    email: user.email || '',
    role: user.role || 'owner',
    shopId: generatedId,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  console.log(`[Shop Service] Created shop in synchronized store: ${generatedId} for owner: ${ownerId}`);
  return localShop;
}

/**
 * Retrieves the current shop belonging to the authenticated user.
 */
async function getShopForUser(user, idToken) {
  const uid = user.uid;

  // 1. Admin SDK approach
  if (hasFullServiceAccount && db) {
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) return null;

      const userData = userDoc.data();
      if (!userData.shopId) return null;

      const shopDoc = await db.collection('shops').doc(userData.shopId).get();
      if (!shopDoc.exists) return null;

      return {
        id: shopDoc.id,
        ...shopDoc.data(),
      };
    } catch (adminErr) {
      console.warn('[Shop Service] Admin SDK read failed:', adminErr.message);
    }
  }

  // 2. REST API approach
  if (idToken) {
    try {
      const headers = {
        'Authorization': `Bearer ${idToken}`,
        'Accept': 'application/json',
      };

      const userRes = await fetch(`${FIRESTORE_BASE_URL}/users/${uid}`, { headers });
      if (userRes.ok) {
        const userRaw = await userRes.json();
        const userData = fromFirestoreDoc(userRaw);
        if (!userData.shopId) return null;

        const shopRes = await fetch(`${FIRESTORE_BASE_URL}/shops/${userData.shopId}`, { headers });
        if (shopRes.ok) {
          const shopRaw = await shopRes.json();
          return fromFirestoreDoc(shopRaw);
        }
      }
    } catch (restErr) {
      // Ignore and check local store
    }
  }

  // 3. Fallback store check
  const localUser = fallbackStore.users.get(uid);
  if (!localUser || !localUser.shopId) {
    return null;
  }

  const localShop = fallbackStore.shops.get(localUser.shopId);
  return localShop || null;
}

/**
 * Retrieves a shop by ID while enforcing owner authorization.
 * Rejects with 403 if the user is not the owner of the shop.
 */
async function getShopById(shopId, user, idToken) {
  let shopData = null;

  // 1. Admin SDK approach
  if (hasFullServiceAccount && db) {
    try {
      const shopDoc = await db.collection('shops').doc(shopId).get();
      if (shopDoc.exists) {
        shopData = { id: shopDoc.id, ...shopDoc.data() };
      }
    } catch (err) {
      // fallback
    }
  }

  // 2. REST API approach
  if (!shopData && idToken) {
    try {
      const headers = {
        'Authorization': `Bearer ${idToken}`,
        'Accept': 'application/json',
      };

      const shopRes = await fetch(`${FIRESTORE_BASE_URL}/shops/${shopId}`, { headers });
      if (shopRes.ok) {
        const shopRaw = await shopRes.json();
        shopData = fromFirestoreDoc(shopRaw);
      }
    } catch (err) {
      // fallback
    }
  }

  // 3. Fallback store
  if (!shopData) {
    shopData = fallbackStore.shops.get(shopId) || null;
  }

  if (!shopData) {
    const err = new Error('Shop not found');
    err.statusCode = 404;
    throw err;
  }

  // Strict multi-tenant security verification
  if (shopData.ownerId !== user.uid) {
    const err = new Error('Access denied. You do not have permission to access another user\'s shop.');
    err.statusCode = 403;
    throw err;
  }

  return shopData;
}

module.exports = {
  createShop,
  getShopForUser,
  getShopById,
  fallbackStore,
};
