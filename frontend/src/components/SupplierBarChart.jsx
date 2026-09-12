import React from 'react';
import ConceptTooltip from './ConceptTooltip';

export default function SupplierBarChart({ suppliers = [], totalCompanyTonnes = 0, onOpenGuide }) {
  const topList = suppliers.slice(0, 6);
  const maxTonnes = topList.length > 0 ? Math.max(...topList.map(s => s.total_emissions_tonnes || 0)) : 1;

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <div>
          <div className="title-with-tooltip">
            <h3 className="chart-title">Emissions by Key Supplier</h3>
            <ConceptTooltip
              conceptId="hotspot"
              label="Supplier Carbon Footprint"
              tooltipText="Ranked carbon contribution by supplier. High share suppliers represent primary decarbonization engagement opportunities."
              onOpenGuide={onOpenGuide}
            />
          </div>
          <p className="chart-subtitle">Rank-ordered carbon contribution across supply chain partners</p>
        </div>
        <span className="unit-badge">Unit: tCO₂e / % Share</span>
      </div>

      <div className="supplier-bars-list">
        {topList.length === 0 ? (
          <div className="empty-state">No supplier emissions records available for selected period.</div>
        ) : (
          topList.map((s) => {
            const barWidth = maxTonnes > 0 ? (s.total_emissions_tonnes / maxTonnes) * 100 : 0;
            const isHigh = s.impact === 'HIGH';
            const isMedium = s.impact === 'MEDIUM';

            return (
              <div key={s.supplier_id} className="supplier-bar-row">
                <div className="supplier-bar-info">
                  <div className="supplier-name-col">
                    <span className="supplier-rank">#{s.rank}</span>
                    <span className="supplier-name" title={s.supplier_name}>{s.supplier_name}</span>
                    <span className={`tier-badge-pill tier-${s.tier_level}`}>T{s.tier_level}</span>
                    {s.country && <span className="country-tag">{s.country}</span>}
                  </div>
                  <div className="supplier-vals-col">
                    <span className="supplier-tonnes">{Number(s.total_emissions_tonnes).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} tCO₂e</span>
                    <span className={`impact-badge badge-${(s.impact || 'low').toLowerCase()}`}>
                      {s.contribution_pct}%
                    </span>
                  </div>
                </div>

                <div className="bar-track">
                  <div
                    className={`bar-fill ${isHigh ? 'fill-danger' : isMedium ? 'fill-warning' : 'fill-primary'}`}
                    style={{ width: `${Math.max(barWidth, 3)}%` }}
                  ></div>
                </div>

                <div className="supplier-bar-meta">
                  <span className="driver-text">
                    <strong className="driver-label">Primary Driver:</strong> {s.main_source || s.main_activity || 'Operations'}
                  </span>
                  <span className="calcs-count">{s.calculations_count} verified entries</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
