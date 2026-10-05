import React from 'react';
import { formatCurrency } from '../utils/cartCalculations';

/**
 * Top-Selling Products Table Component
 * Displays ranking, product names, SKUs, historical quantities sold, and revenue generated.
 *
 * @param {Object} props
 * @param {Array<{ productId: string, name: string, sku: string, quantitySold: number, salesValue: number }>} props.products
 * @param {string} [props.currency='Rs.']
 */
export default function TopProductsTable({ products = [], currency = 'Rs.' }) {
  const topList = Array.isArray(products) ? products : [];

  if (topList.length === 0) {
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '2rem 1.5rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          🏆 Top Selling Products
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 1.5rem 0' }}>
          Ranked by quantity sold during selected period
        </p>
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No products sold in this date range.</p>
        </div>
      </div>
    );
  }

  const getRankBadge = (rank) => {
    if (rank === 1) return { bg: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: 'rgba(234, 179, 8, 0.4)', text: '🥇 #1' };
    if (rank === 2) return { bg: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.4)', text: '🥈 #2' };
    if (rank === 3) return { bg: 'rgba(217, 119, 6, 0.2)', color: '#fb923c', border: 'rgba(217, 119, 6, 0.4)', text: '🥉 #3' };
    return { bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: 'var(--border-subtle)', text: `#${rank}` };
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            🏆 Top Selling Products
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Top {topList.length} product{topList.length === 1 ? '' : 's'} ranked by units sold
          </p>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(99, 102, 241, 0.12)',
            color: '#818cf8',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          Historical Value
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, width: '70px' }}>Rank</th>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Product</th>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>SKU</th>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Qty Sold</th>
              <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Sales Value</th>
            </tr>
          </thead>
          <tbody>
            {topList.map((product, index) => {
              const rank = index + 1;
              const badge = getRankBadge(rank);

              return (
                <tr
                  key={product.productId || product.sku || index}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: '0.85rem 0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        display: 'inline-block',
                      }}
                    >
                      {badge.text}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {product.name}
                  </td>
                  <td style={{ padding: '0.85rem 0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {product.sku || '-'}
                  </td>
                  <td
                    style={{
                      padding: '0.85rem 0.5rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#38bdf8',
                    }}
                  >
                    {product.quantitySold}
                  </td>
                  <td
                    style={{
                      padding: '0.85rem 0.5rem',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {formatCurrency(product.salesValue, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
