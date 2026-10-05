import React, { useState } from 'react';
import { formatCurrency } from '../utils/cartCalculations';

/**
 * Lightweight SVG Sales Trend Chart
 * Renders an interactive, responsive daily sales trend without external dependencies.
 *
 * @param {Object} props
 * @param {Array<{ date: string, formattedDate: string, sales: number, billCount: number }>} props.data
 * @param {string} [props.currency='Rs.']
 */
export default function SalesTrendChart({ data = [], currency = 'Rs.' }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const chartData = Array.isArray(data) ? data : [];
  const maxSales = Math.max(...chartData.map((d) => Number(d.sales) || 0), 100);
  const totalPeriodSales = chartData.reduce((sum, d) => sum + (Number(d.sales) || 0), 0);
  const activeDaysCount = chartData.filter((d) => Number(d.sales) > 0).length;

  // Chart coordinate dimensions
  const svgHeight = 220;
  const paddingBottom = 35;
  const paddingTop = 25;
  const graphHeight = svgHeight - paddingTop - paddingBottom;

  // Determine label interval so x-axis doesn't get overcrowded
  const labelInterval = chartData.length > 20 ? 4 : chartData.length > 10 ? 2 : 1;

  if (chartData.length === 0 || totalPeriodSales === 0) {
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              📈 Daily Sales Trend
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Sales distribution across the selected time period
            </p>
          </div>
        </div>
        <div
          style={{
            padding: '3rem 1rem',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '2rem', opacity: 0.5 }}>📊</span>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No sales recorded for the selected date range.</p>
        </div>
      </div>
    );
  }

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
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            📈 Daily Sales Trend
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Daily revenue performance across {chartData.length} day{chartData.length > 1 ? 's' : ''} ({activeDaysCount} active)
          </p>
        </div>

        {/* Quick stat */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Peak Day: </span>
            <strong style={{ color: '#38bdf8' }}>{formatCurrency(maxSales, currency)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Daily Avg: </span>
            <strong style={{ color: '#34d399' }}>
              {formatCurrency(totalPeriodSales / chartData.length, currency)}
            </strong>
          </div>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div style={{ position: 'relative', width: '100%', height: `${svgHeight}px`, overflow: 'visible' }}>
        <svg
          viewBox={`0 0 1000 ${svgHeight}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="trendBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="trendBarHoverGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingTop + graphHeight * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1="0"
                  y1={y}
                  x2="1000"
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* Bars */}
          {chartData.map((item, index) => {
            const barWidth = Math.max(8, Math.min(60, 800 / chartData.length));
            const totalWidth = 1000;
            const slotWidth = totalWidth / chartData.length;
            const x = index * slotWidth + (slotWidth - barWidth) / 2;

            const salesVal = Number(item.sales) || 0;
            const barHeight = Math.max(3, (salesVal / maxSales) * graphHeight);
            const y = paddingTop + graphHeight - barHeight;
            const isHovered = hoveredIndex === index;

            return (
              <g
                key={item.date || index}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Invisible hover trigger area for easy mouse interaction */}
                <rect
                  x={index * slotWidth}
                  y={0}
                  width={slotWidth}
                  height={svgHeight}
                  fill="transparent"
                />

                {/* Visible bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill={isHovered ? 'url(#trendBarHoverGradient)' : 'url(#trendBarGradient)'}
                  style={{
                    transition: 'all 0.2s ease',
                    filter: isHovered ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))' : 'none',
                  }}
                />

                {/* X-axis date labels */}
                {index % labelInterval === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    fill={isHovered ? '#f8fafc' : '#94a3b8'}
                    fontSize="11"
                    fontFamily="var(--font-main)"
                  >
                    {item.formattedDate || item.date}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <div
            style={{
              position: 'absolute',
              top: '5px',
              left: `${Math.min(
                85,
                Math.max(15, ((hoveredIndex + 0.5) / chartData.length) * 100)
              )}%`,
              transform: 'translateX(-50%)',
              background: '#0f172a',
              border: '1px solid #38bdf8',
              borderRadius: 'var(--radius-sm)',
              padding: '0.5rem 0.85rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
              📅 {chartData[hoveredIndex].formattedDate} ({chartData[hoveredIndex].date})
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
              {formatCurrency(chartData[hoveredIndex].sales, currency)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '0.15rem' }}>
              🧾 {chartData[hoveredIndex].billCount || 0} bill{chartData[hoveredIndex].billCount === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
