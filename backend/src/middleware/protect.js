/**
 * Authentication Middleware — protect()
 * ======================================
 * Verifies the JWT access token on every protected request.
 *
 * Token extraction order:
 *   1. Authorization: Bearer <token>  header
 *   2. x-access-token                 header (legacy)
 *
 * On success: attaches req.user = { id, email, role, ... }
 * On failure: returns 401 Unauthorized
 */
const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');

/**
 * protect middleware
 * Attach to any route that requires authentication.
 */
const protect = async (req, res, next) => {
  try {
    // ── 1. Extract token ────────────────────────────────────────────
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in.',
      });
    }

    // ── 2. Verify token signature & expiry ──────────────────────────
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Access token expired. Please refresh your session.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid access token.',
        code: 'TOKEN_INVALID',
      });
    }

    // ── 3. Check the user still exists and is active ─────────────────
    const user = await User.findById(decoded.sub).select('+isActive +role');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User no longer exists.',
      });
    }
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Please contact your administrator.',
      });
    }

    // ── 4. Attach user context to request ───────────────────────────
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      linkedSupplierId: user.linkedSupplierId?.toString() || null,
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = protect;
