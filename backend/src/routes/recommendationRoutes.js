const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

router.use(protect);

/**
 * POST /api/recommendations/generate/:supplierId
 * Generates and stores recommendations using the Django Engine
 * @access company_manager | supplier
 */
router.post(
  '/generate/:supplierId',
  authorize(ROLES.COMPANY_MANAGER, ROLES.SUPPLIER),
  recommendationController.generateAndStore
);

/**
 * GET /api/recommendations/:supplierId
 * Retrieves saved recommendations
 * @access company_manager | auditor | supplier
 */
router.get(
  '/:supplierId',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER),
  recommendationController.getRecommendations
);

module.exports = router;
