const admin = require('firebase-admin');
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

let isFirebaseAdminConfigured = false;
let hasFullServiceAccount = false;
let adminApp = null;
let initError = null;

/**
 * Safely resolves the service account file path across different execution environments.
 * Checks relative to the server directory, current working directory, and absolute paths.
 *
 * @param {string} rawPath
 * @returns {string|null} Resolved absolute file path or null if not found
 */
function resolveServiceAccountPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;

  const trimmed = rawPath.trim();

  // 1. Direct absolute path
  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return trimmed;
  }

  // 2. Relative to server directory (__dirname is server/config, .. is server)
  const serverDir = path.resolve(__dirname, '..');
  const pathInServerDir = path.resolve(serverDir, trimmed);
  if (fs.existsSync(pathInServerDir)) {
    return pathInServerDir;
  }

  // 3. Relative to process.cwd()
  const pathInCwd = path.resolve(process.cwd(), trimmed);
  if (fs.existsSync(pathInCwd)) {
    return pathInCwd;
  }

  // 4. Relative to process.cwd()/server
  const pathInCwdServer = path.resolve(process.cwd(), 'server', trimmed);
  if (fs.existsSync(pathInCwdServer)) {
    return pathInCwdServer;
  }

  return null;
}

try {
  const existingApps = getApps();
  if (existingApps.length === 0) {
    let credential = null;
    const projectId = process.env.FIREBASE_PROJECT_ID || 'shopflow-cefdd';

    // -------------------------------------------------------------------------
    // Method 1: Service Account JSON File Path (Primary & Recommended)
    // -------------------------------------------------------------------------
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const resolvedPath = resolveServiceAccountPath(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

      if (!resolvedPath) {
        initError = {
          category: 'missing service-account file',
          message: `Service account file not found at path: ${process.env.FIREBASE_SERVICE_ACCOUNT_PATH}`,
        };
        console.error(`[Firebase Admin] Error (${initError.category}): ${initError.message}`);
      } else {
        try {
          const rawContent = fs.readFileSync(resolvedPath, 'utf8');
          const fileContent = JSON.parse(rawContent);

          // Verify project ID matches if specified
          if (fileContent.project_id && projectId && fileContent.project_id !== projectId) {
            initError = {
              category: 'incorrect Firebase project',
              message: `Service account project_id (${fileContent.project_id}) does not match FIREBASE_PROJECT_ID (${projectId})`,
            };
            console.error(`[Firebase Admin] Error (${initError.category}): ${initError.message}`);
          } else {
            credential = cert(fileContent);
            hasFullServiceAccount = true;
          }
        } catch (parseOrCertErr) {
          initError = {
            category: 'invalid credentials',
            message: 'Failed to parse service-account JSON or initialize certificate.',
          };
          console.error(`[Firebase Admin] Error (${initError.category}): ${parseOrCertErr.message}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // Method 2: Base64 or stringified JSON in environment variable
    // -------------------------------------------------------------------------
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
        const parsedJson = rawJson.startsWith('{')
          ? JSON.parse(rawJson)
          : JSON.parse(Buffer.from(rawJson, 'base64').toString('utf8'));

        if (parsedJson.project_id && projectId && parsedJson.project_id !== projectId) {
          initError = {
            category: 'incorrect Firebase project',
            message: `Service account JSON project_id does not match FIREBASE_PROJECT_ID (${projectId})`,
          };
          console.error(`[Firebase Admin] Error (${initError.category}): ${initError.message}`);
        } else {
          credential = cert(parsedJson);
          hasFullServiceAccount = true;
        }
      } catch (err) {
        initError = {
          category: 'invalid credentials',
          message: 'Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON.',
        };
        console.error(`[Firebase Admin] Error (${initError.category}): ${err.message}`);
      }
    }

    // -------------------------------------------------------------------------
    // Method 3: Direct environment variables (client_email + private_key)
    // -------------------------------------------------------------------------
    else if (
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      try {
        credential = cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        hasFullServiceAccount = true;
      } catch (err) {
        initError = {
          category: 'invalid credentials',
          message: 'Failed to initialize credentials from environment variables.',
        };
        console.error(`[Firebase Admin] Error (${initError.category}): ${err.message}`);
      }
    } else {
      initError = {
        category: 'missing environment variable',
        message: 'No service account credentials provided (FIREBASE_SERVICE_ACCOUNT_PATH not set).',
      };
      console.warn(`[Firebase Admin] Warning (${initError.category}): ${initError.message}`);
    }

    // -------------------------------------------------------------------------
    // Initialize Firebase Admin Application
    // -------------------------------------------------------------------------
    if (credential) {
      adminApp = initializeApp({ credential, projectId });
      isFirebaseAdminConfigured = true;
      console.log('[Firebase Admin] Firebase Admin initialized successfully');
      console.log(`[Firebase Admin] Firebase project: ${projectId}`);
    } else if (projectId) {
      // Fallback with projectId only (token verification active)
      adminApp = initializeApp({ projectId });
      isFirebaseAdminConfigured = true;
      console.log(`[Firebase Admin] Initialized Firebase Admin SDK with projectId: ${projectId} (Token verification active).`);
    } else {
      initError = {
        category: 'missing environment variable',
        message: 'FIREBASE_PROJECT_ID not set.',
      };
      console.error(`[Firebase Admin] Error (${initError.category}): ${initError.message}`);
    }
  } else {
    adminApp = existingApps[0];
    isFirebaseAdminConfigured = true;
  }
} catch (error) {
  initError = {
    category: 'initialization failure',
    message: error.message,
  };
  console.error('[Firebase Admin] Failed to initialize Firebase Admin SDK:', error.message);
  isFirebaseAdminConfigured = false;
}

const auth = (isFirebaseAdminConfigured && adminApp) ? getAuth(adminApp) : null;
const db = (hasFullServiceAccount && adminApp) ? getFirestore(adminApp) : null;

module.exports = {
  admin,
  adminApp,
  auth,
  db,
  FieldValue,
  isFirebaseAdminConfigured,
  hasFullServiceAccount,
  initError,
  resolveServiceAccountPath,
};
