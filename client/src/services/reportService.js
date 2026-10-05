/**
 * Reports API Service
 * Centralizes communication with the backend Reports endpoints (/api/reports).
 * Handles token attachment, query parameter formatting, and error extraction.
 */

import API_BASE_URL from '../config/apiConfig';

/**
 * Internal authenticated request helper for Reports
 */
async function reportApiRequest(endpoint, options = {}, idToken = null) {
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
      'Unable to load reports. Please try again.';
    const error = new Error(errorMsg);
    error.statusCode = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Retrieves sales report data for a specified date range.
 *
 * @param {Object} params - { startDate, endDate, tzOffset }
 * @param {string} idToken - Firebase auth ID token
 * @returns {Promise<{ success: boolean, report: Object }>}
 */
export const getSalesReport = (params = {}, idToken) => {
  const query = new URLSearchParams();
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);

  const tzOffset = params.tzOffset !== undefined ? params.tzOffset : new Date().getTimezoneOffset();
  query.append('tzOffset', tzOffset);

  const queryString = query.toString();
  const endpoint = `/reports/sales${queryString ? `?${queryString}` : ''}`;

  return reportApiRequest(endpoint, { method: 'GET' }, idToken);
};

/**
 * Retrieves inventory stock levels, low-stock, and out-of-stock items.
 *
 * @param {string} idToken - Firebase auth ID token
 * @returns {Promise<{ success: boolean, report: Object }>}
 */
export const getInventoryReport = (idToken) => {
  return reportApiRequest('/reports/inventory', { method: 'GET' }, idToken);
};

export default {
  getSalesReport,
  getInventoryReport,
};
