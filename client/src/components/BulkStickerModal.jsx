import React from 'react';
import BarcodeLabel from './BarcodeLabel';

/**
 * Bulk Sticker Print Modal Component
 *
 * Allows users to preview and print multiple product stickers simultaneously.
 * Formats a clean printable grid where each sticker maintains ~50x30mm dimensions
 * and avoids breaking across page boundaries.
 */
export default function BulkStickerModal({
  products = [],
  shopName = 'ShopFlow',
  currency = 'Rs.',
  idToken = null,
  onClose,
}) {
  const handlePrintAll = () => {
    window.print();
  };

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div
      className="modal-backdrop no-print"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      {/* Print-specific style for bulk sticker printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          nav, header, footer, .navbar, .sidebar, .btn, .no-print, .no-print-area, .modal-backdrop {
            display: none !important;
          }

          .bulk-sticker-printable-area,
          .bulk-sticker-printable-area * {
            visibility: visible !important;
          }

          .bulk-sticker-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            gap: 4mm !important;
            justify-content: flex-start !important;
          }

          .bulk-sticker-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 2mm !important;
          }

          .barcode-sticker {
            width: 50mm !important;
            min-height: 30mm !important;
            max-width: 50mm !important;
            margin: 0 !important;
            padding: 2mm 2.5mm !important;
            box-shadow: none !important;
            border: 1px solid #000000 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-sizing: border-box !important;
          }

          @page {
            size: auto;
            margin: 4mm;
          }
        }
      `}</style>

      <div
        style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '1000px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '0.85rem',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.2rem',
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🏷️</span> Batch Barcode Stickers ({products.length})
            </h3>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '0.8rem',
                color: 'var(--text-muted, #94a3b8)',
              }}
            >
              Shop: <strong>{shopName}</strong> | Ready for multi-label printing
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handlePrintAll}
              className="btn btn-primary"
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              🖨️ Print All Stickers
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.5rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0 0.25rem',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Stickers Grid */}
        <div
          className="bulk-sticker-printable-area"
          style={{
            overflowY: 'auto',
            padding: '1rem 0.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '1.5rem',
            justifyItems: 'center',
            alignItems: 'start',
          }}
        >
          {products.map((p) => (
            <div key={p.id} className="bulk-sticker-item">
              <BarcodeLabel
                product={p}
                shopName={shopName}
                currency={currency}
                idToken={idToken}
                showActions={true}
                isBulkItem={true}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
