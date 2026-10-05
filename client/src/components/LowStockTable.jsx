import React, { useState } from 'react';

/**
 * Low Stock & Out of Stock Inventory Report Component
 *
 * @param {Object} props
 * @param {Array<{ id: string, name: string, sku: string, barcode: string, currentStock: number, lowStockLevel: number, status: string }>} props.products
 * @param {number} [props.outOfStockCount]
 * @param {number} [props.lowStockCount]
 */
export default function LowStockTable({
  products = [],
  outOfStockCount = 0,
  lowStockCount = 0,
}) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'out_of_stock' | 'low_stock'

  const allItems = Array.isArray(products) ? products : [];

  const filteredItems = allItems.filter((item) => {
    if (filterMode === 'out_of_stock') return item.currentStock === 0;
    if (filterMode === 'low_stock') return item.currentStock > 0;
    return true;
  });

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header with status counts */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              ⚠️ Low Stock & Inventory Alerts
            </h3>
            {outOfStockCount > 0 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                }}
              >
                Out of Stock Products: {outOfStockCount}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Products at or below their configured minimum threshold (stockQuantity &le; lowStockLevel)
          </p>
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-sm)',
              border: filterMode === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              background: filterMode === 'all' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: filterMode === 'all' ? '#818cf8' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            All Alerts ({allItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('out_of_stock')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-sm)',
              border: filterMode === 'out_of_stock' ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
              background: filterMode === 'out_of_stock' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: filterMode === 'out_of_stock' ? '#ef4444' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Out of Stock ({outOfStockCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('low_stock')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-sm)',
              border: filterMode === 'low_stock' ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
              background: filterMode === 'low_stock' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: filterMode === 'low_stock' ? '#f59e0b' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Low Stock ({lowStockCount - outOfStockCount > 0 ? lowStockCount - outOfStockCount : 0})
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>✨</span>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {filterMode === 'out_of_stock'
              ? 'No products are currently out of stock.'
              : 'All products are currently well-stocked above their minimum threshold.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Product</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>SKU</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Barcode</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'center' }}>Current Stock</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'center' }}>Low Stock Level</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((product) => {
                const isOutOfStock = product.currentStock === 0;

                return (
                  <tr
                    key={product.id || product.sku}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background-color 0.15s ease',
                      backgroundColor: isOutOfStock ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isOutOfStock
                        ? 'rgba(239, 68, 68, 0.07)'
                        : 'rgba(255, 255, 255, 0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isOutOfStock
                        ? 'rgba(239, 68, 68, 0.03)'
                        : 'transparent';
                    }}
                  >
                    <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {product.name}
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {product.sku || '-'}
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {product.barcode || '-'}
                    </td>
                    <td
                      style={{
                        padding: '0.85rem 0.5rem',
                        textAlign: 'center',
                        fontWeight: 700,
                        color: isOutOfStock ? '#ef4444' : '#f59e0b',
                      }}
                    >
                      {product.currentStock}
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {product.lowStockLevel}
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.25rem 0.65rem',
                          borderRadius: 'var(--radius-full)',
                          background: isOutOfStock ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isOutOfStock ? '#f87171' : '#fbbf24',
                          border: isOutOfStock ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                        }}
                      >
                        {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
