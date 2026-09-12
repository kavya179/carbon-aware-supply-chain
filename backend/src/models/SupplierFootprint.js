const mongoose = require('mongoose');

/**
 * SupplierFootprint Model
 * =======================
 * Stores the calculated combined footprint (Energy, Transport, Material) 
 * for a supplier based on the calculation engine's response.
 */
const footprintSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier reference is required'],
      index: true,
    },
    // Raw Inputs
    inputs: {
      energy: {
        consumption: Number,
        source: String,
        unit: String,
      },
      transport: {
        distance: Number,
        mode: String,
        distanceUnit: String,
        weight: Number,
        weightUnit: String,
      },
      material: {
        quantity: Number,
        type: { type: String }, // 'type' is a reserved keyword in Mongoose sometimes, so wrap it
        unit: String,
      }
    },
    // Calculated Results (from Django)
    results: {
      energyEmissions: { type: Number, required: true },
      transportEmissions: { type: Number, required: true },
      materialEmissions: { type: Number, required: true },
      totalEmissions_tCO2e: { type: Number, required: true },
      metadata: { type: mongoose.Schema.Types.Mixed },
      estimationFlags: {
        energy: { type: Boolean, default: false },
        transport: { type: Boolean, default: false }
      }
    }
  },
  {
    timestamps: true,
  }
);

const SupplierFootprint = mongoose.model('SupplierFootprint', footprintSchema);
module.exports = SupplierFootprint;
