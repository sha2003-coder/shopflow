import React, { useState } from 'react';
import { calculateLineTotal, formatCurrency } from '../utils/cartCalculations';

/**
 * POS Cart Component
 * Displays selected items, quantity controls with live stock capping,
 * item discount inputs, line totals, and item removal.
 */
export default function POSCart({
  items = [],
  onUpdateQuantity,
  onUpdateItemDiscount,
  onRemoveItem,
  currency = 'Rs.',
}) {
  const [stockWarning, setStockWarning] = useState(null);

  const handleIncrement = (item) => {
    const nextQty = item.quantity + 1;
    if (nextQty > item.availableStock) {
      showWarning(item.productId, `Insufficient stock! Only ${item.availableStock} available.`);
      return;
    }
    onUpdateQuantity(item.productId, nextQty);
  };

  const handleDecrement = (item) => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.productId, item.quantity - 1);
    }
  };

  const handleQuantityInputChange = (item, val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) {
      onUpdateQuantity(item.productId, 1);
      return;
    }
    if (parsed > item.availableStock) {
      showWarning(item.productId, `Insufficient stock! Only ${item.availableStock} available.`);
      onUpdateQuantity(item.productId, Math.max(1, item.availableStock));
      return;
    }
    onUpdateQuantity(item.productId, parsed);
  };

  const handleDiscountChange = (item, val) => {
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 0) {
      onUpdateItemDiscount(item.productId, 0);
      return;
    }
    const maxDiscount = item.sellingPrice * item.quantity;
    if (parsed > maxDiscount) {
      onUpdateItemDiscount(item.productId, maxDiscount);
      return;
    }
    onUpdateItemDiscount(item.productId, parsed);
  };

  const showWarning = (id, message) => {
    setStockWarning({ id, message });
    setTimeout(() => {
      setStockWarning((prev) => (prev?.id === id ? null : prev));
    }, 3000);
  };

  if (!items || items.length === 0) {
    return (
      <div
        className="pos-cart-empty"
        style={{
          padding: '3rem 1.5rem',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.6 }}>🛒</div>
        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>
          No products added
        </h4>
        <p style={{ fontSize: '0.875rem' }}>
          Scan a barcode or search products from the catalog to add items to this bill.
        </p>
      </div>
    );
  }

  return (
    <div className="pos-cart-table-container" style={{ overflowX: 'auto' }}>
      <table
        className="pos-cart-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.875rem',
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <th style={{ padding: '0.75rem 0.5rem' }}>Product</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>Price</th>
            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', minWidth: '130px' }}>Quantity</th>
            <th style={{ padding: '0.75rem 0.5rem', minWidth: '90px' }}>Discount</th>
            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Total</th>
            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const lineTotal = calculateLineTotal(item.sellingPrice, item.quantity, item.itemDiscount);
            const isWarned = stockWarning?.id === item.productId;

            return (
              <tr
                key={item.productId}
                style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  backgroundColor: isWarned ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                  transition: 'background-color 0.2s',
                }}
              >
                {/* Product Name & SKU */}
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    SKU: {item.sku}
                  </div>
                  {isWarned && (
                    <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, marginTop: '2px' }}>
                      {stockWarning.message}
                    </div>
                  )}
                </td>

                {/* Unit Price */}
                <td style={{ padding: '0.75rem 0.5rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                  {formatCurrency(item.sellingPrice, currency)}
                </td>

                {/* Quantity Controls */}
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDecrement(item)}
                      disabled={item.quantity <= 1}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-primary)',
                        cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: item.quantity <= 1 ? 0.4 : 1,
                      }}
                      title="Decrease quantity"
                    >
                      −
                    </button>

                    <input
                      type="number"
                      min="1"
                      max={item.availableStock}
                      value={item.quantity}
                      onChange={(e) => handleQuantityInputChange(item, e.target.value)}
                      style={{
                        width: '46px',
                        height: '28px',
                        textAlign: 'center',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => handleIncrement(item)}
                      disabled={item.quantity >= item.availableStock}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-primary)',
                        cursor: item.quantity >= item.availableStock ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: item.quantity >= item.availableStock ? 0.4 : 1,
                      }}
                      title={item.quantity >= item.availableStock ? 'Max available stock reached' : 'Increase quantity'}
                    >
                      +
                    </button>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    max {item.availableStock}
                  </div>
                </td>

                {/* Optional Item Discount */}
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={item.itemDiscount || ''}
                    onChange={(e) => handleDiscountChange(item, e.target.value)}
                    style={{
                      width: '70px',
                      height: '28px',
                      padding: '2px 6px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      color: '#fbbf24',
                      fontSize: '0.8rem',
                      textAlign: 'right',
                    }}
                    title="Item specific discount"
                  />
                </td>

                {/* Line Total */}
                <td
                  style={{
                    padding: '0.75rem 0.5rem',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: '#34d399',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatCurrency(lineTotal, currency)}
                </td>

                {/* Remove Action */}
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.productId)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '1.1rem',
                      padding: '4px',
                      lineHeight: 1,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    title="Remove item from bill"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
