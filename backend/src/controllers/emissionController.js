const Emission = require('../models/Emission');

// ─── Ownership helper for supplier role ────────────────────────────────────────
/**
 * Returns true if a supplier-role user owns the given emission record.
 * Suppliers can only interact with records where the supplier field
 * matches their linked supplier ID.
 */
const supplierOwns = (req, emission) => {
  if (req.user.role !== 'supplier') return true; // Non-suppliers skip ownership check
  if (!req.user.linkedSupplierId) return false;   // Unlinked suppliers own nothing
  return emission.supplier.toString() === req.user.linkedSupplierId.toString();
};

/**
 * GET /api/emissions
 * Suppliers automatically see only their own records.
 * Managers and auditors see all (with optional filters).
 */
exports.getAll = async (req, res, next) => {
  try {
    const { supplier, scope3Category, verificationStatus, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Suppliers are automatically scoped to their own supplier ID
    if (req.user.role === 'supplier') {
      if (!req.user.linkedSupplierId) {
        return res.status(403).json({
          success: false,
          error: 'Your account is not linked to a supplier. Contact your administrator.',
        });
      }
      filter.supplier = req.user.linkedSupplierId;
    } else {
      // Managers / auditors: honour optional filter
      if (supplier) filter.supplier = supplier;
    }

    if (scope3Category) filter.scope3Category = Number(scope3Category);
    if (verificationStatus) filter.verificationStatus = verificationStatus;

    const skip = (Number(page) - 1) * Number(limit);
    const [emissions, total] = await Promise.all([
      Emission.find(filter)
        .populate('supplier', 'name code tier country')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Emission.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: emissions,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/emissions/:id
 * Suppliers may only view their own records.
 */
exports.getById = async (req, res, next) => {
  try {
    const emission = await Emission.findById(req.params.id).populate('supplier');
    if (!emission) {
      return res.status(404).json({ success: false, error: 'Emission record not found' });
    }

    // Ownership check for suppliers
    if (!supplierOwns(req, emission)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own emission records.',
      });
    }

    res.json({ success: true, data: emission });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/emissions
 * Suppliers must submit under their own linked supplier ID.
 * The emission value should be calculated by the Carbon Service beforehand.
 */
exports.create = async (req, res, next) => {
  try {
    const body = { ...req.body };

    // Force supplier role to only submit under their own ID
    if (req.user.role === 'supplier') {
      if (!req.user.linkedSupplierId) {
        return res.status(403).json({
          success: false,
          error: 'Your account is not linked to a supplier. Contact your administrator.',
        });
      }
      body.supplier = req.user.linkedSupplierId;
    }

    const emission = await Emission.create(body);
    const populated = await emission.populate('supplier', 'name code tier');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/emissions/:id
 * Suppliers may only update their own records.
 * Suppliers also cannot change verificationStatus (that's for managers).
 */
exports.update = async (req, res, next) => {
  try {
    const emission = await Emission.findById(req.params.id);
    if (!emission) {
      return res.status(404).json({ success: false, error: 'Emission record not found' });
    }

    // Ownership check
    if (!supplierOwns(req, emission)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only update your own emission records.',
      });
    }

    const updateBody = { ...req.body };

    // Suppliers cannot self-verify
    if (req.user.role === 'supplier') {
      delete updateBody.verificationStatus;
      delete updateBody.verifiedBy;
      delete updateBody.verifiedAt;
      // Suppliers also cannot reassign the supplier field
      delete updateBody.supplier;
    }

    const updated = await Emission.findByIdAndUpdate(req.params.id, updateBody, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/emissions/:id
 * Company managers only (enforced at route level too).
 */
exports.remove = async (req, res, next) => {
  try {
    const emission = await Emission.findByIdAndDelete(req.params.id);
    if (!emission) {
      return res.status(404).json({ success: false, error: 'Emission record not found' });
    }
    res.json({ success: true, message: 'Emission record deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/emissions/:id/verify
 * Company managers only — approve or reject a supplier's submitted data.
 */
exports.verify = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['Verified', 'Rejected', 'Under Review'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid verification status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const emission = await Emission.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: status,
        verifiedBy: req.user.email,     // Audit trail: who verified
        verifiedAt: new Date(),
        ...(notes && { notes }),
      },
      { new: true }
    );

    if (!emission) {
      return res.status(404).json({ success: false, error: 'Emission record not found' });
    }
    res.json({ success: true, data: emission });
  } catch (err) {
    next(err);
  }
};
