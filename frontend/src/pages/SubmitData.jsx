import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import './SubmitData.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Form field configs ───────────────────────────────────────────────────────
const ENERGY_SOURCES = [
  'Grid Electricity', 'Natural Gas', 'Diesel', 'Petrol', 'Heavy Fuel Oil',
  'Coal', 'Biomass', 'Solar', 'Wind', 'Hydroelectric', 'LPG', 'Other',
];
const ENERGY_UNITS = ['kWh', 'MWh', 'GJ', 'MJ', 'litres', 'kg', 'tonnes', 'm3', 'MMBtu'];

const TRANSPORT_MODES = [
  'Road – HGV (Diesel)', 'Road – HGV (Electric)', 'Road – Van', 'Rail',
  'Sea – Container', 'Sea – Bulk Carrier', 'Air – Freight', 'Air – Passenger',
  'Pipeline', 'Inland Waterway', 'Other',
];
const DISTANCE_UNITS = ['km', 'miles', 'nautical miles'];
const WEIGHT_UNITS = ['kg', 'tonnes', 'metric tons', 'lbs'];

const MATERIAL_CATEGORIES = [
  'Metals & Alloys', 'Plastics & Polymers', 'Chemicals', 'Textiles & Fibres',
  'Electronics & Components', 'Agricultural & Bio-based', 'Packaging',
  'Construction Materials', 'Fuels', 'Other',
];
const MATERIAL_UNITS = ['kg', 'tonnes', 'metric tons', 'lbs', 'litres', 'm3', 'units', 'pallets'];

const TABS = [
  { id: 'energy', label: 'Energy Data', icon: '⚡' },
  { id: 'transport', label: 'Transport Data', icon: '🚛' },
  { id: 'material', label: 'Material Data', icon: '🏭' },
];

// ─── Initial form states ──────────────────────────────────────────────────────
const INITIAL_ENERGY = {
  source: '', consumption: '', unit: 'kWh', notes: '',
};
const INITIAL_TRANSPORT = {
  mode: '', distance: '', distanceUnit: 'km', weight: '', weightUnit: 'tonnes', notes: '',
};
const INITIAL_MATERIAL = {
  materialType: '', category: 'Other', quantity: '', unit: 'tonnes',
  recycledContent_pct: '', originCountry: '', notes: '',
};

