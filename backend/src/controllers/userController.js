/**
 * User Management Controller
 * ===========================
 * Admin-level operations on users.
 * All routes protected by protect + authorize('company_manager').
 *
 *   GET    /api/users              → List all users
 *   GET    /api/users/:id          → Get single user
 *   PATCH  /api/users/:id/role     → Change a user's role
 *   PATCH  /api/users/:id/activate → Activate / deactivate a user
 *   DELETE /api/users/:id          → Hard-delete a user (use with caution)
 */
const User = require('../models/User');

// ─── List Users ───────────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 20, search } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { companyName: { $regex: search, $options: 'i' } },
    ];

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 })
        .populate('linkedSupplierId', 'name code tier'),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: users.map((u) => u.toPublicJSON()),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get User By ID ───────────────────────────────────────────────────────────
exports.getById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('linkedSupplierId', 'name code tier');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    return res.status(200).json({ success: true, data: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
};

// ─── Change Role ──────────────────────────────────────────────────────────────
exports.changeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['company_manager', 'supplier', 'auditor'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Prevent self-demotion
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot change your own role.',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `User role updated to '${role}'.`,
      data: user.toPublicJSON(),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Activate / Deactivate ────────────────────────────────────────────────────
exports.setActiveStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean value.',
      });
    }

    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot deactivate your own account.',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isActive,
        // Clear refresh token if deactivating — forces re-login when reactivated
        ...(isActive === false && { refreshToken: null }),
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `User account ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data: user.toPublicJSON(),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Link Supplier ────────────────────────────────────────────────────────────
/**
 * PATCH /api/users/:id/link-supplier
 * Links a supplier-role user to a specific Supplier document.
 */
exports.linkSupplier = async (req, res, next) => {
  try {
    const { supplierId } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (user.role !== 'supplier') {
      return res.status(400).json({
        success: false,
        error: 'Only users with the supplier role can be linked to a Supplier.',
      });
    }

    user.linkedSupplierId = supplierId || null;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: supplierId
        ? 'Supplier linked successfully.'
        : 'Supplier link removed.',
      data: user.toPublicJSON(),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Delete User ──────────────────────────────────────────────────────────────
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot delete your own account.',
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted permanently.',
    });
  } catch (err) {
    next(err);
  }
};
