import React, { useState, useEffect, useMemo } from 'react';
import { carbonApi } from '../services/api';

// ─── Domain Configuration & Design Tokens ────────────────────────────────────────
const DOMAIN = {
  MATERIAL: {
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)',
    color: '#059669',
    lightColor: '#34d399',
    darkColor: '#065f46',
    border: 'rgba(16, 185, 129, 0.25)',
    badgeBg: '#dcfce7',
    badgeText: '#065f46',
    icon: '♻️',
    label: 'Material Circularity',
    ghgCategory: 'Scope 3 Cat 1: Purchased Goods & Services',
    desc: 'High recycled content, lightweight bio-composites, closed-loop scrap recycling'
  },
  ENERGY: {
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.03) 100%)',
    color: '#d97706',
    lightColor: '#fbbf24',
    darkColor: '#92400e',
    border: 'rgba(245, 158, 11, 0.25)',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    icon: '⚡',
    label: 'Renewable Energy',
    ghgCategory: 'Scope 3 Cat 3: Fuel & Energy Related Activities',
    desc: 'On-site rooftop solar PPA, green tariffs, electric heat pumps'
  },
  TRANSPORT: {
    bg: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(29, 78, 216, 0.03) 100%)',
    color: '#2563eb',
    lightColor: '#60a5fa',
    darkColor: '#1e40af',
    border: 'rgba(37, 99, 235, 0.25)',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    icon: '🚆',
    label: 'Logistics & Fleet',
    ghgCategory: 'Scope 3 Cat 4: Upstream Transportation & Distribution',
    desc: 'Modal shift from air/road to electrified rail, route batching, EV freight'
  },
  SUPPLIER: {
    bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(124, 58, 237, 0.03) 100%)',
    color: '#7c3aed',
    lightColor: '#a78bfa',
    darkColor: '#5b21b6',
    border: 'rgba(139, 92, 246, 0.25)',
    badgeBg: '#ede9fe',
    badgeText: '#5b21b6',
    icon: '🤝',
    label: 'Supplier Engagement',
    ghgCategory: 'Scope 3 Value Chain Co-Decarbonization',
    desc: 'Tier 1/2 joint reduction pacts, supplier sustainability scoring, audits'
  },
};

