/**
 * Auth Controller
 * ================
 * Handles all authentication operations:
 *   register       → POST /api/auth/register
 *   login          → POST /api/auth/login
 *   logout         → POST /api/auth/logout
 *   refreshToken   → POST /api/auth/refresh
 *   getMe          → GET  /api/auth/me
 *   changePassword → PATCH /api/auth/change-password
 *   forgotPassword → POST /api/auth/forgot-password
 *   resetPassword  → POST /api/auth/reset-password/:token
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const {
  issueTokens,
  verifyRefreshToken,
  clearRefreshCookie,
  signAccessToken,
  REFRESH_COOKIE_NAME,
} = require('../utils/tokenUtils');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract client IP safely behind proxies */
const getClientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.socket?.remoteAddress ||
  'unknown';

// ─── Register ─────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/register
 * Creates a new user account.
 * Suppliers must provide linkedSupplierId if they want to link to a Supplier document.
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, companyName, jobTitle, linkedSupplierId } = req.body;

    // Duplicate email check (also handled by unique index, but gives a better message)
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    // Supplier role validation: warn if no linkedSupplierId
    // (not hard-required here so suppliers can register before being linked)
    const userData = { name, email, password, role, companyName, jobTitle };
    if (linkedSupplierId) userData.linkedSupplierId = linkedSupplierId;

    const user = await User.create(userData);

    // Issue tokens and set cookie
    const { accessToken, user: publicUser } = await issueTokens(user, res);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      accessToken,
      user: publicUser,
    });
  } catch (err) {
    // MongoDB duplicate key
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }
    next(err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/login
 * Authenticates user credentials and issues access + refresh tokens.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Fetch user with password (not selected by default)
    const user = await User.findOne({ email }).select('+password +refreshToken');
    if (!user) {
      // Timing-safe: don't reveal whether the email exists
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    // Account status checks
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Please contact your administrator.',
      });
    }

    // Update login audit fields
    user.lastLoginAt = new Date();
    user.lastLoginIp = getClientIp(req);
    user.loginCount += 1;

    // Issue tokens
    const { accessToken, user: publicUser } = await issueTokens(user, res);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      accessToken,
      user: publicUser,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/logout
 * Clears the refresh token from DB and removes the httpOnly cookie.
 * Access token expiry is handled on the client side (short-lived).
 *
 * Protected route — requires valid access token.
 */
exports.logout = async (req, res, next) => {
  try {
    // Nullify the stored refresh token hash
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });

    // Clear cookie
    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
/**
 * POST /api/auth/refresh
 * Validates the refresh token cookie and issues a new access token.
 * Implements refresh token rotation — issues a new refresh token too.
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const incomingRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!incomingRefreshToken) {
      return res.status(401).json({
        success: false,
        error: 'No refresh token provided.',
        code: 'NO_REFRESH_TOKEN',
      });
    }

    // Verify refresh token signature & expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(incomingRefreshToken);
    } catch (err) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        error: 'Refresh token is invalid or expired. Please log in again.',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    // Fetch user with the stored token hash
    const user = await User.findById(decoded.sub).select('+refreshToken');
    if (!user || !user.refreshToken) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        error: 'Session not found. Please log in again.',
      });
    }

    // Validate the incoming token against the stored hash (rotation guard)
    const tokenMatches = await bcrypt.compare(incomingRefreshToken, user.refreshToken);
    if (!tokenMatches) {
      // Possible token reuse attack — invalidate session completely
      user.refreshToken = null;
      await user.save({ validateBeforeSave: false });
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        error: 'Refresh token reuse detected. Session terminated for security.',
        code: 'TOKEN_REUSE_DETECTED',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account deactivated.',
      });
    }

    // Rotate: issue brand new access + refresh tokens
    const { accessToken, user: publicUser } = await issueTokens(user, res);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed.',
      accessToken,
      user: publicUser,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get Current User ─────────────────────────────────────────────────────────
/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    return res.status(200).json({
      success: true,
      user: user.toPublicJSON(),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Change Password ──────────────────────────────────────────────────────────
/**
 * PATCH /api/auth/change-password
 * Allows authenticated user to update their password.
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect.',
      });
    }

    user.password = newPassword;
    // Invalidate all existing sessions by clearing refresh token
    user.refreshToken = null;
    await user.save();

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
/**
 * POST /api/auth/forgot-password
 * Generates a password reset token and (would) send an email.
 * For this scaffold, the raw token is returned in the response.
 * In production, send it via email only and do NOT include it in the response.
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always return 200 to prevent email enumeration attacks
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    const rawToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // TODO: In production, send rawToken via email, not in response
    // await sendPasswordResetEmail(user.email, rawToken);

    return res.status(200).json({
      success: true,
      message: 'Password reset token generated. Check your email.',
      // ⚠ DEVELOPMENT ONLY — remove in production:
      ...(process.env.NODE_ENV === 'development' && { resetToken: rawToken }),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
/**
 * POST /api/auth/reset-password/:token
 * Validates the reset token and updates the password.
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash the incoming raw token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Password reset token is invalid or has expired.',
      });
    }

    // Update password and clear reset fields
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = null; // Invalidate all sessions
    await user.save();

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in.',
    });
  } catch (err) {
    next(err);
  }
};
