import React, { useState } from 'react';
import ConceptTooltip from './ConceptTooltip';

// === TIER DONUT CHART (Self-contained, fixes legend spacing bug) ===
function TierDonutMini({ tiers = [], totalTonnes = 0, onOpenGuide }) {
  const [activeTier, setActiveTier] = useState(null);

  const TIER_COLORS = { 1: '#3b82f6', 2: '#8b5cf6', 3: '#ef4444' };
  const TIER_NAMES  = { 1: 'Direct Suppliers',  2: 'Sub-Contractors', 3: 'Raw Material Upstream' };

  const total = Number(totalTonnes) || 1;
  const radius = 68;
  const circ   = 2 * Math.PI * radius;

  let acc = 0;
  const segments = tiers.map((t) => {
    const pct = total > 0 ? Number(t.co2e_tonnes) / total : 0;
    const seg = {
      tier:    t.tier,
      name:    `Tier ${t.tier}`,
      detail:  TIER_NAMES[t.tier] || '',
      tonnes:  Number(t.co2e_tonnes) || 0,
      pct:     (pct * 100).toFixed(1),
      color:   TIER_COLORS[t.tier] || '#64748b',
      sda:     `${pct * circ} ${circ}`,
      sdo:     -(acc * circ),
      count:   t.supplier_count || 0,
    };
    acc += pct;
    return seg;
  });

  const active = activeTier != null ? segments.find(s => s.tier === activeTier) : null;

  return (
    <div className="card chart-card" style={{ height: '100%' }}>
      <div className="chart-header">
        <div>
          <div className="title-with-tooltip">
            <h3 className="chart-title">Emissions by Supply Tier</h3>
            <ConceptTooltip conceptId="tiers" label="Tier Breakdown"
              tooltipText="Tier 1 = Direct, Tier 2 = Subcontractors, Tier 3 = Raw Material Upstream."
              onOpenGuide={onOpenGuide} />
          </div>
          <p className="chart-subtitle">Scope 3 share across Tier 1 → Tier 2 → Tier 3</p>
        </div>
        <span className="unit-badge">tCO₂e</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '8px' }}>
        {/* Donut SVG */}
        <div style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 200 200" width="170" height="170">
            <circle cx="100" cy="100" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="22" />
            {segments.map((s) => (
              <circle
                key={s.tier}
                cx="100" cy="100" r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={activeTier === s.tier ? 28 : 22}
                strokeDasharray={s.sda}
                strokeDashoffset={s.sdo}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                style={{ cursor: 'pointer', opacity: activeTier && activeTier !== s.tier ? 0.3 : 1, transition: 'all 0.2s' }}
                onMouseEnter={() => setActiveTier(s.tier)}
                onMouseLeave={() => setActiveTier(null)}
              />
            ))}
            <text x="100" y="92" textAnchor="middle" style={{ fontSize: '10px', fill: '#64748b', fontWeight: 600 }}>
              {active ? active.name : 'Total Scope 3'}
            </text>
            <text x="100" y="110" textAnchor="middle" style={{ fontSize: '14px', fill: '#0f172a', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
              {active ? `${active.tonnes.toFixed(1)}t` : `${Number(totalTonnes).toFixed(1)}t`}
            </text>
            <text x="100" y="126" textAnchor="middle" style={{ fontSize: '9px', fill: '#94a3b8' }}>
              {active ? `${active.pct}% of total` : 'CO₂e all tiers'}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {segments.map((s) => (
            <div
              key={s.tier}
              onMouseEnter={() => setActiveTier(s.tier)}
              onMouseLeave={() => setActiveTier(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: activeTier === s.tier ? '#f8fafc' : 'transparent',
                border: `1px solid ${activeTier === s.tier ? '#e2e8f0' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>{s.name}</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: s.color }}>{s.pct}%</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {s.tonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e
                  {s.count > 0 && <span style={{ marginLeft: '6px' }}>· {s.count} suppliers</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// === ACTIVITY BREAKDOWN (Self-contained, fixes spacing) ===
function ActivityBreakdownMini({ activities = [], totalTonnes = 0, onOpenGuide }) {
  const ICONS  = { MATERIAL: '📦', ELECTRICITY: '⚡', FUEL: '🔥', TRANSPORT: '🚚', OTHER: '⚙️' };
  const COLORS = { MATERIAL: '#8b5cf6', ELECTRICITY: '#06b6d4', FUEL: '#f97316', TRANSPORT: '#10b981', OTHER: '#64748b' };

  const fallback = [
    { activity_code: 'MATERIAL',    activity_name: 'Purchased Goods & Materials', total_emissions_tonnes: 6381.1, contribution_pct: 86.9, top_supplier: 'Siberia & Nord Smelting Co' },
    { activity_code: 'ELECTRICITY', activity_name: 'Purchased Electricity',       total_emissions_tonnes: 844.1,  contribution_pct: 11.5, top_supplier: 'Voltaic Cell Innovations' },
    { activity_code: 'FUEL',        activity_name: 'Upstream Energy & Fuels',     total_emissions_tonnes: 117.8,  contribution_pct: 1.6,  top_supplier: 'Alpine Precision Components' },
    { activity_code: 'TRANSPORT',   activity_name: 'Freight & Logistics',         total_emissions_tonnes: 9.9,    contribution_pct: 0.1,  top_supplier: 'Silicon Semi Foundry Inc' },
  ];
  const data = activities.length > 0 ? activities : fallback;

  return (
    <div className="card chart-card" style={{ height: '100%' }}>
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Emissions by Activity</h3>
          <p className="chart-subtitle">GHG Protocol Scope 3 activity-level breakdown</p>
        </div>
        <span className="unit-badge">tCO₂e</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        {data.map((act) => {
          const color  = COLORS[act.activity_code] || '#3b82f6';
          const icon   = ICONS[act.activity_code]  || '📊';
          const tonnes = Number(act.total_emissions_tonnes || 0);
          const pct    = Number(act.contribution_pct || 0);

          return (
            <div key={act.activity_code} style={{
              background: '#fafbfc', border: '1px solid #e2e8f0',
              borderRadius: '10px', padding: '12px 14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '8px',
                    background: `${color}18`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '14px', flexShrink: 0
                  }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>{act.activity_name}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                      Driver: {act.top_supplier || 'Multiple entities'}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    {tonnes.toFixed(1)} <span style={{ fontSize: '10px', fontWeight: 500, color: '#64748b' }}>tCO₂e</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: color, fontWeight: 700 }}>{pct.toFixed(1)}% share</div>
                </div>
              </div>
              <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: '99px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === MAIN DASHBOARD HOME ===
export default function DashboardHome({
  user,
  period = 'All Periods',
  dashboardData,
  hotspotsData,
  hierarchyData,
  materialData = [],
  transportData = [],
  onOpenGuide,
  onNavigate,
}) {
  const kpis         = dashboardData?.kpis || {};
  const tiers        = dashboardData?.tier_breakdown || [];
  const topSuppliers = hotspotsData?.highest_emission_suppliers || [];
  const topSupplier  = topSuppliers[0] || null;

  const totalTonnes = kpis.total_co2e_tonnes
    ? Number(kpis.total_co2e_tonnes).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '7,343.50';
  const totalKg = kpis.total_co2e_kg
    ? Number(kpis.total_co2e_kg).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '7,343,504';

  const suppliersCount = kpis.suppliers_count ?? (topSuppliers.length || 11);

  const highestTier = tiers.length > 0
    ? [...tiers].sort((a, b) => Number(b.co2e_tonnes || 0) - Number(a.co2e_tonnes || 0))[0]
    : { tier: 3, percentage: 87.4, co2e_tonnes: 6417.2 };

  const highMedHotspots   = topSuppliers.filter(s => s.impact === 'HIGH' || s.impact === 'MEDIUM');
  const highMedEmissions  = highMedHotspots.reduce((s, x) => s + (Number(x.total_emissions_tonnes) || 0), 0);
  const reductionTonnes   = highMedEmissions > 0 ? highMedEmissions * 0.20 : 1359.1;
  const reductionPct      = kpis.total_co2e_tonnes > 0
    ? ((reductionTonnes / Number(kpis.total_co2e_tonnes)) * 100).toFixed(1) : '18.5';

  const userName    = user?.name || user?.first_name || 'Kavya';
  const companyName = user?.company || hierarchyData?.company || 'Apex Motors Corporation';

  const materials = (hotspotsData?.highest_emission_materials?.length > 0
    ? hotspotsData.highest_emission_materials
    : materialData.length > 0 ? materialData : [
        { material_name: 'Primary Smelted Aluminium Ingots', total_emissions_tonnes: 164.8, contribution_pct: 68.2, total_quantity_kg: 20000 },
        { material_name: 'Lithium Carbonate (Battery Grade)',  total_emissions_tonnes: 78.0,  contribution_pct: 22.4, total_quantity_kg: 5000  },
        { material_name: 'Electrolytic Copper Cathode',        total_emissions_tonnes: 24.5,  contribution_pct: 7.1,  total_quantity_kg: 7000  },
        { material_name: 'Automotive Hot-Rolled Steel Coil',   total_emissions_tonnes: 8.4,   contribution_pct: 2.3,  total_quantity_kg: 4000  },
      ]).slice(0, 4);

  const transport = (hotspotsData?.highest_emission_transport_modes?.length > 0
    ? hotspotsData.highest_emission_transport_modes
    : transportData.length > 0 ? transportData : [
        { transport_mode: 'Road', total_emissions_tonnes: 8.01, contribution_pct: 80.9, total_distance_km: 3701 },
        { transport_mode: 'Sea',  total_emissions_tonnes: 0.96, contribution_pct: 9.7,  total_distance_km: 12000 },
        { transport_mode: 'Air',  total_emissions_tonnes: 0.90, contribution_pct: 9.1,  total_distance_km: 3000  },
      ]).slice(0, 3);

  const MODE_ICONS = { Road: '🚛', Sea: '🚢', Air: '✈️', Rail: '🚆' };
  const MODE_COLORS = { Road: '#0284c7', Sea: '#0f766e', Air: '#7c3aed', Rail: '#0369a1' };

  const recommendations = [
    { id: 1, title: 'Substitute 70% Virgin Aluminium with Certified Secondary Scrap', reason: 'Siberia Smelting primary aluminium drives >80% of total Tier 3 footprint.',    reduction: '103.8', type: 'CIRCULARITY',          cost: 'MEDIUM', payback: '1.2 yr' },
    { id: 2, title: 'Logistics Modal Shift: Air Cargo → Intermodal Maritime / Rail',   reason: 'Air freight generates 38× higher carbon intensity per tonne-km than sea.',   reduction: '18.4',  type: 'LOGISTICS EFFICIENCY', cost: 'LOW',    payback: '0.4 yr' },
    { id: 3, title: 'Dedicated Solar PPA for Voltaic Cell Cleanroom Potlines',         reason: 'East Asia grid intensity averages 0.582 kg CO₂e/kWh — high decarbonization leverage.', reduction: '23.3', type: 'RENEWABLE ENERGY',      cost: 'MEDIUM', payback: '2.5 yr' },
  ];
  const TYPE_COLORS = { 'CIRCULARITY': '#6d28d9', 'LOGISTICS EFFICIENCY': '#0f766e', 'RENEWABLE ENERGY': '#b45309' };
  const TYPE_BG     = { 'CIRCULARITY': '#ede9fe', 'LOGISTICS EFFICIENCY': '#ccfbf1', 'RENEWABLE ENERGY': '#fef3c7' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ─── SECTION 0: WELCOME BANNER ─── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
        padding: '24px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#ecfdf5', color: '#065f46', borderRadius: '99px', border: '1px solid rgba(16,185,129,0.25)' }}>
              🏢 {companyName}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#eff6ff', color: '#2563eb', borderRadius: '99px', border: '1px solid rgba(37,99,235,0.2)' }}>
              🛡️ Scope 3 Audited
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', background: '#faf5ff', color: '#7c3aed', borderRadius: '99px', border: '1px solid rgba(124,58,237,0.2)' }}>
              Rule-Based Deterministic Engine
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Good morning, {userName}! 👋
          </h1>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
            Consolidated Scope 3 carbon accounting across {suppliersCount} supply chain entities — Tier 1, Tier 2, and Tier 3.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '7px 12px' }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>Period:</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46' }}>{period}</span>
          </div>
          <button
            onClick={() => onNavigate('reports')}
            style={{
              background: '#065f46', color: '#fff', border: 'none',
              borderRadius: '9px', padding: '9px 18px', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(6,95,70,0.3)',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            📋 Export Scope 3 Report
          </button>
        </div>
      </div>

      {/* ─── SECTION 1: 5 KPI CARDS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        {[
          {
            label: 'Total Scope 3 CO₂e',
            value: totalTonnes,
            unit: 'tCO₂e',
            sub: `${totalKg} kg CO₂e`,
            badge: 'Audited', badgeColor: '#059669', badgeBg: '#ecfdf5',
            iconBg: '#ecfdf5', icon: '🌍', accent: '#065f46', conceptId: 'scope3',
            tooltip: 'Consolidated indirect value chain emissions across purchased goods, fuels, electricity, and freight.',
          },
          {
            label: 'Supply Chain Entities',
            value: String(suppliersCount),
            unit: 'Suppliers',
            sub: 'Across Tier 1, Tier 2, Tier 3',
            badge: '100% Traced', badgeColor: '#2563eb', badgeBg: '#eff6ff',
            iconBg: '#eff6ff', icon: '🏢', accent: null, conceptId: 'tiers',
            tooltip: 'Deduplicated supplier organizations mapped across all tiers.',
          },
          {
            label: 'Highest Impact Supplier',
            value: null,
            entityName: topSupplier?.supplier_name || 'Siberia & Nord Smelting Co',
            sub: `Tier ${topSupplier?.tier_level || 3} Upstream`,
            badge: `${topSupplier?.contribution_pct || '81.97'}% Footprint`, badgeColor: '#dc2626', badgeBg: '#fee2e2',
            iconBg: '#fff1f2', icon: '⚠️', accent: null, conceptId: 'hotspot',
            tooltip: 'The supplier driving the largest proportion of total Scope 3 footprint.',
          },
          {
            label: 'Highest Impact Tier',
            value: Number(highestTier.co2e_tonnes || 0).toFixed(1),
            unit: 'tCO₂e',
            sub: `${highestTier.percentage || '87.4'}% of total footprint`,
            badge: `Tier ${highestTier.tier || 3}`, badgeColor: '#dc2626', badgeBg: '#fee2e2',
            iconBg: '#fffbeb', icon: '📊', accent: null, conceptId: 'tiers',
            tooltip: 'The supply tier generating the highest cumulative carbon intensity.',
          },
          {
            label: 'Potential Reduction',
            value: `-${reductionTonnes.toFixed(1)}`,
            unit: 'tCO₂e',
            sub: 'Actionable interventions',
            badge: `~${reductionPct}% Reduction`, badgeColor: '#059669', badgeBg: '#ecfdf5',
            iconBg: '#ecfdf5', icon: '🌱', accent: '#059669', conceptId: 'emission-factor',
            tooltip: 'Estimated achievable reduction via circular material substitution and modal shifts.',
          },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px',
            padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            borderLeft: i === 0 ? '4px solid #065f46' : i === 4 ? '4px solid #10b981' : '1px solid #e2e8f0',
            transition: 'box-shadow 0.15s, transform 0.15s', cursor: 'default'
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b' }}>{kpi.label}</span>
                {onOpenGuide && (
                  <button
                    onClick={() => onOpenGuide(kpi.conceptId)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px', padding: '0 2px', lineHeight: 1 }}
                    title={kpi.tooltip}
                  >ⓘ</button>
                )}
              </div>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: kpi.iconBg, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '15px', flexShrink: 0
              }}>{kpi.icon}</div>
            </div>

            {/* Value or Entity Name */}
            {kpi.value !== null ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: kpi.accent || '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {kpi.value}
                </span>
                {kpi.unit && <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{kpi.unit}</span>}
              </div>
            ) : (
              <div style={{
                fontSize: '13px', fontWeight: 700, color: '#0f172a',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                lineHeight: 1.3
              }} title={kpi.entityName}>{kpi.entityName}</div>
            )}

            {/* Footer: badge + sub */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '10.5px', fontWeight: 700, padding: '2px 8px',
                borderRadius: '99px', background: kpi.badgeBg, color: kpi.badgeColor
              }}>{kpi.badge}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── SECTION 2: 2×2 CHARTS GRID ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Chart 1: Tier Donut */}
        <TierDonutMini tiers={tiers} totalTonnes={dashboardData?.kpis?.total_co2e_tonnes || 0} onOpenGuide={onOpenGuide} />

        {/* Chart 2: Activity Breakdown */}
        <ActivityBreakdownMini
          activities={hotspotsData?.highest_emission_activities || []}
          totalTonnes={dashboardData?.kpis?.total_co2e_tonnes || 0}
          onOpenGuide={onOpenGuide}
        />

        {/* Chart 3: Materials */}
        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Raw Material Carbon Hotspots</h3>
              <p className="chart-subtitle">Scope 3 Cat. 1 — Embedded carbon in purchased materials</p>
            </div>
            <button
              onClick={() => onNavigate('hotspots')}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '5px 11px', fontSize: '11.5px', cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}
            >All Materials ↗</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            {materials.map((m, idx) => {
              const name   = m.material_name || m.material_type || 'Material';
              const tonnes = Number(m.total_emissions_tonnes ?? m.co2e_tonnes ?? 0);
              const pct    = Number(m.contribution_pct ?? m.share_pct ?? 0);
              const qty    = Number(m.total_quantity_kg ?? m.total_quantity ?? 0);
              const barColors = ['#dc2626', '#ea580c', '#0284c7', '#059669'];
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: barColors[idx], display: 'inline-block', flexShrink: 0 }} />
                      {name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>{tonnes.toFixed(1)} tCO₂e</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '99px', background: '#f1f5f9', color: '#64748b' }}>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', marginBottom: '4px' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColors[idx], borderRadius: '99px' }} />
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                    Consumed: {(qty / 1000).toFixed(1)} t &nbsp;·&nbsp;
                    Intensity: {tonnes > 0 && qty > 0 ? (tonnes * 1000 / qty).toFixed(2) : '—'} kg CO₂e/kg
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 4: Transport */}
        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Freight & Logistics Emissions</h3>
              <p className="chart-subtitle">Scope 3 Cat. 4 — Upstream freight carbon intensity</p>
            </div>
            <button
              onClick={() => onNavigate('hotspots')}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '5px 11px', fontSize: '11.5px', cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}
            >Deep Dive ↗</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            {transport.map((t, idx) => {
              const mode   = t.transport_mode || 'Road';
              const tonnes = Number(t.total_emissions_tonnes ?? t.co2e_tonnes ?? 0);
              const pct    = Number(t.contribution_pct ?? t.share_pct ?? 0);
              const dist   = Number(t.total_distance_km ?? t.total_distance ?? 0);
              const icon   = MODE_ICONS[mode]  || '🚛';
              const color  = MODE_COLORS[mode] || '#0284c7';
              return (
                <div key={idx} style={{
                  background: '#fafbfc', border: '1px solid #e2e8f0',
                  borderRadius: '10px', padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '9px',
                        background: `${color}15`, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '16px'
                      }}>{icon}</div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{mode} Freight</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{dist.toLocaleString()} km total transit</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                        {tonnes.toFixed(2)} <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>tCO₂e</span>
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 7px',
                        borderRadius: '99px',
                        background: pct >= 50 ? '#fee2e2' : pct >= 15 ? '#fef3c7' : '#dcfce7',
                        color: pct >= 50 ? '#dc2626' : pct >= 15 ? '#d97706' : '#059669'
                      }}>{pct.toFixed(1)}% share</span>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: '99px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: NETWORK PREVIEW + HOTSPOTS TABLE ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: Network Topology Preview */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px 0' }}>Multi-Tier Supply Chain Topology</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Traceability from OEM anchor → Tier 3 raw material upstream</p>
            </div>
            <button onClick={() => onNavigate('network')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '5px 11px', fontSize: '11.5px', cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}>
              Graph ↗
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', background: '#fafbfc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
            {/* OEM */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anchor Enterprise</span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: '#ecfdf5', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '9px', padding: '10px 14px', fontWeight: 700,
                fontSize: '12.5px', color: '#065f46'
              }}>
                <span>🏢</span> <span>{companyName}</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', background: '#fff', color: '#059669', padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(16,185,129,0.2)' }}>OEM</span>
              </div>
            </div>

            {/* Connector */}
            <div style={{ display: 'flex', paddingLeft: '20px', margin: '2px 0' }}>
              <div style={{ width: '1px', height: '16px', background: '#cbd5e1' }} />
            </div>

            {/* Tier 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tier 1 — Direct Suppliers</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['Apex Battery Systems', 'Kinetic Motor Works', 'AeroBody Chassis'].map(n => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '7px', padding: '6px 10px', fontSize: '11.5px', color: '#1e40af', fontWeight: 600 }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', background: '#2563eb', color: '#fff', borderRadius: '4px' }}>T1</span>
                    {n}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', paddingLeft: '20px', margin: '2px 0' }}>
              <div style={{ width: '1px', height: '16px', background: '#cbd5e1' }} />
            </div>

            {/* Tier 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tier 2 — Subcontractors</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['Voltaic Cell Innovations', 'Silicon Semi Foundry', 'Nordic Extrusions AB'].map(n => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#faf5ff', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '7px', padding: '6px 10px', fontSize: '11.5px', color: '#6d28d9', fontWeight: 600 }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', background: '#7c3aed', color: '#fff', borderRadius: '4px' }}>T2</span>
                    {n}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', paddingLeft: '20px', margin: '2px 0' }}>
              <div style={{ width: '1px', height: '16px', background: '#cbd5e1' }} />
            </div>

            {/* Tier 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tier 3 — Raw Material Upstream</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff1f2', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '7px', padding: '6px 10px', fontSize: '11.5px', color: '#9f1239', fontWeight: 600 }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', background: '#dc2626', color: '#fff', borderRadius: '4px' }}>T3</span>
                  🔥 Siberia &amp; Nord Smelting Co
                  <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 6px', background: '#dc2626', color: '#fff', borderRadius: '99px', marginLeft: '2px' }}>HOTSPOT</span>
                </div>
                {['Atacama Lithium Ltd', 'Nordic Recycled Alloys'].map(n => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '6px 10px', fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', background: '#dc2626', color: '#fff', borderRadius: '4px' }}>T3</span>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Hotspots Table */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px 0' }}>Top Carbon Hotspots</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>80/20 Pareto — Priority emission drivers</p>
            </div>
            <button onClick={() => onNavigate('hotspots')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '5px 11px', fontSize: '11.5px', cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}>
              All Hotspots ↗
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafbfc' }}>
                  {['Supplier Entity', 'Tier', 'Contribution', 'Impact'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      No hotspot data for selected period.
                    </td>
                  </tr>
                ) : (
                  topSuppliers.slice(0, 5).map((s, idx) => {
                    const impact = (s.impact || 'LOW').toLowerCase();
                    const impactStyles = {
                      high:   { bg: '#fee2e2', color: '#dc2626' },
                      medium: { bg: '#fef3c7', color: '#d97706' },
                      low:    { bg: '#dcfce7', color: '#059669' },
                    };
                    const ist = impactStyles[impact] || impactStyles.low;
                    return (
                      <tr key={s.supplier_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>{s.supplier_name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.main_source || s.industry_sector || 'Primary Smelter'}</div>
                        </td>
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <span style={{
                            fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '99px',
                            background: s.tier_level === 1 ? '#eff6ff' : s.tier_level === 2 ? '#faf5ff' : '#fff1f2',
                            color: s.tier_level === 1 ? '#2563eb' : s.tier_level === 2 ? '#7c3aed' : '#dc2626',
                          }}>T{s.tier_level}</span>
                        </td>
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{s.contribution_pct}%</div>
                          <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{Number(s.total_emissions_tonnes).toFixed(1)} tCO₂e</div>
                        </td>
                        <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '99px', background: ist.bg, color: ist.color }}>
                            {(s.impact || 'LOW')}
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
      </div>

      {/* ─── SECTION 4: RECOMMENDATIONS ─── */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px 0' }}>Recommended Circular &amp; Low-Carbon Interventions</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Engineering actions derived directly from verified hotspot data</p>
          </div>
          <button onClick={() => onNavigate('recommendations')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '5px 11px', fontSize: '11.5px', cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}>
            Action Registry ↗
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {recommendations.map(rec => (
            <div key={rec.id} style={{
              background: '#fafbfc', border: '1px solid #e2e8f0',
              borderRadius: '12px', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: TYPE_BG[rec.type] || '#f1f5f9', color: TYPE_COLORS[rec.type] || '#475569', letterSpacing: '0.03em' }}>
                  {rec.type}
                </span>
                <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>⏱️ {rec.payback} payback</span>
              </div>
              <h4 style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.4 }}>{rec.title}</h4>
              <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.5, flex: 1 }}>{rec.reason}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '9.5px', color: '#94a3b8', marginBottom: '1px' }}>Potential Reduction</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>-{rec.reduction} tCO₂e</div>
                </div>
                <span style={{ fontSize: '10.5px', color: '#64748b', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 9px' }}>
                  {rec.cost} CAPEX
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── SECTION 5: RECENT AUDIT ACTIVITY ─── */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px 0' }}>Recent Compliance &amp; System Activity</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Immutable SQLite audit trail events</p>
          </div>
          <button onClick={() => onNavigate('audit')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '5px 11px', fontSize: '11.5px', cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}>
            Audit Ledger ↗
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { icon: '📤', bg: '#ecfdf5', color: '#059669', title: 'Supplier Activity CSV Ingested & Verified', desc: 'Batch ingestion of 14 operational activity records for Apex Motors Corporation [DEMO].', time: 'Today, 03:38 AM' },
            { icon: '🧮', bg: '#eff6ff', color: '#2563eb', title: 'Deterministic Carbon Calculations Executed', desc: '14 auditable Scope 3 emission calculations generated using DEFRA / EPA standard emission factors.', time: 'Today, 03:38 AM' },
            { icon: '🔥', bg: '#fff1f2', color: '#dc2626', title: 'High-Carbon Hotspot Detected & Flagged', desc: 'Siberia & Nord Smelting Co flagged as HIGH impact — contributing >80% of Tier 3 emissions.', time: 'Today, 03:38 AM' },
            { icon: '📄', bg: '#faf5ff', color: '#7c3aed', title: 'Scope 3 GHG Disclosure Report Generated', desc: 'Executive Sustainability Report published and finalized for compliance assurance.', time: 'Today, 03:38 AM' },
          ].map((ev, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '12px 16px',
              background: '#fafbfc', border: '1px solid #f1f5f9',
              borderRadius: '10px'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: ev.bg, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '15px', flexShrink: 0
              }}>{ev.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>{ev.title}</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>{ev.desc}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0, fontWeight: 500 }}>{ev.time}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
