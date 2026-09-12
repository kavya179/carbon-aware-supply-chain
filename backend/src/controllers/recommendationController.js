/**
 * Recommendation Controller
 * =========================
 * Integrates with Django's Recommendation Engine to generate 
 * actionable circular alternatives for a supplier's footprint,
 * and manages storage/retrieval of these recommendations.
 */

const axios = require('axios');
const Supplier = require('../models/Supplier');
const SupplierFootprint = require('../models/SupplierFootprint');
const Recommendation = require('../models/Recommendation');

const CARBON_SERVICE_URL = process.env.CARBON_SERVICE_URL || 'http://localhost:8001';

/**
 * POST /api/recommendations/generate/:supplierId
 * Fetches the latest footprint for a supplier, passes it to Django
 * to generate recommendations, and saves them to MongoDB.
 */
exports.generateAndStore = async (req, res, next) => {
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

    // Role check for supplier self-generation
    if (
      req.user.role === 'supplier' &&
      req.user.linkedSupplierId &&
      req.user.linkedSupplierId.toString() !== supplier._id.toString()
    ) {
      return res.status(403).json({ success: false, error: 'You can only generate recommendations for your own supplier.' });
    }

    // Find the most recent footprint
    const footprint = await SupplierFootprint.findOne({ supplier: supplier._id })
      .sort({ createdAt: -1 });

    if (!footprint) {
      return res.status(400).json({ success: false, error: 'No footprint data found to generate recommendations from.' });
    }

    // Call Django
    let djangoResult;
    try {
      const response = await axios.post(
        `${CARBON_SERVICE_URL}/api/carbon/generate-recommendations/`,
        footprint,
        { timeout: 15000 }
      );
      djangoResult = response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Carbon Service calculation failed';
      return res.status(502).json({ success: false, error: message });
    }

    const recsData = djangoResult.recommendations || [];
    
    // Clear old pending recommendations to avoid duplicates
    await Recommendation.deleteMany({ supplier: supplier._id, status: 'Pending' });

    // Store new ones
    const savedRecs = await Promise.all(
      recsData.map(async (r) => {
        return Recommendation.create({
          supplier: supplier._id,
          ...r
        });
      })
    );

    return res.status(201).json({
      success: true,
      message: `${savedRecs.length} recommendations generated.`,
      data: savedRecs,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/recommendations/:supplierId
 * Retrieve saved recommendations for a supplier
 */
exports.getRecommendations = async (req, res, next) => {
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

    const recommendations = await Recommendation.find({ supplier: supplier._id })
      .sort({ co2Savings: -1 });

    return res.status(200).json({ success: true, data: recommendations });
  } catch (err) {
    next(err);
  }
};
