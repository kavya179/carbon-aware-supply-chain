const express = require('express');
const router = express.Router();
const hotspotController = require('../controllers/hotspotController');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

router.use(protect);

/**
 * GET /api/hotspots
 * Analyzes emissions across the entire supply chain to identify hotspots.
 * @access company_manager | auditor
 */
router.get(
  '/',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR),
  hotspotController.analyzeHotspots
);

module.exports = router;
