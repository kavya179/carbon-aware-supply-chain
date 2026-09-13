import React, { useState, useEffect, useCallback } from 'react';
import { carbonApi } from '../services/api';

// Tier style config
const TIER = {
  1: { label: 'Tier 1', bg: '#eff6ff', color: '#1e40af', border: 'rgba(37,99,235,0.25)', dot: '#2563eb', role: 'Direct Supplier' },
  2: { label: 'Tier 2', bg: '#faf5ff', color: '#5b21b6', border: 'rgba(124,58,237,0.25)', dot: '#7c3aed', role: 'Subcontractor' },
  3: { label: 'Tier 3', bg: '#fff1f2', color: '#9f1239', border: 'rgba(220,38,38,0.25)', dot: '#dc2626', role: 'Raw Material Upstream' },
};

const IMPACT = {
  HIGH:   { bg: '#fee2e2', color: '#dc2626', border: 'rgba(220,38,38,0.3)' },
  MEDIUM: { bg: '#fef3c7', color: '#d97706', border: 'rgba(217,119,6,0.3)' },
  LOW:    { bg: '#dcfce7', color: '#059669', border: 'rgba(5,150,105,0.3)' },
};

const STATUS = {
  ACTIVE:               { bg: '#ecfdf5', color: '#059669' },
  PENDING_VERIFICATION: { bg: '#fef9c3', color: '#a16207' },
  INACTIVE:             { bg: '#f1f5f9', color: '#64748b' },
};

// Merge hierarchy tree into a flat list of supplier objects
function flattenHierarchy(hierarchyData) {
  const list = [];
  const tree = hierarchyData?.tree || [];

  tree.forEach(t1 => {
    list.push({
      id: t1.id,
      name: t1.supplier,
      code: t1.supplier_code,
      tier: 1,
      sector: t1.industry_sector || 'Automotive',
      country: t1.country || '—',
      location: t1.location || '—',
      share: t1.procurement_share_pct,
      status: t1.status || 'ACTIVE',
      impact: null, emissions: null, contribution: null,
    });
    (t1.children || []).forEach(t2 => {
      list.push({
        id: t2.id,
        name: t2.supplier,
        code: t2.supplier_code,
        tier: 2,
        sector: t2.industry_sector || 'Manufacturing',
        country: t2.country || '—',
        location: t2.location || '—',
        share: t2.procurement_share_pct,
        status: t2.status || 'ACTIVE',
        impact: null, emissions: null, contribution: null,
      });
      (t2.children || []).forEach(t3 => {
        list.push({
          id: t3.id,
          name: t3.supplier,
          code: t3.supplier_code,
          tier: 3,
          sector: t3.industry_sector || 'Mining & Raw Materials',
          country: t3.country || '—',
          location: t3.location || '—',
          share: t3.procurement_share_pct,
          status: t3.status || 'ACTIVE',
          impact: null, emissions: null, contribution: null,
        });
      });
    });
  });
  return list;
}

