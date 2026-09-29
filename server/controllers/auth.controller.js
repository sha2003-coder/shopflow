/**
 * Auth Controller
 * Handles user identity inspection and authentication endpoints.
 */

/**
 * GET /api/auth/me
 * Returns authenticated user details derived from verified Firebase ID token.
 */
const getMe = (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
};
