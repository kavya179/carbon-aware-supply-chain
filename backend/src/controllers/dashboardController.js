const Supplier = require('../models/Supplier');
const Emission = require('../models/Emission');

/**
 * GET /api/dashboard/summary
 * Returns top-level KPI metrics for the dashboard
 */
exports.getSummary = async (req, res, next) => {
  try {
    const [
      totalSuppliers,
      activeSuppliers,
      highRiskSuppliers,
      emissionAgg,
      pendingVerification,
    ] = await Promise.all([
      Supplier.countDocuments(),
      Supplier.countDocuments({ status: 'Active' }),
      Supplier.countDocuments({ status: 'High Risk' }),
      Emission.aggregate([
        {
          $group: {
            _id: null,
            totalEmissions: { $sum: '$emissionValue' },
            recordCount: { $sum: 1 },
          },
        },
      ]),
      Emission.countDocuments({ verificationStatus: 'Pending' }),
    ]);

    const totalEmissions = emissionAgg[0]?.totalEmissions || 0;

    res.json({
      success: true,
      data: {
        suppliers: { total: totalSuppliers, active: activeSuppliers, highRisk: highRiskSuppliers },
        emissions: {
          total: totalEmissions,
          unit: 'tCO2e',
          recordCount: emissionAgg[0]?.recordCount || 0,
          pendingVerification,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/trends
 */
exports.getTrends = async (req, res, next) => {
  try {
    const { period = 'monthly' } = req.query;

    const groupFormat = period === 'yearly'
      ? { year: { $year: '$reportingPeriod.startDate' } }
      : period === 'quarterly'
      ? {
          year: { $year: '$reportingPeriod.startDate' },
          quarter: { $ceil: { $divide: [{ $month: '$reportingPeriod.startDate' }, 3] } },
        }
      : {
          year: { $year: '$reportingPeriod.startDate' },
          month: { $month: '$reportingPeriod.startDate' },
        };

    const trends = await Emission.aggregate([
      { $group: { _id: groupFormat, totalEmissions: { $sum: '$emissionValue' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({ success: true, data: trends, period });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/by-tier
 */
exports.getByTier = async (req, res, next) => {
  try {
    const data = await Emission.aggregate([
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplier',
          foreignField: '_id',
          as: 'supplierInfo',
        },
      },
      { $unwind: '$supplierInfo' },
      {
        $group: {
          _id: '$supplierInfo.tier',
          totalEmissions: { $sum: '$emissionValue' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/by-category
 */
exports.getByCategory = async (req, res, next) => {
  try {
    const data = await Emission.aggregate([
      {
        $group: {
          _id: { category: '$scope3Category', name: '$categoryName' },
          totalEmissions: { $sum: '$emissionValue' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalEmissions: -1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
