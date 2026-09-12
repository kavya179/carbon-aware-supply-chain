import React, { useState, useEffect, useCallback } from 'react';
import { carbonApi } from '../services/api';

const VALUE_TYPE_COLORS = {
  CALCULATED: { bg: '#dcfce7', color: '#059669', border: 'rgba(5,150,105,0.25)', label: 'CALCULATED' },
  ESTIMATED_POTENTIAL: { bg: '#fef3c7', color: '#d97706', border: 'rgba(217,119,6,0.25)', label: 'ESTIMATED POTENTIAL' },
  ESTIMATED: { bg: '#fef3c7', color: '#d97706', border: 'rgba(217,119,6,0.25)', label: 'ESTIMATED' },
  DATA: { bg: '#dbeafe', color: '#2563eb', border: 'rgba(37,99,235,0.2)', label: 'DATA' },
};

const IMPACT_COLORS = {
  HIGH: { bg: '#fee2e2', color: '#dc2626', border: 'rgba(220,38,38,0.25)' },
  MEDIUM: { bg: '#fef3c7', color: '#d97706', border: 'rgba(217,119,6,0.25)' },
  LOW: { bg: '#dbeafe', color: '#2563eb', border: 'rgba(37,99,235,0.2)' },
};

const DOMAIN_META = {
  MATERIAL: { icon: '♻️', color: '#059669', bg: '#dcfce7' },
  TRANSPORT: { icon: '🚆', color: '#2563eb', bg: '#dbeafe' },
  ENERGY: { icon: '⚡', color: '#d97706', bg: '#fef3c7' },
  SUPPLIER: { icon: '🤝', color: '#7c3aed', bg: '#ede9fe' },
};

