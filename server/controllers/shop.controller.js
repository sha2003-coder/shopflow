const shopService = require('../services/shopService');

/**
 * POST /api/shops
 * Creates a new shop for the authenticated user and links shopId to users/{uid}.
 */
const createShop = async (req, res, next) => {
  try {
    const { name, ownerName, phone, address } = req.body;

    // Validation per requirements
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Shop Name is required.' },
      });
    }

    if (!ownerName || typeof ownerName !== 'string' || !ownerName.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Owner Name is required.' },
      });
    }

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Phone Number is required.' },
      });
    }

    const shop = await shopService.createShop(
      { name, ownerName, phone, address },
      req.user,
      req.idToken
    );

    return res.status(201).json({
      success: true,
      message: 'Shop created successfully',
      shop,
    });
  } catch (error) {
    console.error('[Shop Controller] Error creating shop:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to create shop' },
    });
  }
};

/**
 * GET /api/shops/me
 * Retrieves the current shop linked to the authenticated user.
 */
const getMyShop = async (req, res, next) => {
  try {
    const shop = await shopService.getShopForUser(req.user, req.idToken);

    if (!shop) {
      return res.status(200).json({
        success: true,
        shop: null,
        requiresSetup: true,
        message: 'No shop is currently associated with this account. Shop setup is required.',
      });
    }

    return res.status(200).json({
      success: true,
      shop,
      requiresSetup: false,
    });
  } catch (error) {
    console.error('[Shop Controller] Error getting current shop:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to retrieve shop' },
    });
  }
};

/**
 * GET /api/shops/:id
 * Retrieves a shop by ID, verifying that the authenticated user is the owner.
 */
const getShopById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shop = await shopService.getShopById(id, req.user, req.idToken);

    return res.status(200).json({
      success: true,
      shop,
    });
  } catch (error) {
    console.error('[Shop Controller] Error getting shop by ID:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: { message: error.message || 'Failed to retrieve shop' },
    });
  }
};

module.exports = {
  createShop,
  getMyShop,
  getShopById,
};
