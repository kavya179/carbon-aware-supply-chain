/**
 * Footprint Controller
 * ====================
 * Receives comprehensive activity data (Energy, Transport, Material),
 * sends it to the Django ComprehensiveCarbonCalculationEngine,
 * and stores the final calculated results in MongoDB.
 */
const axios = require('axios');
const Supplier = require('../models/Supplier');
const SupplierFootprint = require('../models/SupplierFootprint');

const CARBON_SERVICE_URL = process.env.CARBON_SERVICE_URL || 'http://localhost:8001';

/**
 * POST /api/footprint/calculate
 */
exports.calculateAndStore = async (req, res, next) => {
  try {
    const { supplierId, data } = req.body;

    if (!supplierId || !data) {
      return res.status(400).json({ success: false, error: 'supplierId and data are required.' });
    }

    // Resolve supplier
    const supplier = await Supplier.findOne(
      supplierId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: supplierId }
        : { supplierId: supplierId.toUpperCase() }
    ).select('_id name');

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    // Role check for supplier self-submission
    if (
      req.user.role === 'supplier' &&
      req.user.linkedSupplierId &&
      req.user.linkedSupplierId.toString() !== supplier._id.toString()
    ) {
      return res.status(403).json({ success: false, error: 'You can only submit data for your own supplier.' });
    }

    // 1. Call Django Comprehensive API
    let djangoResult;
    try {
      const response = await axios.post(
        `${CARBON_SERVICE_URL}/api/carbon/calculate-comprehensive/`,
        data,
        { timeout: 10000 }
      );
      djangoResult = response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Carbon Service calculation failed';
      return res.status(502).json({ success: false, error: message });
    }

    // 2. Store in MongoDB
    const footprint = await SupplierFootprint.create({
      supplier: supplier._id,
      inputs: data,
      results: djangoResult,
    });

    return res.status(201).json({
      success: true,
      message: 'Footprint calculated and stored successfully.',
      data: footprint,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/footprint/:supplierId
 * Retrieve footprints for a specific supplier
 */
exports.getSupplierFootprints = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const supplier = await Supplier.findOne(
      supplierId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: supplierId }
        : { supplierId: supplierId.toUpperCase() }
    ).select('_id name');

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    const footprints = await SupplierFootprint.find({ supplier: supplier._id })
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: footprints });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/footprint
 * Retrieve all footprints globally
 */
exports.getAllFootprints = async (req, res, next) => {
  try {
    const footprints = await SupplierFootprint.find()
      .populate('supplier', 'name supplierId tier')
      .sort({ createdAt: -1 })
      .limit(100); // Limit to 100 for dashboard performance

    return res.status(200).json({ success: true, data: footprints });
  } catch (err) {
    next(err);
  }
};