export default function SuppliersView({ hierarchyData, hotspotsData }) {
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [searchTerm, setSearchTerm]   = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Build enriched supplier list
  const hierarchyFlat = flattenHierarchy(hierarchyData);
  const hotspotMap    = {};
  (hotspotsData?.highest_emission_suppliers || []).forEach(s => {
    hotspotMap[s.supplier_name] = s;
  });

  // Enrich with emissions data
  const allSuppliers = hierarchyFlat.length > 0 ? hierarchyFlat.map(sup => {
    const hs = hotspotMap[sup.name] || {};
    return {
      ...sup,
      impact:       hs.impact       || null,
      emissions:    hs.total_emissions_tonnes != null ? Number(hs.total_emissions_tonnes) : null,
      contribution: hs.contribution_pct != null ? Number(hs.contribution_pct) : null,
      mainSource:   hs.main_source  || null,
      calcs:        hs.calculations_count || null,
    };
  }) : (hotspotsData?.highest_emission_suppliers || []).map(s => ({
    id:           s.supplier_id,
    name:         s.supplier_name,
    code:         s.supplier_code || '—',
    tier:         s.tier_level,
    sector:       s.industry_sector || 'Automotive',
    country:      s.country || '—',
    location:     s.location || '—',
    share:        s.procurement_share_pct || '—',
    status:       s.status || 'ACTIVE',
    impact:       s.impact,
    emissions:    Number(s.total_emissions_tonnes),
    contribution: Number(s.contribution_pct),
    mainSource:   s.main_source || null,
    calcs:        s.calculations_count || null,
  }));

  // Counts by tier
  const countAll = allSuppliers.length;
  const count1   = allSuppliers.filter(s => s.tier === 1).length;
  const count2   = allSuppliers.filter(s => s.tier === 2).length;
  const count3   = allSuppliers.filter(s => s.tier === 3).length;

  // Filter
  const filtered = allSuppliers.filter(s => {
    const matchTier   = selectedTier === 'ALL' || String(s.tier) === selectedTier;
    const q           = searchTerm.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.sector || '').toLowerCase().includes(q) || (s.country || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q);
    return matchTier && matchSearch;
  });

  const highCount = allSuppliers.filter(s => s.impact === 'HIGH').length;
  const totalEmissions = allSuppliers.reduce((acc, s) => acc + (s.emissions || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ─── PAGE HEADER ─── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
        padding: '22px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
            Supplier Directory &amp; Tier Registry
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Audited supply chain partners across Tier 1 (direct), Tier 2 (subcontractors), and Tier 3 (raw material upstream)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#ecfdf5', color: '#065f46', borderRadius: '99px', border: '1px solid rgba(16,185,129,0.25)' }}>
            🛡️ SQLite Ledger
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#eff6ff', color: '#2563eb', borderRadius: '99px', border: '1px solid rgba(37,99,235,0.2)' }}>
            GHG Protocol Scope 3
          </span>
        </div>
      </div>

      {/* ─── STATS SUMMARY ROW ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total Suppliers', value: countAll, icon: '🏢', bg: '#f8fafc', accent: '#0f172a', subtext: 'All tiers combined' },
          { label: 'Tier 1 Direct',   value: count1,   icon: '🔵', bg: '#eff6ff', accent: '#1e40af', subtext: 'Direct procurement partners' },
          { label: 'Tier 2 Sub-Tier', value: count2,   icon: '🟣', bg: '#faf5ff', accent: '#5b21b6', subtext: 'Sub-tier subcontractors' },
          { label: 'Tier 3 Upstream', value: count3,   icon: '🔴', bg: '#fff1f2', accent: '#9f1239', subtext: 'Raw material & smelters' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', gap: '14px'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: stat.bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '18px', flexShrink: 0
            }}>{stat.icon}</div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: stat.accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{stat.value}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{stat.label}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{stat.subtext}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── FILTER & SEARCH BAR ─── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px',
        padding: '16px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {/* Tier Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All Tiers (${countAll})`, bg: '#f1f5f9', activeBg: '#0f172a', color: '#64748b', activeColor: '#ffffff' },
            { id: '1',   label: `Tier 1 (${count1})`,       bg: '#eff6ff', activeBg: '#2563eb', color: '#1e40af', activeColor: '#ffffff' },
            { id: '2',   label: `Tier 2 (${count2})`,       bg: '#faf5ff', activeBg: '#7c3aed', color: '#5b21b6', activeColor: '#ffffff' },
            { id: '3',   label: `Tier 3 (${count3})`,       bg: '#fff1f2', activeBg: '#dc2626', color: '#9f1239', activeColor: '#ffffff' },
          ].map(tab => {
            const isActive = selectedTier === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTier(tab.id)}
                style={{
                  padding: '6px 14px', borderRadius: '8px', border: 'none',
                  fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                  background: isActive ? tab.activeBg : tab.bg,
                  color: isActive ? tab.activeColor : tab.color,
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px', maxWidth: '380px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '9px',
            padding: '8px 14px', flex: 1
          }}>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Search by name, sector, country…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: '13px', color: '#0f172a', width: '100%'
              }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: 0 }}>✕</button>
            )}
          </div>
        </div>

        {/* Result count */}
        <div style={{ fontSize: '12.5px', color: '#64748b', flexShrink: 0 }}>
          Showing <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> of {allSuppliers.length} suppliers
        </div>
      </div>

      {/* ─── SUPPLIERS GRID ─── */}
      {filtered.length === 0 ? (
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px',
          padding: '60px 24px', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏢</div>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>No Suppliers Found</h4>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>No supplier organizations match your search or tier filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {filtered.map((s, idx) => {
            const tc  = TIER[s.tier] || TIER[1];
            const imp = s.impact ? (IMPACT[s.impact] || IMPACT.LOW) : null;
            const st  = STATUS[s.status] || STATUS.ACTIVE;
            const isSelected = selectedSupplier?.id === s.id;

            return (
              <div
                key={s.id || idx}
                onClick={() => setSelectedSupplier(isSelected ? null : s)}
                style={{
                  background: '#ffffff',
                  border: `1px solid ${isSelected ? tc.dot : '#e2e8f0'}`,
                  borderRadius: '14px',
                  padding: '18px 20px',
                  boxShadow: isSelected ? `0 0 0 3px ${tc.dot}20, 0 4px 16px rgba(0,0,0,0.06)` : '0 1px 4px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Tier + Status badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 800, padding: '2px 8px',
                        borderRadius: '99px', background: tc.bg, color: tc.color,
                        border: `1px solid ${tc.border}`
                      }}>{tc.label}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                        borderRadius: '99px', background: st.bg, color: st.color
                      }}>
                        {s.status === 'ACTIVE' ? '✓ Active' : s.status === 'PENDING_VERIFICATION' ? '⏳ Pending' : 'Inactive'}
                      </span>
                    </div>
                    {/* Name */}
                    <h3 style={{
                      fontSize: '13.5px', fontWeight: 700, color: '#0f172a',
                      margin: '0 0 3px 0', lineHeight: 1.35,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }} title={s.name}>{s.name}</h3>
                    <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0 }}>
                      {s.code && s.code !== '—' ? `${s.code} · ` : ''}{s.sector}
                    </p>
                  </div>
                  {/* Impact badge */}
                  {imp && (
                    <span style={{
                      fontSize: '10px', fontWeight: 800, padding: '3px 9px',
                      borderRadius: '99px', background: imp.bg, color: imp.color,
                      border: `1px solid ${imp.border}`, flexShrink: 0, letterSpacing: '0.03em'
                    }}>{s.impact}</span>
                  )}
                </div>

                {/* Location */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                  <span>📍</span>
                  <span>{s.location !== '—' ? s.location + ', ' : ''}{s.country}</span>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: '#f1f5f9' }} />

                {/* Metrics Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={{ background: '#fafbfc', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>CO₂e Share</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      {s.contribution != null ? `${s.contribution.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                  <div style={{ background: '#fafbfc', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Emissions</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                      {s.emissions != null ? s.emissions.toFixed(1) : '—'}
                      {s.emissions != null && <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8', display: 'block' }}>tCO₂e</span>}
                    </div>
                  </div>
                  <div style={{ background: '#fafbfc', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Proc. Share</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      {s.share != null && s.share !== '—' ? `${s.share}%` : '—'}
                    </div>
                  </div>
                </div>

                {/* Emission bar (if data available) */}
                {s.contribution != null && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94a3b8', marginBottom: '4px' }}>
                      <span>Scope 3 Footprint Contribution</span>
                      <span style={{ fontWeight: 700, color: imp ? imp.color : '#64748b' }}>{s.contribution.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '99px',
                        width: `${Math.min(s.contribution, 100)}%`,
                        background: imp ? imp.color : tc.dot,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                )}

                {/* Primary driver footer */}
                {s.mainSource && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: '#fafbfc', border: '1px solid #f1f5f9',
                    borderRadius: '8px', padding: '8px 12px', fontSize: '11.5px'
                  }}>
                    <span style={{ color: '#94a3b8' }}>🎯 Primary Driver:</span>
                    <span style={{ color: '#0f172a', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.mainSource}
                    </span>
                  </div>
                )}

                {/* Role tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: tc.color, fontWeight: 600 }}>
                    {tc.role}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {s.calcs != null ? `${s.calcs} records` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── DETAIL PANEL (click to expand) ─── */}
      {selectedSupplier && (() => {
        const s  = selectedSupplier;
        const tc = TIER[s.tier] || TIER[1];
        const imp = s.impact ? (IMPACT[s.impact] || IMPACT.LOW) : null;
        return (
          <div style={{
            background: '#ffffff', border: `1.5px solid ${tc.dot}30`,
            borderRadius: '16px', padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 800, padding: '3px 10px',
                    borderRadius: '99px', background: tc.bg, color: tc.color
                  }}>{tc.label} — {tc.role}</span>
                  {imp && (
                    <span style={{
                      fontSize: '11px', fontWeight: 800, padding: '3px 10px',
                      borderRadius: '99px', background: imp.bg, color: imp.color
                    }}>{s.impact} IMPACT</span>
                  )}
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 3px 0' }}>{s.name}</h2>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                  {s.code && s.code !== '—' ? s.code + ' · ' : ''}{s.sector} · 📍 {s.location !== '—' ? s.location + ', ' : ''}{s.country}
                </p>
              </div>
              <button
                onClick={() => setSelectedSupplier(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: '#64748b', fontWeight: 600 }}
              >✕ Close</button>
            </div>

            {/* Detail metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Scope 3 Footprint Share',    value: s.contribution != null ? `${s.contribution.toFixed(2)}%`     : '—', color: imp?.color || '#0f172a' },
                { label: 'Calculated Total CO₂e',      value: s.emissions    != null ? `${s.emissions.toFixed(2)} tCO₂e`   : '—', color: '#0f172a' },
                { label: 'Procurement Share',          value: s.share != null && s.share !== '—' ? `${s.share}%`          : '—', color: '#0f172a' },
                { label: 'Activity Records',           value: s.calcs != null ? `${s.calcs} entries`                       : '—', color: '#0f172a' },
              ].map((m, i) => (
                <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{m.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</div>
                </div>
              ))}
            </div>

            {s.mainSource && (
              <div style={{
                marginTop: '14px', background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: '10px', padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px'
              }}>
                <span style={{ color: '#94a3b8' }}>🎯 Primary Emission Source:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{s.mainSource}</span>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
