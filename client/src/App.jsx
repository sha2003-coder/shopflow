import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import SetupShop from './pages/SetupShop';
import Dashboard from './pages/Dashboard';

import Products from './pages/Products';
import AddProduct from './pages/AddProduct';
import EditProduct from './pages/EditProduct';
import POS from './pages/POS';
import Sales from './pages/Sales';
import Reports from './pages/Reports';

/**
 * Guard that prevents users who already own a shop from accessing /setup-shop.
 */
function ShopSetupGuard({ children }) {
  const { currentShop, userProfile } = useAuth();
  const hasShop = Boolean(currentShop?.id || userProfile?.shopId);

  if (hasShop) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * Root Application Router & Authentication Context Scaffolding
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MainLayout>
          <Routes>
            {/* Public guest routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />

            {/* Shop Setup route (Authenticated users without a shop) */}
            <Route
              path="/setup-shop"
              element={
                <ProtectedRoute requireShop={false}>
                  <ShopSetupGuard>
                    <SetupShop />
                  </ShopSetupGuard>
                </ProtectedRoute>
              }
            />

            {/* Protected dashboard & inventory routes (Requires active session and shop) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requireShop={true}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute requireShop={true}>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/add"
              element={
                <ProtectedRoute requireShop={true}>
                  <AddProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/:id/edit"
              element={
                <ProtectedRoute requireShop={true}>
                  <EditProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pos"
              element={
                <ProtectedRoute requireShop={true}>
                  <POS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute requireShop={true}>
                  <Sales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requireShop={true}>
                  <Reports />
                </ProtectedRoute>
              }
            />

            {/* Fallback routes */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </MainLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}
