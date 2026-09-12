import React from 'react';

export default function TransportHotspots({ transportModes = [] }) {
  const modeIcons = {
    'Road': '🚛',
    'Rail': '🚆',
    'Sea': '🚢',
    'Air': '✈️'
  };

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Freight & Logistics Emissions</h3>
          <p className="chart-subtitle">Scope 3 Category 4 — Upstream transportation and distribution</p>
        </div>
        <span className="unit-badge">Unit: tCO₂e / Tonne-Km</span>
      </div>

      {transportModes.length === 0 ? (
        <div className="empty-state">No freight transport activity entries logged for this period.</div>
      ) : (
        <div className="transport-cards-grid">
          {transportModes.map((t, index) => {
            const mode = t.transport_mode || 'Freight';
            const icon = modeIcons[mode] || '🚚';
            const tonnes = Number(t.total_emissions_tonnes ?? t.co2e_tonnes ?? 0);
            const distance = Number(t.total_distance_km ?? t.total_distance ?? 0);
            const tonneKm = Number(t.total_tonne_km ?? (distance * (t.total_weight_tonnes || 1)) ?? 0);
            const contribPct = t.contribution_pct ?? t.share_pct ?? 0;
            const transSharePct = t.transport_share_pct ?? t.share_pct ?? 100;
            const impact = t.impact || (contribPct >= 20 ? 'HIGH' : contribPct >= 5 ? 'MEDIUM' : 'LOW');
            const explanation = t.explanation || `Transport mode '${mode}' generates ${tonnes.toFixed(2)} tCO2e across ${distance.toLocaleString()} km.`;

            return (
              <div key={mode + index} className="transport-mode-card">
                <div className="transport-mode-header">
                  <div className="transport-mode-badge">
                    <span className="transport-icon">{icon}</span>
                    <span className="transport-title">{mode} Transport</span>
                  </div>
                  <span className={`impact-badge badge-${impact.toLowerCase()}`}>
                    {impact}
                  </span>
                </div>

                <div className="transport-main-metric">
                  <span className="metric-big">{tonnes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                  <span className="metric-unit-tag">tCO₂e</span>
                </div>

                <div className="transport-share-row">
                  <span className="share-text">{contribPct}% of company footprint</span>
                  <span className="share-text-sub">{transSharePct}% of logistics</span>
                </div>

                <div className="transport-stats-grid">
                  <div className="transport-substat">
                    <span className="substat-label">Total Distance</span>
                    <span className="substat-val">{distance.toLocaleString(undefined, { maximumFractionDigits: 1 })} km</span>
                  </div>
                  <div className="transport-substat">
                    <span className="substat-label">Freight Payload</span>
                    <span className="substat-val">{Number(t.total_weight_tonnes || 0).toFixed(1)} tonnes</span>
                  </div>
                  <div className="transport-substat">
                    <span className="substat-label">Activity Volume</span>
                    <span className="substat-val">{tonneKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} t·km</span>
                  </div>
                  <div className="transport-substat">
                    <span className="substat-label">Shipments</span>
                    <span className="substat-val">{t.shipment_count || 1} trips</span>
                  </div>
                </div>

                <div className="transport-explanation-box">
                  <p className="explanation-text">{explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
