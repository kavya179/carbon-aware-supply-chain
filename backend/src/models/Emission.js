const mongoose = require('mongoose');

/**
 * Emission Record Model
 * Represents a single Scope 3 emission data point from a supplier
 */
const emissionSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier reference is required'],
    },
    // GHG Protocol Scope 3 Categories (1-15)
    scope3Category: {
      type: Number,
      required: true,
      min: 1,
      max: 15,
    },
    categoryName: {
      type: String,
      required: true,
      // e.g. "Purchased Goods & Services", "Upstream Transportation", etc.
    },
    activityType: {
      type: String,
      required: true,
      enum: [
        'Energy Consumption',
        'Transportation (Road)',
        'Transportation (Air)',
        'Transportation (Sea)',
        'Raw Material Production',
        'Manufacturing Process',
        'Waste Generated',
        'Business Travel',
        'Employee Commute',
        'Use of Sold Products',
        'End-of-Life Treatment',
        'Other',
      ],
    },
    // Activity data (raw inputs before conversion)
    activityData: {
      value: { type: Number, required: true },
      unit: { type: String, required: true }, // e.g. 'kWh', 'tonne-km', 'kg'
    },
    // Computed emission value in tCO2e
    emissionValue: {
      type: Number,
      required: true,
      min: 0,
    },
    emissionUnit: {
      type: String,
      default: 'tCO2e',
    },
    emissionFactor: {
      value: Number,
      unit: String,
      source: String, // e.g. 'IPCC AR6', 'EPA 2024', 'DEFRA 2024'
    },
    reportingPeriod: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    dataQuality: {
      type: String,
      enum: ['Measured', 'Estimated', 'Calculated', 'Supplier Reported'],
      default: 'Calculated',
    },
    verificationStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected', 'Under Review'],
      default: 'Pending',
    },
    verifiedBy: { type: String },
    verifiedAt: { type: Date },
    notes: { type: String, maxlength: 1000 },
    attachments: [{ filename: String, url: String }],
    // Flag for anomaly detection from Carbon Service
    isAnomaly: { type: Boolean, default: false },
    anomalyScore: { type: Number, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for time-series queries
emissionSchema.index({ supplier: 1, 'reportingPeriod.startDate': -1 });
emissionSchema.index({ scope3Category: 1 });
emissionSchema.index({ verificationStatus: 1 });

const Emission = mongoose.model('Emission', emissionSchema);
module.exports = Emission;
