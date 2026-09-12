const express = require('express');
const router = express.Router();
const carbonProxyController = require('../controllers/carbonProxyController');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

/**
 * These routes proxy requests from the frontend to the
 * Django Carbon Intelligence Service.
 * All routes require authentication.
 */
router.use(protect);

/**
 * @route   POST /api/carbon/calculate
 * @desc    Calculate emission from raw activity data via Python service
 */
// Managers and suppliers can calculate emissions
router.post('/calculate', authorize(ROLES.COMPANY_MANAGER, ROLES.SUPPLIER), carbonProxyController.calculate);

/**
 * @route   GET /api/carbon/forecast
 * @desc    Get ML emission forecast from Python service
 */
// Managers and auditors can view forecasts
router.get('/forecast', authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR), carbonProxyController.getForecast);

/**
 * @route   GET /api/carbon/recommendations
 * @desc    Get reduction recommendations from Python service
 */
// All roles can view recommendations
router.get('/recommendations', authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER), carbonProxyController.getRecommendations);

/**
 * @route   POST /api/carbon/score/:supplierId
 * @desc    Score a supplier's ESG/carbon performance via ML model
 */
// Managers and auditors can score suppliers
router.post('/score/:supplierId', authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR), carbonProxyController.scoreSupplier);

module.exports = router;
