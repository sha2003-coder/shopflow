import React, { useState, useEffect } from 'react';
import {
  getBarcodeImageBlobUrl,
  getBarcodeImageUrl,
  downloadBarcodeImage,
} from '../services/productService';

/**
 * Printable Barcode Label Component
 * Formats a retail-standard barcode sticker containing Shop Name, Product Name,
 * SKU, Selling Price, Code 128 barcode image, and human-readable barcode number.
 *
 * Utilizes @media print styling so only the sticker is printed,
 * hiding buttons, navigation, and background UI elements.
 */
export default function BarcodeLabel({
  product,
  shopName = 'ShopFlow Retail',
  currency = '$',
  idToken = null,
  onClose = null,
}) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    let blobUrl = null;

    if (!product?.id) {
      setLoading(false);
      return;
    }

    const fetchImage = async () => {
      try {
        setLoading(true);
        setError('');

        if (idToken) {
          const url = await getBarcodeImageBlobUrl(product.id, idToken);
          if (isMounted) {
            blobUrl = url;
            setImageSrc(url);
          }
        } else {
          if (isMounted) {
            setImageSrc(getBarcodeImageUrl(product.id));
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('[BarcodeLabel] Failed to load barcode image:', err);
          setError(err.message || 'Failed to load barcode image');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [product?.id, idToken]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!product || downloading) return;
    try {
      setDownloading(true);
      setError('');
      await downloadBarcodeImage(product, idToken, imageSrc);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('[BarcodeLabel] Download error:', err);
      setError(err.message || 'Failed to download barcode image.');
    } finally {
      setDownloading(false);
    }
  };

  const formattedPrice =
    typeof product?.sellingPrice === 'number'
      ? `${currency}${product.sellingPrice.toFixed(2)}`
      : '—';

  return (
    <div className="barcode-label-wrapper">
      {/* Inline Print Styles strictly isolating the barcode sticker during print */}
      <style>{`
        @media print {
          /* Hide all non-printable elements */
          body * {
            visibility: hidden !important;
          }
          nav, header, footer, .navbar, .sidebar, .btn, .no-print, .modal-backdrop {
            display: none !important;
          }

          /* Show and position only the label sticker */
          .barcode-sticker-print-area,
          .barcode-sticker-print-area * {
            visibility: visible !important;
          }
          .barcode-sticker-print-area {
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

        /* Screen preview styling */
        .barcode-sticker {
          width: 260px;
          min-height: 160px;
          background: #ffffff;
          color: #0f172a;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 12px;
          margin: 0 auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .sticker-shop-name {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sticker-product-name {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.2;
          margin: 4px 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .sticker-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          margin-bottom: 4px;
          padding: 0 2px;
        }

        .sticker-sku {
          font-family: monospace;
          color: #64748b;
          font-weight: 600;
        }

        .sticker-price {
          font-size: 0.95rem;
          font-weight: 800;
          color: #047857;
        }

        .sticker-barcode-img {
          max-width: 100%;
          height: 48px;
          object-fit: contain;
          margin: 2px auto;
          display: block;
          image-rendering: pixelated;
        }

        .sticker-barcode-number {
          font-family: monospace;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #1e293b;
          margin-top: 2px;
        }
      `}</style>

      {/* Screen action controls */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'center',
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
            background: downloadSuccess ? '#059669' : undefined,
          }}
        >
          {downloading ? '⏳ Downloading...' : downloadSuccess ? '✓ Downloaded!' : '⬇️ Download Barcode'}
        </button>

        <button
          type="button"
          onClick={handlePrint}
          disabled={loading || !imageSrc}
          className="btn btn-secondary"
          style={{ padding: '0.5rem 1.1rem', fontSize: '0.875rem' }}
        >
          🖨️ Print Label
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.875rem' }}
          >
            Close
          </button>
        )}
      </div>

      {/* Printable sticker area */}
      <div className="barcode-sticker-print-area">
        <div className="barcode-sticker">
          {/* Header: Shop Name */}
          <div className="sticker-shop-name">{shopName}</div>

          {/* Product Name */}
          <div className="sticker-product-name">{product?.name || 'Product Name'}</div>

          {/* SKU and Price Row */}
          <div className="sticker-meta-row">
            <span className="sticker-sku">SKU: {product?.sku || 'N/A'}</span>
            <span className="sticker-price">{formattedPrice}</span>
          </div>

          {/* Barcode image */}
          {loading && (
            <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b' }}>
              Loading barcode...
            </div>
          )}

          {error && !loading && (
            <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#ef4444' }}>
              {error}
            </div>
          )}

          {imageSrc && !loading && (
            <img
              src={imageSrc}
              alt={`Barcode ${product?.barcode}`}
              className="sticker-barcode-img"
            />
          )}

          {/* Human readable barcode number */}
          <div className="sticker-barcode-number">
            {product?.barcode || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
