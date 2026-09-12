const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

// All dashboard routes: authenticated + manager or auditor
router.use(protect, authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR));

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get KPI summary for the dashboard
 */
router.get('/summary', dashboardController.getSummary);

/**
 * @route   GET /api/dashboard/trends
 * @desc    Get emission trend data over time (supports ?period=monthly|quarterly|yearly)
 */
router.get('/trends', dashboardController.getTrends);

/**
 * @route   GET /api/dashboard/by-tier
 * @desc    Get emissions broken down by supplier tier
 */
router.get('/by-tier', dashboardController.getByTier);

/**
 * @route   GET /api/dashboard/by-category
 * @desc    Get emissions broken down by Scope 3 category
 */
router.get('/by-category', dashboardController.getByCategory);

module.exports = router;
