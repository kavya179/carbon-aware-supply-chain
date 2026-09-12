/**
 * Supplier Controller
 * ====================
 *
 * Operations:
 *   getAll            GET  /api/suppliers                     List + filter suppliers
 *   getById           GET  /api/suppliers/:id                 Single supplier with children
 *   getByTier         GET  /api/suppliers/tier/:tier          Suppliers of a specific tier
 *   create            POST /api/suppliers                     Add a supplier
 *   update            PUT  /api/suppliers/:id                 Update a supplier
 *   remove            DEL  /api/suppliers/:id                 Delete (with cascade guard)
 *   getChain          GET  /api/suppliers/:id/chain           Full upstream chain (T3→T2→T1)
 *   getDescendants    GET  /api/suppliers/:id/descendants     All downstream suppliers
 *   getNetworkGraph   GET  /api/suppliers/network             Entire graph for D3 visualisation
 *   setParent         PATCH /api/suppliers/:id/parent         Set/change parent relationship
 *   updateDataStatus  PATCH /api/suppliers/:id/data-status    Update energy/transport/material status
 *   getEmissions      GET  /api/suppliers/:id/emissions       Emission records for a supplier
 */
const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const Emission = require('../models/Emission');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the standard populate config for list queries.
 * parentSupplier is always populated; childSuppliers on demand.
 */
const BASE_POPULATE = [
  { path: 'parentSupplier', select: 'name supplierId tier status location.country' },
];

const WITH_CHILDREN_POPULATE = [
  ...BASE_POPULATE,
  { path: 'childSuppliers', select: 'name supplierId tier status esgScore dataStatus.completenessScore location.country' },
];

/**
 * Validate that the proposed parent is a legal tier step:
 *  - Tier 2 supplier's parent must be Tier 1
 *  - Tier 3 supplier's parent must be Tier 2
 * Throws a 400 error if invalid.
 */
const validateParentTier = async (childTier, parentId, res) => {
  if (!parentId) return true;
  const parent = await Supplier.findById(parentId).select('tier name');
  if (!parent) {
    res.status(404).json({ success: false, error: 'Parent supplier not found.' });
    return false;
  }
  const expectedParentTier = childTier - 1;
  if (parent.tier !== expectedParentTier) {
    res.status(400).json({
      success: false,
      error: `A Tier ${childTier} supplier's parent must be a Tier ${expectedParentTier} supplier. ` +
             `"${parent.name}" is Tier ${parent.tier}.`,
    });
    return false;
  }
  return true;
};

// ─── GET ALL ─────────────────────────────────────────────────────────────────

/**
 * GET /api/suppliers
 * Full-featured list endpoint with filtering, search, sorting, and pagination.
 *
 * Query params:
 *   tier           1|2|3
 *   status         Active|Inactive|Under Review|High Risk|Onboarding|Offboarded
 *   riskLevel      Low|Medium|High|Critical
 *   country        e.g. India
 *   category       e.g. Raw Materials
 *   parentSupplier MongoDB ID (get direct children of a specific supplier)
 *   hasParent      true|false (filter root vs non-root suppliers)
 *   search         full-text search on name, material, tags
 *   sortBy         name|tier|esgScore|createdAt|dataStatus.completenessScore
 *   sortOrder      asc|desc
 *   page           default 1
 *   limit          default 20, max 100
 */
