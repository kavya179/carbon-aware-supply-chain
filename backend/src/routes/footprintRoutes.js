const express = require('express');
const router = express.Router();
const footprintController = require('../controllers/footprintController');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

router.use(protect);

/**
 * POST /api/footprint/calculate
 * @access company_manager | supplier
 */
router.post(
  '/calculate',
  authorize(ROLES.COMPANY_MANAGER, ROLES.SUPPLIER),
  footprintController.calculateAndStore
);

/**
 * GET /api/footprint
 * @access company_manager | auditor
 */
router.get(
  '/',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  footprintController.getAllFootprints
);

/**
 * GET /api/footprint/:supplierId
 * @access company_manager | auditor | supplier
 */
router.get(
  '/:supplierId',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER),
  footprintController.getSupplierFootprints
);

module.exports = router;
