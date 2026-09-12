/**
 * Submission Routes
 * ==================
 * All routes require authentication.
 *
 * Role access:
 *   company_manager : Full access — can view and manage all submissions
 *   supplier        : Can only submit and view their own data
 *   auditor         : Read-only
 */
const express = require('express');
const router = express.Router();

const submissionController = require('../controllers/submissionController');
const protect    = require('../middleware/protect');
const authorize  = require('../middleware/authorize');
const uploadCsv  = require('../middleware/uploadCsv');
const { ROLES }  = require('../config/permissions');

router.use(protect);

// ─── CSV Templates (public within auth — no write access needed) ──────────────
/**
 * GET /api/submissions/templates/:type
 * Download a filled CSV template for energy | transport | material
 * @access all authenticated
 */
router.get(
  '/templates/:type',
  submissionController.getTemplate
);

// ─── Batch Lookup ─────────────────────────────────────────────────────────────
/**
 * GET /api/submissions/batch/:batchId
 * All records from a single CSV upload batch
 * @access company_manager | auditor | supplier (own batches)
 */
router.get(
  '/batch/:batchId',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER),
  submissionController.getBatch
);

// ─── List / Get ───────────────────────────────────────────────────────────────
/**
 * GET /api/submissions
 * @access company_manager | auditor | supplier (own only)
 */
router.get(
  '/',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER),
  submissionController.getAll
);

/**
 * GET /api/submissions/:id
 * @access company_manager | auditor | supplier (own only)
 */
router.get(
  '/:id',
  authorize(ROLES.COMPANY_MANAGER, ROLES.AUDITOR, ROLES.SUPPLIER),
  submissionController.getById
);

// ─── Manual Submissions ───────────────────────────────────────────────────────
/**
 * POST /api/submissions/energy
 * POST /api/submissions/transport
 * POST /api/submissions/material
 * @access company_manager | supplier
 */
router.post(
  '/:type(energy|transport|material)',
  authorize(ROLES.COMPANY_MANAGER, ROLES.SUPPLIER),
  submissionController.submitManual
);

// ─── CSV Bulk Uploads ─────────────────────────────────────────────────────────
/**
 * POST /api/submissions/upload/energy
 * POST /api/submissions/upload/transport
 * POST /api/submissions/upload/material
 *
 * Multipart form-data with field "file" (CSV)
 * @access company_manager | supplier
 */
router.post(
  '/upload/:type(energy|transport|material)',
  authorize(ROLES.COMPANY_MANAGER, ROLES.SUPPLIER),
  uploadCsv,
  submissionController.uploadCsv
);

// ─── Management ───────────────────────────────────────────────────────────────
/**
 * PATCH /api/submissions/:id/status
 * @access company_manager only
 */
router.patch(
  '/:id/status',
  authorize(ROLES.COMPANY_MANAGER),
  submissionController.updateStatus
);

/**
 * DELETE /api/submissions/:id
 * @access company_manager | supplier (own only)
 */
router.delete(
  '/:id',
  authorize(ROLES.COMPANY_MANAGER, ROLES.SUPPLIER),
  submissionController.remove
);

module.exports = router;
