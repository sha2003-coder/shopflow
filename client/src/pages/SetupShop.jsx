import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/**
 * SetupShop Page Component
 * Allows an authenticated owner without a shop to create their business profile.
 */
export default function SetupShop() {
  const { currentUser, userProfile, getIdToken, setShopCreated } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState(
    currentUser?.displayName || userProfile?.name || ''
  );
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!name.trim()) {
      setError('Shop Name is required.');
      return;
    }

    if (!ownerName.trim()) {
      setError('Owner Name is required.');
      return;
    }

    if (!phone.trim()) {
      setError('Phone Number is required.');
      return;
    }

    try {
      setSubmitting(true);
      const token = await getIdToken();
      if (!token) {
        throw new Error('Authentication session expired. Please sign in again.');
      }

      const res = await api.createShop(
        {
          name: name.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          address: address.trim(),
        },
        token
      );

      if (res.success && res.shop) {
        setSuccess(true);
        setShopCreated(res.shop);
        // Small delay to allow user to see success confirmation before navigating
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 600);
      } else {
        throw new Error(res.message || 'Failed to create shop');
      }
    } catch (err) {
      console.error('[SetupShop] Creation failed:', err);
      setError(err.message || 'Failed to create shop. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container" style={{ maxWidth: '520px' }}>
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-badge">Shop Setup</div>
          <h1 className="auth-title">Register Your Shop</h1>
          <p className="auth-subtitle">
            Create your primary business entity to activate POS and management tools
          </p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="alert">
            Shop created successfully! Directing you to your dashboard...
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="shop-name" className="form-label">
              Shop Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="shop-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ABC Grocery & Mobile"
              required
              disabled={submitting || success}
            />
          </div>

          <div className="form-group">
            <label htmlFor="owner-name" className="form-label">
              Owner Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="owner-name"
              type="text"
              className="form-input"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Mohamed Al-Farsi"
              required
              disabled={submitting || success}
            />
          </div>

          <div className="form-group">
            <label htmlFor="shop-phone" className="form-label">
              Phone Number <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="shop-phone"
              type="tel"
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0771234567"
              required
              disabled={submitting || success}
            />
          </div>

          <div className="form-group">
            <label htmlFor="shop-address" className="form-label">
              Address <span style={{ color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              id="shop-address"
              type="text"
              className="form-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Main Street, Jaffna, Sri Lanka"
              disabled={submitting || success}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || success}
            style={{ marginTop: '0.5rem' }}
          >
            {submitting ? 'Creating Shop...' : 'Complete Shop Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
