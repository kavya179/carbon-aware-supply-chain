import React, { useState } from 'react';

// ─── Constants ────────────────────────────────────────────────
const IMPACT = {
  HIGH:   { bg: '#fee2e2', color: '#dc2626', border: 'rgba(220,38,38,0.3)',   dot: '#dc2626', label: 'HIGH' },
  MEDIUM: { bg: '#fef3c7', color: '#d97706', border: 'rgba(217,119,6,0.3)',   dot: '#f59e0b', label: 'MEDIUM' },
  LOW:    { bg: '#dcfce7', color: '#059669', border: 'rgba(5,150,105,0.3)',   dot: '#10b981', label: 'LOW' },
};
const TIER_STYLE = {
  1: { bg: '#eff6ff', color: '#1e40af' },
  2: { bg: '#faf5ff', color: '#5b21b6' },
  3: { bg: '#fff1f2', color: '#9f1239' },
};
const MODE_ICONS  = { Road: '🚛', Sea: '🚢', Air: '✈️', Rail: '🚆' };
const MODE_COLORS = { Road: '#0284c7', Sea: '#0f766e', Air: '#7c3aed', Rail: '#0369a1' };
const MAT_COLORS  = ['#dc2626', '#ea580c', '#0284c7', '#059669', '#7c3aed', '#d97706'];

