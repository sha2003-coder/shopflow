import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Dashboard Page Component
 * Displays Shop details (Shop Name, Owner Name, Email),
 * active status, and logout button.
 */
export default function Dashboard() {
  const { currentUser, currentShop, userProfile, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[Dashboard] Logout failed:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const shopName = currentShop?.name || 'Shop Not Assigned';
  const ownerName = currentShop?.ownerName || userProfile?.name || currentUser?.displayName || 'Shop Owner';
  const email = currentUser?.email || 'N/A';

  return (
    <div className="welcome-container" style={{ maxWidth: '640px' }}>
      <div className="welcome-card">
        <div className="badge-wrapper" style={{ justifyContent: 'center', marginBottom: '1.25rem' }}>
          <span className="status-dot" />
          <span>Active Shop Session</span>
        </div>

        <h1 className="welcome-title" style={{ marginBottom: '0.5rem' }}>
          ShopFlow
        </h1>
        <p className="welcome-tagline" style={{ marginBottom: '1.75rem', color: 'var(--text-secondary)' }}>
          Shop Management System
        </p>

        {/* Business entity details panel */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            marginBottom: '2rem',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                Shop Name
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem' }}>
                {shopName}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                Owner Name
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {ownerName}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                Email
              </span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                {email}
              </span>
            </div>

            {currentShop?.phone && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                  Phone
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {currentShop.phone}
                </span>
              </div>
            )}

            {currentShop?.address && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                  Address
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {currentShop.address}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="btn btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 700,
              background: 'var(--accent-gradient)',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            💳 Open POS / Billing
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            📦 Products & Inventory
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            🧾 Sales & Invoices
          </button>
          <button
            type="button"
            onClick={() => alert('Reports module will be available in the upcoming release.')}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', opacity: 0.65 }}
          >
            📊 Reports (Upcoming)
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-secondary"
            disabled={loggingOut}
            style={{ minWidth: '160px', opacity: 0.8 }}
          >
            {loggingOut ? 'Logging out...' : 'Log Out'}
          </button>
        </div>
      </div>
    </div>
  );
}
