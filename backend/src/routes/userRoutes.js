/**
 * User Management Routes
 * =======================
 * All routes require: protect + authorize('company_manager')
 *
 *   GET    /api/users                    → List all users
 *   GET    /api/users/:id                → Get single user
 *   PATCH  /api/users/:id/role           → Update role
 *   PATCH  /api/users/:id/status         → Activate / deactivate
 *   PATCH  /api/users/:id/link-supplier  → Link supplier-role user to Supplier doc
 *   DELETE /api/users/:id                → Delete user
 */
const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

// All user management routes: authenticated + company_manager only
router.use(protect, authorize(ROLES.COMPANY_MANAGER));

router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.patch('/:id/role', userController.changeRole);
router.patch('/:id/status', userController.setActiveStatus);
router.patch('/:id/link-supplier', userController.linkSupplier);
router.delete('/:id', userController.deleteUser);

module.exports = router;
