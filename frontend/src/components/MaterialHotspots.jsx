import React from 'react';

export default function MaterialHotspots({ materials = [] }) {
  return (
    <div className="card chart-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Purchased Raw Material Hotspots</h3>
          <p className="chart-subtitle">Scope 3 Category 1 — Embedded carbon in raw materials</p>
        </div>
        <span className="unit-badge">Unit: tCO₂e / Volume</span>
      </div>

      {materials.length === 0 ? (
        <div className="empty-state">No material activity entries recorded for this reporting period.</div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Material Type</th>
                <th>Emissions</th>
                <th>% Company</th>
                <th>% Material</th>
                <th>Volume Consumed</th>
                <th>Supplying Partner</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m, index) => {
                const matName = m.material_name || m.material_type || 'Raw Material';
                const tonnes = Number(m.total_emissions_tonnes ?? m.co2e_tonnes ?? 0);
                const qty = Number(m.total_quantity_kg ?? m.total_quantity ?? 0);
                const contribPct = m.contribution_pct ?? m.share_pct ?? 0;
                const matSharePct = m.material_share_pct ?? m.share_pct ?? 0;
                const suppliersList = m.suppliers || m.supplier_names || [];
                const impact = m.impact || (contribPct >= 20 ? 'HIGH' : contribPct >= 5 ? 'MEDIUM' : 'LOW');
                const rank = m.rank || index + 1;

                const qtyDisplay = qty >= 1000
                  ? `${(qty / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} tonnes`
                  : `${qty.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;

                return (
                  <tr key={matName + index}>
                    <td>
                      <span className="rank-badge">#{rank}</span>
                    </td>
                    <td>
                      <div className="table-primary-text">{matName}</div>
                      {m.emission_factors && m.emission_factors.length > 0 && (
                        <div className="table-subtext">Factor: {m.emission_factors[0]}</div>
                      )}
                    </td>
                    <td>
                      <span className="table-highlight-val">
                        {tonnes.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </span>
                      <span className="table-sub-unit"> tCO₂e</span>
                    </td>
                    <td>
                      <span className="pct-text">{contribPct}%</span>
                    </td>
                    <td>
                      <div className="share-bar-cell">
                        <span>{matSharePct}%</span>
                        <div className="mini-bar-bg">
                          <div className="mini-bar-fill" style={{ width: `${Math.min(matSharePct, 100)}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="volume-text">{qtyDisplay}</span>
                    </td>
                    <td>
                      <div className="supplier-tag-list">
                        {suppliersList.map((s, i) => (
                          <span key={i} className="mini-supplier-pill">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`impact-badge badge-${impact.toLowerCase()}`}>
                        {impact}
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
  );
}
