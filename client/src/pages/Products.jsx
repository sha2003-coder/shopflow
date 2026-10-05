import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import productService from '../services/productService';
import ProductBarcode from '../components/ProductBarcode';

/**
 * Products Page Component (/products)
 * Displays product catalog, search bar, category filter, low-stock filter, and management actions.
 */
export default function Products() {
  const { getIdToken, currentShop } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Barcode Modal State
  const [viewBarcodeProduct, setViewBarcodeProduct] = useState(null);
  const [barcodeToken, setBarcodeToken] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Deletion state
  const [deletingId, setDeletingId] = useState(null);

  const fetchProductsList = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError('');
      const token = await getIdToken();
      if (!token) throw new Error('Authentication expired. Please sign in again.');

      const res = await productService.getProducts(
        {
          search: searchTerm,
          category: selectedCategory,
          lowStock: lowStockOnly,
        },
        token
      );

      if (res.success && Array.isArray(res.products)) {
        setProducts(res.products);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error('[Products] Failed to fetch:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, searchTerm, selectedCategory, lowStockOnly]);

  useEffect(() => {
    fetchProductsList(false);
  }, [fetchProductsList]);

  // Extract unique categories for filter dropdown
  const categoriesList = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"?`)) {
      return;
    }

    try {
      setDeletingId(id);
      setActionSuccess('');
      setError('');
      const token = await getIdToken();
      await productService.deleteProduct(id, token);
      setActionSuccess(`Product "${name}" deleted successfully.`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('[Products] Delete error:', err);
      setError(err.message || 'Failed to delete product');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewBarcode = async (product) => {
    try {
      const token = await getIdToken();
      setBarcodeToken(token);
      setViewBarcodeProduct(product);
    } catch (err) {
      console.error('[Products] Failed to retrieve token for barcode view:', err);
      setViewBarcodeProduct(product);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div>
          <div className="badge-wrapper" style={{ marginBottom: '0.5rem' }}>
            <span className="status-dot" />
            <span>Inventory System</span>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Product Catalog
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            Track item inventory, barcode numbers, pricing, and stock alerts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Dashboard
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Products
          </button>
          <Link
            to="/pos"
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', textDecoration: 'none', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.35)' }}
          >
            💳 POS
          </Link>
          <Link
            to="/sales"
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Sales
          </Link>
          <Link
            to="/reports"
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Reports
          </Link>
          <Link
            to="/products/add"
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', textDecoration: 'none', background: 'var(--accent-gradient)' }}
          >
            + Add Product
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          {actionSuccess}
        </div>
      )}

      {/* Controls Bar: Search, Category Filter, Low Stock Filter */}
      <div
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search Bar */}
        <div style={{ flex: '1 1 280px', minWidth: '220px' }}>
          <input
            type="text"
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            style={{ width: '100%' }}
          />
        </div>

        {/* Category Filter */}
        <div style={{ minWidth: '180px' }}>
          <select
            className="form-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '100%', cursor: 'pointer' }}
          >
            <option value="">All Categories</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Low Stock Filter Button */}
        <div>
          <button
            type="button"
            onClick={() => setLowStockOnly((prev) => !prev)}
            className={lowStockOnly ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{
              padding: '0.75rem 1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: lowStockOnly ? '#ef4444' : '#eab308',
              }}
            />
            {lowStockOnly ? 'Showing: Low Stock Only' : 'Filter: Low Stock'}
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <div className="auth-spinner" style={{ margin: '0 auto 1rem auto' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Loading catalog items...</p>
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 1rem auto',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
              }}
            >
              📦
            </div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              No Products Found
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
              {searchTerm || selectedCategory || lowStockOnly
                ? 'No items matched your current filter criteria. Try clearing search filters.'
                : 'Your shop inventory is empty. Click "+ Add Product" to register your first product.'}
            </p>
            {searchTerm || selectedCategory || lowStockOnly ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setLowStockOnly(false);
                }}
                className="btn btn-secondary"
              >
                Reset Filters
              </button>
            ) : (
              <Link to="/products/add" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                + Add First Product
              </Link>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
              <thead>
                <tr
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '1rem 1.25rem' }}>Product</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Category</th>
                  <th style={{ padding: '1rem 1.25rem' }}>SKU</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Barcode</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Cost Price</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Selling Price</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Stock</th>
                  <th style={{ padding: '1rem 1.25rem' }}>Status</th>
                  <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => {
                  const stockNum = Number(p.stockQuantity);
                  const lowLevel = Number(p.lowStockLevel);
                  const isOutOfStock = stockNum === 0;
                  const isLowStock = !isOutOfStock && stockNum <= lowLevel;

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Name */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        {p.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {p.description}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.6rem',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#a5b4fc',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {p.category}
                        </span>
                      </td>

                      {/* SKU */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8125rem',
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                          }}
                        >
                          {p.sku}
                        </span>
                      </td>

                      {/* Barcode */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8125rem',
                            background: 'rgba(15, 23, 42, 0.6)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#38bdf8',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {p.barcode}
                        </span>
                      </td>

                      {/* Buying Price */}
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                        {Number(p.buyingPrice).toFixed(2)}
                      </td>

                      {/* Selling Price */}
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: '#10b981' }}>
                        {Number(p.sellingPrice).toFixed(2)}
                      </td>

                      {/* Stock & Unit */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{ fontWeight: 700, color: isOutOfStock ? '#ef4444' : 'var(--text-primary)' }}>
                          {stockNum}
                        </span>{' '}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.unit}</span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        {isOutOfStock ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                            }}
                          >
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: 'rgba(234, 179, 8, 0.15)',
                              color: '#eab308',
                              border: '1px solid rgba(234, 179, 8, 0.3)',
                            }}
                          >
                            Low Stock (≤{lowLevel})
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleViewBarcode(p)}
                            className="btn btn-secondary"
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              color: '#38bdf8',
                              borderColor: 'rgba(56, 189, 248, 0.35)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🏷️ View Barcode
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/products/${p.id}/edit`)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id, p.name)}
                            disabled={deletingId === p.id}
                            className="btn btn-secondary"
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8125rem',
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                            }}
                          >
                            {deletingId === p.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Barcode & Printable Label Modal */}
      {viewBarcodeProduct && (
        <div
          className="modal-backdrop no-print"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setViewBarcodeProduct(null)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '0.75rem',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>🏷️</span> Barcode & Label
              </h3>
              <button
                type="button"
                onClick={() => setViewBarcodeProduct(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0 0.25rem',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <ProductBarcode
              product={viewBarcodeProduct}
              shopName={currentShop?.name || 'ShopFlow'}
              currency={currentShop?.currency || 'Rs.'}
              idToken={barcodeToken}
              onClose={() => setViewBarcodeProduct(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
