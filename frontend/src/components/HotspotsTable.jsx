import React, { useState } from 'react';

export default function HotspotsTable({ suppliers = [], onSyncHotspots, isSyncing }) {
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);

  const filteredSuppliers = suppliers.filter((s) => {
    if (filterSeverity === 'ALL') return true;
    return s.impact === filterSeverity;
  });

  return (
    <div className="card chart-card">
      <div className="chart-header flex-between">
        <div>
          <h3 className="chart-title">Hotspot Intelligence & Action Registry</h3>
          <p className="chart-subtitle">Rule-based explainability identifying carbon-dense entities requiring mitigation</p>
        </div>

        <div className="header-actions">
          {/* Severity Filter Tabs */}
          <div className="tab-pills">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
              <button
                key={lvl}
                className={`tab-pill-btn ${filterSeverity === lvl ? 'active' : ''}`}
                onClick={() => setFilterSeverity(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Sync Button */}
          {onSyncHotspots && (
            <button
              className="btn btn-secondary sync-btn"
              onClick={onSyncHotspots}
              disabled={isSyncing}
              title="Sync detected hotspots to persistent SQLite storage"
            >
              {isSyncing ? '⏳ Syncing...' : '💾 Sync to Database'}
            </button>
          )}
        </div>
      </div>

      <div className="hotspots-cards-list">
        {filteredSuppliers.length === 0 ? (
          <div className="empty-state">No hotspots matching the selected criteria.</div>
        ) : (
          filteredSuppliers.map((s) => {
            const isExpanded = expandedId === s.supplier_id;
            const isHigh = s.impact === 'HIGH';
            const isMed = s.impact === 'MEDIUM';

            return (
              <div
                key={s.supplier_id}
                className={`hotspot-row-card ${isHigh ? 'border-high' : isMed ? 'border-med' : ''}`}
              >
                <div className="hotspot-main-row">
                  <div className="hotspot-left-info">
                    <div className="hotspot-badge-stack">
                      <span className={`impact-badge badge-${(s.impact || 'low').toLowerCase()}`}>
                        {s.impact} IMPACT
                      </span>
                      <span className={`tier-badge-pill tier-${s.tier_level}`}>Tier {s.tier_level}</span>
                    </div>

                    <div className="hotspot-titles">
                      <h4 className="hotspot-entity-name">{s.supplier_name}</h4>
                      <p className="hotspot-meta-sub">
                        {s.supplier_code} • {s.industry_sector} • {s.country}
                      </p>
                    </div>
                  </div>

                  <div className="hotspot-metric-stack">
                    <div className="hotspot-tonnes-display">
                      <span className="val-bold">{Number(s.total_emissions_tonnes).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                      <span className="val-unit"> tCO₂e</span>
                    </div>
                    <div className="hotspot-share-display">
                      <strong>{s.contribution_pct}%</strong> of enterprise total
                    </div>
                  </div>

                  <div className="hotspot-actions">
                    <button
                      className="btn-toggle-explain"
                      onClick={() => setExpandedId(isExpanded ? null : s.supplier_id)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? 'Hide Audit Trail ▲' : 'View Audit Trail ▼'}
                    </button>
                  </div>
                </div>

                {/* Primary Driver Line */}
                <div className="hotspot-driver-bar">
                  <span className="driver-bullet">🎯</span>
                  <span className="driver-label">Primary Driver:</span>
                  <span className="driver-highlight">{s.main_source || 'Operational Activity'}</span>
                </div>

                {/* Collapsible Explainability Audit Trail */}
                {isExpanded && (
                  <div className="explainability-panel">
                    <div className="explain-header">
                      <span className="explain-title">Auditable Rationale & Underlying Activity Proof</span>
                      <span className="explain-tag">Deterministic Engine (Zero ML)</span>
                    </div>

                    <p className="explain-narrative">{s.explanation}</p>

                    <div className="explain-meta-grid">
                      <div className="explain-meta-item">
                        <span className="meta-k">Verified Calculations:</span>
                        <span className="meta-v">{s.calculations_count} calculation records</span>
                      </div>
                      <div className="explain-meta-item">
                        <span className="meta-k">Audit Status:</span>
                        <span className="meta-v">
                          {s.verification_summary?.VERIFIED || 0} Verified / {s.verification_summary?.UNVERIFIED || 0} Preliminary
                        </span>
                      </div>
                      <div className="explain-meta-item">
                        <span className="meta-k">Total Invoiced Volume:</span>
                        <span className="meta-v">{Number(s.total_emissions_kg).toLocaleString()} kg CO₂e</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
