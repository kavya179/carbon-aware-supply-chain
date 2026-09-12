/**
 * Permission Map
 * ==============
 * Defines what each role can do across all resources.
 * Used by the authorize middleware for fine-grained RBAC.
 *
 * Structure:
 *   PERMISSIONS[resource][action] = [roles that are allowed]
 */

const ROLES = Object.freeze({
  COMPANY_MANAGER: 'company_manager',
  SUPPLIER: 'supplier',
  AUDITOR: 'auditor',
});

/**
 * Role capabilities summary:
 *
 * company_manager:
 *   - Full CRUD on suppliers
 *   - Full CRUD on emission records (all suppliers)
 *   - View dashboard KPIs and trend analytics
 *   - View carbon hotspots and recommendations
 *   - Manage users (invite, deactivate)
 *   - Verify/reject emission records
 *
 * supplier:
 *   - Submit and update their OWN emission data only
 *   - View their own emission records
 *   - View their own ESG score and recommendations
 *   - Cannot access other suppliers' data
 *
 * auditor:
 *   - Read-only access to all suppliers
 *   - Read-only access to all emission records
 *   - Read-only access to dashboard, analytics, reports
 *   - Cannot create, update, or delete any data
 */
const PERMISSIONS = Object.freeze({
  // ─── Suppliers ────────────────────────────────────────────────────
  suppliers: {
    read:   [ROLES.COMPANY_MANAGER, ROLES.AUDITOR],
    create: [ROLES.COMPANY_MANAGER],
    update: [ROLES.COMPANY_MANAGER],
    delete: [ROLES.COMPANY_MANAGER],
  },

  // ─── Emissions ────────────────────────────────────────────────────
  emissions: {
    read:         [ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER],
    create:       [ROLES.COMPANY_MANAGER, ROLES.SUPPLIER],
    update:       [ROLES.COMPANY_MANAGER, ROLES.SUPPLIER],
    delete:       [ROLES.COMPANY_MANAGER],
    verify:       [ROLES.COMPANY_MANAGER],        // Approve/reject records
    readOwn:      [ROLES.SUPPLIER],               // Supplier reads their own
    updateOwn:    [ROLES.SUPPLIER],               // Supplier updates their own
  },

  // ─── Dashboard ────────────────────────────────────────────────────
  dashboard: {
    read: [ROLES.COMPANY_MANAGER, ROLES.AUDITOR],
  },

  // ─── Carbon Analytics / Hotspots ──────────────────────────────────
  analytics: {
    read: [ROLES.COMPANY_MANAGER, ROLES.AUDITOR],
  },

  // ─── Recommendations ──────────────────────────────────────────────
  recommendations: {
    read: [ROLES.COMPANY_MANAGER, ROLES.SUPPLIER, ROLES.AUDITOR],
  },

  // ─── User Management ──────────────────────────────────────────────
  users: {
    read:       [ROLES.COMPANY_MANAGER],
    create:     [ROLES.COMPANY_MANAGER],
    update:     [ROLES.COMPANY_MANAGER],
    deactivate: [ROLES.COMPANY_MANAGER],
  },
});

/**
 * Check if a role has permission for a given resource + action.
 * @param {string} role   - e.g. 'supplier'
 * @param {string} resource - e.g. 'emissions'
 * @param {string} action   - e.g. 'read'
 * @returns {boolean}
 */
const can = (role, resource, action) => {
  const allowed = PERMISSIONS[resource]?.[action] ?? [];
  return allowed.includes(role);
};

module.exports = { ROLES, PERMISSIONS, can };
