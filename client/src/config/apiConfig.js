/**
 * Centralized API Configuration for ShopFlow Frontend
 * Resolves the backend API base URL from Vite environment variable VITE_API_URL.
 * Supports both root URLs (e.g., 'http://localhost:5000', 'https://api.onrender.com')
 * and explicit '/api' paths (e.g., 'http://localhost:5000/api').
 */

export function resolveApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || typeof envUrl !== 'string' || !envUrl.trim()) {
    return 'http://localhost:5000/api';
  }

  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export default API_BASE_URL;
