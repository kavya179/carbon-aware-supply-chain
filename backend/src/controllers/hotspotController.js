/**
 * Hotspot Controller
 * ==================
 * Identifies carbon hotspots in the supply chain using rule-based analysis.
 * Generates hotspot scores, classifications, and plain-text insights.
 */

const mongoose = require('mongoose');
const SupplierFootprint = require('../models/SupplierFootprint');

function getHotspotClassification(score) {
  if (score >= 20) return 'High';
  if (score >= 10) return 'Medium';
  return 'Low';
}

function generateSupplierInsight(supplier, score) {
  if (score > 15) {
    return `Critical Hotspot: Supplier ${supplier.name} alone contributes ${score.toFixed(1)}% of total supply chain emissions. Immediate engagement is recommended.`;
  }
  return `Supplier ${supplier.name} contributes ${score.toFixed(1)}% of total emissions.`;
}

function generateMaterialInsight(material, score) {
  if (score > 25) {
    return `Major Material Impact: ${material} is responsible for ${score.toFixed(1)}% of total emissions. Consider sourcing lower-carbon alternatives.`;
  }
  return `Material '${material}' accounts for ${score.toFixed(1)}% of supply chain emissions.`;
}

function generateTierInsight(tier, score) {
  return `Tier ${tier} represents ${score.toFixed(1)}% of total supply chain emissions.`;
}

/**
 * GET /api/hotspots
 * Analyzes emissions across the entire supply chain to identify hotspots.
 */
exports.analyzeHotspots = async (req, res, next) => {
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
          // Calculate global total
          global: [
            {
              $group: {
                _id: null,
                total: { $sum: '$results.totalEmissions_tCO2e' }
              }
            }
          ],
          // Supplier Aggregation
          suppliers: [
            {
              $group: {
                _id: { id: '$supplierDoc._id', name: '$supplierDoc.name' },
                emissions: { $sum: '$results.totalEmissions_tCO2e' }
              }
            },
            { $sort: { emissions: -1 } },
            { $limit: 5 }
          ],
          // Material Aggregation
          materials: [
            {
              $group: {
                _id: '$inputs.material.type',
                emissions: { $sum: '$results.totalEmissions_tCO2e' }
              }
            },
            { $match: { _id: { $ne: null } } },
            { $sort: { emissions: -1 } },
            { $limit: 1 }
          ],
          // Transport Aggregation
          transports: [
            {
              $group: {
                _id: '$inputs.transport.mode',
                emissions: { $sum: '$results.transportEmissions' }
              }
            },
            { $match: { _id: { $ne: null } } },
            { $sort: { emissions: -1 } },
            { $limit: 1 }
          ],
          // Tier Aggregation
          tiers: [
            {
              $group: {
                _id: '$supplierDoc.tier',
                emissions: { $sum: '$results.totalEmissions_tCO2e' }
              }
            },
            { $sort: { emissions: -1 } },
            { $limit: 1 }
          ]
        }
      }
    ];

    const result = await SupplierFootprint.aggregate(pipeline);
    const data = result[0];

    const totalEmissions = data.global[0]?.total || 1; // avoid div/0

    // 1. Process Suppliers (Top 5)
    const supplierHotspots = data.suppliers.map(s => {
      const score = (s.emissions / totalEmissions) * 100;
      return {
        type: 'Supplier',
        name: s._id.name,
        id: s._id.id,
        emissions: Math.round(s.emissions),
        score: Number(score.toFixed(2)),
        classification: getHotspotClassification(score),
        insight: generateSupplierInsight(s._id, score)
      };
    });

    // 2. Process Highest Material
    let materialHotspot = null;
    if (data.materials.length > 0) {
      const m = data.materials[0];
      const score = (m.emissions / totalEmissions) * 100;
      materialHotspot = {
        type: 'Material',
        name: m._id,
        emissions: Math.round(m.emissions),
        score: Number(score.toFixed(2)),
        classification: getHotspotClassification(score),
        insight: generateMaterialInsight(m._id, score)
      };
    }

    // 3. Process Highest Transport Activity
    let transportHotspot = null;
    if (data.transports.length > 0) {
      const t = data.transports[0];
      const score = (t.emissions / totalEmissions) * 100;
      transportHotspot = {
        type: 'Transport',
        name: t._id,
        emissions: Math.round(t.emissions),
        score: Number(score.toFixed(2)),
        classification: getHotspotClassification(score),
        insight: `Transport via ${t._id} accounts for ${score.toFixed(1)}% of total emissions.`
      };
    }

    // 4. Process Highest Tier
    let tierHotspot = null;
    if (data.tiers.length > 0) {
      const tr = data.tiers[0];
      const score = (tr.emissions / totalEmissions) * 100;
      tierHotspot = {
        type: 'Tier',
        name: `Tier ${tr._id}`,
        tierLevel: tr._id,
        emissions: Math.round(tr.emissions),
        score: Number(score.toFixed(2)),
        classification: getHotspotClassification(score),
        insight: generateTierInsight(tr._id, score)
      };
    }

    // Combine all insights for a summary list
    const allInsights = [];
    supplierHotspots.forEach(sh => {
      if (sh.classification === 'High') allInsights.push(sh.insight);
    });
    if (materialHotspot && materialHotspot.classification !== 'Low') allInsights.push(materialHotspot.insight);
    if (tierHotspot) allInsights.push(tierHotspot.insight);

    return res.status(200).json({
      success: true,
      data: {
        totalEmissions: Math.round(totalEmissions),
        topSuppliers: supplierHotspots,
        highestMaterial: materialHotspot,
        highestTransport: transportHotspot,
        highestTier: tierHotspot,
        keyInsights: allInsights
      }
    });

  } catch (err) {
    next(err);
  }
};