// ─── SubmitData Page ──────────────────────────────────────────────────────────
export default function SubmitData() {
  const [activeTab, setActiveTab] = useState('energy');
  const [supplierId, setSupplierId] = useState('');
  const [reportingStart, setReportingStart] = useState('');
  const [reportingEnd, setReportingEnd] = useState('');
  const [energy, setEnergy] = useState(INITIAL_ENERGY);
  const [transport, setTransport] = useState(INITIAL_TRANSPORT);
  const [material, setMaterial] = useState(INITIAL_MATERIAL);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!supplierId.trim()) errs.supplierId = 'Supplier ID is required';
    if (!reportingStart) errs.reportingStart = 'Start date is required';
    if (!reportingEnd) errs.reportingEnd = 'End date is required';
    if (reportingStart && reportingEnd && reportingStart > reportingEnd) {
      errs.reportingEnd = 'End date must be after start date';
    }

    if (activeTab === 'energy') {
      if (!energy.source) errs.source = 'Energy source is required';
      if (!energy.consumption || isNaN(+energy.consumption) || +energy.consumption < 0)
        errs.consumption = 'Enter a valid positive number';
      if (!energy.unit) errs.unit = 'Unit is required';
    }
    if (activeTab === 'transport') {
      if (!transport.mode) errs.mode = 'Transport mode is required';
      if (!transport.distance || isNaN(+transport.distance) || +transport.distance < 0)
        errs.distance = 'Enter a valid positive number';
      if (!transport.distanceUnit) errs.distanceUnit = 'Distance unit is required';
    }
    if (activeTab === 'material') {
      if (!material.materialType.trim()) errs.materialType = 'Material type is required';
      if (!material.quantity || isNaN(+material.quantity) || +material.quantity < 0)
        errs.quantity = 'Enter a valid positive number';
      if (!material.unit) errs.unit = 'Unit is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors before submitting.');
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const token = localStorage.getItem('accessToken');
      let dataPayload = {};

      if (activeTab === 'energy') {
        dataPayload = {
          source: energy.source, consumption: parseFloat(energy.consumption),
          unit: energy.unit, notes: energy.notes,
        };
      } else if (activeTab === 'transport') {
        dataPayload = {
          mode: transport.mode, distance: parseFloat(transport.distance),
          distanceUnit: transport.distanceUnit,
          weight: transport.weight ? parseFloat(transport.weight) : null,
          weightUnit: transport.weightUnit, notes: transport.notes,
        };
      } else {
        dataPayload = {
          materialType: material.materialType, category: material.category,
          quantity: parseFloat(material.quantity), unit: material.unit,
          recycledContent_pct: material.recycledContent_pct ? parseFloat(material.recycledContent_pct) : 0,
          originCountry: material.originCountry || null,
          notes: material.notes,
        };
      }

      const body = {
        supplierId,
        reportingPeriod: { startDate: reportingStart, endDate: reportingEnd },
        ...dataPayload,
      };

      const res = await fetch(`${API}/submissions/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Submission failed');

      setResult(json);
      toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} data submitted!`);

      // Reset form
      if (activeTab === 'energy') setEnergy(INITIAL_ENERGY);
      if (activeTab === 'transport') setTransport(INITIAL_TRANSPORT);
      if (activeTab === 'material') setMaterial(INITIAL_MATERIAL);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const E = (field) => errors[field] && <span className="sd-field-error">{errors[field]}</span>;

  return (
    <div className="sd-page">
      {/* ── Header ── */}
      <div className="sd-header">
        <div>
          <h1 className="sd-title">Submit Activity Data</h1>
          <p className="sd-subtitle">Enter energy, transport or material data for emission calculation</p>
        </div>
        <a href="/submit/upload" className="sd-upload-link">
          📁 Upload CSV instead
        </a>
      </div>

      <div className="sd-layout">
        {/* ── Left: Form ── */}
        <form className="sd-form-card" onSubmit={handleSubmit} noValidate>

          {/* Supplier + Period */}
          <section className="sd-section">
            <h2 className="sd-section-title">Submission Details</h2>
            <div className="sd-grid-2">
              <div className="sd-field">
                <label className="sd-label">Supplier ID <span className="sd-required">*</span></label>
                <input
                  id="supplierId"
                  className={`sd-input ${errors.supplierId ? 'sd-input-error' : ''}`}
                  placeholder="e.g. SUP-1-AB3C4D or MongoDB ID"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                />
                {E('supplierId')}
              </div>
              <div className="sd-field" />
              <div className="sd-field">
                <label className="sd-label">Reporting Period Start <span className="sd-required">*</span></label>
                <input
                  id="reportingStart"
                  type="date" className={`sd-input ${errors.reportingStart ? 'sd-input-error' : ''}`}
                  value={reportingStart} onChange={(e) => setReportingStart(e.target.value)}
                />
                {E('reportingStart')}
              </div>
              <div className="sd-field">
                <label className="sd-label">Reporting Period End <span className="sd-required">*</span></label>
                <input
                  id="reportingEnd"
                  type="date" className={`sd-input ${errors.reportingEnd ? 'sd-input-error' : ''}`}
                  value={reportingEnd} onChange={(e) => setReportingEnd(e.target.value)}
                />
                {E('reportingEnd')}
              </div>
            </div>
          </section>

          {/* Data Type Tabs */}
          <div className="sd-tabs">
            {TABS.map((t) => (
              <button
                key={t.id} type="button"
                className={`sd-tab ${activeTab === t.id ? 'sd-tab-active' : ''}`}
                onClick={() => { setActiveTab(t.id); setResult(null); setErrors({}); }}
              >
                <span className="sd-tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Energy Fields ── */}
          {activeTab === 'energy' && (
            <section className="sd-section sd-animate-in">
              <h2 className="sd-section-title">⚡ Energy Consumption</h2>
              <div className="sd-grid-2">
                <div className="sd-field">
                  <label className="sd-label">Energy Source <span className="sd-required">*</span></label>
                  <select
                    id="energySource"
                    className={`sd-select ${errors.source ? 'sd-input-error' : ''}`}
                    value={energy.source} onChange={(e) => setEnergy({ ...energy, source: e.target.value })}
                  >
                    <option value="">Select source…</option>
                    {ENERGY_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {E('source')}
                </div>
                <div className="sd-field">
                  <label className="sd-label">Consumption <span className="sd-required">*</span></label>
                  <div className="sd-input-group">
                    <input
                      id="energyConsumption"
                      type="number" min="0" step="any"
                      className={`sd-input sd-input-num ${errors.consumption ? 'sd-input-error' : ''}`}
                      placeholder="0.00"
                      value={energy.consumption}
                      onChange={(e) => setEnergy({ ...energy, consumption: e.target.value })}
                    />
                    <select
                      id="energyUnit"
                      className="sd-select sd-unit-select"
                      value={energy.unit} onChange={(e) => setEnergy({ ...energy, unit: e.target.value })}
                    >
                      {ENERGY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {E('consumption')}
                </div>
              </div>
              <div className="sd-field">
                <label className="sd-label">Notes (optional)</label>
                <textarea
                  id="energyNotes"
                  className="sd-textarea" rows={2} placeholder="Additional context…"
                  value={energy.notes} onChange={(e) => setEnergy({ ...energy, notes: e.target.value })}
                />
              </div>
            </section>
          )}

          {/* ── Transport Fields ── */}
          {activeTab === 'transport' && (
            <section className="sd-section sd-animate-in">
              <h2 className="sd-section-title">🚛 Transport Information</h2>
              <div className="sd-field">
                <label className="sd-label">Transport Mode <span className="sd-required">*</span></label>
                <select
                  id="transportMode"
                  className={`sd-select ${errors.mode ? 'sd-input-error' : ''}`}
                  value={transport.mode} onChange={(e) => setTransport({ ...transport, mode: e.target.value })}
                >
                  <option value="">Select mode…</option>
                  {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {E('mode')}
              </div>
              <div className="sd-grid-2">
                <div className="sd-field">
                  <label className="sd-label">Distance <span className="sd-required">*</span></label>
                  <div className="sd-input-group">
                    <input
                      id="transportDistance"
                      type="number" min="0" step="any"
                      className={`sd-input sd-input-num ${errors.distance ? 'sd-input-error' : ''}`}
                      placeholder="0"
                      value={transport.distance}
                      onChange={(e) => setTransport({ ...transport, distance: e.target.value })}
                    />
                    <select
                      id="distanceUnit"
                      className="sd-select sd-unit-select"
                      value={transport.distanceUnit}
                      onChange={(e) => setTransport({ ...transport, distanceUnit: e.target.value })}
                    >
                      {DISTANCE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {E('distance')}
                </div>
                <div className="sd-field">
                  <label className="sd-label">Weight / Cargo</label>
                  <div className="sd-input-group">
                    <input
                      id="transportWeight"
                      type="number" min="0" step="any"
                      className="sd-input sd-input-num"
                      placeholder="Optional"
                      value={transport.weight}
                      onChange={(e) => setTransport({ ...transport, weight: e.target.value })}
                    />
                    <select
                      id="weightUnit"
                      className="sd-select sd-unit-select"
                      value={transport.weightUnit}
                      onChange={(e) => setTransport({ ...transport, weightUnit: e.target.value })}
                    >
                      {WEIGHT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="sd-field">
                <label className="sd-label">Notes (optional)</label>
                <textarea
                  id="transportNotes"
                  className="sd-textarea" rows={2}
                  value={transport.notes} onChange={(e) => setTransport({ ...transport, notes: e.target.value })}
                />
              </div>
            </section>
          )}

          {/* ── Material Fields ── */}
          {activeTab === 'material' && (
            <section className="sd-section sd-animate-in">
              <h2 className="sd-section-title">🏭 Material Data</h2>
              <div className="sd-grid-2">
                <div className="sd-field">
                  <label className="sd-label">Material Type <span className="sd-required">*</span></label>
                  <input
                    id="materialType"
                    className={`sd-input ${errors.materialType ? 'sd-input-error' : ''}`}
                    placeholder="e.g. Steel Coil, PET Pellets…"
                    value={material.materialType}
                    onChange={(e) => setMaterial({ ...material, materialType: e.target.value })}
                  />
                  {E('materialType')}
                </div>
                <div className="sd-field">
                  <label className="sd-label">Material Category</label>
                  <select
                    id="materialCategory"
                    className="sd-select"
                    value={material.category}
                    onChange={(e) => setMaterial({ ...material, category: e.target.value })}
                  >
                    {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="sd-field">
                  <label className="sd-label">Quantity <span className="sd-required">*</span></label>
                  <div className="sd-input-group">
                    <input
                      id="materialQuantity"
                      type="number" min="0" step="any"
                      className={`sd-input sd-input-num ${errors.quantity ? 'sd-input-error' : ''}`}
                      placeholder="0.00"
                      value={material.quantity}
                      onChange={(e) => setMaterial({ ...material, quantity: e.target.value })}
                    />
                    <select
                      id="materialUnit"
                      className="sd-select sd-unit-select"
                      value={material.unit}
                      onChange={(e) => setMaterial({ ...material, unit: e.target.value })}
                    >
                      {MATERIAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {E('quantity')}
                </div>
                <div className="sd-field">
                  <label className="sd-label">Recycled Content (%)</label>
                  <input
                    id="recycledContent"
                    type="number" min="0" max="100" step="0.1"
                    className="sd-input" placeholder="0"
                    value={material.recycledContent_pct}
                    onChange={(e) => setMaterial({ ...material, recycledContent_pct: e.target.value })}
                  />
                </div>
                <div className="sd-field">
                  <label className="sd-label">Origin Country</label>
                  <input
                    id="originCountry"
                    className="sd-input" placeholder="e.g. India"
                    value={material.originCountry}
                    onChange={(e) => setMaterial({ ...material, originCountry: e.target.value })}
                  />
                </div>
              </div>
              <div className="sd-field">
                <label className="sd-label">Notes (optional)</label>
                <textarea
                  id="materialNotes"
                  className="sd-textarea" rows={2}
                  value={material.notes} onChange={(e) => setMaterial({ ...material, notes: e.target.value })}
                />
              </div>
            </section>
          )}

          {/* ── Submit Button ── */}
          <div className="sd-footer">
            <button type="submit" id="submitDataBtn" className="sd-submit-btn" disabled={submitting}>
              {submitting ? (
                <><span className="sd-spinner" /> Submitting…</>
              ) : (
                <><span>✓</span> Submit {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Data</>
              )}
            </button>
          </div>
        </form>

        {/* ── Right: Result Panel ── */}
        <div className="sd-result-panel">
          {!result ? (
            <div className="sd-result-empty">
              <div className="sd-result-icon">📊</div>
              <p>Submission results will appear here</p>
              <p className="sd-result-hint">Fill in the form and submit to see emission calculation</p>
            </div>
          ) : (
            <div className="sd-result-card sd-animate-in">
              <div className="sd-result-header">
                <span className="sd-result-badge sd-badge-success">✓ Submitted</span>
                <h3>Submission Result</h3>
              </div>
              {result.emission && (
                <div className="sd-emission-box">
                  <div className="sd-emission-label">Calculated Emission</div>
                  <div className="sd-emission-value">
                    {result.emission.emissionValue?.toFixed(4) ?? '—'}
                    <span className="sd-emission-unit"> tCO₂e</span>
                  </div>
                  {result.emission.emissionFactor && (
                    <div className="sd-emission-factor">
                      Factor: {result.emission.emissionFactor} · Source: {result.emission.methodology || 'DEFRA'}
                    </div>
                  )}
                </div>
              )}
              {!result.emissionCalculated && (
                <div className="sd-warn-box">
                  ⚠ Emission calculation unavailable (Carbon Service offline). Data stored for later processing.
                </div>
              )}
              <div className="sd-result-meta">
                <div className="sd-meta-row"><span>Type</span><span>{result.data?.dataType}</span></div>
                <div className="sd-meta-row"><span>Status</span><span className="sd-badge-pill">{result.data?.status}</span></div>
                <div className="sd-meta-row"><span>Record ID</span><code>{result.data?._id?.slice(-8)}</code></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
