import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component
 * Guards routes that require active authentication.
 * If requireShop is true, redirects users without a shop to /setup-shop.
 */
export default function ProtectedRoute({ children, requireShop = true }) {
  const { currentUser, userProfile, currentShop, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-spinner" />
        <p className="auth-loading-text">Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const hasShop = Boolean(currentShop?.id || userProfile?.shopId);

  if (requireShop && !hasShop) {
    return <Navigate to="/setup-shop" replace />;
  }

  return children;
}
