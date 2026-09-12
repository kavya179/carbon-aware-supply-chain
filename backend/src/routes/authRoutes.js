/**
 * Auth Routes
 * ============
 * Public:
 *   POST  /api/auth/register          → Create account
 *   POST  /api/auth/login             → Login
 *   POST  /api/auth/refresh           → Refresh access token (cookie)
 *   POST  /api/auth/forgot-password   → Request password reset
 *   POST  /api/auth/reset-password/:token → Reset via token
 *
 * Protected (requires valid access token):
 *   POST  /api/auth/logout            → Logout
 *   GET   /api/auth/me                → Get own profile
 *   PATCH /api/auth/change-password   → Change password
 */
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const protect = require('../middleware/protect');
const validate = require('../middleware/validate');
const {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require('../validators/authValidators');

// ── Stricter rate limit for auth endpoints (brute-force protection) ─────────
const rateLimit = require('express-rate-limit');
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per window per IP
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public Routes ─────────────────────────────────────────────────────────────
router.post(
  '/register',
  authRateLimit,
  registerValidation,
  validate,
  authController.register
);

router.post(
  '/login',
  authRateLimit,
  loginValidation,
  validate,
  authController.login
);

router.post(
  '/refresh',
  authController.refreshToken  // cookie is validated inside controller
);

router.post(
  '/forgot-password',
  authRateLimit,
  forgotPasswordValidation,
  validate,
  authController.forgotPassword
);

router.post(
  '/reset-password/:token',
  authRateLimit,
  resetPasswordValidation,
  validate,
  authController.resetPassword
);

// ── Protected Routes ─────────────────────────────────────────────────────────
router.post('/logout', protect, authController.logout);

router.get('/me', protect, authController.getMe);

router.patch(
  '/change-password',
  protect,
  changePasswordValidation,
  validate,
  authController.changePassword
);

module.exports = router;
