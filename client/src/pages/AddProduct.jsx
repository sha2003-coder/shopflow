import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import productService from '../services/productService';

/**
 * AddProduct Page Component (/products/add)
 * Form to register a new product. Barcode is omitted and generated automatically by backend.
 */
export default function AddProduct() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [lowStockLevel, setLowStockLevel] = useState('5');
  const [unit, setUnit] = useState('piece');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdProduct, setCreatedProduct] = useState(null);

  const resetForm = () => {
    setName('');
    setCategory('');
    setSku('');
    setBuyingPrice('');
    setSellingPrice('');
    setStockQuantity('0');
    setLowStockLevel('5');
    setUnit('piece');
    setDescription('');
    setError('');
    setCreatedProduct(null);
  };

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

    if (!unit.trim()) {
      setError('Unit is required.');
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

      const res = await productService.createProduct(payload, token);
      if (res.success && res.product) {
        setCreatedProduct(res.product);
      } else {
        throw new Error(res.message || 'Failed to create product');
      }
    } catch (err) {
      console.error('[AddProduct] Creation failed:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '720px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div className="badge-wrapper">
            <span className="status-dot" />
            <span>Product Creation</span>
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
          Add New Product
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Enter product details. The system will automatically generate an internal barcode.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Success View */}
      {createdProduct ? (
        <div
          className="welcome-card"
          style={{
            textAlign: 'left',
            animation: 'fadeIn 0.4s ease',
            padding: '2.5rem 2rem',
          }}
        >
          <div
            className="alert alert-success"
            style={{
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>✓</span>
            Product created successfully.
          </div>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginBottom: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Product Name</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{createdProduct.name}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>SKU</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#a5b4fc' }}>
                {createdProduct.sku}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Generated Barcode</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  padding: '0.3rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  letterSpacing: '0.05em',
                }}
              >
                {createdProduct.barcode}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Initial Stock</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {createdProduct.stockQuantity} {createdProduct.unit}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-secondary"
            >
              + Add Another Product
            </button>
            <Link to="/products" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              View Product Catalog →
            </Link>
          </div>
        </div>
      ) : (
        /* Product Form */
        <div className="auth-card" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Row 1: Name & Category */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="prod-name" className="form-label">
                  Product Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="prod-name"
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Coca Cola 500ml"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="prod-cat" className="form-label">
                  Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="prod-cat"
                  type="text"
                  className="form-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Beverages"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Row 2: SKU & Unit */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="prod-sku" className="form-label">
                  SKU (Stock Keeping Unit) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="prod-sku"
                  type="text"
                  className="form-input"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="e.g. COKE500"
                  required
                  disabled={submitting}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Must be unique within your shop.
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="prod-unit" className="form-label">
                  Unit <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="prod-unit"
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
                <label htmlFor="prod-bp" className="form-label">
                  Buying / Cost Price (Rs) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="prod-bp"
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={buyingPrice}
                  onChange={(e) => setBuyingPrice(e.target.value)}
                  placeholder="e.g. 150.00"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="prod-sp" className="form-label">
                  Selling Price (Rs) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="prod-sp"
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="e.g. 180.00"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Row 4: Initial Stock & Low Stock Level */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="prod-stock" className="form-label">
                  Initial Stock Quantity <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="prod-stock"
                  type="number"
                  step="1"
                  min="0"
                  className="form-input"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder="e.g. 50"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="prod-low" className="form-label">
                  Low Stock Alert Level <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="prod-low"
                  type="number"
                  step="1"
                  min="0"
                  className="form-input"
                  value={lowStockLevel}
                  onChange={(e) => setLowStockLevel(e.target.value)}
                  placeholder="e.g. 10"
                  required
                  disabled={submitting}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Alert triggers when stock drops to or below this amount.
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="prod-desc" className="form-label">
                Description <span style={{ color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <textarea
                id="prod-desc"
                className="form-input"
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product notes, dimensions, or manufacturer info..."
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
                {submitting ? 'Creating Product...' : 'Save Product & Generate Barcode'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
