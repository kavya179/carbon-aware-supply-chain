import React, { useState, useEffect } from 'react';
import { carbonApi } from '../services/api';

const DOMAIN_STYLES = {
  MATERIAL: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    badgeBg: '#059669',
    badgeText: '#ecfdf5',
    icon: '♻️',
    label: 'Material Circularity'
  },
  ENERGY: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    badgeBg: '#d97706',
    badgeText: '#fffbeb',
    icon: '⚡',
    label: 'Renewable Energy'
  },
  TRANSPORT: {
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.3)',
    badgeBg: '#2563eb',
    badgeText: '#eff6ff',
    icon: '🚆',
    label: 'Logistics & Transport'
  },
  SUPPLIER: {
    bg: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.3)',
    badgeBg: '#7c3aed',
    badgeText: '#f5f3ff',
    icon: '🤝',
    label: 'Supplier Engagement'
  }
};

export default function RecommendationsPanel({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterDomain, setFilterDomain] = useState('ALL');
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistMessage, setPersistMessage] = useState(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = period === 'All Periods' ? null : period;
      const res = await carbonApi.getRecommendations(p);
      setData(res);
    } catch (err) {
      console.error('[RECS FETCH ERROR]', err);
      setError(err.message || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [period]);

  const handlePersist = async () => {
    setIsPersisting(true);
    setPersistMessage(null);
    try {
      const p = period === 'All Periods' ? null : period;
      const res = await carbonApi.generateRecommendations(p);
      setPersistMessage(`Successfully saved ${res.persisted_count} recommendations to SQLite database!`);
      setTimeout(() => setPersistMessage(null), 5000);
    } catch (err) {
      console.error('[PERSIST ERROR]', err);
      setPersistMessage(`Error saving: ${err.message}`);
    } finally {
      setIsPersisting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
        <p>Evaluating actual supply chain hotspots and generating rule-based recommendations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', color: '#fca5a5' }}>
        <h4 style={{ margin: '0 0 8px', color: '#ef4444' }}>Unable to Load Decarbonization Recommendations</h4>
        <p style={{ margin: '0 0 16px', fontSize: '0.9rem' }}>{error}</p>
        <button onClick={fetchRecommendations} className="btn-secondary" style={{ padding: '8px 16px' }}>Retry</button>
      </div>
    );
  }

  const allRecs = data?.recommendations || [];
  const filteredRecs = filterDomain === 'ALL'
    ? allRecs
    : allRecs.filter(r => r.category === filterDomain);

  const summary = data?.summary || {};
  const totalReductionTonnes = summary.total_estimated_potential_reduction_tonnes || 0;
  const breakdown = summary.domain_breakdown || {};

  return (
    <div className="recommendations-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Disclaimer and Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{ maxWidth: '750px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🌱</span>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f1f5f9' }}>
              Circular & Lower-Carbon Decarbonization Engine
            </h3>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
              background: '#047857',
              color: '#d1fae5',
              letterSpacing: '0.05em'
            }}>
              RULE-BASED (ZERO ML)
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
            <strong style={{ color: '#e2e8f0' }}>Important Notice: </strong>
            All emission reductions are strictly labeled as <strong style={{ color: '#38bdf8' }}>estimated potential reductions</strong>,
            derived from identified activity hotspots and verified emission factor variance benchmarks. Reductions are not guaranteed.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '1px solid rgba(148, 163, 184, 0.15)',
            textAlign: 'right'
          }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
              Total Est. Potential Reduction
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#10b981' }}>
              {totalReductionTonnes.toLocaleString()} <span style={{ fontSize: '0.85rem' }}>tCO₂e</span>
            </div>
          </div>

          <button
            onClick={handlePersist}
            disabled={isPersisting}
            className="btn-primary"
            style={{
              padding: '12px 20px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: isPersisting ? '#475569' : '#059669',
              borderColor: '#10b981'
            }}
          >
            <span>{isPersisting ? '⏳' : '💾'}</span>
            <span>{isPersisting ? 'Saving to Database...' : 'Persist to SQLite'}</span>
          </button>
        </div>
      </div>

      {persistMessage && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          background: persistMessage.includes('Error') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${persistMessage.includes('Error') ? '#ef4444' : '#10b981'}`,
          color: persistMessage.includes('Error') ? '#fca5a5' : '#86efac',
          fontSize: '0.88rem'
        }}>
          {persistMessage}
        </div>
      )}

      {/* Domain Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setFilterDomain('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: filterDomain === 'ALL' ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)',
            background: filterDomain === 'ALL' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.5)',
            color: filterDomain === 'ALL' ? '#38bdf8' : '#94a3b8',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          All Domains ({allRecs.length})
        </button>

        {Object.entries(DOMAIN_STYLES).map(([key, style]) => {
          const count = breakdown[key]?.count || 0;
          const potTonnes = breakdown[key]?.potential_reduction_tonnes || 0;
          const isActive = filterDomain === key;
          return (
            <button
              key={key}
              onClick={() => setFilterDomain(key)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isActive ? style.badgeBg : 'rgba(148, 163, 184, 0.2)',
                background: isActive ? style.bg : 'rgba(30, 41, 59, 0.5)',
                color: isActive ? '#f8fafc' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{style.icon}</span>
              <span>{style.label}</span>
              <span style={{
                fontSize: '0.75rem',
                padding: '1px 6px',
                borderRadius: '10px',
                background: isActive ? style.badgeBg : 'rgba(148, 163, 184, 0.2)',
                color: isActive ? style.badgeText : '#cbd5e1'
              }}>
                {count} ({potTonnes.toLocaleString()} t)
              </span>
            </button>
          );
        })}
      </div>

      {/* Recommendations Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(540px, 1fr))', gap: '20px' }}>
        {filteredRecs.map((r, i) => {
          const style = DOMAIN_STYLES[r.category] || DOMAIN_STYLES.MATERIAL;
          const currentKg = r.current_emissions.co2e_kg;
          const currentTonnes = r.current_emissions.co2e_tonnes;
          const altKg = r.alternative_emissions.co2e_kg;
          const altTonnes = r.alternative_emissions.co2e_tonnes;
          const redKg = r.estimated_potential_reduction.co2e_kg;
          const redTonnes = r.estimated_potential_reduction.co2e_tonnes;
          const redPct = r.estimated_potential_reduction.reduction_pct;

          return (
            <div
              key={i}
              className="glass-card"
              style={{
                border: `1px solid ${style.border}`,
                borderRadius: '14px',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                background: 'rgba(30, 41, 59, 0.65)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.3rem' }}>{style.icon}</span>
                  <div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: style.badgeBg,
                      color: style.badgeText,
                      marginRight: '8px'
                    }}>
                      {r.category}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {r.action_type.replace(/_/g, ' ')}
                    </span>
                    <h4 style={{ margin: '6px 0 0', fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                      {r.title}
                    </h4>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: r.cost_level === 'LOW' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: r.cost_level === 'LOW' ? '#34d399' : '#fbbf24',
                    border: `1px solid ${r.cost_level === 'LOW' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                  }}>
                    {r.cost_level} CAPEX
                  </span>
                </div>
              </div>

              {/* Hotspot Anchor */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                borderLeft: '3px solid #38bdf8',
                padding: '8px 12px',
                borderRadius: '0 8px 8px 0',
                fontSize: '0.82rem',
                color: '#cbd5e1'
              }}>
                <strong style={{ color: '#38bdf8' }}>Triggering Hotspot: </strong>
                {r.hotspot} ({r.supplier_name})
              </div>

              {/* Reason */}
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.45 }}>
                {r.reason}
              </div>

              {/* Recommended Alternative Detail */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.84rem'
              }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                  Recommended Alternative Action
                </div>
                <div style={{ color: '#e2e8f0', fontWeight: 500 }}>
                  {r.recommended_alternative}
                </div>
              </div>

              {/* Emissions Comparison & Potential Reduction Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1.2fr',
                gap: '10px',
                background: 'rgba(15, 23, 42, 0.7)',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid rgba(148, 163, 184, 0.1)'
              }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Current Baseline</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ef4444' }}>
                    {currentTonnes.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '0.75rem' }}>tCO₂e</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {Math.round(currentKg).toLocaleString()} kg
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Alternative Footprint</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8' }}>
                    {altTonnes.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '0.75rem' }}>tCO₂e</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {Math.round(altKg).toLocaleString()} kg
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid rgba(148, 163, 184, 0.15)', paddingLeft: '12px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#10b981', textTransform: 'uppercase', fontWeight: 700 }}>
                    Est. Potential Reduction
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>
                    -{redTonnes.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '0.75rem' }}>tCO₂e</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
                    -{redPct}% potential reduction
                  </div>
                </div>
              </div>

              {/* Calculation Basis (Auditable Rule) */}
              <div style={{
                background: 'rgba(2, 6, 23, 0.6)',
                border: '1px dashed rgba(148, 163, 184, 0.2)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.76rem',
                color: '#94a3b8',
                fontFamily: 'monospace',
                lineHeight: 1.4
              }}>
                <strong style={{ color: '#cbd5e1' }}>Calculation Basis: </strong>
                {r.calculation_basis}
              </div>

              {/* Footer Meta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', paddingTop: '4px' }}>
                <span>Payback Horizon: ~{r.payback_period_years} years</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>Status: PROPOSED</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
