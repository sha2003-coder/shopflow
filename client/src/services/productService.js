/**
 * Product API Service
 * Centralizes all Product & Inventory endpoints.
 * Handles token attachment, query parameter serialization, and error parsing.
 */

import API_BASE_URL from '../config/apiConfig';

/**
 * Internal authenticated request helper
 */
async function productApiRequest(endpoint, options = {}, idToken = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error?.message || `Request failed with status ${response.status}`);
    error.statusCode = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Creates a new product for the authenticated user's shop.
 * @param {Object} productData
 * @param {string} idToken
 * @returns {Promise<{success: boolean, message: string, product: Object}>}
 */
export const createProduct = (productData, idToken) =>
  productApiRequest(
    '/products',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    },
    idToken
  );

/**
 * Retrieves products belonging to the user's shop with optional search/filtering.
 * @param {Object} [params] - Optional query params: { search, category, lowStock }
 * @param {string} idToken
 * @returns {Promise<{success: boolean, count: number, products: Array}>}
 */
export const getProducts = (params = {}, idToken) => {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.category) query.append('category', params.category);
  if (params.lowStock) query.append('lowStock', 'true');

  const queryString = query.toString();
  const endpoint = queryString ? `/products?${queryString}` : '/products';

  return productApiRequest(endpoint, { method: 'GET' }, idToken);
};

/**
 * Retrieves a single product by ID.
 * @param {string} id
 * @param {string} idToken
 * @returns {Promise<{success: boolean, product: Object}>}
 */
export const getProduct = (id, idToken) =>
  productApiRequest(`/products/${id}`, { method: 'GET' }, idToken);

/**
 * Retrieves a product by its barcode within the shop.
 * @param {string} barcode
 * @param {string} idToken
 * @returns {Promise<{success: boolean, product: Object}>}
 */
export const getProductByBarcode = (barcode, idToken) =>
  productApiRequest(`/products/barcode/${encodeURIComponent(barcode)}`, { method: 'GET' }, idToken);

/**
 * Updates an existing product.
 * @param {string} id
 * @param {Object} productData
 * @param {string} idToken
 * @returns {Promise<{success: boolean, message: string, product: Object}>}
 */
export const updateProduct = (id, productData, idToken) =>
  productApiRequest(
    `/products/${id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    },
    idToken
  );

/**
 * Deletes a product from the user's shop.
 * @param {string} id
 * @param {string} idToken
 * @returns {Promise<{success: boolean, message: string, id: string}>}
 */
/**
 * Deletes a product from the user's shop.
 * @param {string} id
 * @param {string} idToken
 * @returns {Promise<{success: boolean, message: string, id: string}>}
 */
export const deleteProduct = (id, idToken) =>
  productApiRequest(`/products/${id}`, { method: 'DELETE' }, idToken);

/**
 * Returns the direct URL for a product's barcode PNG image.
 * @param {string} id
 * @param {string} [idToken]
 * @returns {string}
 */
export const getBarcodeImageUrl = (id, idToken = null) => {
  const url = `${API_BASE_URL}/products/${id}/barcode-image`;
  return idToken ? `${url}?token=${encodeURIComponent(idToken)}` : url;
};

/**
 * Fetches the barcode image via authenticated request and returns an object URL (blob).
 * @param {string} id
 * @param {string} idToken
 * @returns {Promise<string>} Blob URL suitable for <img src={...} />
 */
export const getBarcodeImageBlobUrl = async (id, idToken) => {
  const url = `${API_BASE_URL}/products/${id}/barcode-image`;
  const headers = {};
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch barcode image (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Formats a standardized, sanitized filename for a product's barcode PNG image.
 * Format: barcode-{product-sku}-{product-barcode}.png
 * @param {Object} product
 * @returns {string}
 */
export const getBarcodeFileName = (product) => {
  const rawSku = String(product?.sku || 'SKU').trim();
  const sanitizedSku = rawSku
    .replace(/[/\\?%*:|"<> ]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'SKU';
  const barcode = String(product?.barcode || '').trim() || 'barcode';
  return `barcode-${sanitizedSku}-${barcode}.png`;
};

/**
 * Downloads the product's barcode PNG directly to the user's browser.
 * Reuses the existing backend endpoint GET /api/products/:id/barcode-image.
 * @param {Object} product - Product object
 * @param {string} [idToken] - Firebase Auth ID token
 * @param {string} [existingBlobUrl] - Optional existing blob URL to avoid redundant network fetch
 * @returns {Promise<string>} Downloaded filename
 */
export const downloadBarcodeImage = async (product, idToken, existingBlobUrl = null) => {
  if (!product?.id) {
    throw new Error('Product object with valid id is required to download barcode.');
  }

  const filename = getBarcodeFileName(product);
  let blobUrl = existingBlobUrl;
  let shouldRevoke = false;

  if (!blobUrl) {
    blobUrl = await getBarcodeImageBlobUrl(product.id, idToken);
    shouldRevoke = true;
  }

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.setAttribute('style', 'display: none;');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (shouldRevoke) {
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 2000);
  }

  return filename;
};

export default {
  createProduct,
  getProducts,
  getProduct,
  getProductByBarcode,
  updateProduct,
  deleteProduct,
  getBarcodeImageUrl,
  getBarcodeImageBlobUrl,
  getBarcodeFileName,
  downloadBarcodeImage,
};
