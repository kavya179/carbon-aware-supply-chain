const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../src/models/User');
const Supplier = require('../src/models/Supplier');
const SupplierFootprint = require('../src/models/SupplierFootprint');
const Recommendation = require('../src/models/Recommendation');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/carbontrack';

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Supplier.deleteMany({});
    await SupplierFootprint.deleteMany({});
    await Recommendation.deleteMany({});

    // 1. Create Users
    console.log('Creating users...');
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('password123', salt);
    
    await User.create([
      { name: 'Admin (Manager)', email: 'admin@carbontrack.com', password, role: 'company_manager' },
      { name: 'Audit Team', email: 'auditor@carbontrack.com', password, role: 'auditor' }
    ]);

    // 2. Create Suppliers (Hierarchy: Tier 3 -> Tier 2 -> Tier 1)
    console.log('Creating suppliers...');
    
    // Tier 1
    const t1 = await Supplier.create({
      name: 'AutoCorp Assembly',
      supplierId: 'SUP-T1-001',
      tier: 1,
      location: 'Detroit, USA',
      materialSupplied: 'Final Vehicle Assembly',
      contactInfo: { email: 'contact@autocorp.com' },
      dataStatus: { hasSubmittedData: true }
    });

    // Tier 2
    const t2a = await Supplier.create({
      name: 'Delta Batteries',
      supplierId: 'SUP-T2-001',
      tier: 2,
      parentSupplier: t1._id,
      ancestorPath: [t1._id],
      location: 'Nevada, USA',
      materialSupplied: 'EV Battery Packs',
      dataStatus: { hasSubmittedData: true }
    });

    const t2b = await Supplier.create({
      name: 'Sigma Steel',
      supplierId: 'SUP-T2-002',
      tier: 2,
      parentSupplier: t1._id,
      ancestorPath: [t1._id],
      location: 'Pittsburgh, USA',
      materialSupplied: 'Steel Chassis',
      dataStatus: { hasSubmittedData: true }
    });

    // Tier 3
    const t3a = await Supplier.create({
      name: 'LithiCorp Mining',
      supplierId: 'SUP-T3-001',
      tier: 3,
      parentSupplier: t2a._id,
      ancestorPath: [t1._id, t2a._id],
      location: 'Salar de Atacama, Chile',
      materialSupplied: 'Raw Lithium',
      dataStatus: { hasSubmittedData: true }
    });

    const t3b = await Supplier.create({
      name: 'Global Iron Works',
      supplierId: 'SUP-T3-002',
      tier: 3,
      parentSupplier: t2b._id,
      ancestorPath: [t1._id, t2b._id],
      location: 'Minas Gerais, Brazil',
      materialSupplied: 'Iron Ore',
      dataStatus: { hasSubmittedData: true }
    });

    // Create Supplier Users
    await User.create([
      { name: 'Delta Batteries Rep', email: 'delta@supplier.com', password, role: 'supplier', linkedSupplierId: t2a._id },
      { name: 'LithiCorp Rep', email: 'lithicorp@supplier.com', password, role: 'supplier', linkedSupplierId: t3a._id }
    ]);

    // 3. Create Footprints
    console.log('Creating footprints...');
    
    // AutoCorp (Tier 1) - Low direct emissions, assembly only
    await SupplierFootprint.create({
      supplier: t1._id,
      inputs: {
        energy: { consumption: 50000, source: 'electricity_grid', unit: 'kWh' },
        transport: { distance: 100, mode: 'hgv_diesel', weight: 5000 },
        material: { quantity: 1000, type: 'steel_recycled', unit: 'kg' }
      },
      results: {
        energyEmissions: 15.0, transportEmissions: 0.5, materialEmissions: 1.0,
        totalEmissions_tCO2e: 16.5,
        estimationFlags: { energy: false, transport: false, material: false }
      }
    });

    // Delta Batteries (Tier 2) - Medium emissions
    await SupplierFootprint.create({
      supplier: t2a._id,
      inputs: {
        energy: { consumption: 250000, source: 'electricity_grid', unit: 'kWh' },
        transport: { distance: 2000, mode: 'rail_freight', weight: 15000 },
        material: { quantity: 5000, type: 'lithium', unit: 'kg' }
      },
      results: {
        energyEmissions: 75.0, transportEmissions: 2.5, materialEmissions: 25.0,
        totalEmissions_tCO2e: 102.5,
        estimationFlags: { energy: false, transport: true, material: false } // Simulated AI estimation for transport
      }
    });

    // Sigma Steel (Tier 2) - High emissions (The Hotspot)
    await SupplierFootprint.create({
      supplier: t2b._id,
      inputs: {
        energy: { consumption: 800000, source: 'coal_furnace', unit: 'kWh' },
        transport: { distance: 500, mode: 'hgv_diesel', weight: 50000 },
        material: { quantity: 20000, type: 'steel_virgin', unit: 'kg' }
      },
      results: {
        energyEmissions: 600.0, transportEmissions: 15.0, materialEmissions: 40.0,
        totalEmissions_tCO2e: 655.0,
        estimationFlags: { energy: false, transport: false, material: false }
      }
    });

    // LithiCorp (Tier 3)
    await SupplierFootprint.create({
      supplier: t3a._id,
      inputs: {
        energy: { consumption: 100000, source: 'diesel_generator', unit: 'kWh' },
        transport: { distance: 8000, mode: 'sea_freight', weight: 20000 },
        material: { quantity: 0, type: 'none', unit: 'kg' }
      },
      results: {
        energyEmissions: 60.0, transportEmissions: 8.0, materialEmissions: 0.0,
        totalEmissions_tCO2e: 68.0,
        estimationFlags: { energy: false, transport: false, material: false }
      }
    });

    // Global Iron (Tier 3)
    await SupplierFootprint.create({
      supplier: t3b._id,
      inputs: {
        energy: { consumption: 150000, source: 'diesel_generator', unit: 'kWh' },
        transport: { distance: 6000, mode: 'sea_freight', weight: 100000 },
        material: { quantity: 0, type: 'none', unit: 'kg' }
      },
      results: {
        energyEmissions: 90.0, transportEmissions: 30.0, materialEmissions: 0.0,
        totalEmissions_tCO2e: 120.0,
        estimationFlags: { energy: true, transport: false, material: false } // Simulated AI estimation for energy
      }
    });

    // 4. Create Recommendations for Sigma Steel (The Hotspot)
    console.log('Creating recommendations...');
    await Recommendation.create([
      {
        supplier: t2b._id,
        type: 'Energy',
        currentSituation: 'High consumption of coal-based energy for steel forging.',
        recommendedAlternative: 'Transition 40% of operations to Renewable Grid Electricity.',
        currentCO2e: 600000,
        alternativeCO2e: 360000,
        co2Savings: 240000,
        percentageReduction: 40
      },
      {
        supplier: t2b._id,
        type: 'Material',
        currentSituation: 'Using 100% Virgin Steel.',
        recommendedAlternative: 'Incorporate 30% recycled scrap steel into the melting process.',
        currentCO2e: 40000,
        alternativeCO2e: 28000,
        co2Savings: 12000,
        percentageReduction: 30
      }
    ]);

    console.log('\n✅ Database Seeded Successfully!');
    console.log('Demo Accounts:');
    console.log('- Manager: admin@carbontrack.com / password123');
    console.log('- Auditor: auditor@carbontrack.com / password123');
    console.log('- Supplier (Tier 2): delta@supplier.com / password123');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seedDatabase();
