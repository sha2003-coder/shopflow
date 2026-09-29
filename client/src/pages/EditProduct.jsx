import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import productService from '../services/productService';

/**
 * EditProduct Page Component (/products/:id/edit)
 * Allows updating product fields while keeping barcode strictly read-only.
 */
export default function EditProduct() {
  const { id } = useParams();
  const { getIdToken } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [lowStockLevel, setLowStockLevel] = useState('5');
  const [unit, setUnit] = useState('piece');
  const [description, setDescription] = useState('');

  const loadProduct = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError('');
      const token = await getIdToken();
      if (!token) throw new Error('Authentication expired. Please sign in again.');

      const res = await productService.getProduct(id, token);
      if (res.success && res.product) {
        const p = res.product;
        setName(p.name || '');
        setCategory(p.category || '');
        setSku(p.sku || '');
        setBarcode(p.barcode || '');
        setBuyingPrice(String(p.buyingPrice ?? ''));
        setSellingPrice(String(p.sellingPrice ?? ''));
        setStockQuantity(String(p.stockQuantity ?? '0'));
        setLowStockLevel(String(p.lowStockLevel ?? '5'));
        setUnit(p.unit || 'piece');
        setDescription(p.description || '');
      } else {
        throw new Error('Product not found');
      }
    } catch (err) {
      console.error('[EditProduct] Load error:', err);
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [id, getIdToken]);

  useEffect(() => {
    loadProduct(false);
  }, [loadProduct]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!name.trim()) {
      setError('Product Name is required.');
      return;
    }

    if (!category.trim()) {
      setError('Category is required.');
      return;
    }

    if (!sku.trim()) {
      setError('SKU is required.');
      return;
    }

    const bp = parseFloat(buyingPrice);
    if (isNaN(bp) || bp < 0) {
      setError('Buying Price must be a valid number greater than or equal to 0.');
      return;
    }

    const sp = parseFloat(sellingPrice);
    if (isNaN(sp) || sp < 0) {
      setError('Selling Price must be a valid number greater than or equal to 0.');
      return;
    }

    const stock = parseInt(stockQuantity, 10);
    if (isNaN(stock) || stock < 0) {
      setError('Stock Quantity must be a valid whole number greater than or equal to 0.');
      return;
    }

    const lowLevel = parseInt(lowStockLevel, 10);
    if (isNaN(lowLevel) || lowLevel < 0) {
      setError('Low Stock Level must be a valid whole number greater than or equal to 0.');
      return;
    }

    try {
      setSubmitting(true);
      const token = await getIdToken();
      if (!token) throw new Error('Authentication expired. Please sign in again.');

      const payload = {
        name: name.trim(),
        category: category.trim(),
        sku: sku.trim().toUpperCase(),
        buyingPrice: bp,
        sellingPrice: sp,
        stockQuantity: stock,
        lowStockLevel: lowLevel,
        unit: unit.trim(),
        description: description.trim(),
      };

      const res = await productService.updateProduct(id, payload, token);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/products');
        }, 500);
      } else {
        throw new Error(res.message || 'Failed to update product');
      }
    } catch (err) {
      console.error('[EditProduct] Update error:', err);
      setError(err.message || 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="auth-spinner" style={{ margin: '0 auto 1rem auto' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading product details...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '720px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div className="badge-wrapper">
            <span className="status-dot" />
            <span>Product Editor</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.875rem', fontSize: '0.8125rem' }}
          >
            ← Back to Products
          </button>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Edit Product
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Update product specifications, inventory, and pricing
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          Product updated successfully! Returning to catalog...
        </div>
      )}

      {/* Edit Form */}
      <div className="auth-card" style={{ padding: '2rem' }}>
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Read-Only Barcode Banner */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Assigned Barcode (Read-Only)
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.05em' }}>
                {barcode || 'N/A'}
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🔒 System Generated
            </span>
          </div>

          {/* Row 1: Name & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="edit-name" className="form-label">
                Product Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="edit-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-cat" className="form-label">
                Category <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="edit-cat"
                type="text"
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          {/* Row 2: SKU & Unit */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="edit-sku" className="form-label">
                SKU (Stock Keeping Unit) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="edit-sku"
                type="text"
                className="form-input"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-unit" className="form-label">
                Unit <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                id="edit-unit"
                className="form-input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={submitting}
                style={{ cursor: 'pointer' }}
              >
                <option value="piece">Piece (pc)</option>
                <option value="pack">Pack (pk)</option>
                <option value="box">Box (bx)</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="liter">Liter (L)</option>
                <option value="ml">Milliliter (ml)</option>
                <option value="bottle">Bottle</option>
                <option value="can">Can</option>
                <option value="meter">Meter (m)</option>
              </select>
            </div>
          </div>

          {/* Row 3: Buying Price & Selling Price */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="edit-bp" className="form-label">
                Buying / Cost Price (Rs) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="edit-bp"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={buyingPrice}
                onChange={(e) => setBuyingPrice(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="edit-sp" className="form-label">
                Selling Price (Rs) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="edit-sp"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          {/* Row 4: Stock Quantity & Low Stock Level */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="edit-stock" className="form-label">
                Current Stock Quantity <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="edit-stock"
                type="number"
                step="1"
                min="0"
                className="form-input"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                required
                disabled={submitting}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Can be adjusted manually. Must never be negative.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="edit-low" className="form-label">
                Low Stock Alert Level <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="edit-low"
                type="number"
                step="1"
                min="0"
                className="form-input"
                value={lowStockLevel}
                onChange={(e) => setLowStockLevel(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="edit-desc" className="form-label">
              Description <span style={{ color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <textarea
              id="edit-desc"
              className="form-input"
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Submit Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Updating Product...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
