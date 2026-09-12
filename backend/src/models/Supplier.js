const mongoose = require('mongoose');

/**
 * SupplierDataStatus Sub-schema
 * ==============================
 * Tracks the completeness and verification state of a supplier's
 * submitted data across energy, transport, and materials categories.
 * This drives the "data status" requirement and the dashboard readiness score.
 */
const dataStatusSchema = new mongoose.Schema(
  {
    // Overall readiness: % of required fields populated + verified
    completenessScore: { type: Number, min: 0, max: 100, default: 0 },

    energy: {
      submitted: { type: Boolean, default: false },
      verified:  { type: Boolean, default: false },
      lastUpdated: { type: Date, default: null },
    },
    transport: {
      submitted: { type: Boolean, default: false },
      verified:  { type: Boolean, default: false },
      lastUpdated: { type: Date, default: null },
    },
    materials: {
      submitted: { type: Boolean, default: false },
      verified:  { type: Boolean, default: false },
      lastUpdated: { type: Date, default: null },
    },
    // Who last reviewed the data
    lastReviewedBy: { type: String, default: null },
    lastReviewedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * EnergyConsumption Sub-schema
 * ==============================
 * Annual energy consumption figures submitted by the supplier.
 * All values are normalised to MWh for consistency.
 */
const energyConsumptionSchema = new mongoose.Schema(
  {
    // Electricity
    electricityConsumption_MWh:  { type: Number, min: 0, default: null },
    electricitySource: {
      type: String,
      enum: ['Grid', 'Renewable PPA', 'Solar On-site', 'Wind On-site', 'Mixed', 'Unknown'],
      default: 'Unknown',
    },
    renewablePercentage: { type: Number, min: 0, max: 100, default: 0 },

    // Fossil fuels (stored in MWh equivalents for easy comparison)
    naturalGas_MWh:   { type: Number, min: 0, default: null },
    diesel_MWh:       { type: Number, min: 0, default: null },
    heavyFuelOil_MWh: { type: Number, min: 0, default: null },
    coal_MWh:         { type: Number, min: 0, default: null },
    otherFuels_MWh:   { type: Number, min: 0, default: null },

    // Totals (can be computed or manually entered)
    totalEnergy_MWh:        { type: Number, min: 0, default: null },
    energyIntensity_MWhPerUnit: { type: Number, min: 0, default: null }, // MWh / unit of output

    // Reporting period for this data
    reportingYear:  { type: Number, default: null },
    dataSource: {
      type: String,
      enum: ['Metered', 'Invoice', 'Estimation', 'Supplier Reported', 'Unknown'],
      default: 'Unknown',
    },
    notes: { type: String, maxlength: 500 },
  },
  { _id: false }
);

/**
 * TransportInformation Sub-schema
 * =================================
 * Covers inbound (from sub-suppliers) and outbound (to customer) logistics.
 * Designed to feed into Scope 3 Category 4 and 9 emission calculations.
 */
const transportSchema = new mongoose.Schema(
  {
    // Inbound logistics (from tier N+1 suppliers)
    inbound: {
      primaryMode: {
        type: String,
        enum: ['Road', 'Rail', 'Sea', 'Air', 'Multimodal', 'Not Applicable', 'Unknown'],
        default: 'Unknown',
      },
      annualDistance_km:     { type: Number, min: 0, default: null },
      annualTonnage_tonnes:  { type: Number, min: 0, default: null },
      averageLoadFactor_pct: { type: Number, min: 0, max: 100, default: null },
    },

    // Outbound logistics (to next tier or company)
    outbound: {
      primaryMode: {
        type: String,
        enum: ['Road', 'Rail', 'Sea', 'Air', 'Multimodal', 'Not Applicable', 'Unknown'],
        default: 'Unknown',
      },
      annualDistance_km:     { type: Number, min: 0, default: null },
      annualTonnage_tonnes:  { type: Number, min: 0, default: null },
      averageLoadFactor_pct: { type: Number, min: 0, max: 100, default: null },
    },

    // Fleet info (if supplier manages their own fleet)
    ownFleet: {
      vehicleCount:      { type: Number, min: 0, default: null },
      electricVehicles_pct: { type: Number, min: 0, max: 100, default: 0 },
      averageEuroStandard: { type: String, default: null }, // e.g. 'Euro VI'
    },

    reportingYear: { type: Number, default: null },
    notes: { type: String, maxlength: 500 },
  },
  { _id: false }
);

/**
 * MaterialSupplied Sub-schema
 * ============================
 * What the supplier provides to the next tier / the company.
 * Also captures upstream raw material sources for Tier 2/3 suppliers.
 */
const materialSuppliedSchema = new mongoose.Schema(
  {
    // Primary material / product supplied
    primaryMaterial: {
      type: String,
      required: [true, 'Primary material supplied is required'],
      trim: true,
      maxlength: 200,
    },
    materialCategory: {
      type: String,
      enum: [
        'Metals & Alloys',
        'Plastics & Polymers',
        'Chemicals',
        'Textiles & Fibres',
        'Electronics & Components',
        'Agricultural & Bio-based',
        'Packaging',
        'Energy Carrier',
        'Machinery & Equipment',
        'Logistics Services',
        'Construction Materials',
        'Other',
      ],
      default: 'Other',
    },
    // Annual supply volume
    annualVolume:     { type: Number, min: 0, default: null },
    volumeUnit:       { type: String, default: 'tonnes' }, // tonnes, units, m3, etc.

    // Whether any recycled content is included
    recycledContent_pct: { type: Number, min: 0, max: 100, default: 0 },

    // Other materials this supplier also provides (for multi-material suppliers)
    additionalMaterials: [
      {
        name: { type: String },
        category: { type: String },
        annualVolume: { type: Number },
        volumeUnit: { type: String },
      },
    ],

    // Country of material origin (may differ from supplier's country)
    originCountry: { type: String, default: null },
    notes: { type: String, maxlength: 500 },
  },
  { _id: false }
);

/**
 * Location Sub-schema
 * ====================
 * Rich location data including GeoJSON coordinates for map visualization.
 */
const locationSchema = new mongoose.Schema(
  {
    country:      { type: String, required: [true, 'Country is required'], trim: true },
    countryCode:  { type: String, uppercase: true, trim: true, maxlength: 3 }, // ISO 3166-1 alpha-2/3
    region:       { type: String, trim: true },    // State/province
    city:         { type: String, trim: true },
    address:      { type: String, trim: true },
    postalCode:   { type: String, trim: true },

    // GeoJSON Point — enables $near and geospatial queries + map visualisation
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },
  },
  { _id: false }
);

/**
 * ContactInfo Sub-schema
 */
const contactSchema = new mongoose.Schema(
  {
    primaryContactName:  { type: String, trim: true, maxlength: 100 },
    primaryContactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    primaryContactPhone: { type: String, trim: true },
    sustainabilityContactName:  { type: String, trim: true },
    sustainabilityContactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    website: { type: String, trim: true },
  },
  { _id: false }
);

// ─── Main Supplier Schema ─────────────────────────────────────────────────────
const supplierSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    /**
     * supplierId: Human-readable unique code (auto-generated if not provided).
     * Format: SUP-{TIER}-{RANDOM6}  e.g. SUP-1-A3B7C2
     */
    supplierId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // ── Tier & Chain Position ─────────────────────────────────────────────────
    tier: {
      type: Number,
      required: [true, 'Tier level is required'],
      enum: {
        values: [1, 2, 3],
        message: 'Tier must be 1 (direct), 2 (sub-supplier), or 3 (raw material/upstream)',
      },
    },

    /**
     * parentSupplier: Reference to the immediate customer of this supplier.
     *
     * Supply chain direction (upstream → downstream):
     *   Tier 3 → parentSupplier = Tier 2 → parentSupplier = Tier 1 → Company
     *
     * Tier 1 suppliers have parentSupplier = null (they report directly to Company).
     *
     * Tier constraints:
     *   Tier 3's parent must be Tier 2
     *   Tier 2's parent must be Tier 1
     *   Tier 1 has no parent
     */
    parentSupplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
      validate: {
        validator: function (v) {
          // Tier 1 must NOT have a parent; Tier 2 & 3 can optionally have one
          if (this.tier === 1 && v !== null) return false;
          return true;
        },
        message: 'Tier 1 suppliers cannot have a parent supplier.',
      },
    },

    // Denormalised path for efficient chain traversal (array of ancestor IDs)
    // e.g. Tier 3 doc: ancestorPath = [tier2Id, tier1Id]
    // Built automatically by the pre-save hook.
    ancestorPath: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
      },
    ],

    // ── Classification ────────────────────────────────────────────────────────
    category: {
      type: String,
      required: [true, 'Supply category is required'],
      enum: [
        'Raw Materials',
        'Manufacturing',
        'Transportation & Logistics',
        'Packaging',
        'Energy',
        'Electronics & Components',
        'Waste Management',
        'Agricultural',
        'Construction',
        'Services',
        'Other',
      ],
    },
    industryCode: { type: String, trim: true }, // e.g. ISIC/NACE code

    // ── Location ─────────────────────────────────────────────────────────────
    location: { type: locationSchema, required: true },

    // ── Material Supplied ─────────────────────────────────────────────────────
    materialSupplied: {
      type: materialSuppliedSchema,
      required: true,
    },

    // ── Energy Consumption ───────────────────────────────────────────────────
    energyConsumption: { type: energyConsumptionSchema, default: () => ({}) },

    // ── Transport Information ─────────────────────────────────────────────────
    transport: { type: transportSchema, default: () => ({}) },

    // ── Contact Info ──────────────────────────────────────────────────────────
    contact: { type: contactSchema, default: () => ({}) },

    // ── ESG & Compliance ─────────────────────────────────────────────────────
    esgScore: { type: Number, min: 0, max: 100, default: null },
    esgGrade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'F', null],
      default: null,
    },
    certifications: [
      {
        name: { type: String },        // e.g. 'ISO 14001'
        issuedBy: { type: String },
        validUntil: { type: Date },
      },
    ],
    carbonReductionTarget_pct: { type: Number, min: 0, max: 100, default: null },
    carbonReductionBaseYear:   { type: Number, default: null },

    // ── Operational Info ──────────────────────────────────────────────────────
    annualRevenue_USD:  { type: Number, min: 0, default: null },
    employeeCount:      { type: Number, min: 0, default: null },
    foundedYear:        { type: Number, default: null },
    productionCapacity: { type: String, trim: true },  // free-text, e.g. '50,000 units/yr'

    // ── Status & Risk ─────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Under Review', 'High Risk', 'Onboarding', 'Offboarded'],
      default: 'Onboarding',
    },
    riskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical', null],
      default: null,
    },
    riskFlags: [{ type: String }], // e.g. ['High Emissions', 'Missing Data', 'Audit Required']

    // ── Data Status ───────────────────────────────────────────────────────────
    // Tracks submission + verification state per data category
    dataStatus: { type: dataStatusSchema, default: () => ({}) },

    // ── Relationships (Denormalised for graph queries) ────────────────────────
    // Total number of direct children — kept in sync for efficient queries
    directChildCount: { type: Number, default: 0, min: 0 },

    // ── Metadata ──────────────────────────────────────────────────────────────
    tags: [{ type: String, trim: true }],
    notes: { type: String, maxlength: 2000 },
    onboardedAt: { type: Date, default: null },
    onboardedBy: { type: String, default: null }, // User email
    lastAuditedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────

