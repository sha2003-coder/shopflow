import React from 'react';

/**
 * Main application layout
 * Provides clean responsive scaffolding for page views.
 */
export default function MainLayout({ children }) {
  return (
    <div className="app-container">
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
