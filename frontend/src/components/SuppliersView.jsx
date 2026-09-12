import React, { useState } from 'react';

export default function SuppliersView({ hierarchyData, hotspotsData }) {
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Extract suppliers list from hierarchy or hotspots
  const suppliers = hotspotsData?.highest_emission_suppliers || [];

  const filtered = suppliers.filter(s => {
    const matchesTier = selectedTier === 'ALL' || String(s.tier_level) === String(selectedTier);
    const matchesSearch = !searchTerm || s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.industry_sector || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTier && matchesSearch;
  });

  return (
    <div className="clean-view-container">
      {/* Header */}
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">Suppliers Directory & Tier Registry</h2>
          <p className="view-subtitle">Manage and monitor deduplicated supply chain partners across Tier 1, Tier 2, and Tier 3</p>
        </div>

        <div className="view-header-controls">
          <div className="tab-pills">
            {['ALL', '1', '2', '3'].map(t => (
              <button
                key={t}
                className={`tab-pill-btn ${selectedTier === t ? 'active' : ''}`}
                onClick={() => setSelectedTier(t)}
              >
                {t === 'ALL' ? 'All Tiers' : `Tier ${t}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="clean-card search-filter-card mb-6">
        <div className="search-row flex-between">
          <div className="search-box-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="form-input search-input"
              placeholder="Filter by supplier name, industry, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-stats-text">
            Showing <strong>{filtered.length}</strong> of {suppliers.length} active suppliers
          </div>
        </div>
      </div>

      {/* Suppliers Grid / Cards */}
      <div className="suppliers-card-grid">
        {filtered.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-icon">🏢</div>
            <h4>No Suppliers Found</h4>
            <p>No supplier organizations match your search filters.</p>
          </div>
        ) : (
          filtered.map(s => {
            const isHigh = s.impact === 'HIGH';
            const isMed = s.impact === 'MEDIUM';

            return (
              <div key={s.supplier_id} className="clean-card supplier-entity-card">
                <div className="supplier-card-header">
                  <div>
                    <span className={`badge-tier-pill tier-${s.tier_level}`}>Tier {s.tier_level}</span>
                    <h3 className="supplier-name-heading">{s.supplier_name}</h3>
                    <p className="supplier-meta-text">{s.supplier_code} • {s.industry_sector || 'Automotive'} • {s.country || 'Global'}</p>
                  </div>
                  <span className={`badge-impact-${(s.impact || 'low').toLowerCase()}`}>
                    {s.impact} IMPACT
                  </span>
                </div>

                <div className="supplier-stats-row">
                  <div className="stat-pill">
                    <span className="stat-k">Footprint Share</span>
                    <span className="stat-v font-bold">{s.contribution_pct}%</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-k">Calculated CO₂e</span>
                    <span className="stat-v">{Number(s.total_emissions_tonnes).toFixed(1)} tCO₂e</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-k">Verified Entries</span>
                    <span className="stat-v">{s.calculations_count || 1} records</span>
                  </div>
                </div>

                <div className="supplier-card-footer">
                  <span className="driver-label">🎯 Primary Driver:</span>
                  <span className="driver-value">{s.main_source || 'Operational Activity'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
