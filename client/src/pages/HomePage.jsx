import React from 'react';
import Card from '../components/Card';
import Badge from '../components/Badge';

/**
 * HomePage Component
 * Initial landing view displaying application identification and architectural readiness.
 */
export default function HomePage() {
  return (
    <div className="welcome-container">
      <Card>
        <Badge label="System Initialized" />
        
        <h1 className="title-primary">ShopFlow</h1>
        <h2 className="subtitle">Shop Management System</h2>
        
        <p className="description">
          Production-grade shop management and Point of Sale (POS) architecture. 
          Engineered for inventory management, high-speed billing, barcode scanning, and real-time reporting.
        </p>

        <div className="meta-grid">
          <div className="meta-item">
            <div className="meta-label">Architecture</div>
            <div className="meta-value">Clean Decoupled</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Frontend</div>
            <div className="meta-value">React + Vite</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Backend</div>
            <div className="meta-value">Express REST</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Status</div>
            <div className="meta-value">Ready</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
