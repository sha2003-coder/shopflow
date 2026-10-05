import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import salesService from '../services/salesService';

/**
 * Formats currency values
 */
function formatCurrency(amount, currency = 'Rs.') {
  const num = Number(amount) || 0;
  return `${currency} ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats ISO date string
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return String(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Sales Page Component (/sales)
 * Displays sales history table, invoice lookup, and detailed sale breakdown modal.
 */
export default function Sales() {
  const { getIdToken, currentShop, logout } = useAuth();
  const navigate = useNavigate();

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const shopName = currentShop?.name || 'ShopFlow Store';
  const currency = currentShop?.currency || 'Rs.';

  const fetchSalesList = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = await getIdToken();
      if (!token) throw new Error('Authentication expired. Please sign in again.');

      const res = await salesService.getSales({ limit: 100 }, token);
      if (res.success && Array.isArray(res.sales)) {
        setSales(res.sales);
      } else {
        setSales([]);
      }
    } catch (err) {
      console.error('[Sales] Failed to fetch sales:', err);
      setError(err.message || 'Failed to load sales history');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchSalesList();
  }, [fetchSalesList]);

  // Filter sales by invoice number or cashier name
  const filteredSales = sales.filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    const inv = String(s.invoiceNumber || '').toLowerCase();
    const cashier = String(s.cashierName || '').toLowerCase();
    const method = String(s.paymentMethod || '').toLowerCase();
    return inv.includes(q) || cashier.includes(q) || method.includes(q);
  });

  return (
    <div className="sales-page" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Top Header */}
      <header
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            🧾
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Sales & Invoices
            </h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Shop: <strong style={{ color: 'var(--text-primary)' }}>{shopName}</strong> | Audited checkout transactions
            </div>
          </div>
        </div>

        {/* Global Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            to="/dashboard"
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Dashboard
          </Link>
          <Link
            to="/products"
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Products
          </Link>
          <Link
            to="/pos"
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', textDecoration: 'none', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.35)' }}
          >
            💳 Open POS
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            Sales
          </button>
          <Link
            to="/reports"
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            Reports
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', color: '#ef4444' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Search & Actions Bar */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ flex: '1', minWidth: '260px', maxWidth: '450px' }}>
          <input
            type="text"
            placeholder="Search by invoice number, cashier, payment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            style={{ width: '100%', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={fetchSalesList}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing {filteredSales.length} {filteredSales.length === 1 ? 'sale' : 'sales'}
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#ef4444',
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Sales History Table */}
      <div
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            Loading sales history...
          </div>
        ) : filteredSales.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🛒</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {searchTerm ? 'No sales match your search' : 'No sales recorded yet'}
            </h3>
            <p style={{ maxWidth: '420px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
              {searchTerm
                ? 'Try a different invoice number or cashier name.'
                : 'Complete checkout transactions on the POS screen to record sales and track inventory.'}
            </p>
            {!searchTerm && (
              <Link to="/pos" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                💳 Open POS Terminal
              </Link>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  <th style={{ padding: '0.9rem 1.25rem' }}>Invoice</th>
                  <th style={{ padding: '0.9rem 1.25rem' }}>Date & Time</th>
                  <th style={{ padding: '0.9rem 1.25rem' }}>Cashier</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Items</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Grand Total</th>
                  <th style={{ padding: '0.9rem 1.25rem' }}>Payment</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const itemCount = Array.isArray(sale.items)
                    ? sale.items.reduce((s, it) => s + (it.quantity || 1), 0)
                    : 0;

                  return (
                    <tr
                      key={sale.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '0.9rem',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Invoice */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontWeight: 700,
                            color: '#38bdf8',
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                          }}
                        >
                          {sale.invoiceNumber}
                        </span>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {formatDate(sale.createdAt)}
                      </td>

                      {/* Cashier */}
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {sale.cashierName || 'Cashier'}
                      </td>

                      {/* Items */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                        <span
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}
                        >
                          {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td
                        style={{
                          padding: '1rem 1.25rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#10b981',
                          fontSize: '1rem',
                        }}
                      >
                        {formatCurrency(sale.grandTotal, currency)}
                      </td>

                      {/* Payment */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background:
                              sale.paymentMethod === 'cash'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : sale.paymentMethod === 'card'
                                ? 'rgba(99, 102, 241, 0.12)'
                                : 'rgba(234, 179, 8, 0.12)',
                            color:
                              sale.paymentMethod === 'cash'
                                ? '#10b981'
                                : sale.paymentMethod === 'card'
                                ? '#818cf8'
                                : '#eab308',
                            border: `1px solid ${
                              sale.paymentMethod === 'cash'
                                ? 'rgba(16, 185, 129, 0.25)'
                                : sale.paymentMethod === 'card'
                                ? 'rgba(99, 102, 241, 0.25)'
                                : 'rgba(234, 179, 8, 0.25)'
                            }`,
                            textTransform: 'capitalize',
                          }}
                        >
                          {sale.paymentMethod === 'cash' ? '💵 Cash' : sale.paymentMethod === 'card' ? '💳 Card' : '📱 Other'}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedSale(sale)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                        >
                          👁️ View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setSelectedSale(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-glow)',
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontWeight: 800,
                    fontSize: '1.25rem',
                    color: '#38bdf8',
                  }}
                >
                  {selectedSale.invoiceNumber}
                </span>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {formatDate(selectedSale.createdAt)} | Cashier: <strong>{selectedSale.cashierName}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Items Breakdown Table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                }}
              >
                Purchased Items
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '0.6rem 0.5rem' }}>Item</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Discount</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items?.map((it, idx) => (
                    <tr
                      key={`${it.productId}-${idx}`}
                      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
                    >
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{it.name}</div>
                        {(it.sku || it.barcode) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {it.sku && `SKU: ${it.sku}`} {it.barcode && `| Barcode: ${it.barcode}`}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>
                        {it.quantity}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {formatCurrency(it.unitPrice, currency)}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', color: it.itemDiscount > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                        {it.itemDiscount > 0 ? `- ${formatCurrency(it.itemDiscount, currency)}` : '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(it.lineTotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedSale.subtotal, currency)}</span>
                </div>

                {selectedSale.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}>
                    <span>
                      Discount ({selectedSale.discountType === 'percentage' ? `${selectedSale.discountValue}%` : 'Fixed'}):
                    </span>
                    <span>- {formatCurrency(selectedSale.discountAmount, currency)}</span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '0.6rem',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>Grand Total:</span>
                  <span style={{ fontSize: '1.25rem', color: '#10b981' }}>
                    {formatCurrency(selectedSale.grandTotal, currency)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px dashed var(--border-subtle)',
                    paddingTop: '0.6rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Payment Method:</span>
                  <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {selectedSale.paymentMethod}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Amount Received:</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(selectedSale.amountReceived, currency)}
                  </span>
                </div>

                {selectedSale.paymentMethod === 'cash' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Change Returned:</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>
                      {formatCurrency(selectedSale.changeAmount, currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
