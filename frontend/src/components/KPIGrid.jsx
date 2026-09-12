import React from 'react';

export default function KPIGrid({ dashboardData, hotspotsData }) {
  const kpis = dashboardData?.kpis || {};
  const tiers = dashboardData?.tier_breakdown || [];
  const hotspotsSummary = hotspotsData?.summary || {};
  const topSuppliers = hotspotsData?.highest_emission_suppliers || [];

  // 1. Total CO2e
  const totalTonnes = kpis.total_co2e_tonnes ? Number(kpis.total_co2e_tonnes).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  const totalKg = kpis.total_co2e_kg ? Number(kpis.total_co2e_kg).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';

  // 2. Suppliers Count
  const suppliersCount = kpis.suppliers_count ?? (dashboardData?.summary?.total_suppliers || 0);

  // 3, 4, 5. Tier Emissions
  const t1 = tiers.find(t => t.tier === 1) || { co2e_tonnes: 0, percentage: 0 };
  const t2 = tiers.find(t => t.tier === 2) || { co2e_tonnes: 0, percentage: 0 };
  const t3 = tiers.find(t => t.tier === 3) || { co2e_tonnes: 0, percentage: 0 };

  // 6. Highest Impact Supplier
  const highestImpactSupplier = topSuppliers.length > 0 ? topSuppliers[0] : null;

  // 7. Number of Hotspots
  const detectedHotspots = hotspotsSummary.hotspots_detected || { high_count: 0, medium_count: 0, low_count: 0 };
  const actionableCount = (detectedHotspots.high_count || 0) + (detectedHotspots.medium_count || 0);

  // 8. Potential Reduction
  // Modeled as a 20% decarbonization potential across identified HIGH and MEDIUM hotspots
  const highMediumEmissions = topSuppliers
    .filter(s => s.impact === 'HIGH' || s.impact === 'MEDIUM')
    .reduce((sum, s) => sum + (s.total_emissions_tonnes || 0), 0);
  const reductionTargetTonnes = highMediumEmissions * 0.20;
  const reductionPct = kpis.total_co2e_tonnes > 0
    ? ((reductionTargetTonnes / kpis.total_co2e_tonnes) * 100).toFixed(1)
    : '0.0';

  return (
    <section className="kpi-section" aria-label="Key Performance Indicators">
      <div className="section-header">
        <div>
          <h2 className="section-title">Executive Sustainability Metrics</h2>
          <p className="section-desc">Audited Scope 3 greenhouse gas performance across multi-tier supplier operations</p>
        </div>
        <div className="metric-pill">
          <span className="live-dot"></span> Live SQLite Verified Data
        </div>
      </div>

      <div className="kpi-grid">
        {/* KPI 1: Total CO2e */}
        <div className="kpi-card highlight-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Scope 3 CO₂e</span>
            <span className="kpi-icon">🌍</span>
          </div>
          <div className="kpi-value-wrap">
            <span className="kpi-value">{totalTonnes}</span>
            <span className="kpi-unit">tCO₂e</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">{totalKg} kg CO₂e total footprint</span>
          </div>
        </div>

        {/* KPI 2: Number of Suppliers */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Supply Chain Entities</span>
            <span className="kpi-icon">🏢</span>
          </div>
          <div className="kpi-value-wrap">
            <span className="kpi-value">{suppliersCount}</span>
            <span className="kpi-unit">Suppliers</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Mapped across Tier 1, Tier 2, Tier 3</span>
          </div>
        </div>

        {/* KPI 3: Tier 1 Emissions */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Tier 1 (Direct Suppliers)</span>
            <span className="kpi-tag tag-tier1">Tier 1</span>
          </div>
          <div className="kpi-value-wrap">
            <span className="kpi-value">{Number(t1.co2e_tonnes).toFixed(2)}</span>
            <span className="kpi-unit">tCO₂e</span>
          </div>
          <div className="kpi-footer">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill fill-tier1" style={{ width: `${Math.min(t1.percentage, 100)}%` }}></div>
            </div>
            <span className="kpi-subtext">{t1.percentage}% of enterprise emissions</span>
          </div>
        </div>

        {/* KPI 4: Tier 2 Emissions */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Tier 2 (Sub-Contractors)</span>
            <span className="kpi-tag tag-tier2">Tier 2</span>
          </div>
          <div className="kpi-value-wrap">
            <span className="kpi-value">{Number(t2.co2e_tonnes).toFixed(2)}</span>
            <span className="kpi-unit">tCO₂e</span>
          </div>
          <div className="kpi-footer">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill fill-tier2" style={{ width: `${Math.min(t2.percentage, 100)}%` }}></div>
            </div>
            <span className="kpi-subtext">{t2.percentage}% of enterprise emissions</span>
          </div>
        </div>

        {/* KPI 5: Tier 3 Emissions */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Tier 3 (Raw Materials / Mining)</span>
            <span className="kpi-tag tag-tier3">Tier 3</span>
          </div>
          <div className="kpi-value-wrap">
            <span className="kpi-value">{Number(t3.co2e_tonnes).toFixed(2)}</span>
            <span className="kpi-unit">tCO₂e</span>
          </div>
          <div className="kpi-footer">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill fill-tier3" style={{ width: `${Math.min(t3.percentage, 100)}%` }}></div>
            </div>
            <span className="kpi-subtext">{t3.percentage}% of enterprise emissions</span>
          </div>
        </div>

        {/* KPI 6: Highest-Impact Supplier */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Highest-Impact Supplier</span>
            <span className="kpi-icon">⚠️</span>
          </div>
          {highestImpactSupplier ? (
            <>
              <div className="kpi-entity-title" title={highestImpactSupplier.supplier_name}>
                {highestImpactSupplier.supplier_name}
              </div>
              <div className="kpi-footer">
                <span className="badge-critical">{highestImpactSupplier.contribution_pct}% Footprint</span>
                <span className="kpi-subtext">Tier {highestImpactSupplier.tier_level} • {highestImpactSupplier.main_activity || 'Material'}</span>
              </div>
            </>
          ) : (
            <div className="kpi-value-wrap"><span className="kpi-subtext">No suppliers recorded</span></div>
          )}
        </div>

        {/* KPI 7: Number of Hotspots */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Carbon Hotspots</span>
            <span className="kpi-icon">🔥</span>
          </div>
          <div className="kpi-value-wrap">
            <span className="kpi-value">{actionableCount}</span>
            <span className="kpi-unit">Actionable</span>
          </div>
          <div className="kpi-footer hotspot-badge-row">
            <span className="badge-high">{detectedHotspots.high_count || 0} High</span>
            <span className="badge-medium">{detectedHotspots.medium_count || 0} Medium</span>
            <span className="badge-low">{detectedHotspots.low_count || 0} Low</span>
          </div>
        </div>

        {/* KPI 8: Potential Reduction */}
        <div className="kpi-card decarbon-card">
          <div className="kpi-header">
            <span className="kpi-label">Decarbonization Potential</span>
            <span className="kpi-icon">🌱</span>
          </div>
          <div className="kpi-value-wrap">
            <span className="kpi-value text-emerald">-{reductionTargetTonnes.toFixed(2)}</span>
            <span className="kpi-unit">tCO₂e</span>
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext text-emerald-dim">
              ~{reductionPct}% reduction via hotspot interventions
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
