import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentShop, setCurrentShop] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));

  /**
   * Retrieves the current user's Firestore document (users/{uid}) and shop from backend.
   */
  const loadUserAndShop = useCallback(async (user) => {
    if (!user) {
      setUserProfile(null);
      setCurrentShop(null);
      return { profile: null, shop: null, shopId: null };
    }

    let loadedProfile = null;
    let loadedShop = null;
    let shopId = null;

    // 1. Fetch Firestore user document (users/{uid})
    if (db) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          loadedProfile = userSnap.data();
          shopId = loadedProfile.shopId || null;
          setUserProfile(loadedProfile);
        }
      } catch (err) {
        console.warn('[AuthContext] Could not load users doc directly from Firestore:', err.message);
      }
    }

    // 2. Fetch Shop details via backend API
    try {
      const idToken = await user.getIdToken();
      const shopRes = await api.getMyShop(idToken);
      if (shopRes.success && shopRes.shop) {
        loadedShop = shopRes.shop;
        shopId = loadedShop.id;
        setCurrentShop(loadedShop);
        setUserProfile((prev) => ({
          ...(prev || {}),
          uid: user.uid,
          email: user.email,
          name: user.displayName || prev?.name || '',
          role: prev?.role || 'owner',
          shopId: loadedShop.id,
        }));
      } else {
        setCurrentShop(null);
      }
    } catch (err) {
      if (err.statusCode !== 404 && !err.data?.requiresSetup) {
        console.warn('[AuthContext] Backend getMyShop error:', err.message);
      }
      setCurrentShop(null);
    }

    return { profile: loadedProfile, shop: loadedShop, shopId };
  }, []);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadUserAndShop(user);
      } else {
        setUserProfile(null);
        setCurrentShop(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loadUserAndShop]);

  /**
   * Register a new user with Firebase Auth and initialize their Firestore document.
   */
  const register = async (name, email, password) => {
    if (!auth) throw new Error('Firebase Authentication is not configured.');

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const trimmedName = (name || '').trim();
    if (trimmedName) {
      await updateProfile(user, { displayName: trimmedName });
    }

    // Create user document in Firestore: users/{user.uid}
    const initialProfile = {
      uid: user.uid,
      name: trimmedName,
      email: user.email,
      role: 'owner',
      shopId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (db) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, initialProfile);
      } catch (err) {
        console.warn('[AuthContext] Error writing users/{uid} document to Firestore:', err.message);
      }
    }

    setCurrentUser({ ...user, displayName: trimmedName });
    setUserProfile(initialProfile);
    setCurrentShop(null);

    return { user, profile: initialProfile };
  };

  /**
   * Sign in using Firebase Email/Password Authentication.
   */
  const login = async (email, password) => {
    if (!auth) throw new Error('Firebase Authentication is not configured.');

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    setCurrentUser(user);

    // Load profile and shop
    const { profile, shop, shopId } = await loadUserAndShop(user);

    return { user, profile, shop, shopId };
  };

  /**
   * Sign out the currently authenticated user.
   */
  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    setCurrentShop(null);
  };

  /**
   * Helper to retrieve latest Firebase ID token for API calls.
   */
  const getIdToken = async (forceRefresh = false) => {
    if (!currentUser) return null;
    return currentUser.getIdToken(forceRefresh);
  };

  /**
   * Update local context state when shop is created.
   */
  const setShopCreated = (shop) => {
    setCurrentShop(shop);
    setUserProfile((prev) => ({
      ...(prev || {}),
      shopId: shop.id,
      updatedAt: new Date(),
    }));
  };

  const value = {
    currentUser,
    userProfile,
    currentShop,
    loading,
    login,
    register,
    logout,
    getIdToken,
    setShopCreated,
    refreshUserAndShop: () => currentUser && loadUserAndShop(currentUser),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to consume AuthContext safely.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
