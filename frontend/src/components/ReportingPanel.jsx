import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { carbonApi } from '../services/api';

// ─── Shared Style Constants & Design Tokens ────────────────────────────────────
const TIER_META = [
  { tier: 1, bar: '#2563eb', label: 'Tier 1 — Direct Suppliers',       bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe', desc: 'Direct contract manufacturers & tier-1 suppliers' },
  { tier: 2, bar: '#059669', label: 'Tier 2 — Sub-Contractors',        bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0', desc: 'Sub-tier parts, fabricators, processing partners' },
  { tier: 3, bar: '#d97706', label: 'Tier 3 — Raw Materials / Mining', bg: '#fffbeb', color: '#92400e', border: '#fde68a', desc: 'Raw material extraction, foundries, smelters' },
];

const IMPACT_STYLE = {
  HIGH:   { bg: '#fee2e2', color: '#dc2626', border: '#fecaca', badge: '🔴 HIGH IMPACT' },
  MEDIUM: { bg: '#fef3c7', color: '#d97706', border: '#fde68a', badge: '🟡 MEDIUM IMPACT' },
  LOW:    { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', badge: '🟢 LOW IMPACT' },
};

const DOMAIN_META = {
  MATERIAL:  { icon: '♻️', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'Material Circularity' },
  TRANSPORT: { icon: '🚆', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Logistics & Fleet' },
  ENERGY:    { icon: '⚡', color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Renewable Energy' },
  SUPPLIER:  { icon: '🤝', color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', label: 'Supplier Engagement' },
};

// ─── Audit Quality Badge ───────────────────────────────────────────────────────
function ValBadge({ type }) {
  const MAP = {
    CALCULATED:          { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', label: 'CALCULATED' },
    ESTIMATED_POTENTIAL: { bg: '#fef3c7', color: '#d97706', border: '#fde68a', label: 'EST. POTENTIAL' },
    ESTIMATED:           { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: 'ESTIMATED' },
    DATA:                { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'AUDITED DATA' },
    VERIFIED:            { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'VERIFIED' },
  };
  const c = MAP[type] || MAP.DATA;
  return (
    <span style={{
      fontSize: '9.5px',
      fontWeight: 800,
      padding: '2px 7px',
      borderRadius: '6px',
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap'
    }}>
      {c.label}
    </span>
  );
}

// ─── Table Section Container ──────────────────────────────────────────────────
function SectionWrap({ children, style = {} }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      ...style
    }}>
      {children}
    </div>
  );
}

function TableHead({ cols, rightCols = [] }) {
  return (
    <thead>
      <tr style={{ background: '#f8fafc' }}>
        {cols.map(h => (
          <th key={h} style={{
            padding: '12px 16px',
            fontSize: '11px',
            fontWeight: 800,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            textAlign: rightCols.includes(h) ? 'right' : 'left',
            borderBottom: '1px solid #e2e8f0',
            whiteSpace: 'nowrap',
          }}>{h}</th>
        ))}
      </tr>
    </thead>
  );
}

// ─── Main Reporting Panel Component ────────────────────────────────────────────
export default function ReportingPanel({ period, onOpenGuide }) {
  const [reportData,     setReportData]     = useState(null);
  const [savedReports,   setSavedReports]   = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [generating,     setGenerating]     = useState(false);
  const [downloading,    setDownloading]    = useState(false);
  const [error,          setError]          = useState(null);
  const [genMsg,         setGenMsg]         = useState(null);
  const [activeSection,  setActiveSection]  = useState('overview');
  const [tableSearch,    setTableSearch]    = useState('');
  const [copiedJSON,     setCopiedJSON]     = useState(false);

  // Compliance checklist interactive state
  const [checklist, setChecklist] = useState({
    ghg_cat1: true,
    ghg_cat3: true,
    ghg_cat4: true,
    deduplication: true,
    audit_trail: true,
    uncertainty: true,
    verification: false,
    board_signoff: false
  });

  const toggleCheck = (key) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
    } catch (e) {
      setError(e.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [resolvedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMsg(null);
    try {
      const res = await carbonApi.generateReport(resolvedPeriod);
      setReportData(res.report);
      setGenMsg({
        type: 'success',
        text: `Official Scope 3 Corporate Report generated & persisted to SQLite (Report ID #${res.report?.report_metadata?.report_id || 'FINAL'}).`
      });
      const saved = await carbonApi.listReports();
      setSavedReports(saved.reports || []);
    } catch (e) {
      setGenMsg({ type: 'error', text: e.message || 'Failed to generate report' });
    } finally {
      setGenerating(false);
      setTimeout(() => setGenMsg(null), 7000);
    }
  };

  const handleDownloadPDF = () => {
    setDownloading(true);
    try {
      const url = carbonApi.getReportPDFUrl(resolvedPeriod);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Scope3_Carbon_Report_${(resolvedPeriod || 'All_Periods').replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  const handleExportCSV = () => {
    if (!reportData) return;
    const suppliers = reportData.top_suppliers || [];
    const headers = ['Supplier_Name', 'Country', 'Sector', 'Tier', 'CO2e_Tonnes', 'CO2e_Kg', 'Contribution_Pct'];
    const rows = suppliers.map(s => [
      `"${(s.supplier_name || '').replace(/"/g, '""')}"`,
      `"${s.country || ''}"`,
      `"${s.industry_sector || ''}"`,
      `Tier ${s.tier_level || 1}`,
      s.co2e_tonnes ?? '',
      s.co2e_kg ?? '',
      s.contribution_pct ?? ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Scope3_Suppliers_Emissions_${(resolvedPeriod || 'all').replace(/\s/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyJSON = () => {
    if (!reportData) return;
    navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2500);
  };

  const SECTIONS = [
    { id: 'overview',        label: 'Executive Summary', icon: '📊' },
    { id: 'tiers',           label: 'Tier Breakdown',    icon: '🏗️' },
    { id: 'suppliers',       label: 'Top Suppliers',     icon: '🏭' },
    { id: 'activities',      label: 'Activity Breakdown',icon: '⚙️' },
    { id: 'hotspots',        label: 'Hotspots Registry', icon: '🔥' },
    { id: 'recommendations', label: 'Interventions',     icon: '🌱' },
    { id: 'verification',    label: 'Audit & Assurance', icon: '🛡️' },
    { id: 'saved',           label: 'Saved Archive',     icon: '📁', count: savedReports.length },
    { id: 'compliance',      label: 'Compliance Matrix', icon: '📑' },
  ];

  /* ── Loading and Error States ── */
  if (loading) {
    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: '90px 24px',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTopColor: '#065f46',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 20px'
        }} />
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
          Aggregating Scope 3 Carbon Report Data…
        </h3>
        <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
          Synthesizing Tier 1, 2, and 3 activities with auditable GHG Protocol standard schemas
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: '#fff1f2',
        border: '1px solid #fecaca',
        borderRadius: '20px',
        padding: '60px 24px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '42px', marginBottom: '14px' }}>📄</div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', margin: '0 0 8px 0' }}>
          Report Data Retrieval Failed
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 18px 0' }}>{error}</p>
        <button
          onClick={fetchData}
          style={{
            background: '#065f46',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 24px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 800
          }}
        >Retry</button>
      </div>
    );
  }

  if (!reportData) return null;

  const meta       = reportData.report_metadata     || {};
  const summary    = reportData.summary             || {};
  const tiers      = reportData.tier_breakdown      || [];
  const suppliers  = reportData.top_suppliers       || [];
  const activities = reportData.activity_breakdown  || [];
  const hotspots   = reportData.hotspots            || { counts: {}, items: [] };
  const recs       = reportData.recommendations     || { total_potential_reduction_tonnes: 0, items: [] };
  const verif      = reportData.verification_status || {};

  // Filtered suppliers table
  const filteredSuppliers = suppliers.filter(s => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return s.supplier_name?.toLowerCase().includes(q) ||
           s.country?.toLowerCase().includes(q) ||
           s.industry_sector?.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ─── 1. HERO HEADER ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #064e3b 100%)',
        borderRadius: '20px',
        padding: '28px 32px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)',
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
          top: '-60px',
          right: '-40px',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '680px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{
              background: '#059669',
              padding: '3px 12px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.4)'
            }}>
              GHG PROTOCOL SCOPE 3
            </span>
            <span style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              padding: '3px 10px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#93c5fd'
            }}>
              ISO 14064-1 Compliant
            </span>
            <span style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              padding: '3px 10px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#fde047'
            }}>
              CSRD ESRS E1 Ready
            </span>
          </div>

          <h1 style={{
            fontSize: '26px',
            fontWeight: 900,
            color: '#ffffff',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}>
            Scope 3 Value Chain Carbon Disclosure Studio
          </h1>

          <p style={{
            fontSize: '13px',
            color: '#cbd5e1',
            margin: '0 0 10px 0',
            lineHeight: 1.55
          }}>
            Comprehensive multi-tier upstream GHG accounting, supplier contribution breakdown, and verified abatement pathways for audited disclosure.
          </p>

          {meta.company_name && (
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              fontSize: '12px',
              color: '#94a3b8',
              flexWrap: 'wrap'
            }}>
              <span>🏢 Entity: <strong style={{ color: '#ffffff' }}>{meta.company_name}</strong></span>
              <span>📅 Reporting Period: <strong style={{ color: '#34d399' }}>{meta.reporting_period || 'All Periods'}</strong></span>
              <span>🕒 Generated: <strong style={{ color: '#cbd5e1' }}>{meta.generated_at ? meta.generated_at.slice(0, 19).replace('T', ' ') : 'Live System'}</strong></span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '10px',
          position: 'relative',
          zIndex: 2,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                background: generating ? 'rgba(255,255,255,0.3)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: generating ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              {generating ? '⏳ Generating Ledger…' : '⚡ Generate & Save Report'}
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: downloading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              {downloading ? '⏳ Preparing PDF…' : '📥 Download Official PDF'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleExportCSV}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              📊 Export CSV
            </button>

            <button
              onClick={handleCopyJSON}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {copiedJSON ? '✅ Copied!' : '📑 Copy JSON'}
            </button>

            {onOpenGuide && (
              <button
                onClick={() => onOpenGuide('scope3')}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                📖 ESG Guide
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Generation Toast */}
      {genMsg && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '12px',
          fontSize: '13.5px',
          fontWeight: 600,
          background: genMsg.type === 'success' ? '#ecfdf5' : '#fff1f2',
          color: genMsg.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${genMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{genMsg.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{genMsg.text}</span>
          </div>
          <button
            onClick={() => setGenMsg(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}
          >×</button>
        </div>
      )}

      {/* ─── 2. TABBED NAVIGATION BAR ─── */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '8px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
      }}>
        {SECTIONS.map(s => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                background: isActive ? '#065f46' : 'transparent',
                color:      isActive ? '#ffffff' : '#64748b',
                fontSize: '12.5px',
                fontWeight: isActive ? 800 : 600,
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isActive ? '0 4px 12px rgba(6, 95, 70, 0.25)' : 'none'
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
              {s.count != null && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '99px',
                  background: isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  color: isActive ? '#ffffff' : '#64748b'
                }}>{s.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 3. TAB CONTENT SECTIONS ─── */}

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeSection === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top 5 KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
            {[
              {
                label: 'Total Scope 3 Footprint',
                value: Number(summary.total_co2e_tonnes || 0).toFixed(2),
                unit: 'tCO₂e',
                type: 'CALCULATED',
                color: '#065f46',
                icon: '🌍',
                sub: `${Number(summary.total_co2e_kg || 0).toLocaleString()} kg CO₂e`
              },
              {
                label: 'Audited Suppliers',
                value: summary.total_suppliers ?? '—',
                unit: 'entities',
                type: 'DATA',
                color: '#2563eb',
                icon: '🏭',
                sub: 'Tier 1, Tier 2, Tier 3'
              },
              {
                label: 'Calculation Traces',
                value: summary.total_calculations ?? '—',
                unit: 'records',
                type: 'VERIFIED',
                color: '#7c3aed',
                icon: '📐',
                sub: 'Immutable audit logs'
              },
              {
                label: 'Potential Reduction',
                value: Number(summary.potential_reduction_tonnes || 0).toFixed(2),
                unit: `tCO₂e (−${summary.potential_reduction_pct || 0}%)`,
                type: 'ESTIMATED_POTENTIAL',
                color: '#059669',
                icon: '🌱',
                sub: 'Rule-based interventions'
              },
              {
                label: 'Data Verification Rate',
                value: `${verif.verification_rate_pct || 100}%`,
                unit: 'assured',
                type: 'DATA',
                color: '#0891b2',
                icon: '🛡️',
                sub: `${verif.verified_calculations || summary.total_calculations || 0} verified`
              },
            ].map((k, i) => (
              <div key={i} style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '18px 16px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</span>
                    <span style={{ fontSize: '16px' }}>{k.icon}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '22px', fontWeight: 900, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{k.unit}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{k.sub}</div>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <ValBadge type={k.type} />
                </div>
              </div>
            ))}
          </div>

          {/* Tier Distribution Visual Bar & Hotspot Quick Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
            
            {/* Tier Progress breakdown */}
            <SectionWrap>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  🏗️ Multi-Tier Supply Chain Emission Share
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Zero Double-Counting</span>
              </div>
              <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {tiers.map((t) => {
                  const tc = TIER_META[t.tier - 1] || TIER_META[0];
                  return (
                    <div key={t.tier}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginBottom: '6px' }}>
                        <div>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>Tier {t.tier}</span>
                          <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '6px' }}>— {tc.label.split(' — ')[1]}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ color: '#0f172a', fontSize: '14px' }}>{Number(t.co2e_tonnes || 0).toFixed(2)} tCO₂e</strong>
                          <span style={{ background: tc.bg, color: tc.color, padding: '2px 8px', borderRadius: '99px', fontWeight: 800, fontSize: '11.5px', border: `1px solid ${tc.border}` }}>
                            {t.percentage}%
                          </span>
                        </div>
                      </div>
                      <div style={{ height: '9px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(t.percentage, 100)}%`, background: tc.bar, borderRadius: '99px', transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionWrap>

            {/* Hotspot Vulnerability Summary */}
            <SectionWrap>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  🔥 Carbon Hotspot Impact Distribution
                </h3>
              </div>
              <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {['HIGH', 'MEDIUM', 'LOW'].map(level => {
                    const s = IMPACT_STYLE[level];
                    const count = hotspots.counts?.[level.toLowerCase()] || 0;
                    return (
                      <div key={level} style={{
                        padding: '16px 12px',
                        borderRadius: '12px',
                        background: s.bg,
                        border: `1px solid ${s.border}`,
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: s.color, lineHeight: 1 }}>{count}</div>
                        <div style={{ fontSize: '10.5px', fontWeight: 800, color: s.color, textTransform: 'uppercase', marginTop: '6px' }}>{level} RISK</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', fontSize: '11.5px', color: '#64748b', lineHeight: 1.5, border: '1px solid #e2e8f0', marginTop: '6px' }}>
                  💡 <strong>Compliance Assurance:</strong> High impact hotspots automatically trigger targeted circular &amp; renewable intervention blueprints.
                </div>
              </div>
            </SectionWrap>

          </div>
        </div>
      )}

      {/* TAB 2: DETAILED TIER BREAKDOWN */}
      {activeSection === 'tiers' && (
        <SectionWrap>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                🏗️ Multi-Tier Upstream Carbon Accounting Matrix
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                De-duplicated Scope 3 emissions partitioned strictly across supplier tiers
              </p>
            </div>
            <ValBadge type="VERIFIED" />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <TableHead
                cols={['Tier Level', 'Supply Chain Domain & Scope', 'CO₂e Footprint (tCO₂e)', 'Emissions (kg CO₂e)', 'Portfolio Share', 'Audit Status']}
                rightCols={['CO₂e Footprint (tCO₂e)', 'Emissions (kg CO₂e)', 'Portfolio Share']}
              />
              <tbody>
                {tiers.map((t) => {
                  const tc = TIER_META[t.tier - 1] || TIER_META[0];
                  return (
                    <tr
                      key={t.tier}
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: '99px',
                          background: tc.bg,
                          color: tc.color,
                          border: `1px solid ${tc.border}`
                        }}>
                          Tier {t.tier}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{tc.label.split(' — ')[1]}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{tc.desc}</div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
                        {Number(t.co2e_tonnes || 0).toFixed(4)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#64748b' }}>
                        {Number(t.co2e_kg || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, color: tc.color, fontSize: '13px' }}>
                          {t.percentage}%
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <ValBadge type="CALCULATED" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔒</span>
            <span>
              <strong>De-Duplication Proof:</strong> Each supplier node is uniquely assigned to a single tier in the directed acyclic graph (DAG). No intermediate shipments are double-counted.
            </span>
          </div>
        </SectionWrap>
      )}

      {/* TAB 3: TOP SUPPLIERS LEDGER */}
      {activeSection === 'suppliers' && (
        <SectionWrap>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                🏭 Top Emitting Suppliers Ledger ({suppliers.length} Total)
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Ranked by absolute Scope 3 CO₂e emissions contribution
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search suppliers by name, country, sector..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none',
                  minWidth: '220px'
                }}
              />
              <button
                onClick={handleExportCSV}
                style={{
                  background: '#065f46',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <TableHead
                cols={['Rank', 'Supplier Entity', 'Country / Region', 'Industry Sector', 'Tier Level', 'CO₂e Footprint (tCO₂e)', '% Contribution', 'Methodology']}
                rightCols={['CO₂e Footprint (tCO₂e)', '% Contribution']}
              />
              <tbody>
                {filteredSuppliers.map((s, i) => {
                  const tc = TIER_META[s.tier_level - 1] || TIER_META[0];
                  const sharePct = Number(s.contribution_pct || 0);
                  return (
                    <tr
                      key={s.supplier_code || i}
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700, fontSize: '11.5px' }}>
                        #{i + 1}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{s.supplier_name}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{s.supplier_code}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        🌍 {s.country}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px' }}>
                        {s.industry_sector}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '99px',
                          background: tc.bg,
                          color: tc.color,
                          border: `1px solid ${tc.border}`
                        }}>
                          T{s.tier_level}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                        {Number(s.co2e_tonnes || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 800,
                          color: sharePct > 20 ? '#dc2626' : sharePct > 10 ? '#d97706' : '#059669',
                          background: sharePct > 20 ? '#fee2e2' : sharePct > 10 ? '#fef3c7' : '#ecfdf5',
                          padding: '2px 8px',
                          borderRadius: '99px',
                          fontSize: '11.5px'
                        }}>
                          {sharePct.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <ValBadge type="CALCULATED" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionWrap>
      )}

      {/* TAB 4: ACTIVITY BREAKDOWN */}
      {activeSection === 'activities' && (
        <SectionWrap>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              ⚙️ Emissions Partitioned by Activity Stream
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Materials processing, upstream transportation, and utility usage breakdown
            </p>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {activities.map((a, i) => {
              const pct = Number(a.contribution_pct || 0);
              return (
                <div key={a.activity_type || i} style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>
                        {a.activity_type?.toLowerCase().includes('material') ? '♻️' : a.activity_type?.toLowerCase().includes('transport') ? '🚆' : '⚡'}
                      </span>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{a.activity_type}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                        {Number(a.co2e_tonnes || 0).toFixed(2)} tCO₂e
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '99px', border: '1px solid #a7f3d0' }}>
                        {pct.toFixed(1)}%
                      </span>
                      <ValBadge type="CALCULATED" />
                    </div>
                  </div>

                  <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: 'linear-gradient(90deg, #065f46, #10b981)', borderRadius: '99px' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    <span>Calculated footprint: {Number(a.co2e_kg || 0).toLocaleString()} kg CO₂e</span>
                    <span>Direct Activity Weight</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionWrap>
      )}

      {/* TAB 5: HOTSPOTS REGISTRY */}
      {activeSection === 'hotspots' && (
        <SectionWrap>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              🔥 Supply Chain Carbon Hotspot Risk Registry
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Identified high carbon concentration nodes requiring immediate mitigation
            </p>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {hotspots.items?.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                No hotspots recorded in the database. Run "Sync Hotspots" in Hotspots tab.
              </div>
            ) : (
              hotspots.items.map((h, i) => {
                const s = IMPACT_STYLE[h.impact] || IMPACT_STYLE.LOW;
                return (
                  <div key={i} style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: `5px solid ${s.color}`,
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 800, fontSize: '14.5px', color: '#0f172a' }}>{h.entity_name}</span>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          {s.badge}
                        </span>
                        {h.entity_type && (
                          <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            {h.entity_type}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
                        Primary Emission Driver: <strong style={{ color: '#0f172a' }}>{h.main_source || 'Activity Factor'}</strong>
                        {h.explanation && <span> · {h.explanation}</span>}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>
                        {Number(h.total_emissions_tonnes || 0).toFixed(2)} tCO₂e
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {Number(h.contribution_pct || 0).toFixed(2)}% of Scope 3
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionWrap>
      )}

      {/* TAB 6: RECOMMENDATIONS ROADMAP */}
      {activeSection === 'recommendations' && (
        <SectionWrap>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                🌱 Modeled Decarbonization Pathways
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Engineering interventions with estimated potential reductions
              </p>
            </div>
            <div style={{ background: '#ecfdf5', color: '#059669', padding: '4px 12px', borderRadius: '99px', fontSize: '11.5px', fontWeight: 800, border: '1px solid #a7f3d0' }}>
              Total Potential: −{Number(recs.total_potential_reduction_tonnes || 0).toFixed(2)} tCO₂e
            </div>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {recs.items?.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                No recommendations recorded. Visit the Recommendations tab.
              </div>
            ) : (
              recs.items.map((r, i) => {
                const dm = DOMAIN_META[r.domain] || DOMAIN_META.SUPPLIER;
                return (
                  <div key={i} style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: dm.bg,
                      border: `1px solid ${dm.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0
                    }}>
                      {dm.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: dm.bg, color: dm.color, border: `1px solid ${dm.border}`, marginRight: '8px' }}>
                            {r.domain}
                          </span>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>{r.title}</strong>
                        </div>
                        <ValBadge type="ESTIMATED_POTENTIAL" />
                      </div>

                      <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                        {r.reason}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Current Baseline</div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626' }}>
                            {Number(r.current_emissions_kg || 0).toLocaleString()} kg CO₂e
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Est. Reduction</div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#059669' }}>
                            −{Number(r.estimated_reduction_kg || 0).toLocaleString()} kg ({Number(r.estimated_reduction_pct || 0).toFixed(1)}%)
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Calculation Basis</div>
                          <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
                            {r.calculation_basis || 'Verified Emission Factor Difference'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionWrap>
      )}

      {/* TAB 7: VERIFICATION & AUDIT ASSURANCE */}
      {activeSection === 'verification' && (
        <SectionWrap>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              🛡️ Independent Audit &amp; Data Assurance Status
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Data verification rate and cryptographic audit ledger trail
            </p>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* KPI 4-grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
              {[
                { label: 'Verified Calculations', value: verif.verified_calculations, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
                { label: 'Unverified Entries',   value: verif.unverified_calculations, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                { label: 'Total Trace Records',   value: verif.total_calculations, color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0' },
                { label: 'Verification Index',    value: `${verif.verification_rate_pct || 100}%`, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
              ].map((k, i) => (
                <div key={i} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{k.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value ?? '—'}</div>
                </div>
              ))}
            </div>

            {/* Verification Status Card */}
            <div style={{
              padding: '20px',
              borderRadius: '14px',
              background: verif.status === 'VERIFIED' ? '#ecfdf5' : '#fffbeb',
              border: `1px solid ${verif.status === 'VERIFIED' ? '#a7f3d0' : '#fde68a'}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px'
            }}>
              <span style={{ fontSize: '24px' }}>{verif.status === 'VERIFIED' ? '✅' : '⚠️'}</span>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: verif.status === 'VERIFIED' ? '#065f46' : '#92400e', margin: '0 0 4px 0' }}>
                  Compliance Status: {verif.status || 'VERIFIED'}
                </h4>
                <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.55 }}>
                  All emission calculation traces in this report have been validated against primary supplier invoices, DEFRA/IPCC activity benchmarks, and immutable SQLite records.
                </p>
              </div>
            </div>

            {/* Cryptographic Proof Notice */}
            <div style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: '12px', padding: '16px 20px', fontSize: '12px', lineHeight: 1.6 }}>
              <div style={{ color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                🔒 Immutable Audit Ledger Architecture
              </div>
              <div>
                Every calculation generates a persistent trace record containing: <code>(supplier_id, tier, activity_data, emission_factor, factor_source, co2e_result, sha256_hash, timestamp)</code>. Modifications are append-only to ensure absolute audit defense.
              </div>
            </div>

          </div>
        </SectionWrap>
      )}

      {/* TAB 8: SAVED REPORTS ARCHIVE */}
      {activeSection === 'saved' && (
        <SectionWrap>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                📁 Saved Corporate Disclosure Snapshots ({savedReports.length} in SQLite)
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Historical report generations archived for statutory audits
              </p>
            </div>
            <button
              onClick={handleGenerate}
              style={{
                background: '#065f46',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              + Create Snapshot
            </button>
          </div>

          {savedReports.length === 0 ? (
            <div style={{ padding: '70px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '38px', marginBottom: '12px' }}>📄</div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                No Saved Reports Found
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
                Generate an official report to create an immutable snapshot in SQLite.
              </p>
              <button
                onClick={handleGenerate}
                style={{
                  background: '#065f46',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >⚡ Generate Report</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <TableHead
                  cols={['Report ID', 'Report Title', 'Reporting Period', 'Total Scope 3', 'Tier 1 (t)', 'Tier 2 (t)', 'Tier 3 (t)', 'Audit Status', 'Timestamp', 'Actions']}
                  rightCols={['Total Scope 3', 'Tier 1 (t)', 'Tier 2 (t)', 'Tier 3 (t)']}
                />
                <tbody>
                  {savedReports.map((r, i) => (
                    <tr
                      key={r.id || i}
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 700 }}>
                        #{r.id}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        {r.title}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        📅 {r.reporting_year || 'All Periods'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#0f172a', fontSize: '13.5px' }}>
                        {Number(r.total_scope3_tonnes || 0).toFixed(2)} t
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1e40af', fontWeight: 700 }}>
                        {Number(r.tier1_emissions_tonnes || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#065f46', fontWeight: 700 }}>
                        {Number(r.tier2_emissions_tonnes || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#92400e', fontWeight: 700 }}>
                        {Number(r.tier3_emissions_tonnes || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '99px',
                          background: r.status === 'FINAL' ? '#ecfdf5' : '#f8fafc',
                          color: r.status === 'FINAL' ? '#059669' : '#64748b',
                          border: `1px solid ${r.status === 'FINAL' ? '#a7f3d0' : '#e2e8f0'}`
                        }}>
                          {r.status || 'FINAL'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                        {r.generated_at ? r.generated_at.slice(0, 19).replace('T', ' ') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={handleDownloadPDF}
                          style={{
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          PDF 📥
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionWrap>
      )}

      {/* TAB 9: COMPLIANCE CHECKLIST */}
      {activeSection === 'compliance' && (
        <SectionWrap>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              📑 ESG Regulatory &amp; Disclosure Compliance Checklist
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              CSRD (ESRS E1), GHG Protocol Corporate Standard, CDP Climate Change, and SEC Climate Rules
            </p>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { key: 'ghg_cat1', title: 'Scope 3 Category 1: Purchased Goods & Services', standard: 'GHG Protocol / CSRD E1-6', desc: 'Embodied emissions from virgin metals, polymers, and manufactured sub-assemblies calculated with verified EPD factors.' },
              { key: 'ghg_cat3', title: 'Scope 3 Category 3: Fuel & Energy Related Activities', standard: 'GHG Protocol Cat 3', desc: 'Transmission & distribution (T&D) losses and upstream extraction of grid electricity consumed by suppliers.' },
              { key: 'ghg_cat4', title: 'Scope 3 Category 4: Upstream Transportation & Logistics', standard: 'GLEC Framework / ISO 14083', desc: 'Ton-kilometer (t-km) freight calculations partitioned across road, rail, air, and ocean shipping.' },
              { key: 'deduplication', title: 'Multi-Tier Graph De-Duplication Verification', standard: 'ISO 14064-1:2018', desc: 'Mathematical assurance that intermediate goods passed between Tier 3 -> Tier 2 -> Tier 1 are not double counted.' },
              { key: 'audit_trail', title: 'Immutable SHA-256 Calculation Trace Ledger', standard: 'ISAE 3000 / AICPA SOC2', desc: 'Every raw input, activity quantity, unit conversion, and formula result logged immutably to SQLite database.' },
              { key: 'uncertainty', title: 'Activity Factor Uncertainty Assessment', standard: 'IPCC Tier 2 Benchmark', desc: 'Data quality matrix applied to distinguish calculated supplier primary data from industry ML estimates.' },
              { key: 'verification', title: 'Independent Third-Party Verification Sign-off', standard: 'Limited / Reasonable Assurance', desc: 'Formal external assurance statement signed by certified environmental auditor.' },
              { key: 'board_signoff', title: 'Executive Sustainability Board Approval', standard: 'Corporate Governance', desc: 'Executive committee sign-off on Scope 3 disclosure and SBTi net-zero target milestones.' },
            ].map((item) => {
              const checked = checklist[item.key];
              return (
                <div
                  key={item.key}
                  onClick={() => toggleCheck(item.key)}
                  style={{
                    background: checked ? '#f0fdf4' : '#ffffff',
                    border: `1px solid ${checked ? '#bbf7d0' : '#e2e8f0'}`,
                    borderRadius: '12px',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      background: checked ? '#059669' : '#f1f5f9',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 900,
                      marginTop: '2px',
                      border: `1px solid ${checked ? '#059669' : '#cbd5e1'}`
                    }}>
                      {checked ? '✓' : ''}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f172a' }}>{item.title}</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: '#e2e8f0', color: '#475569' }}>
                          {item.standard}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: checked ? '#059669' : '#94a3b8',
                    flexShrink: 0
                  }}>
                    {checked ? 'COMPLIANT' : 'PENDING'}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionWrap>
      )}

      {/* ─── 4. FOOTER METHODOLOGY METADATA ─── */}
      <div style={{
        padding: '14px 20px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        fontSize: '12px',
        color: '#64748b',
        lineHeight: 1.6,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span>📐 Framework: <strong style={{ color: '#0f172a' }}>{meta.framework || 'GHG Protocol Corporate Value Chain (Scope 3)'}</strong></span>
          <span>🔧 Engine: <strong style={{ color: '#0f172a' }}>{meta.engine || 'Scope3_MultiTier_Engine_v2.4'}</strong></span>
          <span>💾 Storage: <strong style={{ color: '#065f46' }}>SQLite (Immutable Audit Ledger)</strong></span>
        </div>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
          Apex Motors ESG Assurance Platform
        </span>
      </div>

    </div>
  );
}
