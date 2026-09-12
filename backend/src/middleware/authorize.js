/**
 * Role-Based Access Control Middleware — authorize()
 * ====================================================
 * Must be used AFTER protect() so that req.user is available.
 *
 * Usage:
 *   // Allow only company managers and auditors:
 *   router.get('/suppliers', protect, authorize('company_manager', 'auditor'), controller)
 *
 *   // Allow only company managers:
 *   router.delete('/suppliers/:id', protect, authorize('company_manager'), controller)
 *
 *   // Use the ROLES constant for readability:
 *   const { ROLES } = require('../config/permissions');
 *   router.post('/', protect, authorize(ROLES.COMPANY_MANAGER, ROLES.SUPPLIER), controller)
 */

/**
 * Returns an Express middleware that restricts access to the specified roles.
 * @param {...string} allowedRoles - One or more role strings
 * @returns {Function} Express middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // protect() must run first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated. Use protect() before authorize().',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role(s): [${allowedRoles.join(', ')}]. Your role: ${req.user.role}`,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
};

module.exports = authorize;
