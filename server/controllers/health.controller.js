/**
 * Health Check Controller
 * Handles server health status monitoring.
 */
const getHealth = (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'ShopFlow API is running',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealth,
};
