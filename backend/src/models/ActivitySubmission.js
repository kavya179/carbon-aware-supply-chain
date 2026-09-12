const mongoose = require('mongoose');

/**
 * ActivitySubmission Model
 * =========================
 * Stores a single carbon-related activity data submission from a supplier.
 * Each record represents one row of data (energy, transport, or material).
 *
 * Bulk CSV uploads create multiple ActivitySubmission documents — one per valid row.
 * A BatchUpload document (separate collection) groups them by uploadId.
 */

// ─── Energy Sub-document ──────────────────────────────────────────────────────
const energyDataSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      enum: [
        'Grid Electricity',
        'Natural Gas',
        'Diesel',
        'Petrol',
        'Heavy Fuel Oil',
        'Coal',
        'Biomass',
        'Solar',
        'Wind',
        'Hydroelectric',
        'LPG',
        'Other',
      ],
    },
    consumption: {
      type: Number,
      required: true,
      min: [0, 'Energy consumption cannot be negative'],
    },
    unit: {
      type: String,
      required: true,
      enum: ['kWh', 'MWh', 'GJ', 'MJ', 'litres', 'kg', 'tonnes', 'm3', 'MMBtu'],
    },
    // Normalised to kWh for cross-record comparison (computed on save)
    normalised_kWh: { type: Number, default: null },
  },
  { _id: false }
);

// ─── Transport Sub-document ───────────────────────────────────────────────────
const transportDataSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      required: true,
      enum: [
        'Road – HGV (Diesel)',
        'Road – HGV (Electric)',
        'Road – Van',
        'Rail',
        'Sea – Container',
        'Sea – Bulk Carrier',
        'Air – Freight',
        'Air – Passenger',
        'Pipeline',
        'Inland Waterway',
        'Other',
      ],
    },
    distance: {
      type: Number,
      required: true,
      min: [0, 'Distance cannot be negative'],
    },
    distanceUnit: {
      type: String,
      required: true,
      enum: ['km', 'miles', 'nautical miles'],
    },
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative'],
      default: null,
    },
    weightUnit: {
      type: String,
      enum: ['kg', 'tonnes', 'metric tons', 'lbs'],
      default: 'tonnes',
    },
    // Computed tonne-km for emission factor lookup
    tonne_km: { type: Number, default: null },
    // Number of passengers (for Air – Passenger)
    passengerCount: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

// ─── Material Sub-document ────────────────────────────────────────────────────
const materialDataSchema = new mongoose.Schema(
  {
    materialType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: [
        'Metals & Alloys',
        'Plastics & Polymers',
        'Chemicals',
        'Textiles & Fibres',
        'Electronics & Components',
        'Agricultural & Bio-based',
        'Packaging',
        'Construction Materials',
        'Fuels',
        'Other',
      ],
      default: 'Other',
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'tonnes', 'metric tons', 'lbs', 'litres', 'm3', 'units', 'pallets'],
    },
    recycledContent_pct: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    originCountry: { type: String, default: null },
  },
  { _id: false }
);

// ─── Validation Result Sub-document ──────────────────────────────────────────
const validationResultSchema = new mongoose.Schema(
  {
    isValid: { type: Boolean, default: true },
    validationErrors: [
      {
        field:   { type: String },
        message: { type: String },
        value:   { type: mongoose.Schema.Types.Mixed },
      },
    ],
    warnings: [
      {
        field:   { type: String },
        message: { type: String },
      },
    ],
    // Emission calculated by Carbon Service
    calculatedEmission_tCO2e: { type: Number, default: null },
    emissionFactor:           { type: mongoose.Schema.Types.Mixed, default: null },
    validatedAt:              { type: Date, default: null },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const activitySubmissionSchema = new mongoose.Schema(
  {
    // ── Ownership ─────────────────────────────────────────────────────────────
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier reference is required'],
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Data Type ─────────────────────────────────────────────────────────────
    dataType: {
      type: String,
      required: true,
      enum: ['energy', 'transport', 'material'],
      index: true,
    },

    // ── Activity Data (only one will be populated per record) ─────────────────
    energyData:    { type: energyDataSchema,    default: null },
    transportData: { type: transportDataSchema, default: null },
    materialData:  { type: materialDataSchema,  default: null },

    // ── Reporting Period ──────────────────────────────────────────────────────
    reportingPeriod: {
      startDate: { type: Date, required: [true, 'Reporting period start date is required'] },
      endDate:   { type: Date, required: [true, 'Reporting period end date is required'] },
    },

    // ── Submission Status ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'validated', 'rejected', 'processed'],
      default: 'pending',
      index: true,
    },

    // ── Validation ────────────────────────────────────────────────────────────
    validation: { type: validationResultSchema, default: () => ({}) },

    // ── Bulk Upload Tracking ──────────────────────────────────────────────────
    // Set when this record came from a CSV upload
    batchId: {
      type: String,
      default: null,
      index: true,
    },
    sourceRow: {
      // Original CSV row number (1-indexed) for traceability
      type: Number,
      default: null,
    },

    // ── Notes / Metadata ──────────────────────────────────────────────────────
    notes:    { type: String, maxlength: 1000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Compound Indexes ─────────────────────────────────────────────────────────
activitySubmissionSchema.index({ supplier: 1, dataType: 1, status: 1 });
activitySubmissionSchema.index({ batchId: 1 });
activitySubmissionSchema.index({ 'reportingPeriod.startDate': -1 });

// ─── Pre-save: Compute derived fields ─────────────────────────────────────────

/** Normalise energy to kWh for comparability */
const ENERGY_TO_KWH = {
  kWh: 1, MWh: 1000, GJ: 277.778, MJ: 0.277778,
  MMBtu: 293.071, litres: 10.35, kg: 13.1, tonnes: 13100, m3: 10.55,
};

activitySubmissionSchema.pre('save', function (next) {
  // Energy normalisation
  if (this.dataType === 'energy' && this.energyData) {
    const factor = ENERGY_TO_KWH[this.energyData.unit] || 1;
    this.energyData.normalised_kWh = this.energyData.consumption * factor;
  }

  // Transport tonne-km
  if (this.dataType === 'transport' && this.transportData) {
    const DIST_TO_KM = { km: 1, miles: 1.60934, 'nautical miles': 1.852 };
    const WEIGHT_TO_TONNES = { kg: 0.001, tonnes: 1, 'metric tons': 1, lbs: 0.000453592 };
    const distKm  = this.transportData.distance * (DIST_TO_KM[this.transportData.distanceUnit] || 1);
    const weightT = this.transportData.weight
      ? this.transportData.weight * (WEIGHT_TO_TONNES[this.transportData.weightUnit] || 1)
      : 1;
    this.transportData.tonne_km = distKm * weightT;
  }

  next();
});

const ActivitySubmission = mongoose.model('ActivitySubmission', activitySubmissionSchema);
module.exports = ActivitySubmission;
