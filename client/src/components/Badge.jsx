import React from 'react';

/**
 * Reusable Status Badge component
 */
export default function Badge({ label, showDot = true }) {
  return (
    <div className="badge-wrapper">
      {showDot && <span className="status-dot" />}
      <span>{label}</span>
    </div>
  );
}
