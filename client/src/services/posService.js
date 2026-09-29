import productService from './productService';

/**
 * POS API Service
 * Encapsulates POS barcode scanner lookups and real-time product searches.
 * Delegates to verified shop-isolated endpoints.
 */

/**
 * Looks up a single product by barcode string strictly within the authenticated user's shop.
 * @param {string} barcode - Barcode string entered by scanner or manual input
 * @param {string} idToken - Firebase Auth ID token
 * @returns {Promise<Object>} Product data object
 */
export async function lookupBarcode(barcode, idToken) {
  if (!barcode || typeof barcode !== 'string' || !barcode.trim()) {
    const error = new Error('Barcode cannot be empty');
    error.statusCode = 400;
    throw error;
  }

  const res = await productService.getProductByBarcode(barcode.trim(), idToken);
  if (!res.success || !res.product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }
  return res.product;
}

/**
 * Searches shop products by term (name, SKU, or barcode).
 * @param {string} query - Search term
 * @param {string} idToken - Firebase Auth ID token
 * @returns {Promise<Array<Object>>} Matching products list
 */
export async function searchProducts(query, idToken) {
  const res = await productService.getProducts(
    { search: (query || '').trim() },
    idToken
  );
  return res.products || [];
}

export default {
  lookupBarcode,
  searchProducts,
};
