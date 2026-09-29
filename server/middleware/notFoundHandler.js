/**
 * Not Found (404) Middleware
 * Catches any incoming requests that do not match existing routes.
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
    },
  });
};

module.exports = notFoundHandler;
