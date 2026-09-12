import React, { useState } from 'react';

export default function SettingsView({
  highThreshold,
  setHighThreshold,
  medThreshold,
  setMedThreshold,
  onOpenGuide,
  onSaveThresholds
}) {
  const [highVal, setHighVal] = useState(highThreshold || '20.0');
  const [medVal, setMedVal] = useState(medThreshold || '5.0');
  const [savedNotice, setSavedNotice] = useState(null);

  const handleSave = (e) => {
    e.preventDefault();
    setHighThreshold(highVal);
    setMedThreshold(medVal);
    if (onSaveThresholds) onSaveThresholds(highVal, medVal);
    setSavedNotice('✅ Threshold preferences saved and applied to active dashboard.');
    setTimeout(() => setSavedNotice(null), 4000);
  };

  return (
    <div className="clean-view-container">
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">Settings & Governance Configuration</h2>
          <p className="view-subtitle">Manage carbon hotspot thresholds, assurance parameters, and ESG reference standards</p>
        </div>
      </div>

      {savedNotice && (
        <div className="alert-banner alert-success mb-6">
          <span>{savedNotice}</span>
        </div>
      )}

      <div className="two-column-split-grid">
        {/* Left: Hotspot Thresholds Card */}
        <div className="clean-card settings-card">
          <h3 className="card-heading">Carbon Hotspot Impact Thresholds</h3>
          <p className="card-subheading">Configure percentage contribution limits for automated high & medium hotspot severity classification</p>

          <form onSubmit={handleSave} className="settings-form">
            <div className="form-group">
              <label className="form-label" htmlFor="high-thresh">HIGH Impact Threshold (% of total Scope 3)</label>
              <div className="input-with-unit">
                <input
                  id="high-thresh"
                  type="number"
                  step="0.5"
                  min="5"
                  max="100"
                  className="form-input"
                  value={highVal}
                  onChange={(e) => setHighVal(e.target.value)}
                />
                <span className="unit-suffix">%</span>
              </div>
              <span className="form-hint">Default is ≥ 20.0%. Identifies critical priority nodes requiring circular intervention.</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="med-thresh">MEDIUM Impact Threshold (% of total Scope 3)</label>
              <div className="input-with-unit">
                <input
                  id="med-thresh"
                  type="number"
                  step="0.5"
                  min="1"
                  max="50"
                  className="form-input"
                  value={medVal}
                  onChange={(e) => setMedVal(e.target.value)}
                />
                <span className="unit-suffix">%</span>
              </div>
              <span className="form-hint">Default is ≥ 5.0%. Identifies operational efficiency targets.</span>
            </div>

            <button type="submit" className="btn btn-primary">
              💾 Save & Apply Thresholds
            </button>
          </form>
        </div>

        {/* Right: ESG Knowledge Center & System Diagnostics Card */}
        <div className="clean-card settings-card">
          <h3 className="card-heading">ESG Knowledge Center & Standards</h3>
          <p className="card-subheading">Learn and reference standard accounting rules (GHG Protocol Scope 3, IPCC AR6, DEFRA)</p>

          <div className="guide-launch-box mb-6">
            <div className="guide-launch-info">
              <h4>📖 Scope 3 Knowledge Standards Guide</h4>
              <p>Explore full definitions and reporting frameworks for Scope 3, CO₂e, Tier 1/2/3, Emission Factors, Hotspots, and ML Estimates.</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => onOpenGuide && onOpenGuide('scope3')}
            >
              Open Interactive ESG Guide ↗
            </button>
          </div>

          <h3 className="card-heading mt-6">System & Database Architecture</h3>
          <div className="diagnostics-list">
            <div className="diag-item">
              <span className="diag-k">Primary Database:</span>
              <span className="diag-v font-mono text-emerald">SQLite (django_service/db.sqlite3)</span>
            </div>
            <div className="diag-item">
              <span className="diag-k">Application Gateway:</span>
              <span className="diag-v font-mono text-main">Node.js Express (Port 5000)</span>
            </div>
            <div className="diag-item">
              <span className="diag-k">Calculation Engine:</span>
              <span className="diag-v font-mono text-main">Django REST Framework (Port 8000)</span>
            </div>
            <div className="diag-item">
              <span className="diag-k">ML Gap-Filling Model:</span>
              <span className="diag-v font-mono text-violet">RandomForestRegressor (R² = 0.9906)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