/** Virtual: direct child suppliers (populated on demand) */
supplierSchema.virtual('childSuppliers', {
  ref: 'Supplier',
  localField: '_id',
  foreignField: 'parentSupplier',
});

/** Virtual: tier label */
supplierSchema.virtual('tierLabel').get(function () {
  const labels = {
    1: 'Tier 1 — Direct Supplier',
    2: 'Tier 2 — Sub-Supplier',
    3: 'Tier 3 — Raw Material / Upstream',
  };
  return labels[this.tier] || `Tier ${this.tier}`;
});

/** Virtual: chain depth (0-based; Tier 1 = depth 0) */
supplierSchema.virtual('chainDepth').get(function () {
  return this.tier - 1;
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
supplierSchema.index({ tier: 1, status: 1 });
supplierSchema.index({ parentSupplier: 1 });
supplierSchema.index({ ancestorPath: 1 });
supplierSchema.index({ 'location.country': 1 });
supplierSchema.index({ 'location.coordinates': '2dsphere' }); // Geospatial
supplierSchema.index({ status: 1, riskLevel: 1 });
supplierSchema.index({ name: 'text', 'materialSupplied.primaryMaterial': 'text', tags: 'text' }); // Full-text

// ─── Pre-save Hook: auto-generate supplierId ───────────────────────────────────
supplierSchema.pre('save', async function (next) {
  if (!this.supplierId) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.supplierId = `SUP-${this.tier}-${random}`;
  }
  next();
});

// ─── Pre-save Hook: build ancestorPath ─────────────────────────────────────────
/**
 * Keeps the denormalised ancestorPath array up-to-date when a supplier
 * is saved or its parentSupplier changes.
 *
 * ancestorPath contains: [immediateParentId, grandparentId, ...]
 * This allows O(1) "is X an ancestor of Y?" queries.
 */
supplierSchema.pre('save', async function (next) {
  if (this.isModified('parentSupplier')) {
    if (!this.parentSupplier) {
      this.ancestorPath = [];
    } else {
      const parent = await this.constructor.findById(this.parentSupplier).select('ancestorPath');
      if (parent) {
        // [parentId, ...parent's ancestors]
        this.ancestorPath = [parent._id, ...parent.ancestorPath];
      }
    }
  }
  next();
});

// ─── Post-save Hook: keep directChildCount in sync on parent ──────────────────
supplierSchema.post('save', async function (doc) {
  if (doc.parentSupplier) {
    const childCount = await doc.constructor.countDocuments({ parentSupplier: doc.parentSupplier });
    await doc.constructor.findByIdAndUpdate(doc.parentSupplier, { directChildCount: childCount });
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Compute and save the dataStatus completenessScore based on which
 * of the three data categories have been submitted.
 */
supplierSchema.methods.updateCompletenessScore = function () {
  const categories = ['energy', 'transport', 'materials'];
  const submitted = categories.filter((c) => this.dataStatus[c]?.submitted).length;
  const verified  = categories.filter((c) => this.dataStatus[c]?.verified).length;
  // Submitted counts 60%, verified counts 40% on top
  this.dataStatus.completenessScore = Math.round((submitted / 3) * 60 + (verified / 3) * 40);
};

/**
 * Returns a compact node representation for graph/network visualisation.
 * Designed to feed directly into D3 force-directed or network graph APIs.
 */
supplierSchema.methods.toGraphNode = function () {
  return {
    id:             this._id.toString(),
    supplierId:     this.supplierId,
    name:           this.name,
    tier:           this.tier,
    tierLabel:      this.tierLabel,
    parentId:       this.parentSupplier?.toString() || null,
    ancestorPath:   this.ancestorPath.map((a) => a.toString()),
    status:         this.status,
    riskLevel:      this.riskLevel,
    esgScore:       this.esgScore,
    category:       this.category,
    country:        this.location?.country,
    coordinates:    this.location?.coordinates?.coordinates || null,
    completeness:   this.dataStatus?.completenessScore,
    childCount:     this.directChildCount,
    material:       this.materialSupplied?.primaryMaterial,
  };
};

const Supplier = mongoose.model('Supplier', supplierSchema);
module.exports = Supplier;
