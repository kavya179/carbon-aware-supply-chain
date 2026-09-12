/**
 * Aggregation Controller
 * ======================
 * Handles multi-tier carbon footprint aggregation.
 * Calculates total emissions across the supply chain, broken down by:
 * - Supplier
 * - Tier
 * - Material
 * - Transport / Energy / Material sub-categories
 * 
 * Supports parent-child relationship rollup (e.g., Tier 1 sees their footprint + all upstream Tier 2 & 3).
 */

const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const SupplierFootprint = require('../models/SupplierFootprint');

/**
 * GET /api/aggregation/summary
 * Returns global supply chain aggregation metrics for charts.
 */
exports.getGlobalSummary = async (req, res, next) => {
  try {
    const pipeline = [
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplier',
          foreignField: '_id',
          as: 'supplierDoc'
        }
      },
      { $unwind: '$supplierDoc' },
      {
        $facet: {
          // 1. Total supply chain emissions & sub-categories
          totals: [
            {
              $group: {
                _id: null,
                totalEmissions: { $sum: '$results.totalEmissions_tCO2e' },
                totalEnergy: { $sum: '$results.energyEmissions' },
                totalTransport: { $sum: '$results.transportEmissions' },
                totalMaterial: { $sum: '$results.materialEmissions' },
                count: { $sum: 1 }
              }
            }
          ],
          // 2. Emissions per tier
          perTier: [
            {
              $group: {
                _id: '$supplierDoc.tier',
                emissions: { $sum: '$results.totalEmissions_tCO2e' }
              }
            },
            { $sort: { _id: 1 } }
          ],
          // 3. Emissions per material (using inputs.material.type)
          perMaterial: [
            {
              $group: {
                _id: '$inputs.material.type',
                emissions: { $sum: '$results.totalEmissions_tCO2e' }
              }
            },
            { $match: { _id: { $ne: null } } },
            { $sort: { emissions: -1 } }
          ],
          // 4. Emissions per supplier (Top 10 highest emitters)
          topSuppliers: [
            {
              $group: {
                _id: {
                  id: '$supplierDoc._id',
                  name: '$supplierDoc.name',
                  supplierId: '$supplierDoc.supplierId',
                  tier: '$supplierDoc.tier'
                },
                emissions: { $sum: '$results.totalEmissions_tCO2e' }
              }
            },
            { $sort: { emissions: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ];

    const result = await SupplierFootprint.aggregate(pipeline);
    const data = result[0];

    return res.status(200).json({
      success: true,
      data: {
        totals: data.totals[0] || {
          totalEmissions: 0, totalEnergy: 0, totalTransport: 0, totalMaterial: 0, count: 0
        },
        perTier: data.perTier.reduce((acc, curr) => {
          acc[`Tier ${curr._id}`] = curr.emissions;
          return acc;
        }, {}),
        perMaterial: data.perMaterial.map(m => ({ material: m._id || 'Unknown', emissions: m.emissions })),
        topSuppliers: data.topSuppliers.map(s => ({
          ...s._id,
          emissions: s.emissions
        }))
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/aggregation/network/:supplierId
 * Calculates total footprint for a specific supplier PLUS all of their downstream/upstream dependencies.
 * If a Tier 1 is queried, it rolls up the footprint of all Tier 2 & 3 suppliers that flow into it.
 */
exports.getNetworkRollup = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    
    // Find the root supplier
    const rootSupplier = await Supplier.findOne(
      supplierId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: supplierId }
        : { supplierId: supplierId.toUpperCase() }
    );

    if (!rootSupplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    // Find all suppliers where this supplier is an ancestor (i.e., downstream sub-suppliers that feed into it)
    const subSuppliers = await Supplier.find({ ancestorPath: rootSupplier._id }).select('_id');
    const allRelevantIds = [rootSupplier._id, ...subSuppliers.map(s => s._id)];

    // Aggregate footprint for this network cluster
    const pipeline = [
      { $match: { supplier: { $in: allRelevantIds } } },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplier',
          foreignField: '_id',
          as: 'supplierDoc'
        }
      },
      { $unwind: '$supplierDoc' },
      {
        $group: {
          _id: '$supplierDoc._id',
          name: { $first: '$supplierDoc.name' },
          tier: { $first: '$supplierDoc.tier' },
          energyEmissions: { $sum: '$results.energyEmissions' },
          transportEmissions: { $sum: '$results.transportEmissions' },
          materialEmissions: { $sum: '$results.materialEmissions' },
          totalEmissions: { $sum: '$results.totalEmissions_tCO2e' }
        }
      }
    ];

    const nodes = await SupplierFootprint.aggregate(pipeline);
    
    // Calculate Rollup (Total network emissions)
    const rollup = nodes.reduce((acc, curr) => {
      acc.totalEmissions += curr.totalEmissions;
      acc.energyEmissions += curr.energyEmissions;
      acc.transportEmissions += curr.transportEmissions;
      acc.materialEmissions += curr.materialEmissions;
      return acc;
    }, { totalEmissions: 0, energyEmissions: 0, transportEmissions: 0, materialEmissions: 0 });

    return res.status(200).json({
      success: true,
      networkHead: {
        id: rootSupplier._id,
        name: rootSupplier.name,
        tier: rootSupplier.tier,
      },
      rollup,
      nodeBreakdown: nodes
    });

  } catch (err) {
    next(err);
  }
};
