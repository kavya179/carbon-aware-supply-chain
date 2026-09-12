/**
 * JWT Token Utilities
 * =====================
 * Handles creation, signing, and cookie attachment of access + refresh tokens.
 *
 * Strategy:
 *  - Access Token  : short-lived (15 min), sent in JSON response body
 *  - Refresh Token : long-lived (7 days), sent as httpOnly cookie + stored as
 *                    a bcrypt hash in the User document
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ─── Token Payload ────────────────────────────────────────────────────────────
/**
 * Build the JWT payload from a User document.
 * Keeps the payload minimal — only what's needed for auth decisions.
 */
const buildPayload = (user) => ({
  sub: user._id.toString(),
  email: user.email,
  role: user.role,
  companyName: user.companyName,
  linkedSupplierId: user.linkedSupplierId?.toString() || null,
});

// ─── Sign Tokens ──────────────────────────────────────────────────────────────

/**
 * Sign an access token (short-lived).
 * @param {Object} user - Mongoose User document
 * @returns {string} signed JWT
 */
const signAccessToken = (user) =>
  jwt.sign(buildPayload(user), ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    issuer: 'carbon-supply-chain',
    audience: 'carbon-supply-chain-client',
  });

/**
 * Sign a refresh token (long-lived).
 * @param {Object} user - Mongoose User document
 * @returns {string} signed JWT
 */
const signRefreshToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'carbon-supply-chain',
  });

// ─── Verify Tokens ────────────────────────────────────────────────────────────

/**
 * Verify and decode an access token.
 * @param {string} token
 * @returns {Object} decoded payload
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
const verifyAccessToken = (token) =>
  jwt.verify(token, ACCESS_TOKEN_SECRET, {
    issuer: 'carbon-supply-chain',
    audience: 'carbon-supply-chain-client',
  });

/**
 * Verify and decode a refresh token.
 * @param {string} token
 * @returns {Object} decoded payload
 */
const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_TOKEN_SECRET, {
    issuer: 'carbon-supply-chain',
  });

// ─── Cookie Helpers ───────────────────────────────────────────────────────────

const REFRESH_COOKIE_NAME = 'refreshToken';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,                        // JS cannot read this cookie
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,     // 7 days in ms
  path: '/api/auth',                     // Scoped to auth routes only
};

/**
 * Attach the refresh token as an httpOnly cookie on the response.
 * @param {Response} res - Express response object
 * @param {string} refreshToken
 */
const attachRefreshCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
};

/**
 * Clear the refresh token cookie (on logout).
 * @param {Response} res
 */
const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
};

// ─── Full Auth Response ───────────────────────────────────────────────────────

/**
 * Generate both tokens, persist the refresh token hash to the DB,
 * attach the refresh cookie, and return the access token + user data.
 *
 * @param {Object} user - Mongoose User document (must be saved after this call)
 * @param {Response} res - Express response object
 * @returns {{ accessToken: string, user: Object }}
 */
const issueTokens = async (user, res) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  // Store hashed refresh token in DB (bcrypt hash, cost 10 is fine for tokens)
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
  await user.save({ validateBeforeSave: false });

  attachRefreshCookie(res, refreshToken);

  return { accessToken, user: user.toPublicJSON() };
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  attachRefreshCookie,
  clearRefreshCookie,
  issueTokens,
  REFRESH_COOKIE_NAME,
};
