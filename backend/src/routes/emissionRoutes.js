/**
 * Emission Routes — with Role-Based Access Control
 * =================================================
 *
 * company_manager : Full CRUD + verify
 * supplier        : Create + read/update their OWN records only
 * auditor         : Read-only on all records
 *
 * Ownership enforcement for suppliers is handled inside the controller
 * by comparing req.user.linkedSupplierId with the emission's supplier field.
 */
const express = require('express');
const router = express.Router();
const emissionController = require('../controllers/emissionController');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

// All emission routes require authentication
router.use(protect);

/**
 * @route   GET /api/emissions
 * @access  company_manager | auditor | supplier (own records only)
 */
router.get(
  '/',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER),
  emissionController.getAll
);

/**
 * @route   GET /api/emissions/:id
 * @access  company_manager | auditor | supplier (own record only)
 */
router.get(
  '/:id',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER),
  emissionController.getById
);

/**
 * @route   POST /api/emissions
 * @access  company_manager | supplier
 */
router.post(
  '/',
  authorize(ROLES.COMPANY_MANAGER, ROLES.SUPPLIER),
  emissionController.create
);

/**
 * @route   PUT /api/emissions/:id
 * @access  company_manager | supplier (own record only)
 */
router.put(
  '/:id',
  authorize(ROLES.COMPANY_MANAGER, ROLES.SUPPLIER),
  emissionController.update
);

/**
 * @route   DELETE /api/emissions/:id
 * @access  company_manager only
 */
router.delete(
  '/:id',
  authorize(ROLES.COMPANY_MANAGER),
  emissionController.remove
);

/**
 * @route   PATCH /api/emissions/:id/verify
 * @access  company_manager only
 */
router.patch(
  '/:id/verify',
  authorize(ROLES.COMPANY_MANAGER),
  emissionController.verify
);

module.exports = router;
