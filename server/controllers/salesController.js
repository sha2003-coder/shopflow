const salesService = require('../services/salesService');

/**
 * POST /api/sales
 * Creates a new sale atomically inside a Firestore transaction.
 * Deducts stock from products, generates sequential invoice number,
 * saves sale snapshot, and validates all financial calculations.
 */
const createSale = async (req, res, next) => {
  try {
    const sale = await salesService.createSale(req.body, req.user, req.idToken);
    return res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      sale,
    });
  } catch (error) {
    console.error('[Sales Controller] createSale error:', error.message);

    // Specific structure for stock insufficiency per specification
    if (error.message === 'Insufficient stock' || error.product) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock',
        product: error.product,
        availableStock: error.availableStock,
        requestedQuantity: error.requestedQuantity,
        error: {
          message: error.message,
          product: error.product,
          availableStock: error.availableStock,
          requestedQuantity: error.requestedQuantity,
        },
      });
    }

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to complete sale',
      error: {
        message: error.message || 'Failed to complete sale',
      },
    });
  }
};

/**
 * GET /api/sales
 * Retrieves sales history belonging to the authenticated user's shop.
 * Returns records sorted newest first.
 */
const getSales = async (req, res, next) => {
  try {
    const sales = await salesService.getSales(req.user, req.idToken, req.query);
    return res.status(200).json({
      success: true,
      count: sales.length,
      sales,
    });
  } catch (error) {
    console.error('[Sales Controller] getSales error:', error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        message: error.message || 'Failed to retrieve sales history',
      },
    });
  }
};

/**
 * GET /api/sales/:id
 * Retrieves a single sale by ID, enforcing shop isolation.
 */
const getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sale = await salesService.getSaleById(id, req.user, req.idToken);
    return res.status(200).json({
      success: true,
      sale,
    });
  } catch (error) {
    console.error('[Sales Controller] getSaleById error:', error.message);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        message: error.message || 'Failed to retrieve sale details',
      },
    });
  }
};

module.exports = {
  createSale,
  getSales,
  getSaleById,
};
