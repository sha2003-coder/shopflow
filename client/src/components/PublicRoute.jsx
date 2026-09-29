import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PublicRoute Component
 * Guards guest routes (/login, /register).
 * If authenticated, redirects to /dashboard (if shop exists) or /setup-shop (if shop needed).
 */
export default function PublicRoute({ children }) {
  const { currentUser, userProfile, currentShop, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-spinner" />
      </div>
    );
  }

  if (currentUser) {
    const hasShop = Boolean(currentShop?.id || userProfile?.shopId);
    return <Navigate to={hasShop ? '/dashboard' : '/setup-shop'} replace />;
  }

  return children;
}