function ValueTypeBadge({ type }) {
  const cfg = VALUE_TYPE_COLORS[type] || VALUE_TYPE_COLORS.DATA;
  return (
    <span style={{
      display: 'inline-block', fontSize: '9px', fontWeight: 800,
      padding: '2px 6px', borderRadius: '6px',
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function SectionCard({ icon, title, children, accent = '#059669' }) {
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid rgba(16,185,129,0.12)`,
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      marginBottom: '20px',
    }}>
      <div style={{
        padding: '14px 22px',
        borderBottom: '1px solid rgba(16,185,129,0.1)',
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'linear-gradient(90deg, rgba(16,185,129,0.04) 0%, transparent 100%)',
      }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f2017', letterSpacing: '-0.02em' }}>
          {title}
        </h3>
      </div>
      <div style={{ padding: '20px 22px' }}>
        {children}
      </div>
    </div>
  );
}

function KPIBox({ label, value, unit, valueType, color = '#0f2017' }) {
  return (
    <div style={{
      background: '#f4faf6',
      border: '1.5px solid rgba(16,185,129,0.1)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: '#5a8a6a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: '11px', color: '#5a8a6a', fontWeight: 600 }}>{unit}</span>}
      </div>
      {valueType && <ValueTypeBadge type={valueType} />}
    </div>
  );
}

export default function ReportingPanel({ period }) {
  const [reportData, setReportData] = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [genMessage, setGenMessage] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

  const resolvedPeriod = period === 'All Periods' ? null : period;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, saved] = await Promise.all([
        carbonApi.getReportData(resolvedPeriod),
        carbonApi.listReports(),
      ]);
      setReportData(data);
      setSavedReports(saved.reports || []);
    } catch (err) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [resolvedPeriod]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMessage(null);
    try {
      const res = await carbonApi.generateReport(resolvedPeriod);
      setReportData(res.report);
      setGenMessage({ type: 'success', text: `Report generated and saved to SQLite (ID: ${res.report?.report_metadata?.report_id || '—'})` });
      // Refresh saved list
      const saved = await carbonApi.listReports();
      setSavedReports(saved.reports || []);
    } catch (err) {
      setGenMessage({ type: 'error', text: err.message });
    } finally {
      setGenerating(false);
      setTimeout(() => setGenMessage(null), 6000);
    }
  };

  const handleDownloadPDF = () => {
    setDownloading(true);
    const url = carbonApi.getReportPDFUrl(resolvedPeriod);
    // Trigger browser download
    const a = document.createElement('a');
    a.href = url;
    a.download = `scope3_report_${(resolvedPeriod || 'all').replace(/\s/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 2000);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <div className="loading-text">Building Report</div>
        <div className="loading-sub">Aggregating emissions data across Tier 1, 2 & 3 supply chain…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-card">
        <div className="error-icon">📄</div>
        <div className="error-title">Report Generation Error</div>
        <div className="error-desc">{error}</div>
        <button className="btn btn-primary" onClick={fetchData}>Retry</button>
      </div>
    );
  }

  if (!reportData) return null;

  const meta = reportData.report_metadata;
  const summary = reportData.summary;
  const tiers = reportData.tier_breakdown || [];
  const suppliers = reportData.top_suppliers || [];
  const activities = reportData.activity_breakdown || [];
  const hotspots = reportData.hotspots || { counts: {}, items: [] };
  const recs = reportData.recommendations || { total_potential_reduction_tonnes: 0, items: [] };
  const verif = reportData.verification_status || {};

  const SECTIONS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'tiers', label: 'Tier Breakdown', icon: '🏗️' },
    { id: 'suppliers', label: 'Top Suppliers', icon: '🏭' },
    { id: 'activities', label: 'Activities', icon: '⚙️' },
    { id: 'hotspots', label: 'Hotspots', icon: '🔥' },
    { id: 'recommendations', label: 'Recommendations', icon: '🌱' },
    { id: 'verification', label: 'Verification', icon: '🛡️' },
    { id: 'saved', label: 'Saved Reports', icon: '📁' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header Banner ─────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        border: '1.5px solid rgba(5,150,105,0.2)',
        borderRadius: '16px',
        padding: '22px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 2px 16px rgba(5,150,105,0.08)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1.5rem' }}>📋</span>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0f2017', letterSpacing: '-0.03em' }}>
              Scope 3 Carbon Emissions Report
            </h2>
            <span style={{
              fontSize: '9.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '8px',
              background: '#d1fae5', color: '#059669', border: '1px solid rgba(5,150,105,0.3)',
              letterSpacing: '0.06em',
            }}>GHG PROTOCOL SCOPE 3</span>
          </div>
          <div style={{ fontSize: '12.5px', color: '#5a8a6a' }}>
            <strong style={{ color: '#059669' }}>{meta.company_name}</strong>
            &nbsp;·&nbsp;Reporting Year {meta.reporting_year}
            &nbsp;·&nbsp;Period: <strong style={{ color: '#0f2017' }}>{meta.reporting_period}</strong>
            &nbsp;·&nbsp;Generated: {meta.generated_at?.slice(0, 19).replace('T', ' ')}
          </div>
          <div style={{
            marginTop: '10px', fontSize: '11px', color: '#5a8a6a',
            background: 'rgba(255,255,255,0.7)', padding: '8px 12px',
            borderRadius: '8px', border: '1px solid rgba(5,150,105,0.12)',
            lineHeight: 1.5, maxWidth: '720px',
          }}>
            ⚠️ <strong>Disclaimer:</strong> {meta.disclaimer}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-primary"
            style={{ fontSize: '13px', padding: '10px 20px' }}
          >
            {generating ? '⏳ Generating…' : '⚡ Generate & Save Report'}
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="btn btn-secondary"
            style={{ fontSize: '13px', padding: '10px 20px' }}
          >
            {downloading ? '⏳ Preparing PDF…' : '📥 Download PDF'}
          </button>
          <div style={{ fontSize: '10.5px', color: '#9dc4a8', textAlign: 'right' }}>
            Report saved to SQLite · ReportLab PDF
          </div>
        </div>
      </div>

      {/* Gen message */}
      {genMessage && (
        <div style={{
          padding: '10px 16px', borderRadius: '10px', fontSize: '13px',
          background: genMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: genMessage.type === 'success' ? '#059669' : '#dc2626',
          border: `1px solid ${genMessage.type === 'success' ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}`,
        }}>
          {genMessage.type === 'success' ? '✅' : '❌'} {genMessage.text}
        </div>
      )}

      {/* ── Section Tab Nav ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '4px', flexWrap: 'wrap',
        background: '#fff', border: '1.5px solid rgba(16,185,129,0.12)',
        borderRadius: '12px', padding: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              padding: '7px 13px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: activeSection === s.id ? '#059669' : 'transparent',
              color: activeSection === s.id ? '#fff' : '#5a8a6a',
              fontWeight: activeSection === s.id ? 700 : 500,
              fontSize: '12px', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      {activeSection === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <KPIBox label="Total Scope 3 Emissions" value={summary.total_co2e_tonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} unit="tCO₂e" valueType="CALCULATED" color="#0f2017" />
            <KPIBox label="Total (kg CO₂e)" value={summary.total_co2e_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} unit="kg" valueType="CALCULATED" />
            <KPIBox label="Suppliers Tracked" value={summary.total_suppliers} unit="entities" valueType="DATA" color="#2563eb" />
            <KPIBox label="Calculation Records" value={summary.total_calculations} unit="records" valueType="DATA" color="#7c3aed" />
            <KPIBox label="Potential Reduction" value={summary.potential_reduction_tonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} unit={`tCO₂e (~${summary.potential_reduction_pct}%)`} valueType="ESTIMATED_POTENTIAL" color="#d97706" />
          </div>

          {/* Tier Summary Bar */}
          <SectionCard icon="🏗️" title="Emissions by Tier — Visual Summary">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tiers.map(t => (
                <div key={t.tier}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 700, color: '#0f2017' }}>Tier {t.tier} — {['Direct Suppliers', 'Sub-Contractors', 'Raw Materials / Mining'][t.tier - 1]}</span>
                    <span style={{ color: '#5a8a6a' }}>
                      <strong style={{ color: '#0f2017', fontFamily: 'Outfit, sans-serif' }}>{t.co2e_tonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> tCO₂e
                      &nbsp;·&nbsp;{t.percentage}%
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(16,185,129,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '4px',
                      width: `${Math.min(t.percentage, 100)}%`,
                      background: ['linear-gradient(90deg,#2563eb,#60a5fa)', 'linear-gradient(90deg,#059669,#34d399)', 'linear-gradient(90deg,#d97706,#fbbf24)'][t.tier - 1],
                      transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Hotspot Summary */}
          <SectionCard icon="🔥" title="Carbon Hotspot Summary">
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {['HIGH', 'MEDIUM', 'LOW'].map(level => {
                const cfg = IMPACT_COLORS[level];
                const count = hotspots.counts?.[level.toLowerCase()] || 0;
                return (
                  <div key={level} style={{
                    flex: '1', minWidth: '140px', padding: '16px', borderRadius: '12px',
                    background: cfg.bg, border: `1.5px solid ${cfg.border}`, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: cfg.color }}>{count}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{level} Impact</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── TIER BREAKDOWN ────────────────────────────────────────────────── */}
      {activeSection === 'tiers' && (
        <SectionCard icon="🏗️" title="Detailed Tier Emissions Breakdown">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(90deg,#059669,#10b981)', color: '#fff' }}>
                  {['Tier', 'Description', 'CO₂e (tCO₂e)', 'CO₂e (kg)', '% Share', 'Label'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'CO₂e (tCO₂e)' || h === 'CO₂e (kg)' || h === '% Share' ? 'right' : 'left', fontWeight: 700, fontSize: '11px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => {
                  const desc = ['Direct (Tier 1) Suppliers', 'Sub-Contractors (Tier 2)', 'Raw Materials / Mining (Tier 3)'][t.tier - 1];
                  return (
                    <tr key={t.tier} style={{ background: i % 2 === 0 ? '#fff' : '#f4faf6' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f2017' }}>Tier {t.tier}</td>
                      <td style={{ padding: '12px 14px', color: '#5a8a6a' }}>{desc}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>{t.co2e_tonnes.toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#5a8a6a' }}>{t.co2e_kg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>{t.percentage}%</td>
                      <td style={{ padding: '12px 14px' }}><ValueTypeBadge type="CALCULATED" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '14px', padding: '12px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid rgba(5,150,105,0.15)', fontSize: '11.5px', color: '#5a8a6a' }}>
            ℹ️ Each supplier is assigned to exactly one tier based on their supply chain relationship. De-duplication prevents double-counting when suppliers appear in multiple paths.
          </div>
        </SectionCard>
      )}

      {/* ── TOP SUPPLIERS ────────────────────────────────────────────────── */}
      {activeSection === 'suppliers' && (
        <SectionCard icon="🏭" title="Top Suppliers by Emissions Contribution">
          {suppliers.length === 0 ? (
            <div className="empty-state">No supplier emissions data available.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f2017', color: '#fff' }}>
                    {['#', 'Supplier', 'Country', 'Sector', 'Tier', 'CO₂e (tCO₂e)', '% Share', 'Label'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: ['CO₂e (tCO₂e)', '% Share', '#'].includes(h) ? 'center' : 'left', fontSize: '11px', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s, i) => (
                    <tr key={s.supplier_code} style={{ background: i % 2 === 0 ? '#fff' : '#f4faf6' }}>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#9dc4a8', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>#{i + 1}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f2017' }}>{s.supplier_name}</td>
                      <td style={{ padding: '12px 14px', color: '#5a8a6a' }}>{s.country}</td>
                      <td style={{ padding: '12px 14px', color: '#5a8a6a', fontSize: '12px' }}>{s.industry_sector}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '8px',
                          background: ['#dbeafe', '#dcfce7', '#fef3c7'][s.tier_level - 1] || '#f1f5f9',
                          color: ['#2563eb', '#059669', '#d97706'][s.tier_level - 1] || '#64748b',
                        }}>T{s.tier_level}</span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#0f2017' }}>
                        {s.co2e_tonnes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ color: s.contribution_pct > 20 ? '#dc2626' : s.contribution_pct > 10 ? '#d97706' : '#059669', fontWeight: 700 }}>
                          {s.contribution_pct.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}><ValueTypeBadge type="CALCULATED" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── ACTIVITIES ───────────────────────────────────────────────────── */}
      {activeSection === 'activities' && (
        <SectionCard icon="⚙️" title="Emissions by Activity Category">
          {activities.length === 0 ? (
            <div className="empty-state">No activity breakdown data available.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activities.map((a, i) => (
                <div key={a.activity_type} style={{
                  background: i % 2 === 0 ? '#f4faf6' : '#fff',
                  border: '1.5px solid rgba(16,185,129,0.1)',
                  borderRadius: '10px', padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#0f2017', fontSize: '13.5px' }}>{a.activity_type}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontSize: '15px', color: '#0f2017' }}>
                        {a.co2e_tonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e
                      </span>
                      <span style={{ color: '#059669', fontWeight: 700, fontSize: '12.5px' }}>{a.contribution_pct}%</span>
                      <ValueTypeBadge type="CALCULATED" />
                    </div>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(16,185,129,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px',
                      width: `${Math.min(a.contribution_pct, 100)}%`,
                      background: 'linear-gradient(90deg,#059669,#34d399)',
                    }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#9dc4a8', marginTop: '5px' }}>
                    {a.co2e_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂e
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── HOTSPOTS ─────────────────────────────────────────────────────── */}
      {activeSection === 'hotspots' && (
        <SectionCard icon="🔥" title="Carbon Hotspot Analysis">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['HIGH', 'MEDIUM', 'LOW'].map(level => {
              const cfg = IMPACT_COLORS[level];
              const count = hotspots.counts?.[level.toLowerCase()] || 0;
              return (
                <div key={level} style={{
                  flex: 1, minWidth: '120px', padding: '12px 16px', borderRadius: '10px',
                  background: cfg.bg, border: `1.5px solid ${cfg.border}`, textAlign: 'center',
                }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: cfg.color, fontFamily: 'Outfit, sans-serif' }}>{count}</div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase' }}>{level}</div>
                </div>
              );
            })}
          </div>
          {hotspots.items.length === 0 ? (
            <div className="empty-state">No hotspots recorded. Run hotspot sync first.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {hotspots.items.map((h, i) => {
                const cfg = IMPACT_COLORS[h.impact] || IMPACT_COLORS.LOW;
                return (
                  <div key={i} style={{
                    background: '#fff', border: `1.5px solid rgba(16,185,129,0.1)`,
                    borderLeft: `4px solid ${cfg.color}`,
                    borderRadius: '10px', padding: '14px 18px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f2017' }}>{h.entity_name}</span>
                          <span style={{
                            fontSize: '9px', padding: '1px 6px', borderRadius: '6px', fontWeight: 700,
                            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                            textTransform: 'uppercase',
                          }}>{h.impact}</span>
                          <span style={{ fontSize: '10px', color: '#9dc4a8' }}>{h.entity_type}</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#5a8a6a', lineHeight: 1.5 }}>
                          Primary driver: <strong style={{ color: '#0f2017' }}>{h.main_source || '—'}</strong>
                          {h.explanation && <> · {h.explanation.slice(0, 100)}{h.explanation.length > 100 ? '…' : ''}</>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '16px', fontFamily: 'Outfit, sans-serif', color: '#0f2017' }}>
                          {h.total_emissions_tonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e
                        </div>
                        <div style={{ fontSize: '11px', color: '#5a8a6a' }}>{h.contribution_pct.toFixed(2)}% of total</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── RECOMMENDATIONS ──────────────────────────────────────────────── */}
      {activeSection === 'recommendations' && (
        <SectionCard icon="🌱" title="Decarbonization Recommendations">
          <div style={{
            background: '#fef3c7', border: '1.5px solid rgba(217,119,6,0.2)',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
            fontSize: '12px', color: '#92400e',
          }}>
            ⚠️ <strong>All values below are ESTIMATED POTENTIAL REDUCTIONS.</strong> These are modelled estimates based on emission factor differentials. They are not guaranteed savings and should not be reported as achieved reductions.
            <br />Total estimated potential: <strong>{recs.total_potential_reduction_tonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e</strong>
          </div>
          {recs.items.length === 0 ? (
            <div className="empty-state">No recommendations generated yet. Visit the Recommendations tab to generate them.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recs.items.map((r, i) => {
                const dm = DOMAIN_META[r.domain] || DOMAIN_META.SUPPLIER;
                return (
                  <div key={i} style={{
                    background: '#fff', border: '1.5px solid rgba(16,185,129,0.1)',
                    borderRadius: '12px', padding: '16px 20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '10px',
                        background: dm.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '20px', flexShrink: 0,
                      }}>{dm.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
                          <div>
                            <span style={{
                              fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px',
                              background: dm.bg, color: dm.color, marginRight: '7px',
                              border: `1px solid ${dm.color}30`,
                            }}>{r.domain}</span>
                            <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f2017' }}>{r.title}</span>
                          </div>
                          <ValueTypeBadge type="ESTIMATED_POTENTIAL" />
                        </div>
                        <div style={{ fontSize: '12px', color: '#5a8a6a', marginBottom: '10px', lineHeight: 1.5 }}>{r.reason}</div>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
                          background: '#f4faf6', borderRadius: '8px', padding: '10px',
                          border: '1px solid rgba(16,185,129,0.1)',
                        }}>
                          <div>
                            <div style={{ fontSize: '9.5px', color: '#9dc4a8', fontWeight: 600, marginBottom: '2px' }}>CURRENT</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626', fontFamily: 'Outfit, sans-serif' }}>
                              {r.current_emissions_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9.5px', color: '#9dc4a8', fontWeight: 600, marginBottom: '2px' }}>EST. POTENTIAL REDUCTION</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#d97706', fontFamily: 'Outfit, sans-serif' }}>
                              −{r.estimated_reduction_kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg ({r.estimated_reduction_pct.toFixed(1)}%)
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9.5px', color: '#9dc4a8', fontWeight: 600, marginBottom: '2px' }}>BASIS</div>
                            <div style={{ fontSize: '11.5px', color: '#5a8a6a' }}>{r.calculation_basis || '—'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── VERIFICATION ─────────────────────────────────────────────────── */}
      {activeSection === 'verification' && (
        <SectionCard icon="🛡️" title="Data Verification & Audit Status">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <KPIBox label="Verified Records" value={verif.verified_calculations} valueType="DATA" color="#059669" />
            <KPIBox label="Unverified Records" value={verif.unverified_calculations} valueType="DATA" color="#d97706" />
            <KPIBox label="Total Records" value={verif.total_calculations} valueType="DATA" />
            <KPIBox label="Verification Rate" value={`${verif.verification_rate_pct}%`} valueType="DATA"
              color={verif.verification_rate_pct >= 80 ? '#059669' : verif.verification_rate_pct > 0 ? '#d97706' : '#dc2626'} />
          </div>
          <div style={{
            padding: '16px 20px', borderRadius: '12px',
            background: verif.status === 'VERIFIED' ? '#dcfce7' : verif.status === 'PARTIAL' ? '#fef3c7' : '#fee2e2',
            border: `1.5px solid ${verif.status === 'VERIFIED' ? 'rgba(5,150,105,0.25)' : verif.status === 'PARTIAL' ? 'rgba(217,119,6,0.25)' : 'rgba(220,38,38,0.25)'}`,
          }}>
            <div style={{ fontWeight: 800, fontSize: '16px', color: verif.status === 'VERIFIED' ? '#059669' : verif.status === 'PARTIAL' ? '#d97706' : '#dc2626' }}>
              {verif.status === 'VERIFIED' ? '✅' : verif.status === 'PARTIAL' ? '⚠️' : '❌'} Data Status: {verif.status}
            </div>
            <div style={{ fontSize: '12px', color: '#5a8a6a', marginTop: '6px', lineHeight: 1.6 }}>
              {verif.verification_rate_pct >= 80
                ? 'The majority of emission calculations have been verified. This report meets minimum verification requirements for disclosure.'
                : verif.verification_rate_pct > 0
                  ? 'A portion of calculations remain unverified. These are preliminary estimates. Verify all records before external disclosure.'
                  : 'No calculations have been verified. This report is entirely preliminary and must not be used for external reporting.'}
            </div>
          </div>
          <div style={{ marginTop: '14px', padding: '12px 16px', background: '#f4faf6', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.1)', fontSize: '11.5px', color: '#5a8a6a', lineHeight: 1.6 }}>
            🔒 <strong>Audit trail is immutable.</strong> All calculation traces are stored in SQLite with input → unit → emission factor → formula → result → timestamp. Records cannot be modified or deleted post-creation.
          </div>
        </SectionCard>
      )}

      {/* ── SAVED REPORTS ────────────────────────────────────────────────── */}
      {activeSection === 'saved' && (
        <SectionCard icon="📁" title={`Saved Report Records (${savedReports.length} in SQLite)`}>
          {savedReports.length === 0 ? (
            <div className="empty-state">
              No reports saved yet. Click "Generate & Save Report" to create and persist a report to the SQLite database.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#059669', color: '#fff' }}>
                    {['ID', 'Title', 'Company', 'Year', 'Total tCO₂e', 'T1', 'T2', 'T3', 'Status', 'Generated At'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {savedReports.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f4faf6' }}>
                      <td style={{ padding: '10px 12px', color: '#9dc4a8', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>#{r.id}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f2017', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</td>
                      <td style={{ padding: '10px 12px', color: '#5a8a6a' }}>{r.company}</td>
                      <td style={{ padding: '10px 12px', color: '#5a8a6a' }}>{r.reporting_year}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: '#0f2017' }}>{r.total_scope3_tonnes.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '10px 12px', color: '#2563eb', fontSize: '12px' }}>{r.tier1_emissions_tonnes.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', color: '#059669', fontSize: '12px' }}>{r.tier2_emissions_tonnes.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', color: '#d97706', fontSize: '12px' }}>{r.tier3_emissions_tonnes.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '7px',
                          background: r.status === 'FINAL' ? '#dcfce7' : '#f1f5f9',
                          color: r.status === 'FINAL' ? '#059669' : '#5a8a6a',
                          border: `1px solid ${r.status === 'FINAL' ? 'rgba(5,150,105,0.2)' : 'rgba(100,116,139,0.2)'}`,
                        }}>{r.status}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#9dc4a8', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {r.generated_at?.slice(0, 19).replace('T', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Footer Note ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 16px', background: '#fff', border: '1.5px solid rgba(16,185,129,0.1)',
        borderRadius: '10px', fontSize: '11px', color: '#9dc4a8', lineHeight: 1.6,
        display: 'flex', gap: '16px', flexWrap: 'wrap',
      }}>
        <span>📐 Framework: <strong style={{ color: '#5a8a6a' }}>{meta.framework}</strong></span>
        <span>🔧 Engine: <strong style={{ color: '#5a8a6a' }}>{meta.engine}</strong></span>
        <span>💾 Storage: <strong style={{ color: '#059669' }}>SQLite (Immutable Audit Ledger)</strong></span>
        <span>📥 PDF: <strong style={{ color: '#2563eb' }}>ReportLab</strong></span>
      </div>
    </div>
  );
}
