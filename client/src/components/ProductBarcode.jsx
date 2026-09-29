import React, { useState, useEffect } from 'react';
import {
  getBarcodeImageBlobUrl,
  getBarcodeImageUrl,
  downloadBarcodeImage,
  getBarcodeFileName,
} from '../services/productService';

/**
 * Reusable Product Barcode Component
 * Supports:
 * 1. View Barcode: Code 128 image with human-readable numbers & product meta.
 * 2. Download Barcode: Direct PNG download formatted as `barcode-{sku}-{barcode}.png`.
 * 3. Print Barcode Label: Retail sticker print format via window.print() and @media print.
 */
export default function ProductBarcode({
  product,
  idToken,
  shopName = 'ShopFlow Retail',
  currency = 'Rs.',
  onClose = null,
  className = '',
}) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    let createdBlobUrl = null;

    if (!product?.id) {
      setLoading(false);
      return;
    }

    const loadBarcodeImage = async () => {
      try {
        setLoading(true);
        setError('');

        if (idToken) {
          const blobUrl = await getBarcodeImageBlobUrl(product.id, idToken);
          if (isMounted) {
            createdBlobUrl = blobUrl;
            setImageSrc(blobUrl);
          }
        } else {
          if (isMounted) {
            setImageSrc(getBarcodeImageUrl(product.id));
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('[ProductBarcode] Failed to load barcode image:', err);
          setError(err.message || 'Failed to load barcode image');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadBarcodeImage();

    return () => {
      isMounted = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [product?.id, idToken]);

  // Handler for direct PNG download
  const handleDownload = async () => {
    if (!product || downloading) return;
    try {
      setDownloading(true);
      setError('');
      await downloadBarcodeImage(product, idToken, imageSrc);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('[ProductBarcode] Download error:', err);
      setError(err.message || 'Failed to download barcode image.');
    } finally {
      setDownloading(false);
    }
  };

  // Handler for printing retail label
  const handlePrint = () => {
    window.print();
  };

  if (!product) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No product details provided.</div>;
  }

  const formattedPrice =
    typeof product.sellingPrice === 'number'
      ? `${currency} ${product.sellingPrice.toFixed(2)}`
      : '—';

  const previewFilename = getBarcodeFileName(product);

  return (
    <div className={`product-barcode-container ${className}`} style={{ width: '100%' }}>
      {/* Print-specific style isolating the sticker during window.print() */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          nav, header, footer, .navbar, .sidebar, .btn, .no-print, .modal-backdrop, .no-print-area {
            display: none !important;
          }
          .barcode-printable-area,
          .barcode-printable-area * {
            visibility: visible !important;
          }
          .barcode-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .barcode-sticker {
            width: 58mm !important;
            min-height: 38mm !important;
            max-width: 58mm !important;
            margin: 0 auto !important;
            padding: 2.5mm !important;
            box-shadow: none !important;
            border: 1px dashed #cbd5e1 !important;
            page-break-inside: avoid !important;
          }
          @page {
            size: auto;
            margin: 4mm;
          }
        }
      `}</style>

      {/* Action Buttons: Download Barcode, Print Label, Close */}
      <div
        className="no-print-area"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.625rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading || !imageSrc || downloading}
          className="btn btn-primary"
          style={{
            padding: '0.5rem 1.1rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: downloadSuccess ? '#059669' : undefined,
          }}
          title={`Download PNG as ${previewFilename}`}
        >
          {downloading ? '⏳ Downloading...' : downloadSuccess ? '✓ Downloaded!' : '⬇️ Download Barcode'}
        </button>

        <button
          type="button"
          onClick={handlePrint}
          disabled={loading || !imageSrc}
          className="btn btn-secondary"
          style={{
            padding: '0.5rem 1.1rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          🖨️ Print Label
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              padding: '0.5rem 0.85rem',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* Error alert if any */}
      {error && (
        <div
          className="no-print-area"
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#ef4444',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {/* Barcode Sticker Preview & Printable Area */}
      <div className="barcode-printable-area">
        <div
          className="barcode-sticker"
          style={{
            width: '280px',
            minHeight: '170px',
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            padding: '14px',
            margin: '0 auto',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Shop Header */}
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#475569',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {shopName}
          </div>

          {/* Product Name */}
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.25,
              margin: '4px 0',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {product.name || 'Unnamed Product'}
          </div>

          {/* SKU & Price Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8rem',
              marginBottom: '4px',
              padding: '0 2px',
            }}
          >
            <span style={{ fontFamily: 'monospace', color: '#64748b', fontWeight: 600 }}>
              SKU: {product.sku || 'N/A'}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#047857' }}>
              {formattedPrice}
            </span>
          </div>

          {/* Barcode Image View */}
          <div
            style={{
              minHeight: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '2px 0',
            }}
          >
            {loading && (
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Generating barcode...
              </div>
            )}

            {!loading && imageSrc && (
              <img
                src={imageSrc}
                alt={`Barcode for ${product.name}`}
                style={{
                  maxWidth: '100%',
                  height: '50px',
                  objectFit: 'contain',
                  display: 'block',
                  imageRendering: 'crisp-edges',
                }}
              />
            )}
          </div>

          {/* Barcode Number Display */}
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#1e293b',
              marginTop: '2px',
            }}
          >
            {product.barcode || '—'}
          </div>
        </div>
      </div>

      {/* Filename information hint */}
      <div
        className="no-print-area"
        style={{
          marginTop: '0.75rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted, #94a3b8)',
          fontFamily: 'monospace',
        }}
      >
        File: {previewFilename}
      </div>
    </div>
  );
}
