import React, { useState, useEffect, useCallback } from 'react';
import { carbonApi } from '../services/api';

export default function SupplierDashboard({ user, period, onOpenGuide, activeSubTab = 'dashboard', onNavigateTab }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState(period === 'All Periods' ? '' : period);

  // Form state for new activity submission
  const [formData, setFormData] = useState({
    activity_type: 'Energy', // 'Energy' | 'Transportation' | 'Material'
    reporting_period: '2024-Q1',
    // Energy fields
    electricity_kwh: '',
    fuel_type: 'Diesel',
    fuel_liters: '',
    // Transport fields
    transport_mode: 'ROAD_TRUCK',
    distance_km: '',
    shipment_weight_tons: '',
    // Material fields
    material_type: 'Battery Cells (Lithium-NMC)',
    material_quantity_kg: '',
    // Common
    source_description: 'Utility bill telemetry & automated ERP export',
  });

  // Load activities for this supplier
  const loadSupplierData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await carbonApi.getActivityData({
        reporting_period: filterPeriod || undefined,
      });
      setActivities(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error('[SUPPLIER DATA LOAD ERROR]', err);
      setError(err.message || 'Unable to fetch supplier activity records');
    } finally {
      setLoading(false);
    }
  }, [filterPeriod]);

  useEffect(() => {
    loadSupplierData();
  }, [loadSupplierData]);

  // Handle Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitSuccess(null);
    setError(null);

    try {
      let payload = {
        supplier: user?.supplier || 15,
        reporting_period: formData.reporting_period,
        source: formData.source_description || 'Direct Supplier Portal Entry',
        verification_status: 'UNDER_REVIEW',
      };

      if (formData.activity_type === 'Energy') {
        const kwh = parseFloat(formData.electricity_kwh) || 0;
        const liters = parseFloat(formData.fuel_liters) || 0;
        if (kwh <= 0 && liters <= 0) {
          throw new Error('Please enter electricity consumption or fuel volume.');
        }
        payload.activity_type = 'Energy / Electricity';
        payload.activity_amount = (kwh + liters * 10).toString(); // baseline quantity
        payload.unit = 'kWh';
        payload.fuel_type = liters > 0 ? formData.fuel_type : '';
      } else if (formData.activity_type === 'Transportation') {
        const dist = parseFloat(formData.distance_km) || 0;
        const weight = parseFloat(formData.shipment_weight_tons) || 0;
        if (dist <= 0) {
          throw new Error('Please enter transport distance in kilometers.');
        }
        payload.activity_type = 'Freight Logistics';
        payload.transport_mode = formData.transport_mode;
        payload.distance_km = dist.toString();
        payload.activity_amount = (dist * (weight || 1)).toString();
        payload.unit = 'tonne-km';
      } else if (formData.activity_type === 'Material') {
        const qty = parseFloat(formData.material_quantity_kg) || 0;
        if (qty <= 0) {
          throw new Error('Please enter material quantity in kg.');
        }
        payload.activity_type = 'Raw Material Acquisition';
        payload.material_type = formData.material_type;
        payload.activity_amount = qty.toString();
        payload.unit = 'kg';
      }

      await carbonApi.submitActivityData(payload);
      setSubmitSuccess('✅ Activity data successfully submitted! Sent for automated calculation & audit review.');
      
      // Reset form fields
      setFormData({
        ...formData,
        electricity_kwh: '',
        fuel_liters: '',
        distance_km: '',
        shipment_weight_tons: '',
        material_quantity_kg: '',
      });

      // Reload list
      loadSupplierData();
    } catch (err) {
      setError(err.message || 'Submission failed. Please check form values.');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics calculation
  const totalSubmissions = activities.length;
  const verifiedCount = activities.filter(a => a.verification_status === 'VERIFIED').length;
  const pendingCount = activities.filter(a => a.verification_status === 'UNDER_REVIEW' || a.verification_status === 'DRAFT' || a.verification_status === 'PENDING').length;
  const flaggedCount = activities.filter(a => a.verification_status === 'FLAGGED' || a.verification_status === 'REJECTED').length;

  const supplierName = user?.supplier_name || 'Apex Battery Systems GmbH';
  const supplierTier = 'Tier 1';
  const supplierIndustry = 'Automotive Battery & Storage Cells';
  const supplierLocation = 'Stuttgart, Germany';
  const parentCustomer = 'Apex Motors Corporation';

  return (
    <div className="supplier-portal-view" style={{ padding: '0', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '28px 32px',
        border: '1px solid #E2E8F0',
        marginBottom: '28px',
        boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#065F46',
              fontWeight: 700,
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '20px',
              letterSpacing: '0.04em'
            }}>
              SUPPLIER PORTAL
            </span>
            <span style={{ color: '#64748B', fontSize: '13px' }}>ID: SUP-DEMO-T1-01</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Supplier Sustainability Portal
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: '6px 0 0 0' }}>
            Submit and monitor your environmental activity data for auditable Scope 3 reporting.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => onOpenGuide && onOpenGuide('scope3')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>📖</span> ESG Guidelines
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (onNavigateTab) onNavigateTab('submit-data');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#065F46' }}
          >
            <span>➕</span> Submit Activity Data
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '28px'
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '20px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            My Supply Chain Tier
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#065F46' }}>{supplierTier}</div>
          <div style={{ fontSize: '12px', color: '#10B981', marginTop: '6px', fontWeight: 500 }}>
            Direct OEM Partner
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '20px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Reporting Status
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
            Active
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
            Period: {period || '2024-Q1'}
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '20px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Submitted Records
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A' }}>{totalSubmissions}</div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
            Total Activity Streams
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '20px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Pending Verification
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: pendingCount > 0 ? '#F59E0B' : '#64748B' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
            Awaiting Auditor Review
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          padding: '20px 24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Verified Records
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#10B981' }}>{verifiedCount}</div>
          <div style={{ fontSize: '12px', color: '#065F46', marginTop: '6px', fontWeight: 500 }}>
            Assurance-Ready
          </div>
        </div>
      </div>

      {/* Main Content Areas based on active subtab */}
      {/* 1. PROFILE SECTION */}
      {(activeSubTab === 'profile' || activeSubTab === 'dashboard') && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '28px 32px',
          border: '1px solid #E2E8F0',
          marginBottom: '28px',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                🏢 My Supplier Profile
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
                Your enterprise profile verified in the corporate Scope 3 supply chain network.
              </p>
            </div>
            <span style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#065F46',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600
            }}>
              Verified Partner
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            background: '#F8FAFC',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Supplier Name</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>{supplierName}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Tier Level</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#065F46', marginTop: '4px' }}>{supplierTier} (Direct Supplier)</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Industry Sector</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginTop: '4px' }}>{supplierIndustry}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Facility Location</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginTop: '4px' }}>{supplierLocation}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Parent Customer</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginTop: '4px' }}>{parentCustomer}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Contact Email</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginTop: '4px' }}>esg-compliance@apexbattery.de</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. SUBMIT DATA SECTION */}
      {(activeSubTab === 'submit-data' || activeSubTab === 'dashboard') && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '28px 32px',
          border: '1px solid #E2E8F0',
          marginBottom: '28px',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              📤 Submit Activity Data
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
              Report operational energy consumption, logistics freight, or material delivery telemetry.
            </p>
          </div>

          {submitSuccess && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10B981',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#065F46',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '20px'
            }}>
              {submitSuccess}
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #EF4444',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#DC2626',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleFormSubmit}>
            {/* Activity Category Selector */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              {['Energy', 'Transportation', 'Material'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormData({ ...formData, activity_type: cat })}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: formData.activity_type === cat ? '2px solid #065F46' : '1px solid #E2E8F0',
                    background: formData.activity_type === cat ? 'rgba(6, 95, 70, 0.05)' : '#FFFFFF',
                    color: formData.activity_type === cat ? '#065F46' : '#64748B',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{cat === 'Energy' ? '⚡' : cat === 'Transportation' ? '🚚' : '📦'}</span>
                  <span>{cat} Activity</span>
                </button>
              ))}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {/* Common Reporting Period */}
              <div>
                <label className="form-label">Reporting Period</label>
                <select
                  className="form-input"
                  value={formData.reporting_period}
                  onChange={(e) => setFormData({ ...formData, reporting_period: e.target.value })}
                >
                  <option value="2024-Q1">2024-Q1</option>
                  <option value="2024-Q2">2024-Q2</option>
                  <option value="2024-Q3">2024-Q3</option>
                  <option value="2024-Q4">2024-Q4</option>
                </select>
              </div>

              {/* Dynamic Category Specific Inputs */}
              {formData.activity_type === 'Energy' && (
                <>
                  <div>
                    <label className="form-label">Electricity Consumption (kWh)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="e.g. 45000"
                      value={formData.electricity_kwh}
                      onChange={(e) => setFormData({ ...formData, electricity_kwh: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Stationary Fuel Type</label>
                    <select
                      className="form-input"
                      value={formData.fuel_type}
                      onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                    >
                      <option value="Diesel">Diesel</option>
                      <option value="Natural Gas">Natural Gas</option>
                      <option value="Heavy Fuel Oil">Heavy Fuel Oil</option>
                      <option value="Propane">Propane</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Fuel Volume / Quantity (Liters / m³)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="e.g. 1200"
                      value={formData.fuel_liters}
                      onChange={(e) => setFormData({ ...formData, fuel_liters: e.target.value })}
                    />
                  </div>
                </>
              )}

              {formData.activity_type === 'Transportation' && (
                <>
                  <div>
                    <label className="form-label">Transport Mode</label>
                    <select
                      className="form-input"
                      value={formData.transport_mode}
                      onChange={(e) => setFormData({ ...formData, transport_mode: e.target.value })}
                    >
                      <option value="ROAD_TRUCK">Heavy Duty Truck (Road)</option>
                      <option value="RAIL_FREIGHT">Freight Train (Rail)</option>
                      <option value="AIR_FREIGHT">Cargo Aircraft (Air)</option>
                      <option value="OCEAN_CONTAINER">Container Ship (Ocean)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Transport Distance (km)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="e.g. 620"
                      value={formData.distance_km}
                      onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Shipment Cargo Weight (Metric Tons)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="e.g. 18.5"
                      value={formData.shipment_weight_tons}
                      onChange={(e) => setFormData({ ...formData, shipment_weight_tons: e.target.value })}
                    />
                  </div>
                </>
              )}

              {formData.activity_type === 'Material' && (
                <>
                  <div>
                    <label className="form-label">Material Component Type</label>
                    <select
                      className="form-input"
                      value={formData.material_type}
                      onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                    >
                      <option value="Battery Cells (Lithium-NMC)">Battery Cells (Lithium-NMC)</option>
                      <option value="Aluminum Casing">Aluminum Casing</option>
                      <option value="Copper Busbars">Copper Busbars</option>
                      <option value="Thermal Paste & Coolant">Thermal Paste & Coolant</option>
                      <option value="Structural Steel Bracket">Structural Steel Bracket</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Material Quantity (kg)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="e.g. 8500"
                      value={formData.material_quantity_kg}
                      onChange={(e) => setFormData({ ...formData, material_quantity_kg: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="form-label">Verification Source / Evidence</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Invoice #99482 / Smart Meter Telemetry"
                  value={formData.source_description}
                  onChange={(e) => setFormData({ ...formData, source_description: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submitting}
                style={{ background: '#065F46', padding: '12px 32px' }}
              >
                {submitting ? 'Submitting to SQLite Ledger...' : 'Submit Activity Data'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. SUBMISSION HISTORY SECTION */}
      {(activeSubTab === 'history' || activeSubTab === 'activity-data' || activeSubTab === 'dashboard') && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '28px 32px',
          border: '1px solid #E2E8F0',
          marginBottom: '28px',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                📜 Activity Submission History
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
                Audited operational records and independent verification lifecycle status.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                className="form-input"
                style={{ padding: '6px 12px', fontSize: '13px', width: 'auto' }}
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
              >
                <option value="">All Periods</option>
                <option value="2024-Q1">2024-Q1</option>
                <option value="2024-Q2">2024-Q2</option>
              </select>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
                onClick={loadSupplierData}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
              Loading supplier activity records...
            </div>
          ) : activities.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📂</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', margin: 0 }}>No Activity Submissions Found</h3>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', maxWidth: '400px', margin: '6px auto 16px auto' }}>
                You have not submitted activity records for this period yet. Use the form above to submit your operational data.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (onNavigateTab) onNavigateTab('submit-data');
                }}
              >
                Submit First Record
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC', color: '#475569', fontWeight: 600 }}>
                    <th style={{ padding: '12px 16px' }}>Reporting Period</th>
                    <th style={{ padding: '12px 16px' }}>Activity Type / Stream</th>
                    <th style={{ padding: '12px 16px' }}>Reported Amount</th>
                    <th style={{ padding: '12px 16px' }}>Unit</th>
                    <th style={{ padding: '12px 16px' }}>Source / Evidence</th>
                    <th style={{ padding: '12px 16px' }}>Submitted Date</th>
                    <th style={{ padding: '12px 16px' }}>Verification Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((item, idx) => {
                    const statusColor = 
                      item.verification_status === 'VERIFIED' ? '#059669' :
                      item.verification_status === 'UNDER_REVIEW' ? '#D97706' :
                      item.verification_status === 'FLAGGED' ? '#DC2626' :
                      item.verification_status === 'REJECTED' ? '#B91C1C' : '#475569';
                    
                    const statusBg = 
                      item.verification_status === 'VERIFIED' ? 'rgba(5, 150, 105, 0.1)' :
                      item.verification_status === 'UNDER_REVIEW' ? 'rgba(217, 119, 6, 0.1)' :
                      item.verification_status === 'FLAGGED' ? 'rgba(220, 38, 38, 0.1)' :
                      item.verification_status === 'REJECTED' ? 'rgba(185, 28, 28, 0.1)' : 'rgba(100, 116, 139, 0.1)';

                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A' }}>
                          {item.reporting_period || '2024-Q1'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#1E293B' }}>
                          <span style={{ fontWeight: 600 }}>{item.activity_type}</span>
                          {item.material_type && <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>Mat: {item.material_type}</span>}
                          {item.transport_mode && <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>Mode: {item.transport_mode}</span>}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0F172A' }}>
                          {item.activity_amount ? parseFloat(item.activity_amount).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748B' }}>
                          {item.unit || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.source || 'Direct Entry'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748B' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : '2024-03-15'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            background: statusBg,
                            color: statusColor,
                            display: 'inline-block'
                          }}>
                            {item.verification_status || 'UNDER_REVIEW'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. DATA QUALITY SECTION */}
      {(activeSubTab === 'quality' || activeSubTab === 'dashboard') && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '28px 32px',
          border: '1px solid #E2E8F0',
          marginBottom: '28px',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              📊 Data Quality & Completeness Diagnostics
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
              Readiness breakdown and actionable telemetry recommendations.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px'
          }}>
            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #E2E8F0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>✅</span>
                <span style={{ fontWeight: 700, color: '#065F46', fontSize: '14px' }}>Complete Data Streams</span>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Electricity utility bills and lithium cell production batches have been fully logged with source invoices attached.
              </p>
            </div>

            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #E2E8F0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <span style={{ fontWeight: 700, color: '#D97706', fontSize: '14px' }}>Missing Data Alert</span>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Upstream sub-tier road freight distance for Q1 batch #B42 is currently estimated by ML. Please submit actual GPS log or carrier invoice.
              </p>
            </div>

            <div style={{
              background: '#F8FAFC',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #E2E8F0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>🛡️</span>
                <span style={{ fontWeight: 700, color: '#0F766E', fontSize: '14px' }}>Auditor Verification Cycle</span>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: 0 }}>
                Auditors inspect activity data against GHG Protocol standards. Once verified, records become permanently immutable in the audit ledger.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
