import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase Client Configuration
 * Loaded strictly from Vite environment variables.
 * Under no circumstances should backend service account credentials or secrets be hard-coded here.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Verify whether client Firebase environment variables have been provided.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

if (!isFirebaseConfigured) {
  console.warn(
    '[Firebase Client] Warning: Firebase configuration keys are missing or incomplete in client/.env. ' +
    'Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID.'
  );
}

// Initialize Firebase App instance singleton
export const app = getApps().length > 0
  ? getApp()
  : isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : null;

// Initialize Firebase Auth instance
export const auth = app ? getAuth(app) : null;

// Initialize Cloud Firestore client instance
export const db = app ? getFirestore(app) : null;

export default app;
