/**
 * Sales API Service
 * Centralizes all Checkout & Sales history endpoints.
 * Handles token attachment, request payload dispatching, and error parsing.
 */

import API_BASE_URL from '../config/apiConfig';

/**
 * Internal authenticated request helper for Sales
 */
async function salesApiRequest(endpoint, options = {}, idToken = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    Accept: 'application/json',
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
    const errorMsg =
      data.error?.message ||
      data.message ||
      `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.statusCode = response.status;
    error.data = data;
    error.product = data.product;
    error.availableStock = data.availableStock;
    error.requestedQuantity = data.requestedQuantity;
    throw error;
  }

  return data;
}

/**
 * Creates a sale atomically via POST /api/sales
 * @param {Object} saleData - { items: [{ productId, quantity, itemDiscount }], discountType, discountValue, paymentMethod, amountReceived }
 * @param {string} idToken - Firebase Auth ID token
 * @returns {Promise<{ success: boolean, message: string, sale: Object }>}
 */
export const createSale = (saleData, idToken) =>
  salesApiRequest(
    '/sales',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData),
    },
    idToken
  );

/**
 * Retrieves sales history for the authenticated user's shop via GET /api/sales
 * @param {Object} [params] - Optional query params: { limit, page }
 * @param {string} idToken - Firebase Auth ID token
 * @returns {Promise<{ success: boolean, count: number, sales: Array<Object> }>}
 */
export const getSales = (params = {}, idToken) => {
  const query = new URLSearchParams();
  if (params.limit) query.append('limit', params.limit);
  if (params.page) query.append('page', params.page);

  const queryString = query.toString();
  const endpoint = `/sales${queryString ? `?${queryString}` : ''}`;

  return salesApiRequest(endpoint, { method: 'GET' }, idToken);
};

/**
 * Retrieves a single sale details by document ID via GET /api/sales/:id
 * @param {string} saleId - Firestore document ID
 * @param {string} idToken - Firebase Auth ID token
 * @returns {Promise<{ success: boolean, sale: Object }>}
 */
export const getSaleById = (saleId, idToken) =>
  salesApiRequest(`/sales/${saleId}`, { method: 'GET' }, idToken);

export default {
  createSale,
  getSales,
  getSaleById,
};
