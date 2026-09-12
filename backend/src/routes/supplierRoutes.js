/**
 * Supplier Routes
 * ================
 * All routes are authenticated. Role-based access:
 *   company_manager — full read + write
 *   auditor         — read only
 *   supplier        — restricted (cannot access this module; they use /api/emissions)
 *
 * ⚠ IMPORTANT: Static routes (/stats, /network, /tier/:tier) must be declared
 * BEFORE dynamic /:id routes to prevent Express matching "stats" or "network" as an ID.
 */
const express = require('express');
const router = express.Router();

const supplierController = require('../controllers/supplierController');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { ROLES } = require('../config/permissions');
const {
  createSupplierValidation,
  updateSupplierValidation,
  updateDataStatusValidation,
  tierParamValidation,
  setParentValidation,
} = require('../validators/supplierValidators');

// All supplier routes require authentication
router.use(protect);

// ─── Static / Aggregate Routes (must come before /:id) ────────────────────────

/**
 * GET /api/suppliers/stats
 * Aggregate stats: total, by-tier, by-status, ESG averages, top countries
 * @access company_manager | auditor
 */
router.get(
  '/stats',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  supplierController.getStats
);

/**
 * GET /api/suppliers/network
 * Full supply chain graph (nodes + edges) for D3 visualisation
 * @access company_manager | auditor
 */
router.get(
  '/network',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  supplierController.getNetworkGraph
);

/**
 * GET /api/suppliers/tier/:tier
 * All suppliers of a specific tier (1, 2, or 3) with tier stats
 * @access company_manager | auditor
 */
router.get(
  '/tier/:tier',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  tierParamValidation,
  validate,
  supplierController.getByTier
);

// ─── Collection Routes ─────────────────────────────────────────────────────────

/**
 * GET /api/suppliers
 * List all suppliers — supports rich filtering, search, sort, pagination
 * @access company_manager | auditor
 */
router.get(
  '/',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  supplierController.getAll
);

/**
 * POST /api/suppliers
 * Create a new supplier
 * @access company_manager only
 */
router.post(
  '/',
  authorize(ROLES.COMPANY_MANAGER),
  createSupplierValidation,
  validate,
  supplierController.create
);

// ─── Document Routes (/:id and sub-routes) ────────────────────────────────────

/**
 * GET /api/suppliers/:id
 * Full supplier detail with parent + children populated
 * @access company_manager | auditor
 */
router.get(
  '/:id',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  supplierController.getById
);

/**
 * PUT /api/suppliers/:id
 * Update a supplier
 * @access company_manager only
 */
router.put(
  '/:id',
  authorize(ROLES.COMPANY_MANAGER),
  updateSupplierValidation,
  validate,
  supplierController.update
);

/**
 * DELETE /api/suppliers/:id
 * Delete a supplier. Blocks if children exist unless ?force=true
 * @access company_manager only
 */
router.delete(
  '/:id',
  authorize(ROLES.COMPANY_MANAGER),
  supplierController.remove
);

/**
 * GET /api/suppliers/:id/chain
 * Full upstream chain: [this supplier → parent → grandparent → ...]
 * @access company_manager | auditor
 */
router.get(
  '/:id/chain',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  supplierController.getChain
);

/**
 * GET /api/suppliers/:id/descendants
 * All downstream suppliers that have this supplier in their ancestorPath
 * @access company_manager | auditor
 */
router.get(
  '/:id/descendants',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  supplierController.getDescendants
);

/**
 * PATCH /api/suppliers/:id/parent
 * Set or change the parent supplier relationship
 * @access company_manager only
 */
router.patch(
  '/:id/parent',
  authorize(ROLES.COMPANY_MANAGER),
  setParentValidation,
  validate,
  supplierController.setParent
);

/**
 * PATCH /api/suppliers/:id/data-status
 * Update energy / transport / materials data submission & verification status
 * @access company_manager (verify), supplier role handled at emission level
 */
router.patch(
  '/:id/data-status',
  authorize(ROLES.COMPANY_MANAGER),
  updateDataStatusValidation,
  validate,
  supplierController.updateDataStatus
);

/**
 * GET /api/suppliers/:id/emissions
 * Emission records for a specific supplier
 * @access company_manager | auditor
 */
router.get(
  '/:id/emissions',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  supplierController.getEmissions
);

module.exports = router;
