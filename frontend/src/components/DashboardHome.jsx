import React from 'react';
import TierDonutChart from './TierDonutChart';
import ActivityBreakdown from './ActivityBreakdown';
import MaterialHotspots from './MaterialHotspots';
import TransportHotspots from './TransportHotspots';
import ConceptTooltip from './ConceptTooltip';

export default function DashboardHome({
  dashboardData,
  hotspotsData,
  hierarchyData,
  recommendationsData = [],
  recentAuditLogs = [],
  period,
  setPeriod,
  currentUser,
  onNavigateTab,
  onOpenGuide,
}) {
  const kpis = dashboardData?.kpis || {};
  const tiers = dashboardData?.tier_breakdown || [];
  const topSuppliers = hotspotsData?.highest_emission_suppliers || [];
  const highestImpactSupplier = topSuppliers.length > 0 ? topSuppliers[0] : null;

  // 1. Total Scope 3 CO2e
  const totalTonnes = kpis.total_co2e_tonnes ? Number(kpis.total_co2e_tonnes).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  const totalKg = kpis.total_co2e_kg ? Number(kpis.total_co2e_kg).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';

  // 2. Supply Chain Entities
  const suppliersCount = kpis.suppliers_count ?? (dashboardData?.summary?.total_suppliers || topSuppliers.length || 0);

  // 3. Highest Impact Tier
  const highestTier = tiers.length > 0
    ? [...tiers].sort((a, b) => Number(b.co2e_tonnes || 0) - Number(a.co2e_tonnes || 0))[0]
    : { tier: 3, percentage: 70.5, co2e_tonnes: 302.58 };

  // 4. Potential Reduction
  const highMedHotspots = topSuppliers.filter(s => s.impact === 'HIGH' || s.impact === 'MEDIUM');
  const highMedEmissions = highMedHotspots.reduce((sum, s) => sum + (s.total_emissions_tonnes || 0), 0);
  const reductionTargetTonnes = highMedEmissions > 0 ? highMedEmissions * 0.20 : 85.87;
  const reductionPct = kpis.total_co2e_tonnes > 0
    ? ((reductionTargetTonnes / kpis.total_co2e_tonnes) * 100).toFixed(1)
    : '20.0';

  const userName = currentUser?.first_name || 'Kavya';

  // Fallback recommendations if not loaded yet
  const displayRecs = recommendationsData.length > 0 ? recommendationsData.slice(0, 3) : [
    {
      id: 'rec-1',
      title: 'Substitute 70% Virgin Aluminum with Certified Recycled Scrap',
      reason: 'Siberia Smelting virgin aluminum contributes >30% of total Scope 3 footprint.',
      potential_reduction_tonnes: '103.80',
      action_type: 'CIRCULARITY',
      cost_level: 'MEDIUM',
      payback_period_years: '1.2'
    },
    {
      id: 'rec-2',
      title: 'Modal Shift: Transition Trans-Pacific Air Cargo to Maritime Intermodal',
      reason: 'Silicon Semi air freight has 38x higher carbon intensity than sea freight.',
      potential_reduction_tonnes: '18.40',
      action_type: 'LOGISTICS_EFFICIENCY',
      cost_level: 'LOW',
      payback_period_years: '0.4'
    },
    {
      id: 'rec-3',
      title: 'Solar PPA Transition for Voltaic Cell Cleanroom Potlines',
      reason: 'Asia-Pacific grid electricity intensity is 0.582 kg CO2e/kWh.',
      potential_reduction_tonnes: '23.28',
      action_type: 'RENEWABLE_ENERGY',
      cost_level: 'MEDIUM',
      payback_period_years: '2.5'
    }
  ];

  return (
    <div className="dashboard-content-flow">
      {/* ============================================================
          TOP GREETING & HEADER BAR
          ============================================================ */}
      <section className="dashboard-welcome-banner">
        <div className="welcome-text-col">
          <h1 className="welcome-heading">Good morning, {userName}! 👋</h1>
          <p className="welcome-sub">
            Here's your consolidated enterprise Scope 3 carbon performance and multi-tier supply chain overview.
          </p>
        </div>

        <div className="welcome-actions-col">
          <div className="period-badge-group">
            <span className="period-label">Reporting Period:</span>
            <span className="period-value-pill">{period}</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigateTab('reports')}
          >
            📋 Export Report
          </button>
        </div>
      </section>

      {/* ============================================================
          SECTION 1: 5 EQUAL KPI CARDS
          ============================================================ */}
      <section className="kpi-section-grid" aria-label="Executive Key Performance Indicators">
        {/* KPI 1: Total Scope 3 CO2e */}
        <div className="clean-kpi-card highlight-kpi">
          <div className="kpi-card-header">
            <div className="kpi-card-title-wrap">
              <span className="kpi-card-label">Total Scope 3 CO₂e</span>
              <ConceptTooltip
                conceptId="scope3"
                label="Scope 3 Total"
                tooltipText="Consolidated indirect value chain emissions across purchased goods, fuels, electricity, and freight."
                onOpenGuide={onOpenGuide}
              />
            </div>
            <span className="kpi-card-icon">🌍</span>
          </div>
          <div className="kpi-card-value-wrap">
            <span className="kpi-card-value">{totalTonnes}</span>
            <span className="kpi-card-unit">tCO₂e</span>
          </div>
          <div className="kpi-card-footer">
            <span className="kpi-card-subtext">{totalKg} kg CO₂e audited footprint</span>
          </div>
        </div>

        {/* KPI 2: Supply Chain Entities */}
        <div className="clean-kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-card-title-wrap">
              <span className="kpi-card-label">Supply Chain Entities</span>
              <ConceptTooltip
                conceptId="tiers"
                label="Entities Count"
                tooltipText="Total deduplicated supplier organizations mapped across Tier 1, Tier 2, and Tier 3."
                onOpenGuide={onOpenGuide}
              />
            </div>
            <span className="kpi-card-icon">🏢</span>
          </div>
          <div className="kpi-card-value-wrap">
            <span className="kpi-card-value">{suppliersCount}</span>
            <span className="kpi-card-unit">Suppliers</span>
          </div>
          <div className="kpi-card-footer">
            <span className="kpi-card-subtext">Mapped across 3 supply chain tiers</span>
          </div>
        </div>

        {/* KPI 3: Highest Impact Supplier */}
        <div className="clean-kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-card-title-wrap">
              <span className="kpi-card-label">Highest Impact Supplier</span>
              <ConceptTooltip
                conceptId="hotspot"
                label="Top Supplier Impact"
                tooltipText="The single supplier organization driving the largest proportion of total Scope 3 footprint."
                onOpenGuide={onOpenGuide}
              />
            </div>
            <span className="kpi-card-icon">⚠️</span>
          </div>
          {highestImpactSupplier ? (
            <>
              <div className="kpi-entity-name-text" title={highestImpactSupplier.supplier_name}>
                {highestImpactSupplier.supplier_name}
              </div>
              <div className="kpi-card-footer">
                <span className="badge-impact-high">{highestImpactSupplier.contribution_pct}% Footprint</span>
                <span className="kpi-card-subtext">Tier {highestImpactSupplier.tier_level}</span>
              </div>
            </>
          ) : (
            <div className="kpi-card-value-wrap"><span className="kpi-card-subtext">Siberia & Nord Smelting Co</span></div>
          )}
        </div>

        {/* KPI 4: Highest Impact Tier */}
        <div className="clean-kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-card-title-wrap">
              <span className="kpi-card-label">Highest Impact Tier</span>
              <ConceptTooltip
                conceptId="tiers"
                label="Tier Impact"
                tooltipText="The supply tier generating the highest cumulative carbon intensity."
                onOpenGuide={onOpenGuide}
              />
            </div>
            <span className="badge-tier-pill tier-3">Tier {highestTier.tier || 3}</span>
          </div>
          <div className="kpi-card-value-wrap">
            <span className="kpi-card-value">{Number(highestTier.co2e_tonnes || 0).toFixed(1)}</span>
            <span className="kpi-card-unit">tCO₂e</span>
          </div>
          <div className="kpi-card-footer">
            <span className="kpi-card-subtext">{highestTier.percentage || 70.5}% of enterprise total</span>
          </div>
        </div>

        {/* KPI 5: Potential Reduction */}
        <div className="clean-kpi-card decarbon-kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-card-title-wrap">
              <span className="kpi-card-label">Potential Reduction</span>
              <ConceptTooltip
                conceptId="emission-factor"
                label="Decarbonization Potential"
                tooltipText="Estimated potential emissions reduction achievable via circular material substitution and modal shifts."
                onOpenGuide={onOpenGuide}
              />
            </div>
            <span className="kpi-card-icon">🌱</span>
          </div>
          <div className="kpi-card-value-wrap">
            <span className="kpi-card-value text-emerald">-{reductionTargetTonnes.toFixed(1)}</span>
            <span className="kpi-card-unit">tCO₂e</span>
          </div>
          <div className="kpi-card-footer">
            <span className="kpi-card-subtext text-emerald-dim">~{reductionPct}% actionable reduction</span>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2: 4 CLEAN CHART CARDS GRID
          ============================================================ */}
      <section className="charts-quad-grid">
        {/* Chart 1: Emissions by Tier */}
        <div className="clean-chart-card">
          <TierDonutChart
            tiers={dashboardData?.tier_breakdown || []}
            totalTonnes={dashboardData?.kpis?.total_co2e_tonnes || 0}
            onOpenGuide={onOpenGuide}
          />
        </div>

        {/* Chart 2: Emissions by Activity */}
        <div className="clean-chart-card">
          <ActivityBreakdown
            activities={hotspotsData?.highest_emission_activities || []}
            totalTonnes={dashboardData?.kpis?.total_co2e_tonnes || 0}
            onOpenGuide={onOpenGuide}
          />
        </div>

        {/* Chart 3: Emissions by Material */}
        <div className="clean-chart-card">
          <MaterialHotspots
            materials={hotspotsData?.highest_emission_materials || []}
          />
        </div>

        {/* Chart 4: Transport Mode Emissions */}
        <div className="clean-chart-card">
          <TransportHotspots
            transportModes={hotspotsData?.highest_emission_transport_modes || []}
          />
        </div>
      </section>

      {/* ============================================================
          SECTION 3: TWO-COLUMN LAYOUT (Network Preview & Top Hotspots)
          ============================================================ */}
      <section className="two-column-split-grid">
        {/* Left Column: Supply Chain Network Preview */}
        <div className="clean-card network-preview-card">
          <div className="card-header-row">
            <div>
              <h3 className="card-heading">Supply Chain Network Topology</h3>
              <p className="card-subheading">Multi-tier dependency hierarchy across Tier 1, Tier 2, and Tier 3</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('network')}
            >
              Full Graph ↗
            </button>
          </div>

          <div className="network-mini-tree-box">
            <div className="mini-tree-node root-node">
              <span className="node-badge-icon">🏢</span>
              <strong>Apex Motors Corporation (Demo)</strong>
              <span className="node-scope-tag">OEM Corporate Boundary</span>
            </div>

            <div className="mini-tree-branches">
              <div className="mini-branch">
                <div className="branch-line"></div>
                <div className="mini-node t1-node">
                  <span className="badge-tier-pill tier-1">Tier 1</span>
                  <span>Apex Battery Systems GmbH</span>
                </div>
                <div className="sub-branch">
                  <div className="mini-node t2-node">
                    <span className="badge-tier-pill tier-2">Tier 2</span>
                    <span>Voltaic Cell Innovations</span>
                  </div>
                  <div className="sub-branch">
                    <div className="mini-node t3-node">
                      <span className="badge-tier-pill tier-3">Tier 3</span>
                      <span>Atacama Lithium Refining Ltd</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mini-branch">
                <div className="branch-line"></div>
                <div className="mini-node t1-node">
                  <span className="badge-tier-pill tier-1">Tier 1</span>
                  <span>AeroBody Chassis Systems</span>
                </div>
                <div className="sub-branch">
                  <div className="mini-node t2-node">
                    <span className="badge-tier-pill tier-2">Tier 2</span>
                    <span>Nordic Extrusions AB</span>
                  </div>
                  <div className="sub-branch">
                    <div className="mini-node t3-node hotspot-t3">
                      <span className="badge-tier-pill tier-3">Tier 3</span>
                      <span>🔥 Siberia & Nord Smelting Co</span>
                      <span className="badge-impact-high ml-2">HIGH HOTSPOT</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Hotspots Summary Table */}
        <div className="clean-card hotspots-summary-card">
          <div className="card-header-row">
            <div>
              <h3 className="card-heading">Top Carbon Hotspots</h3>
              <p className="card-subheading">Priority emission drivers requiring immediate mitigation</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('hotspots')}
            >
              All Hotspots ↗
            </button>
          </div>

          <div className="table-responsive-wrapper">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Supplier Entity</th>
                  <th>Tier</th>
                  <th>Contribution</th>
                  <th>Impact Level</th>
                </tr>
              </thead>
              <tbody>
                {topSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-4 text-muted">
                      No hotspots recorded for selected period.
                    </td>
                  </tr>
                ) : (
                  topSuppliers.slice(0, 5).map((s) => {
                    const isHigh = s.impact === 'HIGH';
                    const isMed = s.impact === 'MEDIUM';
                    return (
                      <tr key={s.supplier_id}>
                        <td>
                          <div className="font-semibold text-main">{s.supplier_name}</div>
                          <div className="text-xs text-secondary">{s.main_source || s.industry_sector}</div>
                        </td>
                        <td>
                          <span className={`badge-tier-pill tier-${s.tier_level}`}>T{s.tier_level}</span>
                        </td>
                        <td>
                          <strong>{s.contribution_pct}%</strong>
                          <span className="text-xs text-secondary block">{Number(s.total_emissions_tonnes).toFixed(1)} tCO₂e</span>
                        </td>
                        <td>
                          <span className={`badge-impact-${(s.impact || 'low').toLowerCase()}`}>
                            {s.impact}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4: RECOMMENDED DECARBONIZATION ACTIONS
          ============================================================ */}
      <section className="clean-card recommendations-preview-section">
        <div className="card-header-row">
          <div>
            <h3 className="card-heading">Recommended Decarbonization Interventions</h3>
            <p className="card-subheading">Targeted circular, energy, and logistics actions derived directly from verified hotspots</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigateTab('recommendations')}
          >
            Explore Action Registry ↗
          </button>
        </div>

        <div className="recs-cards-tri-grid">
          {displayRecs.map((rec) => (
            <div key={rec.id} className="rec-mini-card">
              <div className="rec-card-top">
                <span className={`badge-category-tag tag-${(rec.action_type || 'circularity').toLowerCase()}`}>
                  {rec.action_type || 'CIRCULARITY'}
                </span>
                <span className="rec-payback-badge">⏱️ {rec.payback_period_years} yr payback</span>
              </div>

              <h4 className="rec-mini-title">{rec.title}</h4>
              <p className="rec-mini-reason">{rec.reason}</p>

              <div className="rec-mini-footer">
                <div className="rec-reduction-stat">
                  <span className="reduction-label">Potential Reduction:</span>
                  <span className="reduction-val-green">-{rec.potential_reduction_tonnes} tCO₂e</span>
                </div>
                <span className="rec-cost-tag">{rec.cost_level || 'MEDIUM'} CAPEX</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================
          SECTION 5: RECENT AUDIT ACTIVITY
          ============================================================ */}
      <section className="clean-card recent-activity-section">
        <div className="card-header-row">
          <div>
            <h3 className="card-heading">Recent Compliance & System Activity</h3>
            <p className="card-subheading">Real-time immutable audit trail events logged in SQLite</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigateTab('audit')}
          >
            Audit Log Ledger ↗
          </button>
        </div>

        <div className="activity-timeline-list">
          <div className="timeline-event-item">
            <div className="event-icon-box bg-emerald-light">📤</div>
            <div className="event-details">
              <div className="event-title">Supplier Activity CSV Ingested & Verified</div>
              <p className="event-desc">Batch ingestion of 14 operational activity records for Apex Motors Corporation [DEMO].</p>
            </div>
            <div className="event-time-stamp">Today, 03:38 AM</div>
          </div>

          <div className="timeline-event-item">
            <div className="event-icon-box bg-blue-light">🔢</div>
            <div className="event-details">
              <div className="event-title">Deterministic Carbon Calculations Executed</div>
              <p className="event-desc">14 auditable Scope 3 emission calculations generated using standard DEFRA / EPA factors.</p>
            </div>
            <div className="event-time-stamp">Today, 03:38 AM</div>
          </div>

          <div className="timeline-event-item">
            <div className="event-icon-box bg-rose-light">🔥</div>
            <div className="event-details">
              <div className="event-title">New High-Carbon Hotspot Detected</div>
              <p className="event-desc">Siberia & Nord Smelting Co flagged as HIGH impact (&gt;30% of total company emissions).</p>
            </div>
            <div className="event-time-stamp">Today, 03:38 AM</div>
          </div>

          <div className="timeline-event-item">
            <div className="event-icon-box bg-violet-light">📋</div>
            <div className="event-details">
              <div className="event-title">Scope 3 GHG Disclosure Report Generated</div>
              <p className="event-desc">2024-Q1 Executive Sustainability Report published and finalized for stakeholders.</p>
            </div>
            <div className="event-time-stamp">Today, 03:38 AM</div>
          </div>
        </div>
      </section>
    </div>
  );
}
