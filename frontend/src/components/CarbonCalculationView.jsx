import React, { useState, useEffect } from 'react';
import { carbonApi } from '../services/api';

const ACT_COLORS = {
  MATERIAL:    { bg: '#faf5ff', color: '#7c3aed', border: 'rgba(124,58,237,0.2)', icon: '📦' },
  ELECTRICITY: { bg: '#ecfeff', color: '#0891b2', border: 'rgba(8,145,178,0.2)',  icon: '⚡' },
  FUEL:        { bg: '#fff7ed', color: '#ea580c', border: 'rgba(234,88,12,0.2)',  icon: '🔥' },
  TRANSPORT:   { bg: '#f0fdf4', color: '#0f766e', border: 'rgba(15,118,110,0.2)', icon: '🚚' },
  OTHER:       { bg: '#f8fafc', color: '#475569', border: 'rgba(71,85,105,0.2)',  icon: '⚙️' },
};

const STATUS_STYLE = {
  VERIFIED:   { bg: '#ecfdf5', color: '#059669' },
  CALCULATED: { bg: '#ecfdf5', color: '#059669' },
  ML_ESTIMATED: { bg: '#fffbeb', color: '#d97706' },
  PENDING:    { bg: '#f8fafc', color: '#94a3b8' },
};

function getActKey(str = '') {
  const s = str.toUpperCase();
  if (s.includes('MATERIAL') || s.includes('ALUMIN') || s.includes('STEEL') || s.includes('COPPER') || s.includes('LITHIUM') || s.includes('GOODS')) return 'MATERIAL';
  if (s.includes('ELECTRIC') || s.includes('KWH'))  return 'ELECTRICITY';
  if (s.includes('FUEL') || s.includes('DIESEL') || s.includes('PETROL') || s.includes('GAS'))   return 'FUEL';
  if (s.includes('TRANSPORT') || s.includes('FREIGHT') || s.includes('ROAD') || s.includes('SEA') || s.includes('AIR')) return 'TRANSPORT';
  return 'OTHER';
}