// ─── Supplier hotspot card ────────────────────────────────────
function SupplierCard({ s, idx }) {
  const [expanded, setExpanded] = useState(false);
  const imp = IMPACT[(s.impact || 'LOW')] || IMPACT.LOW;
  const tc  = TIER_STYLE[s.tier_level] || TIER_STYLE[1];
  const tonnes = Number(s.total_emissions_tonnes || 0);
  const pct    = Number(s.contribution_pct || 0);

  return (
    <div style={{
      background: '#ffffff',
      border: `1.5px solid ${expanded ? imp.dot + '50' : '#e2e8f0'}`,
      borderLeft: `4px solid ${imp.dot}`,
      borderRadius: '12px',
      boxShadow: expanded ? '0 4px 16px rgba(0,0,0,0.07)' : '0 1px 3px rgba(0,0,0,0.04)',
      overflow: 'hidden',
      transition: 'all 0.15s',
    }}>
      {/* Main row */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>

        {/* Rank */}
        <div style={{
          width: '34px', height: '34px', borderRadius: '9px',
          background: imp.bg, color: imp.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 800, flexShrink: 0,
        }}>#{idx + 1}</div>

        {/* Supplier info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: tc.bg, color: tc.color }}>
              Tier {s.tier_level}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 800, padding: '2px 9px',
              borderRadius: '99px', background: imp.bg, color: imp.color,
              border: `1px solid ${imp.border}`,
            }}>{imp.label} IMPACT</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.supplier_name}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            {s.supplier_code && `${s.supplier_code} · `}{s.industry_sector || 'Manufacturing'}{s.country && ` · 📍 ${s.country}`}
          </div>
        </div>

        {/* Emissions metric */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {tonnes.toFixed(1)}
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8', marginLeft: '4px' }}>tCO₂e</span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: imp.color, marginTop: '3px' }}>
            {pct.toFixed(2)}% of total
          </div>
          {/* Mini bar */}
          <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', marginTop: '6px', width: '100px' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: imp.dot, borderRadius: '99px' }} />
          </div>
        </div>

        {/* Driver */}
        <div style={{ flexShrink: 0, maxWidth: '160px', display: 'none' /* hidden on small */ }} />

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: expanded ? '#f1f5f9' : '#fafbfc',
            border: '1px solid #e2e8f0', borderRadius: '8px',
            padding: '6px 12px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 600, color: '#475569',
            flexShrink: 0, transition: 'all 0.15s',
          }}
        >{expanded ? '▲ Hide' : '▼ Detail'}</button>
      </div>

      {/* Driver bar */}
      <div style={{
        padding: '8px 20px 10px',
        borderTop: '1px solid #f8fafc',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#fafbfc',
      }}>
        <span style={{ fontSize: '12px' }}>🎯</span>
        <span style={{ fontSize: '11.5px', color: '#64748b' }}>Primary Driver:</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{s.main_source || 'Operational Activity'}</span>
        {s.calculations_count && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8' }}>
            {s.calculations_count} verified records
          </span>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
              Auditable Rationale &amp; Hotspot Classification
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', background: '#ecfdf5', color: '#059669' }}>
              Deterministic Engine · Zero ML
            </span>
          </div>

          {s.explanation && (
            <p style={{ fontSize: '12.5px', color: '#475569', margin: '0 0 14px 0', lineHeight: 1.6, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
              {s.explanation}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              { label: 'Verified Records',    value: s.calculations_count ? `${s.calculations_count} entries` : '—' },
              { label: 'Audit Status',        value: s.verification_summary ? `${s.verification_summary.VERIFIED || 0} Verified / ${s.verification_summary.UNVERIFIED || 0} Pending` : 'Verified' },
              { label: 'Total Invoiced (kg)', value: s.total_emissions_kg ? Number(s.total_emissions_kg).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' kg CO₂e' : `${(tonnes * 1000).toFixed(0)} kg CO₂e` },
            ].map((m, i) => (
              <div key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{m.label}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main HotspotsView ────────────────────────────────────────
export default function HotspotsView({
  suppliers = [],
  materials = [],
  transportModes = [],
  onSyncHotspots,
  isSyncing,
  onOpenGuide,
}) {
  const [activeTab,    setActiveTab]    = useState('suppliers');
  const [filterImpact, setFilterImpact] = useState('ALL');

  // Counts
  const highCount = suppliers.filter(s => s.impact === 'HIGH').length;
  const medCount  = suppliers.filter(s => s.impact === 'MEDIUM').length;
  const lowCount  = suppliers.filter(s => s.impact === 'LOW').length;
  const totalEmissions = suppliers.reduce((a, s) => a + Number(s.total_emissions_tonnes || 0), 0);

  const filteredSuppliers = suppliers.filter(s =>
    filterImpact === 'ALL' || s.impact === filterImpact
  );

  const TABS = [
    { id: 'suppliers',  label: `🏢 Supplier Hotspots (${suppliers.length})` },
    { id: 'materials',  label: `📦 Material Hotspots (${materials.length})` },
    { id: 'transport',  label: `🚛 Logistics Hotspots (${transportModes.length})` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ─── PAGE HEADER ─── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
        padding: '22px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
            Carbon Hotspot &amp; Impact Analysis
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Automated 80/20 Pareto identification of emission-dense suppliers, materials, and logistics pathways
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#fff1f2', color: '#dc2626', borderRadius: '99px', border: '1px solid rgba(220,38,38,0.25)' }}>
            🔥 {highCount} High Impact
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#ecfdf5', color: '#065f46', borderRadius: '99px', border: '1px solid rgba(16,185,129,0.25)' }}>
            🛡️ Rule-Based Detection
          </span>
          {onSyncHotspots && (
            <button
              onClick={onSyncHotspots}
              disabled={isSyncing}
              style={{
                padding: '7px 14px', borderRadius: '9px', border: '1px solid #e2e8f0',
                background: '#f8fafc', fontSize: '12px', fontWeight: 600,
                color: '#475569', cursor: isSyncing ? 'not-allowed' : 'pointer',
              }}
            >{isSyncing ? '⏳ Syncing…' : '🔄 Sync to DB'}</button>
          )}
        </div>
      </div>

      {/* ─── KPI STRIP ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total Scope 3 (Hotspots)',  value: totalEmissions.toFixed(1), unit: 'tCO₂e', icon: '🌍', bg: '#ecfdf5', ac: '#065f46', sub: 'All identified hotspot suppliers' },
          { label: 'High Impact Entities',      value: highCount,   unit: null, icon: '🔴', bg: '#fff1f2', ac: '#dc2626', sub: '≥20% footprint contribution' },
          { label: 'Medium Impact Entities',    value: medCount,    unit: null, icon: '🟡', bg: '#fef3c7', ac: '#d97706', sub: '5–20% footprint contribution' },
          { label: 'Low Impact Entities',       value: lowCount,    unit: null, icon: '🟢', bg: '#ecfdf5', ac: '#059669', sub: '<5% footprint contribution' },
        ].map((s, i) => (
          <div key={i} style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.ac, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {s.value}{s.unit && <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#94a3b8', marginLeft: '4px' }}>{s.unit}</span>}
              </div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{s.label}</div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '1px' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── TABS ─── */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '8px 16px', borderRadius: '9px', border: 'none',
            fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
            background: activeTab === t.id ? '#0f172a' : '#f1f5f9',
            color:      activeTab === t.id ? '#ffffff'  : '#64748b',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─── TAB 1: SUPPLIER HOTSPOTS ─── */}
      {activeTab === 'suppliers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Impact filter bar */}
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '12px 16px', display: 'flex', alignItems: 'center',
            gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>Filter:</span>
            {[
              { id: 'ALL',    label: `All (${suppliers.length})`,    bg: '#f1f5f9', activeBg: '#0f172a', color: '#64748b', activeColor: '#fff' },
              { id: 'HIGH',   label: `🔴 High (${highCount})`,       bg: '#fff1f2', activeBg: '#dc2626', color: '#dc2626', activeColor: '#fff' },
              { id: 'MEDIUM', label: `🟡 Medium (${medCount})`,      bg: '#fef3c7', activeBg: '#d97706', color: '#d97706', activeColor: '#fff' },
              { id: 'LOW',    label: `🟢 Low (${lowCount})`,         bg: '#ecfdf5', activeBg: '#059669', color: '#059669', activeColor: '#fff' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilterImpact(f.id)} style={{
                padding: '5px 14px', borderRadius: '7px', border: 'none',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                background: filterImpact === f.id ? f.activeBg : f.bg,
                color:      filterImpact === f.id ? f.activeColor : f.color,
                transition: 'all 0.15s',
              }}>{f.label}</button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8' }}>
              Showing <strong style={{ color: '#0f172a' }}>{filteredSuppliers.length}</strong> suppliers
            </span>
          </div>

          {/* Supplier cards list */}
          {filteredSuppliers.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>No Hotspots Found</h4>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>No supplier hotspots match the selected impact level.</p>
            </div>
          ) : (
            filteredSuppliers.map((s, idx) => (
              <SupplierCard key={s.supplier_id || idx} s={s} idx={idx} />
            ))
          )}
        </div>
      )}

      {/* ─── TAB 2: MATERIAL HOTSPOTS ─── */}
      {activeTab === 'materials' && (
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
        }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px 0' }}>
              📦 Purchased Raw Material Carbon Hotspots
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Scope 3 Category 1 — Embedded carbon in raw materials purchased by supply chain entities
            </p>
          </div>

          {materials.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📦</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>No Material Data</div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>No material activity entries recorded for this reporting period.</div>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafbfc' }}>
                      {['Rank', 'Material Type', 'Total CO₂e', 'Company Share', 'Material Share', 'Volume Consumed', 'Supplying Partner', 'Impact'].map(h => (
                        <th key={h} style={{ padding: '11px 14px', fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m, i) => {
                      const name        = m.material_name || m.material_type || 'Raw Material';
                      const tonnes      = Number(m.total_emissions_tonnes ?? m.co2e_tonnes ?? 0);
                      const qty         = Number(m.total_quantity_kg ?? m.total_quantity ?? 0);
                      const contribPct  = Number(m.contribution_pct ?? m.share_pct ?? 0);
                      const matSharePct = Number(m.material_share_pct ?? m.share_pct ?? 0);
                      const suppliers   = m.suppliers || m.supplier_names || [];
                      const impact      = m.impact || (contribPct >= 20 ? 'HIGH' : contribPct >= 5 ? 'MEDIUM' : 'LOW');
                      const imp         = IMPACT[impact] || IMPACT.LOW;
                      const rank        = m.rank || i + 1;
                      const qtyDisplay  = qty >= 1000 ? `${(qty/1000).toFixed(1)} t` : `${qty.toFixed(0)} kg`;
                      const color       = MAT_COLORS[i] || '#64748b';

                      return (
                        <tr key={name + i} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
                              #{rank}
                            </div>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{name}</div>
                                {m.emission_factors?.length > 0 && (
                                  <div style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '1px' }}>EF: {m.emission_factors[0]}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{tonnes.toFixed(1)}</div>
                            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>tCO₂e</div>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: imp.color }}>{contribPct.toFixed(1)}%</div>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', minWidth: '38px' }}>{matSharePct.toFixed(1)}%</span>
                              <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '99px', flex: 1, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(matSharePct, 100)}%`, background: color, borderRadius: '99px' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600 }}>{qtyDisplay}</span>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {suppliers.slice(0, 2).map((s, si) => (
                                <span key={si} style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 7px', borderRadius: '5px', background: '#f1f5f9', color: '#475569' }}>{s}</span>
                              ))}
                              {suppliers.length > 2 && <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>+{suppliers.length - 2}</span>}
                              {suppliers.length === 0 && <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>}
                            </div>
                          </td>
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '99px', background: imp.bg, color: imp.color }}>{impact}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB 3: TRANSPORT HOTSPOTS ─── */}
      {activeTab === 'transport' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px',
            padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px 0' }}>
              🚛 Freight &amp; Logistics Emission Hotspots
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Scope 3 Category 4 — Upstream transportation and distribution carbon intensity by mode
            </p>
          </div>

          {transportModes.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🚛</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>No Transport Data</div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>No freight transport activity entries logged for this period.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {transportModes.map((t, i) => {
                const mode       = t.transport_mode || 'Road';
                const icon       = MODE_ICONS[mode]  || '🚚';
                const color      = MODE_COLORS[mode] || '#0284c7';
                const tonnes     = Number(t.total_emissions_tonnes ?? t.co2e_tonnes ?? 0);
                const distance   = Number(t.total_distance_km ?? t.total_distance ?? 0);
                const tonneKm    = Number(t.total_tonne_km ?? 0);
                const weight     = Number(t.total_weight_tonnes ?? 0);
                const contribPct = Number(t.contribution_pct ?? t.share_pct ?? 0);
                const transPct   = Number(t.transport_share_pct ?? t.share_pct ?? 100);
                const impact     = t.impact || (contribPct >= 20 ? 'HIGH' : contribPct >= 5 ? 'MEDIUM' : 'LOW');
                const imp        = IMPACT[impact] || IMPACT.LOW;
                const explanation = t.explanation || `${mode} freight generates ${tonnes.toFixed(2)} tCO₂e across ${distance.toLocaleString()} km.`;

                return (
                  <div key={mode + i} style={{
                    background: '#ffffff', border: '1px solid #e2e8f0',
                    borderRadius: '14px', padding: '20px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    display: 'flex', flexDirection: 'column', gap: '14px',
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '10px',
                          background: `${color}15`, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '20px',
                        }}>{icon}</div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{mode} Freight</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Scope 3 Cat. 4</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '99px', background: imp.bg, color: imp.color }}>{impact}</span>
                    </div>

                    {/* Big metric */}
                    <div style={{ textAlign: 'center', padding: '12px', background: '#fafbfc', borderRadius: '10px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
                        {tonnes.toFixed(2)}
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginLeft: '6px' }}>tCO₂e</span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: imp.color, marginTop: '4px' }}>
                        {contribPct.toFixed(1)}% of company footprint
                      </div>
                      <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden', marginTop: '8px' }}>
                        <div style={{ height: '100%', width: `${Math.min(contribPct, 100)}%`, background: color, borderRadius: '99px' }} />
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {[
                        { label: 'Total Distance', value: `${distance.toLocaleString()} km` },
                        { label: 'Freight Payload', value: weight > 0 ? `${weight.toFixed(1)} t` : '—' },
                        { label: 'Activity Volume', value: tonneKm > 0 ? `${tonneKm.toLocaleString()} t·km` : '—' },
                        { label: 'Logistics Share', value: `${transPct.toFixed(1)}%` },
                      ].map((m, mi) => (
                        <div key={mi} style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '9px 11px' }}>
                          <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>{m.label}</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Explanation */}
                    <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '10px 12px' }}>
                      <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>{explanation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
