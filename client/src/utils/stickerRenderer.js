import html2canvas from 'html2canvas';

/**
 * Standardizes and sanitizes filename for sticker PNG downloads.
 * Format: sticker-{product-sku}-{product-barcode}.png
 *
 * @param {Object} product - Product object containing sku and barcode
 * @returns {string} Sanitized filename
 */
export const getStickerFileName = (product) => {
  const rawSku = String(product?.sku || 'SKU').trim();
  const sanitizedSku =
    rawSku
      .replace(/[/\\?%*:|"<> ]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'SKU';

  const rawBarcode = String(product?.barcode || 'barcode').trim();
  const sanitizedBarcode = rawBarcode.replace(/[/\\?%*:|"<> ]/g, '') || 'barcode';

  return `sticker-${sanitizedSku}-${sanitizedBarcode}.png`;
};

/**
 * Helper to trigger browser download of a Blob as a file.
 */
function triggerBlobDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.setAttribute('style', 'display: none;');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 2000);
}

/**
 * Loads an image from a URL or Blob URL into an HTMLImageElement.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for canvas render'));
    img.src = src;
  });
}

/**
 * Fallback Canvas Renderer:
 * Direct 2D Canvas rendering of the complete retail sticker.
 * Produces a high-DPI (300 DPI equivalent) 840 x 510 px PNG image
 * with white background, sharp text, and scannable barcode.
 */
export async function renderStickerToCanvas(product, shopName, currency, barcodeSrc) {
  const canvas = document.createElement('canvas');
  // Dimensions for high-DPI crisp print/preview (50mm x 30mm ratio)
  const width = 840;
  const height = 510;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // 1. Pure White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. Subtle outer border guide
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  const paddingX = 36;
  let currentY = 48;

  // 3. Shop Name (Centered, Uppercase, Bold)
  const displayShop = String(shopName || 'ShopFlow Retail').trim().toUpperCase();
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(displayShop, width / 2, currentY);

  currentY += 24;

  // Thin separator line
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(paddingX, currentY);
  ctx.lineTo(width - paddingX, currentY);
  ctx.stroke();

  currentY += 36;

  // 4. Product Name (Left-aligned, Bold, Wrapped up to 2 lines)
  const productName = String(product?.name || 'Product Name').trim();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';

  const maxTextWidth = width - paddingX * 2;
  const words = productName.split(' ');
  let line = '';
  let lineCount = 0;
  const maxLines = 2;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxTextWidth && n > 0) {
      if (lineCount === maxLines - 1) {
        // Truncate second line with ellipsis if still overflowing
        line = line.trim() + '...';
        break;
      }
      ctx.fillText(line.trim(), paddingX, currentY);
      line = words[n] + ' ';
      currentY += 40;
      lineCount++;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), paddingX, currentY);
  currentY += 42;

  // 5. SKU & Selling Price Row
  const rawSku = String(product?.sku || 'N/A').trim();
  const skuText = `SKU: ${rawSku}`;

  const priceNum = typeof product?.sellingPrice === 'number' ? product.sellingPrice : parseFloat(product?.sellingPrice);
  const formattedPrice = !isNaN(priceNum)
    ? `PRICE: ${currency} ${priceNum.toFixed(2)}`
    : `PRICE: ${currency} —`;

  // Draw SKU (monospace, left-aligned)
  ctx.fillStyle = '#475569';
  ctx.font = '600 28px Consolas, Monaco, "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(skuText, paddingX, currentY);

  // Draw Selling Price (bold, right-aligned)
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formattedPrice, width - paddingX, currentY);

  currentY += 16;

  // 6. Barcode Image (Centered with proper aspect ratio & quiet zone)
  if (barcodeSrc) {
    try {
      const img = await loadImage(barcodeSrc);
      const targetHeight = 150;
      const aspect = img.width / (img.height || 1);
      let targetWidth = targetHeight * aspect;
      const maxBarcodeWidth = width - paddingX * 2;

      if (targetWidth > maxBarcodeWidth) {
        targetWidth = maxBarcodeWidth;
      }

      const imgX = (width - targetWidth) / 2;
      ctx.drawImage(img, imgX, currentY, targetWidth, targetHeight);
      currentY += targetHeight + 10;
    } catch (e) {
      console.warn('[renderStickerToCanvas] Could not draw barcode image directly:', e);
      currentY += 160;
    }
  } else {
    currentY += 160;
  }

  // 7. Human-readable Barcode Number (Centered, Monospace, Spaced)
  const barcodeNumber = String(product?.barcode || '—').trim();
  ctx.fillStyle = '#1e293b';
  ctx.font = '700 30px Consolas, Monaco, "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '3px';
  ctx.fillText(barcodeNumber, width / 2, currentY + 18);

  return canvas;
}

/**
 * Downloads the full sticker as a PNG image.
 * Uses html2canvas for pixel-perfect DOM rendering with scale: 3 for crispness,
 * with automatic fallback to high-DPI HTML5 2D Canvas rendering.
 *
 * @param {HTMLElement} stickerElement - DOM element containing the sticker preview
 * @param {Object} product - Product details
 * @param {string} shopName - Authenticated shop name
 * @param {string} currency - Currency symbol (e.g. 'Rs.')
 * @param {string} [barcodeSrc] - Barcode image source URL/blob
 * @returns {Promise<string>} Downloaded filename
 */
export async function downloadStickerPng(
  stickerElement,
  product,
  shopName = 'ShopFlow Retail',
  currency = 'Rs.',
  barcodeSrc = null
) {
  if (!product) {
    throw new Error('Product is required to generate sticker PNG.');
  }

  const filename = getStickerFileName(product);

  // Strategy 1: Render DOM sticker element with html2canvas at scale 3
  if (stickerElement) {
    try {
      const canvas = await html2canvas(stickerElement, {
        scale: 3, // Crisp 300 DPI equivalent
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 5000,
      });

      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      if (blob) {
        triggerBlobDownload(blob, filename);
        return filename;
      }
    } catch (html2canvasErr) {
      console.warn('[downloadStickerPng] html2canvas error, falling back to 2D canvas:', html2canvasErr);
    }
  }

  // Strategy 2: High-DPI 2D Canvas Fallback
  const fallbackCanvas = await renderStickerToCanvas(product, shopName, currency, barcodeSrc);
  const fallbackBlob = await new Promise((resolve) => {
    fallbackCanvas.toBlob((b) => resolve(b), 'image/png');
  });

  if (!fallbackBlob) {
    throw new Error('Failed to create PNG blob for sticker.');
  }

  triggerBlobDownload(fallbackBlob, filename);
  return filename;
}

export default {
  getStickerFileName,
  downloadStickerPng,
  renderStickerToCanvas,
};