// ── Summary KPI strip built from traces ──────────────────────
function CalcSummaryStrip({ traces }) {
  const total = traces.reduce((s, t) => s + (Number(t.co2e_tonnes ?? (t.co2e_kg / 1000)) || 0), 0);
  const verified = traces.filter(t => (t.status || 'VERIFIED').includes('VERIF') || (t.status || '').includes('CALC')).length;
  const ml = traces.filter(t => (t.status || '').includes('ML')).length;

  // By category
  const byCategory = {};
  traces.forEach(t => {
    const k = getActKey(t.activity_type || t.activity_category || '');
    byCategory[k] = (byCategory[k] || 0) + (Number(t.co2e_tonnes ?? (t.co2e_kg / 1000)) || 0);
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
      {[
        { label: 'Total Calculated CO₂e', value: total.toFixed(2), unit: 'tCO₂e', icon: '🧮', bg: '#ecfdf5', ac: '#065f46', sub: `${traces.length} trace records` },
        { label: 'Verified Records',      value: verified,          unit: null,     icon: '✅', bg: '#eff6ff', ac: '#1e40af', sub: 'Deterministic engine' },
        { label: 'Materials Footprint',   value: (byCategory.MATERIAL||0).toFixed(1),    unit: 'tCO₂e', icon: '📦', bg: '#faf5ff', ac: '#7c3aed', sub: 'Scope 3 Cat. 1' },
        { label: 'Energy Footprint',      value: ((byCategory.ELECTRICITY||0)+(byCategory.FUEL||0)).toFixed(1), unit: 'tCO₂e', icon: '⚡', bg: '#ecfeff', ac: '#0891b2', sub: 'Electricity + Fuel' },
        { label: 'ML Estimated',          value: ml,                unit: null,     icon: '🤖', bg: '#fffbeb', ac: '#d97706', sub: 'Gap-filled records' },
      ].map((s, i) => (
        <div key={i} style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
          padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>
            {s.icon}
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: s.ac, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {s.value}{s.unit && <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8', marginLeft: '4px' }}>{s.unit}</span>}
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{s.label}</div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '1px' }}>{s.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Formula row expander ──────────────────────────────────────
function CalcRow({ calc, idx }) {
  const [expanded, setExpanded] = useState(false);

  const actKey = getActKey(calc.activity_type || calc.activity_category || '');
  const act    = ACT_COLORS[actKey] || ACT_COLORS.OTHER;
  const status = calc.status || 'VERIFIED';
  const st     = STATUS_STYLE[status] || STATUS_STYLE.VERIFIED;

  const tonnes  = Number(calc.co2e_tonnes ?? ((calc.co2e_kg || 0) / 1000) ?? 0);
  const kg      = Number(calc.co2e_kg ?? (tonnes * 1000) ?? 0);
  const qty     = calc.input_value ?? calc.quantity ?? '—';
  const unit    = calc.unit || '';
  const factor  = calc.emission_factor_value ?? calc.factor_value ?? '—';
  const formula = calc.formula || `${qty} ${unit} × ${factor} kg CO₂e/${unit} = ${kg.toFixed(2)} kg CO₂e`;

  return (
    <>
      <tr
        style={{ borderBottom: expanded ? 'none' : '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.1s' }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Expand toggle */}
        <td style={{ padding: '13px 14px', width: '36px' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', flexShrink: 0 }}>
            {expanded ? '▼' : '▶'}
          </div>
        </td>

        {/* Supplier */}
        <td style={{ padding: '13px 14px', verticalAlign: 'middle' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
            {calc.supplier_name || calc.supplier || 'Unknown Supplier'}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
            {calc.supplier_code || `#${calc.id || idx + 1}`}
          </div>
        </td>

        {/* Activity */}
        <td style={{ padding: '13px 14px', verticalAlign: 'middle' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '11.5px', fontWeight: 700, padding: '3px 10px',
            borderRadius: '99px', background: act.bg, color: act.color,
            border: `1px solid ${act.border}`,
          }}>
            <span>{act.icon}</span>
            {calc.activity_type || actKey}
          </span>
          {calc.activity_category && calc.activity_category !== calc.activity_type && (
            <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '3px' }}>{calc.activity_category}</div>
          )}
        </td>

        {/* Formula preview */}
        <td style={{ padding: '13px 14px', verticalAlign: 'middle', maxWidth: '320px' }}>
          <code style={{
            display: 'block', fontSize: '11.5px', fontFamily: 'Consolas, monospace',
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: '7px', padding: '6px 10px',
            color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={formula}>{formula}</code>
        </td>

        {/* Result */}
        <td style={{ padding: '13px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {tonnes.toFixed(3)}
            <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8', marginLeft: '4px' }}>tCO₂e</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            {kg > 0 ? kg.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'} kg
          </div>
        </td>

        {/* Status */}
        <td style={{ padding: '13px 14px', verticalAlign: 'middle' }}>
          <span style={{
            fontSize: '10.5px', fontWeight: 700, padding: '3px 9px',
            borderRadius: '99px', background: st.bg, color: st.color,
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>
            {status.includes('ML') ? '🤖' : '✓'} {status}
          </span>
          {calc.reporting_period && (
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>{calc.reporting_period}</div>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
          <td colSpan={6} style={{ padding: '0 14px 16px 50px', background: '#fafbfc' }}>
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: '10px', padding: '16px 20px',
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px',
            }}>
              {[
                { label: 'Input Quantity',      value: `${qty} ${unit}` },
                { label: 'Emission Factor',     value: factor !== '—' ? `${factor} kg CO₂e/${unit}` : '—' },
                { label: 'Source / Standard',   value: calc.emission_factor_source || calc.factor_source || 'DEFRA 2023 / EPA' },
                { label: 'Full Formula',        value: formula, mono: true },
              ].map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{m.label}</div>
                  <div style={{ fontSize: m.mono ? '11.5px' : '13px', fontWeight: 700, color: '#0f172a', fontFamily: m.mono ? 'Consolas, monospace' : 'inherit', lineHeight: 1.4, wordBreak: 'break-all' }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Methodology explainer panel ───────────────────────────────
function MethodologyPanel() {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
      padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
        🧮 Deterministic Calculation Methodology
      </h3>
      <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 20px 0' }}>
        Rule-based, auditable, zero-hallucination — every CO₂e value is derived from a transparent formula.
      </p>

      {/* Core formula */}
      <div style={{
        background: '#0f172a', borderRadius: '12px', padding: '20px 24px',
        marginBottom: '20px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.05em', marginBottom: '10px' }}>CORE FORMULA</div>
        <code style={{ fontSize: '18px', fontWeight: 800, color: '#7dd3fc', fontFamily: 'Consolas, monospace', letterSpacing: '-0.01em' }}>
          CO₂e (kg) = Activity Quantity × Emission Factor
        </code>
        <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#94a3b8' }}>
          Then: tCO₂e = CO₂e (kg) ÷ 1,000 &nbsp;·&nbsp; Scope 3 Aggregation = Σ tCO₂e (all suppliers, all tiers)
        </div>
      </div>

      {/* 4 category method cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
        {[
          {
            icon: '📦', title: 'Purchased Materials (Cat. 1)',
            color: '#7c3aed', bg: '#faf5ff', border: 'rgba(124,58,237,0.15)',
            formula: 'Mass (kg) × Material EF (kg CO₂e/kg)',
            source: 'DEFRA 2023 Material Emission Factors',
            example: '20,000 kg Al × 8.24 kg CO₂e/kg = 164,800 kg CO₂e',
          },
          {
            icon: '⚡', title: 'Purchased Electricity (Cat. 3)',
            color: '#0891b2', bg: '#ecfeff', border: 'rgba(8,145,178,0.15)',
            formula: 'Energy (kWh) × Grid Intensity (kg CO₂e/kWh)',
            source: 'IEA Grid Emission Factors by country',
            example: '1,450,000 kWh × 0.582 kg CO₂e/kWh = 844,100 kg CO₂e',
          },
          {
            icon: '🔥', title: 'Upstream Fuel & Energy (Cat. 3)',
            color: '#ea580c', bg: '#fff7ed', border: 'rgba(234,88,12,0.15)',
            formula: 'Volume (litre) × Fuel EF (kg CO₂e/litre)',
            source: 'EPA 2023 Stationary Combustion Factors',
            example: '45,000 L diesel × 2.617 kg CO₂e/L = 117,765 kg CO₂e',
          },
          {
            icon: '🚚', title: 'Freight & Logistics (Cat. 4)',
            color: '#0f766e', bg: '#f0fdf4', border: 'rgba(15,118,110,0.15)',
            formula: 'Mass (t) × Distance (km) × Mode EF',
            source: 'DEFRA 2023 Freight Emission Factors',
            example: '5 t × 3,701 km × 0.0062 kg CO₂e/t·km = 114.7 kg CO₂e',
          },
        ].map((m, i) => (
          <div key={i} style={{
            background: m.bg, border: `1px solid ${m.border}`,
            borderRadius: '12px', padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>{m.icon}</span>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: m.color }}>{m.title}</span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Formula</div>
              <code style={{ fontSize: '11.5px', color: '#0f172a', fontFamily: 'Consolas, monospace', fontWeight: 600 }}>{m.formula}</code>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Standard Source</div>
              <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>{m.source}</div>
            </div>
            <div style={{ background: '#ffffff', borderRadius: '7px', padding: '8px 10px', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Example</div>
              <code style={{ fontSize: '11px', color: m.color, fontFamily: 'Consolas, monospace' }}>{m.example}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function CarbonCalculationView({ period, onOpenGuide }) {
  const [traces, setTraces]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAct, setFilterAct] = useState('ALL');
  const [activeTab, setActiveTab] = useState('traces'); // 'traces' | 'methodology'

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await carbonApi.getCalculationTraces(period === 'All Periods' ? null : period);
        setTraces(Array.isArray(res) ? res : (res?.calculations || res?.traces || []));
      } catch (err) {
        console.error('Calculation traces load failed', err);
        setTraces([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [period]);

  const ACT_FILTERS = ['ALL', 'MATERIAL', 'ELECTRICITY', 'FUEL', 'TRANSPORT', 'OTHER'];

  const filtered = traces.filter(t => {
    const actKey = getActKey(t.activity_type || t.activity_category || '');
    const matchAct = filterAct === 'ALL' || actKey === filterAct;
    if (!searchTerm) return matchAct;
    const q = searchTerm.toLowerCase();
    const matchSearch = (t.supplier_name || '').toLowerCase().includes(q)
      || (t.activity_type || '').toLowerCase().includes(q)
      || (t.formula || '').toLowerCase().includes(q)
      || (t.supplier_code || '').toLowerCase().includes(q);
    return matchAct && matchSearch;
  });

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
            Deterministic Carbon Calculation Engine
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Auditable formula traces matching supplier activities to DEFRA / EPA emission factors — zero AI hallucination
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#ecfdf5', color: '#065f46', borderRadius: '99px', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            Rule-Based Engine
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#eff6ff', color: '#2563eb', borderRadius: '99px', border: '1px solid rgba(37,99,235,0.2)' }}>
            GHG Protocol Scope 3
          </span>
        </div>
      </div>

      {/* ─── KPI STRIP ─── */}
      {!loading && <CalcSummaryStrip traces={traces} />}

      {/* ─── TABS ─── */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[
          { id: 'traces',      label: `📋 Calculation Traces (${traces.length})` },
          { id: 'methodology', label: '🧮 Methodology & Formulas' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '8px 16px', borderRadius: '9px', border: 'none',
            fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
            background: activeTab === t.id ? '#0f172a' : '#f1f5f9',
            color:      activeTab === t.id ? '#ffffff'  : '#64748b',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─── TAB 1: TRACES TABLE ─── */}
      {activeTab === 'traces' && (
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
        }}>
          {/* Filters bar */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            background: '#fafbfc',
          }}>
            {/* Category filters */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {ACT_FILTERS.map(f => {
                const isActive = filterAct === f;
                const act = ACT_COLORS[f];
                return (
                  <button key={f} onClick={() => setFilterAct(f)} style={{
                    padding: '5px 12px', borderRadius: '7px', border: 'none',
                    fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                    background: isActive ? (act ? act.color : '#0f172a') : '#f1f5f9',
                    color:      isActive ? '#ffffff' : '#64748b',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    transition: 'all 0.15s',
                  }}>
                    {act?.icon} {f}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '7px 12px', flex: 1, minWidth: '200px', maxWidth: '320px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>🔍</span>
              <input
                type="text"
                placeholder="Search supplier, activity, formula…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12.5px', color: '#0f172a', width: '100%' }}
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px', padding: 0 }}>✕</button>}
            </div>

            <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8' }}>
              Showing <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> of {traces.length} records
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafbfc' }}>
                  <th style={{ width: '36px', padding: '11px 14px' }} />
                  {['Supplier Entity', 'Activity Type', 'Mathematical Formula Trace', 'Calculated CO₂e', 'Status'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#065f46', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Loading deterministic calculation records…</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>No Matching Records</div>
                      <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>Try adjusting your search or category filter.</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((calc, idx) => <CalcRow key={calc.id || idx} calc={calc} idx={idx} />)
                )}
              </tbody>
            </table>
          </div>

          {/* Footer total */}
          {!loading && filtered.length > 0 && (
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px',
              background: '#fafbfc',
            }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Filtered Total:</span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#065f46' }}>
                {filtered.reduce((s, t) => s + (Number(t.co2e_tonnes ?? ((t.co2e_kg || 0) / 1000)) || 0), 0).toFixed(3)} tCO₂e
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>across {filtered.length} records</span>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: METHODOLOGY ─── */}
      {activeTab === 'methodology' && <MethodologyPanel />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
