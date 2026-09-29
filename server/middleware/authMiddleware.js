const { auth, isFirebaseAdminConfigured } = require('../config/firebaseAdmin');

/**
 * Authentication Middleware
 * Validates Firebase ID tokens passed in the Authorization header.
 * Attaches the verified user payload to req.user.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1]?.trim();
    } else if (req.query && req.query.token && typeof req.query.token === 'string') {
      token = req.query.token.trim();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Access denied. Missing authentication token. Expected Authorization header: Bearer <token> or ?token=<token>',
        },
      });
    }

    if (!isFirebaseAdminConfigured || !auth) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Firebase Admin SDK is not configured on the server. Please set credentials in server/.env.',
        },
      });
    }

    // Verify token using Firebase Admin SDK
    const decodedToken = await auth.verifyIdToken(token);

    // Attach verified user information to the request
    req.idToken = token;
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name: decodedToken.name || null,
      role: decodedToken.role || 'owner',
      tokenDetails: decodedToken,
    };

    next();
  } catch (error) {
    console.error('[Auth Middleware] Token verification failed:', error.message);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired. Please sign in again.',
        },
      });
    }

    if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token provided.',
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Failed to authenticate token.',
      },
    });
  }
};

module.exports = authMiddleware;
