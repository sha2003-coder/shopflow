import React from 'react';

/**
 * Reusable Card component for structured content display.
 */
export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`welcome-card ${className}`} {...props}>
      {children}
    </div>
  );
}
