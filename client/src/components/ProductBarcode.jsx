import React from 'react';
import BarcodeLabel from './BarcodeLabel';

/**
 * Reusable Product Barcode Sticker Component
 *
 * Wraps BarcodeLabel to provide:
 * 1. Complete Product Sticker Preview (Shop name, Product name, SKU, Price, Barcode, Number).
 * 2. "Download Sticker PNG" (with sanitized sticker-{sku}-{barcode}.png).
 * 3. "Print Sticker" with isolated @media print rules.
 *
 * @param {Object} props
 * @param {Object} props.product - The product object
 * @param {string} [props.idToken] - Firebase Auth ID token for fetching secure barcode images
 * @param {string} [props.shopName] - Current authenticated shop name
 * @param {string} [props.currency='Rs.'] - Currency symbol (defaults to 'Rs.')
 * @param {Function} [props.onClose] - Modal close callback
 * @param {string} [props.className] - Optional custom CSS class
 */
export default function ProductBarcode({
  product,
  idToken = null,
  shopName = 'ShopFlow',
  currency = 'Rs.',
  onClose = null,
  className = '',
}) {
  if (!product) {
    return (
      <div style={{ color: 'var(--text-muted, #94a3b8)', textAlign: 'center', padding: '1.5rem' }}>
        No product details provided.
      </div>
    );
  }

  return (
    <div className={`product-barcode-container ${className}`} style={{ width: '100%' }}>
      <BarcodeLabel
        product={product}
        idToken={idToken}
        shopName={shopName}
        currency={currency}
        onClose={onClose}
        showActions={true}
      />
    </div>
  );
}