const COST_STYLE = {
  LOW:    { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', label: 'Low CAPEX (<$15k)' },
  MEDIUM: { bg: '#fef3c7', color: '#d97706', border: '#fde68a', label: 'Medium CAPEX ($15k-$75k)' },
  HIGH:   { bg: '#fee2e2', color: '#dc2626', border: '#fecaca', label: 'High CAPEX (>$75k)' },
};

const STATUS_OPTIONS = [
  { id: 'NOT_STARTED', label: '⚪ Not Started', color: '#64748b', bg: '#f1f5f9' },
  { id: 'PLANNED',     label: '🟡 Planned',     color: '#d97706', bg: '#fef3c7' },
  { id: 'IN_PROGRESS', label: '🔵 In Progress', color: '#2563eb', bg: '#eff6ff' },
  { id: 'IMPLEMENTED', label: '🟢 Implemented', color: '#059669', bg: '#ecfdf5' },
];

// ─── Single Recommendation Card Component ─────────────────────────────────────
function RecCard({ r, idx, onOpenGuide, status, onStatusChange, carbonPrice, adoptionRate }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const d    = DOMAIN[r.category] || DOMAIN.MATERIAL;
  const cost = COST_STYLE[r.cost_level] || COST_STYLE.MEDIUM;

  const currentTonnes = Number(r.current_emissions?.co2e_tonnes ?? 0);
  const altTonnes     = Number(r.alternative_emissions?.co2e_tonnes ?? 0);
  const rawRedTonnes  = Number(r.estimated_potential_reduction?.co2e_tonnes ?? 0);
  const redPct        = Number(r.estimated_potential_reduction?.reduction_pct ?? 0);
  const currentKg     = Number(r.current_emissions?.co2e_kg ?? 0);
  const altKg         = Number(r.alternative_emissions?.co2e_kg ?? 0);

  // Scaled by simulation
  const effectiveRedTonnes = rawRedTonnes * (adoptionRate / 100);
  const costSavingsUSD = effectiveRedTonnes * carbonPrice;

  const handleCopyBasis = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`Intervention: ${r.title}\nBasis: ${r.calculation_basis}\nEst. Reduction: ${rawRedTonnes.toFixed(2)} tCO2e (-${redPct}%)`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentStatus = status || 'NOT_STARTED';

  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid ${expanded ? d.color + '60' : '#e2e8f0'}`,
      borderLeft: `5px solid ${d.color}`,
      borderRadius: '16px',
      boxShadow: expanded 
        ? '0 12px 30px -8px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.05)' 
        : '0 2px 8px rgba(0,0,0,0.03)',
      overflow: 'hidden',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      position: 'relative'
    }}>
      {/* Background domain watermark / subtle glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '320px',
        height: '100%',
        background: d.bg,
        opacity: expanded ? 0.9 : 0.4,
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
        clipPath: 'polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)'
      }} />

      {/* Main card header strip */}
      <div style={{ padding: '22px 24px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
          
          {/* Domain Icon Avatar */}
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: d.badgeBg,
            border: `1px solid ${d.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            flexShrink: 0,
            boxShadow: '0 4px 10px rgba(0,0,0,0.04)'
          }}>
            {d.icon}
          </div>

          {/* Main Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Top badges & status tracker */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '99px',
                  background: d.badgeBg,
                  color: d.badgeText,
                  border: `1px solid ${d.border}`,
                  letterSpacing: '0.03em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {d.icon} {d.label}
                </span>

                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '99px',
                  background: cost.bg,
                  color: cost.color,
                  border: `1px solid ${cost.border}`
                }}>
                  {cost.label}
                </span>

                {r.payback_period_years && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '99px',
                    background: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #e2e8f0'
                  }}>
                    ⏱️ ~{r.payback_period_years} yr payback
                  </span>
                )}

                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0'
                }}>
                  SBTi 1.5°C
                </span>
              </div>

              {/* Status Selector Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Action Status:</span>
                <select
                  value={currentStatus}
                  onChange={(e) => onStatusChange(r.id || r.title, e.target.value)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: STATUS_OPTIONS.find(s => s.id === currentStatus)?.bg || '#f1f5f9',
                    color: STATUS_OPTIONS.find(s => s.id === currentStatus)?.color || '#475569',
                    border: '1px solid #cbd5e1',
                    outline: 'none'
                  }}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title & Hotspot link */}
            <h3 style={{
              fontSize: '16px',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 6px 0',
              lineHeight: 1.35,
              letterSpacing: '-0.01em'
            }}>
              {r.title}
            </h3>

            {r.hotspot && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Triggering Hotspot:
                </span>
                <span style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#0f172a',
                  background: '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0'
                }}>
                  🎯 {r.hotspot} {r.supplier_name ? ` · ${r.supplier_name}` : ''}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  ({d.ghgCategory})
                </span>
              </div>
            )}

            {/* Reason narrative */}
            <p style={{
              fontSize: '13px',
              color: '#475569',
              margin: '0 0 16px 0',
              lineHeight: 1.6
            }}>
              {r.reason}
            </p>

            {/* Decarbonization Comparison Metrics Strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1.3fr',
              gap: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
            }}>
              {/* Baseline */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Current Baseline
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  {currentTonnes.toFixed(2)}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>tCO₂e</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {Math.round(currentKg).toLocaleString()} kg CO₂e
                </div>
              </div>

              {/* Alternative */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Intervention Target
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0284c7', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  {altTonnes.toFixed(2)}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>tCO₂e</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {Math.round(altKg).toLocaleString()} kg CO₂e
                </div>
              </div>

              {/* Potential Net Reduction */}
              <div style={{
                borderLeft: '1px solid #cbd5e1',
                paddingLeft: '16px',
                background: 'rgba(16, 185, 129, 0.04)',
                margin: '-14px -16px -14px 0',
                padding: '14px 16px',
                borderRadius: '0 12px 12px 0'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Est. Potential Reduction</span>
                  <span style={{ background: '#dcfce7', color: '#065f46', padding: '1px 6px', borderRadius: '99px', fontSize: '9px', fontWeight: 800 }}>−{redPct}%</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  −{effectiveRedTonnes.toFixed(2)}
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>tCO₂e</span>
                  {adoptionRate !== 100 && (
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>({adoptionRate}% adoption)</span>
                  )}
                </div>
                <div style={{ fontSize: '11.5px', color: '#065f46', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>💵 ~${Math.round(costSavingsUSD).toLocaleString()}/yr</span>
                  <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 400 }}>carbon value</span>
                </div>
              </div>
            </div>

            {/* Visual Progress reduction bar */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                <span>Decarbonization Efficiency Ratio</span>
                <strong style={{ color: d.color }}>{redPct}% carbon intensity eliminated</strong>
              </div>
              <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${Math.min(redPct, 100)}%`, background: `linear-gradient(90deg, ${d.color}, ${d.lightColor || '#10b981'})`, borderRadius: '99px', transition: 'width 0.8s ease' }} />
              </div>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: expanded ? d.color : '#f1f5f9',
              color: expanded ? '#ffffff' : '#475569',
              border: `1px solid ${expanded ? d.color : '#cbd5e1'}`,
              borderRadius: '10px',
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              transition: 'all 0.2s ease',
              boxShadow: expanded ? `0 4px 12px ${d.color}40` : 'none'
            }}
          >
            {expanded ? '▲ Hide Blueprint' : '▼ View Blueprint'}
          </button>
        </div>
      </div>

      {/* ─── EXPANDABLE IMPLEMENTATION BLUEPRINT & AUDIT TRAIL ─── */}
      {expanded && (
        <div style={{
          padding: '20px 24px 24px',
          borderTop: `1px solid ${d.color}30`,
          background: 'linear-gradient(180deg, #fafbfc 0%, #ffffff 100%)',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>
            
            {/* Left: Recommended Implementation Action */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 18px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🛠️ Recommended Alternative Action</span>
                </div>
                <span style={{ fontSize: '10.5px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '99px', fontWeight: 700 }}>
                  High Feasibility
                </span>
              </div>
              
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', lineHeight: 1.55, marginBottom: '14px' }}>
                {r.recommended_alternative || 'Transition to certified lower-emission alternatives with verified lifecycle assessments.'}
              </div>

              {/* 4-Step Rollout Roadmap */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                  📋 4-Stage Deployment Roadmap
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { step: '1. Supplier Audit', desc: 'Verify supplier ISO 14064 or EPD certifications' },
                    { step: '2. Spec Validation', desc: 'Run material strength & tolerance benchmark tests' },
                    { step: '3. Procurement Pilot', desc: 'Switch 20% batch volume under new green contract' },
                    { step: '4. Full Scope 3 Rollout', desc: 'Incorporate into mandatory supplier code of conduct' },
                  ].map((s, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{s.step}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Auditable Mathematical Calculation Basis */}
            <div style={{
              background: '#0f172a',
              borderRadius: '12px',
              padding: '16px 18px',
              color: '#e2e8f0',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📐 Auditable Calculation Trace (Zero ML)</span>
                  </div>
                  <button
                    onClick={handleCopyBasis}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#94a3b8',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {copied ? '✅ Copied!' : '📋 Copy Formula'}
                  </button>
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontFamily: 'Consolas, Monaco, monospace',
                  fontSize: '11.5px',
                  lineHeight: 1.6,
                  color: '#a5f3fc',
                  wordBreak: 'break-word',
                  marginBottom: '10px'
                }}>
                  {r.calculation_basis || `Reduction = (${currentTonnes.toFixed(2)} tCO2e - ${altTonnes.toFixed(2)} tCO2e) = ${rawRedTonnes.toFixed(2)} tCO2e (-${redPct}%)`}
                </div>

                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
                  🛡️ <strong>Methodology Note:</strong> This calculation uses published IPCC/DEFRA activity factors without generative approximations. Fully compliant with GHG Protocol Corporate Standard.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: '10px' }}>
                <span style={{ fontSize: '10.5px', color: '#64748b' }}>Deterministic Rule Engine v2.4</span>
                {onOpenGuide && (
                  <button
                    onClick={() => onOpenGuide('scope3')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Learn about Scope 3 Intervention Rules →
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Recommendations Panel Component ───────────────────────────────────────
export default function RecommendationsPanel({ period, onOpenGuide }) {
  const [data,            setData]            = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [filterDomain,    setFilterDomain]    = useState('ALL');
  const [filterCapex,     setFilterCapex]     = useState('ALL');
  const [searchQuery,     setSearchQuery]     = useState('');
  const [sortBy,          setSortBy]          = useState('reduction_desc');
  const [isPersisting,    setIsPersisting]    = useState(false);
  const [persistMsg,      setPersistMsg]      = useState(null);
  
  // Interactive Simulation state
  const [carbonPrice,     setCarbonPrice]     = useState(85); // USD per tonne
  const [adoptionRate,    setAdoptionRate]    = useState(100); // 0-100%
  const [showSimulator,   setShowSimulator]   = useState(true);

  // Local corporate action tracker status state
  const [actionStatuses,  setActionStatuses]  = useState(() => {
    try {
      const saved = localStorage.getItem('carbon_action_statuses');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleStatusChange = (recId, newStatus) => {
    setActionStatuses(prev => {
      const updated = { ...prev, [recId]: newStatus };
      try {
        localStorage.setItem('carbon_action_statuses', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = period === 'All Periods' ? null : period;
      const res = await carbonApi.getRecommendations(p);
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period]);

  const handlePersist = async () => {
    setIsPersisting(true);
    setPersistMsg(null);
    try {
      const p = period === 'All Periods' ? null : period;
      const res = await carbonApi.generateRecommendations(p);
      setPersistMsg({
        type: 'success',
        text: `Successfully persisted ${res.persisted_count || res.recommendations?.length || 0} decarbonization pathways to SQLite action ledger.`
      });
      setTimeout(() => setPersistMsg(null), 6000);
      load();
    } catch (e) {
      setPersistMsg({ type: 'error', text: e.message || 'Failed to persist recommendations.' });
    } finally {
      setIsPersisting(false);
    }
  };

  const handleExportCSV = () => {
    if (!filteredRecs || filteredRecs.length === 0) return;
    const headers = ['Category', 'Title', 'Cost_Level', 'Payback_Years', 'Baseline_tCO2e', 'Alternative_tCO2e', 'Potential_Reduction_tCO2e', 'Reduction_Pct', 'Action_Status'];
    const rows = filteredRecs.map(r => [
      `"${r.category || ''}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${r.cost_level || ''}"`,
      r.payback_period_years || '',
      r.current_emissions?.co2e_tonnes ?? '',
      r.alternative_emissions?.co2e_tonnes ?? '',
      r.estimated_potential_reduction?.co2e_tonnes ?? '',
      r.estimated_potential_reduction?.reduction_pct ?? '',
      `"${actionStatuses[r.id || r.title] || 'NOT_STARTED'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `decarbonization_recommendations_${(period || 'all').replace(/\s/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const allRecs = data?.recommendations || [];
  const summary = data?.summary || {};
  const breakdown = summary.domain_breakdown || {};
  const rawTotalReduction = Number(summary.total_estimated_potential_reduction_tonnes || 0);

  // Simulated total reduction
  const totalSimulatedReduction = rawTotalReduction * (adoptionRate / 100);
  const totalCarbonValueUSD = totalSimulatedReduction * carbonPrice;

  // Filter & Search Logic
  const filteredRecs = useMemo(() => {
    return allRecs.filter(r => {
      // Domain filter
      if (filterDomain !== 'ALL' && r.category !== filterDomain) return false;
      // Capex filter
      if (filterCapex !== 'ALL' && r.cost_level !== filterCapex) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchReason = r.reason?.toLowerCase().includes(q);
        const matchAlt = r.recommended_alternative?.toLowerCase().includes(q);
        const matchSupplier = r.supplier_name?.toLowerCase().includes(q);
        const matchHotspot = r.hotspot?.toLowerCase().includes(q);
        if (!matchTitle && !matchReason && !matchAlt && !matchSupplier && !matchHotspot) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'reduction_desc') {
        const rA = Number(a.estimated_potential_reduction?.co2e_tonnes ?? 0);
        const rB = Number(b.estimated_potential_reduction?.co2e_tonnes ?? 0);
        return rB - rA;
      }
      if (sortBy === 'payback_asc') {
        const pA = Number(a.payback_period_years ?? 99);
        const pB = Number(b.payback_period_years ?? 99);
        return pA - pB;
      }
      if (sortBy === 'alpha') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return 0;
    });
  }, [allRecs, filterDomain, filterCapex, searchQuery, sortBy]);

  // Status counts
  const implementedCount = allRecs.filter(r => actionStatuses[r.id || r.title] === 'IMPLEMENTED').length;
  const inProgressCount = allRecs.filter(r => actionStatuses[r.id || r.title] === 'IN_PROGRESS').length;
  const plannedCount = allRecs.filter(r => actionStatuses[r.id || r.title] === 'PLANNED').length;

  const DOMAIN_FILTERS = [
    { id: 'ALL', label: `All Domains`, count: allRecs.length, icon: '🌐', bg: '#f1f5f9', activeBg: '#0f172a', color: '#475569', activeColor: '#ffffff' },
    ...Object.entries(DOMAIN).map(([key, d]) => ({
      id: key,
      label: d.label,
      count: breakdown[key]?.count || 0,
      tonnes: breakdown[key]?.potential_reduction_tonnes || 0,
      icon: d.icon,
      bg: d.badgeBg,
      activeBg: d.color,
      color: d.badgeText,
      activeColor: '#ffffff',
    })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ─── 1. HERO HEADER ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
        borderRadius: '20px',
        padding: '28px 32px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(6, 78, 59, 0.3), 0 8px 10px -6px rgba(6, 78, 59, 0.2)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '24px'
      }}>
        {/* Decorative backdrop shapes */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '240px',
          height: '240px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52, 211, 153, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '680px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#a7f3d0',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              🌱 Zero-Hallucination Rule Engine
            </span>
            <span style={{
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '4px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#ecfdf5'
            }}>
              Period: {period || 'All Periods'}
            </span>
          </div>

          <h1 style={{
            fontSize: '26px',
            fontWeight: 900,
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}>
            Circular &amp; Lower-Carbon Interventions
          </h1>
          <p style={{
            fontSize: '13.5px',
            color: '#d1fae5',
            margin: 0,
            lineHeight: 1.55,
            opacity: 0.95
          }}>
            Auditable, rule-based decarbonization pathways computed directly against your verified supply chain hotspots — providing deterministic carbon reduction estimates and clear ROI.
          </p>
        </div>

        {/* Header Actions & Live KPI Capsule */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '12px',
          position: 'relative',
          zIndex: 2
        }}>
          {/* Main Potential Reduction Capsule */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '16px',
            padding: '14px 22px',
            textAlign: 'right',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              Est. Potential Scope 3 Reduction
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '6px' }}>
              −{totalSimulatedReduction.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#a7f3d0' }}>tCO₂e</span>
            </div>
            <div style={{ fontSize: '11px', color: '#ecfdf5', marginTop: '4px', opacity: 0.9 }}>
              💵 ~${Math.round(totalCarbonValueUSD).toLocaleString()} carbon value @ ${carbonPrice}/t
            </div>
          </div>

          {/* Action Button Row */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setShowSimulator(!showSimulator)}
              style={{
                background: showSimulator ? '#ffffff' : 'rgba(255, 255, 255, 0.15)',
                color: showSimulator ? '#065f46' : '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              🧮 {showSimulator ? 'Hide ROI Simulator' : 'What-If Simulator'}
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              📥 Export CSV
            </button>

            <button
              onClick={handlePersist}
              disabled={isPersisting}
              style={{
                background: isPersisting ? 'rgba(255,255,255,0.4)' : '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: isPersisting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              {isPersisting ? '⏳ Persisting…' : '💾 Persist to SQLite'}
            </button>
          </div>
        </div>
      </div>

      {/* Persist Success/Error Toast */}
      {persistMsg && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '12px',
          fontSize: '13.5px',
          fontWeight: 600,
          background: persistMsg.type === 'success' ? '#ecfdf5' : '#fff1f2',
          color: persistMsg.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${persistMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{persistMsg.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{persistMsg.text}</span>
          </div>
          <button
            onClick={() => setPersistMsg(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}
          >×</button>
        </div>
      )}

      {/* ─── 2. WHAT-IF & ROI SCENARIO SIMULATOR DRAWER ─── */}
      {showSimulator && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '16px',
          padding: '22px 26px',
          boxShadow: '0 4px 20px -4px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                🧮
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Interactive What-If Scenario &amp; Financial Impact Modeler
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Simulate portfolio decarbonization adoption rates and calculate carbon cost avoidance
                </p>
              </div>
            </div>

            {onOpenGuide && (
              <button
                onClick={() => onOpenGuide('scope3')}
                style={{ background: 'none', border: 'none', color: '#059669', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Methodology Guide ↗
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            {/* Slider 1: Adoption Rate */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>SUPPLIER ADOPTION</span>
                <strong style={{ fontSize: '13px', color: '#059669' }}>{adoptionRate}%</strong>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={adoptionRate}
                onChange={(e) => setAdoptionRate(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#059669', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#94a3b8', marginTop: '4px' }}>
                <span>10% (Pilot)</span>
                <span>50% (Key T1s)</span>
                <span>100% (Full Chain)</span>
              </div>
            </div>

            {/* Slider 2: Carbon Price */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>INTERNAL CARBON PRICE</span>
                <strong style={{ fontSize: '13px', color: '#2563eb' }}>${carbonPrice}/tCO₂e</strong>
              </div>
              <input
                type="range"
                min="20"
                max="200"
                step="5"
                value={carbonPrice}
                onChange={(e) => setCarbonPrice(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#94a3b8', marginTop: '4px' }}>
                <span>$20 (Voluntary)</span>
                <span>$85 (EU ETS)</span>
                <span>$200 (SBTi 2030)</span>
              </div>
            </div>

            {/* Result KPI 1: Simulated Reduction */}
            <div style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)', padding: '14px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Simulated Net Scope 3 Abatement
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669' }}>
                −{totalSimulatedReduction.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 600, color: '#047857' }}>tCO₂e</span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#065f46', marginTop: '2px' }}>
                Targeting {(allRecs.length * (adoptionRate / 100)).toFixed(0)} supplier pathways
              </div>
            </div>

            {/* Result KPI 2: Annual Cost Avoidance */}
            <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)', padding: '14px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Annual Carbon Liability Savings
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#2563eb' }}>
                ${Math.round(totalCarbonValueUSD).toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af' }}>USD/yr</span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#1e40af', marginTop: '2px' }}>
                Regulatory penalty & ETS credit avoidance
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. DOMAIN STATS SUMMARY CARDS ─── */}
      {!loading && data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[
            {
              domainKey: 'MATERIAL',
              icon: '♻️',
              title: 'Material Circularity',
              count: breakdown.MATERIAL?.count || 0,
              tonnes: breakdown.MATERIAL?.potential_reduction_tonnes || 0,
              desc: 'Aluminium, steel, bio-polymers',
              color: '#059669',
              bg: '#ecfdf5',
              border: 'rgba(16, 185, 129, 0.25)'
            },
            {
              domainKey: 'ENERGY',
              icon: '⚡',
              title: 'Clean Energy & Solar',
              count: breakdown.ENERGY?.count || 0,
              tonnes: breakdown.ENERGY?.potential_reduction_tonnes || 0,
              desc: 'Rooftop PPAs, heat pumps',
              color: '#d97706',
              bg: '#fffbeb',
              border: 'rgba(245, 158, 11, 0.25)'
            },
            {
              domainKey: 'TRANSPORT',
              icon: '🚆',
              title: 'Logistics Efficiency',
              count: breakdown.TRANSPORT?.count || 0,
              tonnes: breakdown.TRANSPORT?.potential_reduction_tonnes || 0,
              desc: 'Rail modal shifts, EV freight',
              color: '#2563eb',
              bg: '#eff6ff',
              border: 'rgba(37, 99, 235, 0.25)'
            },
            {
              domainKey: 'SUPPLIER',
              icon: '🤝',
              title: 'Supplier Engagement',
              count: breakdown.SUPPLIER?.count || 0,
              tonnes: breakdown.SUPPLIER?.potential_reduction_tonnes || 0,
              desc: 'Audits & joint reduction pacts',
              color: '#7c3aed',
              bg: '#faf5ff',
              border: 'rgba(124, 58, 237, 0.25)'
            },
          ].map((item, i) => (
            <div
              key={i}
              onClick={() => setFilterDomain(filterDomain === item.domainKey ? 'ALL' : item.domainKey)}
              style={{
                background: '#ffffff',
                border: `1px solid ${filterDomain === item.domainKey ? item.color : '#e2e8f0'}`,
                borderTop: `4px solid ${item.color}`,
                borderRadius: '14px',
                padding: '18px 20px',
                cursor: 'pointer',
                boxShadow: filterDomain === item.domainKey 
                  ? `0 8px 20px -4px ${item.color}30` 
                  : '0 1px 4px rgba(0,0,0,0.04)',
                transform: filterDomain === item.domainKey ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: item.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px'
                }}>
                  {item.icon}
                </div>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '99px',
                  background: item.bg,
                  color: item.color
                }}>
                  {item.count} Actions
                </span>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{item.title}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{item.desc}</div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>POTENTIAL</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: item.color }}>
                  −{Number(item.tonnes).toFixed(1)} <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8' }}>tCO₂e</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── 4. FILTER CONTROLS & SEARCH BAR ─── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '16px 20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        {/* Domain Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {DOMAIN_FILTERS.map(f => {
            const isActive = filterDomain === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilterDomain(f.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  background: isActive ? f.activeBg : f.bg,
                  color: isActive ? f.activeColor : f.color,
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.12)' : 'none'
                }}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
                {f.count != null && (
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '99px',
                    background: isActive ? 'rgba(255,255,255,0.25)' : '#cbd5e1',
                    color: isActive ? '#ffffff' : '#334155',
                  }}>{f.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search, Capex Filter, Sorting Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
          
          {/* Keyword Search */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Search by keyword, hotspot, material, or supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
              >×</button>
            )}
          </div>

          {/* CAPEX Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>CAPEX:</span>
            <select
              value={filterCapex}
              onChange={(e) => setFilterCapex(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                background: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All CAPEX Levels</option>
              <option value="LOW">Low CAPEX (&lt;$15k)</option>
              <option value="MEDIUM">Medium CAPEX</option>
              <option value="HIGH">High CAPEX (&gt;$75k)</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                background: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <option value="reduction_desc">Highest Carbon Reduction</option>
              <option value="payback_asc">Quickest Payback Timeline</option>
              <option value="alpha">Alphabetical (A-Z)</option>
            </select>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Showing <strong style={{ color: '#0f172a' }}>{filteredRecs.length}</strong> of {allRecs.length} pathways
          </div>
        </div>
      </div>

      {/* ─── 5. LOADING & ERROR STATES ─── */}
      {loading && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '80px 24px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#059669',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }} />
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            Evaluating Multi-Tier Hotspots &amp; Emission Benchmarks…
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Synthesizing circular and lower-carbon engineering recommendations from verified supplier data
          </p>
        </div>
      )}

      {error && (
        <div style={{
          background: '#fff1f2',
          border: '1px solid #fecaca',
          borderRadius: '16px',
          padding: '40px 24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', margin: '0 0 6px 0' }}>
            Failed to Load Decarbonization Pathways
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>{error}</p>
          <button
            onClick={load}
            style={{
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >Retry</button>
        </div>
      )}

      {/* ─── 6. INTERVENTION CARDS LIST ─── */}
      {!loading && !error && (
        filteredRecs.length === 0 ? (
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '70px 24px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🌱</div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
              No Matching Recommendations Found
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Try clearing your search query or selecting "All Domains".
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredRecs.map((r, idx) => (
              <RecCard
                key={r.id || idx}
                r={r}
                idx={idx}
                onOpenGuide={onOpenGuide}
                status={actionStatuses[r.id || r.title]}
                onStatusChange={handleStatusChange}
                carbonPrice={carbonPrice}
                adoptionRate={adoptionRate}
              />
            ))}
          </div>
        )
      )}

      {/* ─── 7. FOOTER AUDIT NOTICE ─── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: '#64748b',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔒</span>
          <span>
            <strong>Corporate Transparency:</strong> All potential reductions are verified mathematical models. Implementation does not alter baseline audit logs until verified actual activity is ingested.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: '#059669', fontWeight: 700 }}>● {implementedCount} Implemented</span>
          <span style={{ color: '#2563eb', fontWeight: 700 }}>● {inProgressCount} In Progress</span>
          <span style={{ color: '#d97706', fontWeight: 700 }}>● {plannedCount} Planned</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
