import React from 'react';

/**
 * Reusable Metric Summary Card for Reports Dashboard
 *
 * @param {Object} props
 * @param {string} props.title - Card title (e.g. "Total Sales")
 * @param {string|number} props.value - Primary metric display value
 * @param {string} [props.subtitle] - Secondary caption or description
 * @param {string} [props.icon] - Emoji or icon character
 * @param {string} [props.accentColor] - Optional CSS color override (e.g. '#6366f1')
 * @param {string} [props.badgeText] - Optional status badge text
 * @param {string} [props.badgeType] - Badge style variant ('success', 'warning', 'danger', 'info')
 */
export default function ReportSummaryCard({
  title,
  value,
  subtitle,
  icon,
  accentColor = 'var(--accent-primary)',
  badgeText,
  badgeType = 'info',
}) {
  const getBadgeStyle = () => {
    switch (badgeType) {
      case 'danger':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        };
      case 'warning':
        return {
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        };
      case 'success':
        return {
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        };
      default:
        return {
          background: 'rgba(99, 102, 241, 0.15)',
          color: '#818cf8',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        };
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      {/* Decorative top border accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: accentColor || 'var(--accent-gradient)',
          opacity: 0.9,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
          }}
        >
          {title}
        </span>
        {icon && (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.15rem',
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.25rem' }}>
        <span
          style={{
            fontSize: '1.85rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-main)',
          }}
        >
          {value}
        </span>
        {badgeText && (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              ...getBadgeStyle(),
            }}
          >
            {badgeText}
          </span>
        )}
      </div>

      {subtitle && (
        <p
          style={{
            margin: '0.5rem 0 0 0',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
