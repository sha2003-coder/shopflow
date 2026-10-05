const reportService = require('../services/reportService');

/**
 * GET /api/reports/sales
 * Retrieves sales reports, financial summaries, payment breakdown, top products,
 * daily sales trend, and inventory alerts for the authenticated user's shop.
 *
 * Query parameters:
 * - startDate (YYYY-MM-DD)
 * - endDate (YYYY-MM-DD)
 * - tzOffset (timezone offset in minutes)
 */
const getSalesReport = async (req, res, next) => {
  try {
    const report = await reportService.getSalesReport(req.user, req.idToken, req.query);

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('[Report Controller] getSalesReport error:', error.message);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: 'Unable to load reports. Please try again.',
      error: {
        message: error.statusCode ? error.message : 'Unable to load reports. Please try again.',
      },
    });
  }
};

/**
 * GET /api/reports/inventory
 * Retrieves stock status, low stock products, and out of stock products
 * strictly for the authenticated user's shop.
 */
const getInventoryReport = async (req, res, next) => {
  try {
    const report = await reportService.getInventoryReport(req.user, req.idToken);

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('[Report Controller] getInventoryReport error:', error.message);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: 'Unable to load inventory report. Please try again.',
      error: {
        message: error.statusCode ? error.message : 'Unable to load inventory report. Please try again.',
      },
    });
  }
};

module.exports = {
  getSalesReport,
  getInventoryReport,
};