exports.getAll = async (req, res, next) => {
  try {
    const {
      tier, status, riskLevel, country, category,
      parentSupplier, hasParent, search,
      sortBy = 'createdAt', sortOrder = 'desc',
      page = 1, limit = 20,
    } = req.query;

    const filter = {};

    if (tier)          filter.tier = Number(tier);
    if (status)        filter.status = status;
    if (riskLevel)     filter.riskLevel = riskLevel;
    if (country)       filter['location.country'] = { $regex: country, $options: 'i' };
    if (category)      filter.category = category;
    if (parentSupplier) filter.parentSupplier = parentSupplier;
    if (hasParent === 'true')  filter.parentSupplier = { $ne: null };
    if (hasParent === 'false') filter.parentSupplier = null;

    // Full-text search
    if (search) {
      filter.$text = { $search: search };
    }

    const sanitisedLimit = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * sanitisedLimit;

    // Build sort
    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const allowedSortFields = ['name', 'tier', 'esgScore', 'createdAt', 'dataStatus.completenessScore', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sort = { [sortField]: sortDir };

    const [suppliers, total] = await Promise.all([
      Supplier.find(filter)
        .populate(BASE_POPULATE)
        .skip(skip)
        .limit(sanitisedLimit)
        .sort(sort),
      Supplier.countDocuments(filter),
    ]);

    // Per-tier breakdown totals (useful for the dashboard)
    const tierBreakdown = await Supplier.aggregate([
      { $match: filter },
      { $group: { _id: '$tier', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: suppliers,
      pagination: {
        total,
        page: Number(page),
        limit: sanitisedLimit,
        pages: Math.ceil(total / sanitisedLimit),
      },
      meta: { tierBreakdown },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────

/**
 * GET /api/suppliers/:id
 * Returns full supplier details with populated parent + direct children.
 */
exports.getById = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate(WITH_CHILDREN_POPULATE);

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    return res.status(200).json({ success: true, data: supplier });
  } catch (err) {
    next(err);
  }
};

// ─── GET BY TIER ──────────────────────────────────────────────────────────────

/**
 * GET /api/suppliers/tier/:tier
 * Returns all suppliers of a specific tier with summary stats.
 */
exports.getByTier = async (req, res, next) => {
  try {
    const tier = Number(req.params.tier);
    if (![1, 2, 3].includes(tier)) {
      return res.status(400).json({ success: false, error: 'Tier must be 1, 2, or 3.' });
    }

    const { status, country, page = 1, limit = 50 } = req.query;
    const filter = { tier };
    if (status)  filter.status = status;
    if (country) filter['location.country'] = { $regex: country, $options: 'i' };

    const sanitisedLimit = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * sanitisedLimit;

    const [suppliers, total, stats] = await Promise.all([
      Supplier.find(filter)
        .populate(BASE_POPULATE)
        .skip(skip)
        .limit(sanitisedLimit)
        .sort({ name: 1 }),
      Supplier.countDocuments(filter),
      // Aggregate stats for this tier
      Supplier.aggregate([
        { $match: { tier } },
        {
          $group: {
            _id: null,
            avgEsgScore: { $avg: '$esgScore' },
            avgCompleteness: { $avg: '$dataStatus.completenessScore' },
            countByStatus: { $push: '$status' },
            countByRisk: { $push: '$riskLevel' },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      tier,
      tierLabel: { 1: 'Direct Suppliers', 2: 'Sub-Suppliers', 3: 'Raw Material / Upstream' }[tier],
      data: suppliers,
      pagination: { total, page: Number(page), limit: sanitisedLimit, pages: Math.ceil(total / sanitisedLimit) },
      stats: stats[0] || null,
    });
  } catch (err) {
    next(err);
  }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────

/**
 * POST /api/suppliers
 * Creates a new supplier. Validates parent-tier constraint.
 */
exports.create = async (req, res, next) => {
  try {
    const { tier, parentSupplier } = req.body;

    // Validate parent tier compatibility
    if (parentSupplier) {
      const ok = await validateParentTier(Number(tier), parentSupplier, res);
      if (!ok) return;
    }

    // Tier 1 must have no parent
    if (Number(tier) === 1 && parentSupplier) {
      return res.status(400).json({
        success: false,
        error: 'Tier 1 suppliers cannot have a parent supplier.',
      });
    }

    // Inject onboarding metadata
    const body = {
      ...req.body,
      onboardedAt: new Date(),
      onboardedBy: req.user?.email || 'system',
    };

    const supplier = await Supplier.create(body);
    const populated = await supplier.populate(WITH_CHILDREN_POPULATE);

    return res.status(201).json({
      success: true,
      message: `Tier ${supplier.tier} supplier "${supplier.name}" created successfully.`,
      data: populated,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'A supplier with this ID already exists.',
      });
    }
    next(err);
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

/**
 * PUT /api/suppliers/:id
 * Full or partial update. Re-validates parent-tier if parentSupplier changes.
 */
exports.update = async (req, res, next) => {
  try {
    const { tier, parentSupplier } = req.body;

    // If changing tier or parent, re-validate
    if (parentSupplier !== undefined) {
      const currentTier = tier || (await Supplier.findById(req.params.id).select('tier'))?.tier;
      if (currentTier && parentSupplier) {
        const ok = await validateParentTier(Number(currentTier), parentSupplier, res);
        if (!ok) return;
      }
    }

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate(WITH_CHILDREN_POPULATE);

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Supplier updated successfully.',
      data: supplier,
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

/**
 * DELETE /api/suppliers/:id
 * Soft/hard delete with child safety check.
 * Will block deletion if supplier has children (use ?force=true to override).
 * Clears parentSupplier reference on orphaned children when force-deleted.
 */
exports.remove = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    const childCount = await Supplier.countDocuments({ parentSupplier: req.params.id });

    if (childCount > 0 && req.query.force !== 'true') {
      return res.status(409).json({
        success: false,
        error: `Cannot delete supplier "${supplier.name}" — it has ${childCount} child supplier(s). ` +
               `Use ?force=true to orphan children and delete anyway.`,
        childCount,
      });
    }

    // Orphan children if force-deleting
    if (childCount > 0) {
      await Supplier.updateMany(
        { parentSupplier: req.params.id },
        { $set: { parentSupplier: null, ancestorPath: [] } }
      );
    }

    // Remove from other suppliers' ancestorPaths
    await Supplier.updateMany(
      { ancestorPath: req.params.id },
      { $pull: { ancestorPath: supplier._id } }
    );

    await Supplier.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Supplier "${supplier.name}" deleted.`,
      orphanedChildren: childCount,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET UPSTREAM CHAIN ───────────────────────────────────────────────────────

/**
 * GET /api/suppliers/:id/chain
 * Returns the full upstream chain from this supplier all the way to Tier 1.
 *
 * e.g. for a Tier 3 supplier:
 *   [Tier3, Tier2 (parent), Tier1 (grandparent)]
 *
 * Uses the denormalised ancestorPath for O(1) lookup.
 */
exports.getChain = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate(BASE_POPULATE);

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    // Fetch all ancestors in one query
    const ancestors = supplier.ancestorPath.length > 0
      ? await Supplier.find({ _id: { $in: supplier.ancestorPath } })
          .populate({ path: 'parentSupplier', select: 'name supplierId tier' })
          .sort({ tier: -1 }) // Tier 3 first if applicable
      : [];

    // Build ordered chain: [this supplier, parent, grandparent, ...]
    const orderedAncestors = supplier.ancestorPath.map(
      (id) => ancestors.find((a) => a._id.toString() === id.toString())
    ).filter(Boolean);

    const chain = [supplier, ...orderedAncestors];

    return res.status(200).json({
      success: true,
      supplierId: supplier.supplierId,
      name: supplier.name,
      chainLength: chain.length,
      chain: chain.map((s) => ({
        id: s._id,
        supplierId: s.supplierId,
        name: s.name,
        tier: s.tier,
        tierLabel: s.tierLabel,
        status: s.status,
        country: s.location?.country,
        category: s.category,
        material: s.materialSupplied?.primaryMaterial,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET DESCENDANTS ──────────────────────────────────────────────────────────

/**
 * GET /api/suppliers/:id/descendants
 * Returns all downstream suppliers that have this supplier in their ancestorPath.
 * Useful for showing what a Tier 1 supplier feeds into.
 */
exports.getDescendants = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id).select('name supplierId tier');
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    const descendants = await Supplier.find({
      ancestorPath: req.params.id,
    })
      .populate({ path: 'parentSupplier', select: 'name supplierId tier' })
      .sort({ tier: 1, name: 1 });

    // Group by tier for easy consumption
    const grouped = { 1: [], 2: [], 3: [] };
    descendants.forEach((d) => {
      if (grouped[d.tier]) grouped[d.tier].push(d);
    });

    return res.status(200).json({
      success: true,
      rootSupplier: { id: supplier._id, supplierId: supplier.supplierId, name: supplier.name },
      totalDescendants: descendants.length,
      byTier: grouped,
      data: descendants,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET NETWORK GRAPH ────────────────────────────────────────────────────────

/**
 * GET /api/suppliers/network
 * Returns nodes + edges formatted for D3 force-directed or network visualisation.
 *
 * Node: { id, supplierId, name, tier, status, esgScore, country, ... }
 * Edge: { source: parentId, target: childId, tier, material }
 *
 * Optional query: ?tier=1 to scope graph to a specific tier's sub-network
 */
exports.getNetworkGraph = async (req, res, next) => {
  try {
    const { tier, status } = req.query;
    const filter = {};
    if (tier)   filter.tier = Number(tier);
    if (status) filter.status = status;

    const suppliers = await Supplier.find(filter)
      .select('name supplierId tier parentSupplier status riskLevel esgScore location category materialSupplied.primaryMaterial dataStatus.completenessScore directChildCount ancestorPath')
      .lean();

    // Build graph nodes
    const nodes = suppliers.map((s) => ({
      id:           s._id.toString(),
      supplierId:   s.supplierId,
      name:         s.name,
      tier:         s.tier,
      tierLabel:    { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' }[s.tier],
      parentId:     s.parentSupplier?.toString() || null,
      status:       s.status,
      riskLevel:    s.riskLevel,
      esgScore:     s.esgScore,
      country:      s.location?.country,
      coordinates:  s.location?.coordinates?.coordinates || null,
      category:     s.category,
      material:     s.materialSupplied?.primaryMaterial,
      completeness: s.dataStatus?.completenessScore,
      childCount:   s.directChildCount,
    }));

    // Build edges: one edge per parent→child relationship
    const edges = suppliers
      .filter((s) => s.parentSupplier)
      .map((s) => ({
        id:       `${s.parentSupplier.toString()}-${s._id.toString()}`,
        source:   s.parentSupplier.toString(),
        target:   s._id.toString(),
        tier:     s.tier,
        material: s.materialSupplied?.primaryMaterial || null,
      }));

    // Summary stats for the graph header
    const summary = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      byTier: {
        tier1: nodes.filter((n) => n.tier === 1).length,
        tier2: nodes.filter((n) => n.tier === 2).length,
        tier3: nodes.filter((n) => n.tier === 3).length,
      },
      byStatus: nodes.reduce((acc, n) => {
        acc[n.status] = (acc[n.status] || 0) + 1;
        return acc;
      }, {}),
      byRisk: nodes.reduce((acc, n) => {
        if (n.riskLevel) acc[n.riskLevel] = (acc[n.riskLevel] || 0) + 1;
        return acc;
      }, {}),
    };

    return res.status(200).json({
      success: true,
      graph: { nodes, edges },
      summary,
    });
  } catch (err) {
    next(err);
  }
};

// ─── SET / CHANGE PARENT ──────────────────────────────────────────────────────

/**
 * PATCH /api/suppliers/:id/parent
 * Set or change the parentSupplier of an existing supplier.
 * Pass { parentSupplierId: "mongoId" } to set, or { parentSupplierId: null } to unlink.
 *
 * Validates:
 *  - Tier 1 cannot have a parent
 *  - Parent must be one tier above the child
 *  - No circular references
 */
exports.setParent = async (req, res, next) => {
  try {
    const { parentSupplierId } = req.body;
    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    if (supplier.tier === 1 && parentSupplierId) {
      return res.status(400).json({
        success: false,
        error: 'Tier 1 suppliers cannot have a parent supplier.',
      });
    }

    // Null → unlink
    if (!parentSupplierId) {
      supplier.parentSupplier = null;
      supplier.ancestorPath = [];
      await supplier.save();
      return res.status(200).json({
        success: true,
        message: 'Parent supplier relationship removed.',
        data: supplier,
      });
    }

    // Circular reference guard: parentSupplierId cannot be in this supplier's descendants
    const descendantIds = (await Supplier.find({ ancestorPath: supplier._id }).select('_id'))
      .map((d) => d._id.toString());
    if (descendantIds.includes(parentSupplierId)) {
      return res.status(400).json({
        success: false,
        error: 'Circular reference detected: the proposed parent is a descendant of this supplier.',
      });
    }

    // Tier validation
    const ok = await validateParentTier(supplier.tier, parentSupplierId, res);
    if (!ok) return;

    // Update old parent's child count
    if (supplier.parentSupplier) {
      const oldChildCount = await Supplier.countDocuments({ parentSupplier: supplier.parentSupplier, _id: { $ne: supplier._id } });
      await Supplier.findByIdAndUpdate(supplier.parentSupplier, { directChildCount: oldChildCount });
    }

    supplier.parentSupplier = parentSupplierId;
    await supplier.save(); // ancestorPath rebuilt via pre-save hook

    const populated = await supplier.populate(WITH_CHILDREN_POPULATE);

    return res.status(200).json({
      success: true,
      message: 'Parent supplier relationship updated.',
      data: populated,
    });
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE DATA STATUS ───────────────────────────────────────────────────────

/**
 * PATCH /api/suppliers/:id/data-status
 * Updates the data submission and verification status for a specific category.
 *
 * Body: { category: 'energy'|'transport'|'materials', submitted: bool, verified: bool }
 */
exports.updateDataStatus = async (req, res, next) => {
  try {
    const { category, submitted, verified } = req.body;
    const validCategories = ['energy', 'transport', 'materials'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    // Update the specified category
    const updatePath = `dataStatus.${category}`;
    const now = new Date();
    const updates = {};

    if (submitted !== undefined) {
      updates[`${updatePath}.submitted`] = submitted;
      if (submitted) updates[`${updatePath}.lastUpdated`] = now;
    }
    if (verified !== undefined) {
      // Only managers can verify (role already enforced at route level)
      updates[`${updatePath}.verified`] = verified;
      if (verified) {
        updates['dataStatus.lastReviewedBy'] = req.user?.email;
        updates['dataStatus.lastReviewedAt'] = now;
      }
    }

    const updated = await Supplier.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    // Recompute completeness score
    updated.updateCompletenessScore();
    await updated.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: `Data status for '${category}' updated.`,
      dataStatus: updated.dataStatus,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET EMISSIONS ────────────────────────────────────────────────────────────

/**
 * GET /api/suppliers/:id/emissions
 * Returns emission records for a supplier with pagination.
 */
exports.getEmissions = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id).select('name supplierId tier');
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found.' });
    }

    const { page = 1, limit = 20, verificationStatus } = req.query;
    const filter = { supplier: req.params.id };
    if (verificationStatus) filter.verificationStatus = verificationStatus;

    const sanitisedLimit = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * sanitisedLimit;

    const [emissions, total, totalEmissions] = await Promise.all([
      Emission.find(filter)
        .skip(skip)
        .limit(sanitisedLimit)
        .sort({ 'reportingPeriod.startDate': -1 }),
      Emission.countDocuments(filter),
      // Total tCO2e for this supplier
      Emission.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$emissionValue' } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      supplier: { id: supplier._id, supplierId: supplier.supplierId, name: supplier.name, tier: supplier.tier },
      totalEmissions_tCO2e: totalEmissions[0]?.total || 0,
      data: emissions,
      pagination: { total, page: Number(page), limit: sanitisedLimit, pages: Math.ceil(total / sanitisedLimit) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET SUMMARY STATS ────────────────────────────────────────────────────────

/**
 * GET /api/suppliers/stats
 * Returns aggregate statistics for the supplier module dashboard card.
 */
exports.getStats = async (req, res, next) => {
  try {
    const [tierCounts, statusCounts, riskCounts, avgEsg, dataReadiness, topCountries] =
      await Promise.all([
        Supplier.aggregate([{ $group: { _id: '$tier', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Supplier.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Supplier.aggregate([
          { $match: { riskLevel: { $ne: null } } },
          { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
        ]),
        Supplier.aggregate([
          { $match: { esgScore: { $ne: null } } },
          { $group: { _id: null, avg: { $avg: '$esgScore' }, min: { $min: '$esgScore' }, max: { $max: '$esgScore' } } },
        ]),
        Supplier.aggregate([
          { $group: { _id: null, avgCompleteness: { $avg: '$dataStatus.completenessScore' } } },
        ]),
        Supplier.aggregate([
          { $group: { _id: '$location.country', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

    return res.status(200).json({
      success: true,
      stats: {
        total: tierCounts.reduce((sum, t) => sum + t.count, 0),
        byTier: tierCounts.reduce((acc, t) => { acc[`tier${t._id}`] = t.count; return acc; }, {}),
        byStatus: statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
        byRisk: riskCounts.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {}),
        esgScore: avgEsg[0] || { avg: null, min: null, max: null },
        avgDataCompleteness: dataReadiness[0]?.avgCompleteness || 0,
        topCountries,
      },
    });
  } catch (err) {
    next(err);
  }
};
