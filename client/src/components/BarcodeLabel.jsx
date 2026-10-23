import React, { useState, useEffect, useRef } from 'react';
import {
  getBarcodeImageBlobUrl,
  getBarcodeImageUrl,
  downloadBarcodeImage,
} from '../services/productService';
import { downloadStickerPng, getStickerFileName } from '../utils/stickerRenderer';

/**
 * Printable Product Barcode Sticker Component
 *
 * Formats a clean, retail-standard barcode sticker according to specification:
 * ┌─────────────────────────────┐
 * │       ABC SUPERMARKET       │
 * │                             │
 * │ Coca Cola 500ml             │
 * │ SKU: CC001                  │
 * │ PRICE: Rs. 150.00           │
 * │                             │
 * │     || ||| || || ||||       │
 * │       200000000001          │
 * └─────────────────────────────┘
 *
 * Supports:
 * - "Download Sticker PNG": Full sticker image (shop name, product name, SKU, price, barcode, number).
 * - "Print Sticker": Browser printing using @media print with ~50x30 mm thermal/sticker label layout.
 */
export default function BarcodeLabel({
  product,
  shopName = 'ShopFlow',
  currency = 'Rs.',
  idToken = null,
  onClose = null,
  showActions = true,
  isBulkItem = false,
  className = '',
}) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingSticker, setDownloadingSticker] = useState(false);
  const [stickerDownloadSuccess, setStickerDownloadSuccess] = useState(false);
  const [downloadingBarcodeOnly, setDownloadingBarcodeOnly] = useState(false);
  const [error, setError] = useState('');

  const stickerCardRef = useRef(null);

  // Authenticated shop name with safe fallback
  const resolvedShopName = String(shopName || 'ShopFlow').trim() || 'ShopFlow';
  const resolvedCurrency = String(currency || 'Rs.').trim() || 'Rs.';

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

  // Handler for printing single sticker
  const handlePrint = () => {
    window.print();
  };

  // Handler for downloading the FULL sticker as PNG
  const handleDownloadSticker = async () => {
    if (!product || downloadingSticker) return;
    try {
      setDownloadingSticker(true);
      setError('');
      await downloadStickerPng(
        stickerCardRef.current,
        product,
        resolvedShopName,
        resolvedCurrency,
        imageSrc
      );
      setStickerDownloadSuccess(true);
      setTimeout(() => setStickerDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('[BarcodeLabel] Download sticker error:', err);
      setError(err.message || 'Failed to download sticker PNG.');
    } finally {
      setDownloadingSticker(false);
    }
  };

  // Optional: Download raw barcode bars only (backward compatibility)
  const handleDownloadBarcodeOnly = async () => {
    if (!product || downloadingBarcodeOnly) return;
    try {
      setDownloadingBarcodeOnly(true);
      setError('');
      await downloadBarcodeImage(product, idToken, imageSrc);
    } catch (err) {
      console.error('[BarcodeLabel] Download barcode error:', err);
      setError(err.message || 'Failed to download barcode image.');
    } finally {
      setDownloadingBarcodeOnly(false);
    }
  };

  const priceNum =
    typeof product?.sellingPrice === 'number'
      ? product.sellingPrice
      : parseFloat(product?.sellingPrice);
  const formattedPrice = !isNaN(priceNum)
    ? `PRICE: ${resolvedCurrency} ${priceNum.toFixed(2)}`
    : `PRICE: ${resolvedCurrency} —`;

  const stickerFilename = product ? getStickerFileName(product) : '';

  return (
    <div className={`barcode-label-wrapper ${className}`}>
      {/* Inline styles for screen preview and printing */}
      <style>{`
        @media print {
          /* Hide non-sticker UI */
          body * {
            visibility: hidden !important;
          }
          nav, header, footer, .navbar, .sidebar, .btn, .no-print, .no-print-area, .modal-backdrop {
            display: none !important;
          }

          /* Show and position single sticker area */
          .barcode-sticker-single-area,
          .barcode-sticker-single-area * {
            visibility: visible !important;
          }

          .barcode-sticker-single-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
          }

          /* Compact 50mm x 30mm standard retail sticker dimensions */
          .barcode-sticker {
            width: 50mm !important;
            min-height: 30mm !important;
            max-width: 50mm !important;
            margin: 0 auto !important;
            padding: 2mm 2.5mm !important;
            box-shadow: none !important;
            border: 1px solid #000000 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-sizing: border-box !important;
          }

          .sticker-shop-name {
            font-size: 7pt !important;
            font-weight: 800 !important;
            color: #000000 !important;
            border-bottom: 0.5pt solid #000000 !important;
            padding-bottom: 1mm !important;
            margin-bottom: 1mm !important;
            text-align: center !important;
          }

          .sticker-product-name {
            font-size: 8pt !important;
            font-weight: 800 !important;
            color: #000000 !important;
            line-height: 1.15 !important;
            margin: 1mm 0 !important;
            text-align: left !important;
          }

          .sticker-meta-row {
            font-size: 7pt !important;
            margin: 1mm 0 !important;
            display: flex !important;
            justify-content: space-between !important;
          }

          .sticker-sku {
            font-size: 6.5pt !important;
            color: #000000 !important;
            font-family: monospace !important;
          }

          .sticker-price {
            font-size: 7.5pt !important;
            font-weight: 800 !important;
            color: #000000 !important;
          }

          .sticker-barcode-container {
            margin: 1mm 0 !important;
          }

          .sticker-barcode-img {
            height: 12mm !important;
            max-width: 100% !important;
            margin: 0.5mm auto !important;
            display: block !important;
            image-rendering: pixelated !important;
          }

          .sticker-barcode-number {
            font-size: 7pt !important;
            font-weight: 700 !important;
            color: #000000 !important;
            letter-spacing: 0.08em !important;
            margin-top: 0.5mm !important;
            text-align: center !important;
            font-family: monospace !important;
          }

          @page {
            size: auto;
            margin: 2mm;
          }
        }

        /* Screen Preview Styling */
        .barcode-sticker {
          width: 280px;
          min-height: 175px;
          background: #ffffff;
          color: #0f172a;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
          padding: 12px 14px;
          margin: 0 auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-sizing: border-box;
          user-select: text;
        }

        .sticker-shop-name {
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
          margin-bottom: 4px;
        }

        .sticker-product-name {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.25;
          margin: 3px 0;
          text-align: left;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }

        .sticker-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8125rem;
          margin: 4px 0;
          padding: 0 1px;
        }

        .sticker-sku {
          font-family: Consolas, Monaco, "Courier New", monospace;
          color: #475569;
          font-weight: 600;
          font-size: 0.775rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 50%;
          text-align: left;
        }

        .sticker-price {
          font-size: 0.875rem;
          font-weight: 800;
          color: #047857;
          white-space: nowrap;
          text-align: right;
        }

        .sticker-barcode-container {
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 2px 0;
        }

        .sticker-barcode-img {
          max-width: 95%;
          height: 48px;
          object-fit: contain;
          margin: 0 auto;
          display: block;
          image-rendering: pixelated;
        }

        .sticker-barcode-number {
          font-family: Consolas, Monaco, "Courier New", monospace;
          font-size: 0.825rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #1e293b;
          margin-top: 2px;
        }
      `}</style>

      {/* Action Controls (Hidden during Print) */}
      {showActions && (
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
          {/* Download Sticker PNG (Primary Action) */}
          <button
            type="button"
            onClick={handleDownloadSticker}
            disabled={loading || !imageSrc || downloadingSticker}
            className="btn btn-primary"
            style={{
              padding: '0.55rem 1.15rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: stickerDownloadSuccess ? '#059669' : undefined,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}
            title={`Download complete sticker as ${stickerFilename}`}
          >
            {downloadingSticker
              ? '⏳ Generating PNG...'
              : stickerDownloadSuccess
              ? '✓ Sticker Downloaded!'
              : '⬇️ Download Sticker PNG'}
          </button>

          {/* Print Sticker Action */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !imageSrc}
            className="btn btn-secondary"
            style={{
              padding: '0.55rem 1.15rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            🖨️ Print Sticker
          </button>

          {/* Optional Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{
                padding: '0.55rem 0.95rem',
                fontSize: '0.875rem',
              }}
            >
              Close
            </button>
          )}
        </div>
      )}

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

      {/* Printable Sticker Area */}
      <div className={isBulkItem ? 'barcode-sticker-bulk-item' : 'barcode-sticker-single-area'}>
        <div className="barcode-sticker" ref={stickerCardRef}>
          {/* 1. Shop Name at Top */}
          <div className="sticker-shop-name" title={resolvedShopName}>
            {resolvedShopName}
          </div>

          {/* 2. Product Name */}
          <div className="sticker-product-name" title={product?.name}>
            {product?.name || 'Product Name'}
          </div>

          {/* 3. SKU & Selling Price Row */}
          <div className="sticker-meta-row">
            <span className="sticker-sku" title={`SKU: ${product?.sku || 'N/A'}`}>
              SKU: {product?.sku || 'N/A'}
            </span>
            <span className="sticker-price">{formattedPrice}</span>
          </div>

          {/* 4. Barcode Image */}
          <div className="sticker-barcode-container">
            {loading && (
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Loading barcode...
              </div>
            )}

            {!loading && imageSrc && (
              <img
                src={imageSrc}
                alt={`Barcode for ${product?.barcode}`}
                className="sticker-barcode-img"
              />
            )}

            {!loading && !imageSrc && !error && (
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                No barcode available
              </div>
            )}
          </div>

          {/* 5. Human-readable Barcode Number Underneath */}
          <div className="sticker-barcode-number">
            {product?.barcode || '—'}
          </div>
        </div>
      </div>

      {/* Filename information hint and secondary action */}
      {showActions && (
        <div
          className="no-print-area"
          style={{
            marginTop: '0.85rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted, #94a3b8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            alignItems: 'center',
          }}
        >
          <div>
            Output file:{' '}
            <code style={{ color: '#38bdf8', fontSize: '0.75rem' }}>{stickerFilename}</code>
          </div>
          <button
            type="button"
            onClick={handleDownloadBarcodeOnly}
            disabled={loading || !imageSrc || downloadingBarcodeOnly}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0.2rem',
            }}
            title="Download only the Code 128 barcode bars PNG"
          >
            {downloadingBarcodeOnly ? 'Downloading barcode...' : 'Download barcode bars only'}
          </button>
        </div>
      )}
    </div>
  );
}
