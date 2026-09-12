const express = require('express');
const router = express.Router();
const aggregationController = require('../controllers/aggregationController');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

router.use(protect);

/**
 * GET /api/aggregation/summary
 * Total emissions across the supply chain, by tier, material, etc.
 * @access company_manager | auditor
 */
router.get(
  '/summary',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  aggregationController.getGlobalSummary
);

/**
 * GET /api/aggregation/network/:supplierId
 * Aggregate total network emissions for a supplier and all its upstream descendants
 * @access company_manager | auditor | supplier (if they are querying their own network)
 */
router.get(
  '/network/:supplierId',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER),
  aggregationController.getNetworkRollup
);

module.exports = router;
