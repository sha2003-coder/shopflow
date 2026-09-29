/**
 * Centralized API client service for ShopFlow
 * Configured via Vite environment variables to avoid hardcoded URLs.
 * Handles unified Authorization Bearer token injection.
 */
import API_BASE_URL from '../config/apiConfig';

/**
 * Generic API request wrapper that standardizes headers, error extraction, and token passing.
 *
 * @param {string} endpoint - API path (e.g. '/shops/me')
 * @param {RequestInit} options - Standard fetch options
 * @param {string|null} idToken - Firebase ID token
 * @returns {Promise<any>}
 */
async function apiRequest(endpoint, options = {}, idToken = null) {
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
 * GET /api/health
 */
export const checkApiHealth = () => apiRequest('/health');

/**
 * GET /api/auth/me
 */
export const getAuthUser = (idToken) => apiRequest('/auth/me', { method: 'GET' }, idToken);

/**
 * POST /api/shops
 * Creates a new shop for the authenticated user and links shopId to users/{uid}.
 */
export const createShop = (shopData, idToken) =>
  apiRequest(
    '/shops',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData),
    },
    idToken
  );

/**
 * GET /api/shops/me
 * Retrieves the current shop linked to the authenticated user.
 */
export const getMyShop = (idToken) =>
  apiRequest('/shops/me', { method: 'GET' }, idToken);

/**
 * GET /api/shops/:id
 * Retrieves a shop by ID, verifying owner authorization.
 */
export const getShopById = (shopId, idToken) =>
  apiRequest(`/shops/${shopId}`, { method: 'GET' }, idToken);

export default {
  API_BASE_URL,
  checkApiHealth,
  getAuthUser,
  createShop,
  getMyShop,
  getShopById,
};
