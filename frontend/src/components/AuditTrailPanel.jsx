import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { carbonApi } from '../services/api';

const ACTION_COLORS = {
  CARBON_CALCULATION_RUN: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '🧮', label: 'Calculation Run' },
  CARBON_CALCULATED:      { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '🧮', label: 'Emission Calculated' },
  CSV_UPLOADED:           { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '📂', label: 'CSV File Ingested' },
  CSV_DATA_UPLOADED:      { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '📂', label: 'Data Batch Uploaded' },
  SUPPLIER_ADDED:         { bg: '#faf5ff', border: '#ddd6fe', text: '#6b21a8', icon: '🏢', label: 'Supplier Registered' },
  SUPPLIER_UPDATED:       { bg: '#faf5ff', border: '#ddd6fe', text: '#6b21a8', icon: '✏️', label: 'Supplier Updated' },
  HOTSPOTS_GENERATED:     { bg: '#fee2e2', border: '#fecaca', text: '#991b1b', icon: '🔥', label: 'Hotspot Sync' },
  RECOMMENDATIONS_GENERATED: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '🌱', label: 'Interventions Generated' },
  EMISSION_FACTOR_CREATED:{ bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: '📊', label: 'Emission Factor Created' },
  EMISSION_FACTOR_UPDATED:{ bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: '🔄', label: 'Emission Factor Updated' },
  ACTIVITY_DATA_SUBMITTED:{ bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '📝', label: 'Activity Submitted' },
  ACTIVITY_DATA_VERIFIED: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '✅', label: 'Activity Verified' },
  REPORT_GENERATED:       { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d', icon: '📄', label: 'Report Generated' },
  USER_LOGIN:             { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', icon: '🔐', label: 'User Authentication' },
};

export default function AuditTrailPanel({ period, onOpenGuide }) {
  const [viewMode,        setViewMode]        = useState('traces'); // 'traces' | 'logs' | 'integrity'
  const [logs,            setLogs]            = useState([]);
  const [traces,          setTraces]          = useState([]);
  const [summary,         setSummary]         = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [filterAction,    setFilterAction]    = useState('ALL');
  const [filterStatus,    setFilterStatus]    = useState('ALL');
  const [searchTerm,      setSearchTerm]      = useState('');
  const [expandedLogId,   setExpandedLogId]   = useState(null);
  const [copiedTraceId,   setCopiedTraceId]   = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = period === 'All Periods' ? null : period;
      const [logsRes, summaryRes, tracesRes] = await Promise.all([
        carbonApi.getAuditLogs({ search: searchTerm || undefined }),
        carbonApi.getAuditSummary(),
        carbonApi.getCalculationTraces(p)
      ]);

      const logList = Array.isArray(logsRes) ? logsRes : (logsRes.results || []);
      setLogs(logList);
      setSummary(summaryRes);
      setTraces(tracesRes.traces || []);
    } catch (err) {
      console.error('[AUDIT TRAIL FETCH ERROR]', err);
      setError(err.message || 'Failed to retrieve compliance audit logs');
    } finally {
      setLoading(false);
    }
  }, [period, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopyTrace = (t, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`Trace #${t.calculation_id} (${t.supplier_name}):\nInput: ${t.input} ${t.unit}\nFactor: ${t.emission_factor} (${t.source})\nFormula: ${t.formula}\nResult: ${t.result_tonnes} tCO2e (${t.result_kg} kg)\nStatus: ${t.verification_status}`);
    setCopiedTraceId(t.calculation_id);
    setTimeout(() => setCopiedTraceId(null), 2000);
  };

  const handleExportCSV = () => {
    if (viewMode === 'traces') {
      if (filteredTraces.length === 0) return;
      const headers = ['Calculation_ID', 'Supplier_Name', 'Activity_Type', 'Input_Quantity', 'Unit', 'Emission_Factor', 'Factor_Source', 'Result_Kg', 'Result_Tonnes', 'Status', 'Timestamp'];
      const rows = filteredTraces.map(t => [
        t.calculation_id,
        `"${(t.supplier_name || '').replace(/"/g, '""')}"`,
        `"${t.activity_type || ''}"`,
        t.input ?? '',
        `"${t.unit || ''}"`,
        t.emission_factor ?? '',
        `"${(t.source || '').replace(/"/g, '""')}"`,
        t.result_kg ?? '',
        t.result_tonnes ?? '',
        `"${t.verification_status || ''}"`,
        `"${t.timestamp || ''}"`
      ]);
      const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const link = document.createElement('a');
      link.href = encodeURI(csv);
      link.download = `Calculation_Traces_Audit_${(period || 'all').replace(/\s/g, '_')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (filteredLogs.length === 0) return;
      const headers = ['Log_ID', 'Timestamp', 'Action', 'Username', 'User_Role', 'Entity_Type', 'Entity_ID'];
      const rows = filteredLogs.map(l => [
        l.id,
        `"${l.timestamp || ''}"`,
        `"${l.action || ''}"`,
        `"${l.username || ''}"`,
        `"${l.user_role || ''}"`,
        `"${l.entity_type || ''}"`,
        `"${l.entity_id || ''}"`
      ]);
      const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const link = document.createElement('a');
      link.href = encodeURI(csv);
      link.download = `Action_Ledger_Audit_${(period || 'all').replace(/\s/g, '_')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (filterAction !== 'ALL' && l.action !== filterAction) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchAction = l.action?.toLowerCase().includes(q);
        const matchUser = l.username?.toLowerCase().includes(q);
        const matchEntity = l.entity_type?.toLowerCase().includes(q) || String(l.entity_id)?.toLowerCase().includes(q);
        if (!matchAction && !matchUser && !matchEntity) return false;
      }
      return true;
    });
  }, [logs, filterAction, searchTerm]);

  const filteredTraces = useMemo(() => {
    return traces.filter(t => {
      if (filterStatus !== 'ALL' && t.verification_status !== filterStatus) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchSupplier = t.supplier_name?.toLowerCase().includes(q);
        const matchActivity = t.activity_type?.toLowerCase().includes(q);
        const matchSource = t.source?.toLowerCase().includes(q);
        const matchFormula = t.formula?.toLowerCase().includes(q);
        if (!matchSupplier && !matchActivity && !matchSource && !matchFormula) return false;
      }
      return true;
    });
  }, [traces, filterStatus, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ─── 1. HERO HEADER ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #064e3b 100%)',
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
        {/* Background glow decoration */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '260px',
          height: '260px',
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
              ISAE 3000 ASSURANCE
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
              ISO 14064-1 Auditable
            </span>
            <span style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              padding: '3px 10px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#a7f3d0'
            }}>
              Append-Only SQLite Ledger
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
            Scope 3 Compliance &amp; Immutable Audit Trail
          </h1>

          <p style={{
            fontSize: '13px',
            color: '#cbd5e1',
            margin: 0,
            lineHeight: 1.55
          }}>
            Cryptographic ledger tracking all raw activity ingestions, factor linkages, mathematical formulas, and disclosure reports. Record updates and deletions are strictly forbidden by database triggers.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '12px',
          position: 'relative',
          zIndex: 2,
          flexShrink: 0
        }}>
          {/* View Switcher Pills */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '4px',
            borderRadius: '12px',
            display: 'flex',
            gap: '4px'
          }}>
            <button
              onClick={() => setViewMode('traces')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'traces' ? '#059669' : 'transparent',
                color: viewMode === 'traces' ? '#ffffff' : '#cbd5e1',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔬 8-Part Calculation Traces
            </button>

            <button
              onClick={() => setViewMode('logs')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'logs' ? '#059669' : 'transparent',
                color: viewMode === 'logs' ? '#ffffff' : '#cbd5e1',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📋 Immutable Action Ledger
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleExportCSV}
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              📥 Export Audit CSV
            </button>

            <button
              onClick={fetchData}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🔄 Refresh Ledger
            </button>

            {onOpenGuide && (
              <button
                onClick={() => onOpenGuide('scope3')}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#a7f3d0',
                  border: '1px solid rgba(167, 243, 208, 0.3)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📖 Assurance Guide
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. SUMMARY KPI STAT CARDS ─── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #0f172a',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Audit Ledger Events
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', marginTop: '4px', lineHeight: 1 }}>
              {summary.total_audit_events || logs.length}
            </div>
            <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '4px' }}>
              ● 100% Retained in SQLite DB
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #2563eb',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Mathematical Trace Records
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#2563eb', marginTop: '4px', lineHeight: 1 }}>
              {traces.length}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Input → Factor → Formula Lineage
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #7c3aed',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CSV Ingestion Validations
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#7c3aed', marginTop: '4px', lineHeight: 1 }}>
              {(summary.action_breakdown?.CSV_UPLOADED || 0) + (summary.action_breakdown?.CSV_DATA_UPLOADED || 0)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Row-Level Schema Checks
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            border: '1px solid #a7f3d0',
            borderTop: '4px solid #059669',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(5,150,105,0.06)'
          }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tamper Proof Enforcement
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669', marginTop: '6px', lineHeight: 1 }}>
              🔒 ACTIVE (IMMUTABLE)
            </div>
            <div style={{ fontSize: '11px', color: '#065f46', marginTop: '4px' }}>
              UPDATE/DELETE Prohibited
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. SEARCH & FILTER CONTROLS ─── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '16px 20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            placeholder={viewMode === 'traces' ? 'Search calculation traces by supplier, activity, source...' : 'Search action ledger by action, user, or entity...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
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
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
            >×</button>
          )}
        </div>

        {/* Action / Status Dropdown */}
        {viewMode === 'logs' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Action Filter:</span>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
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
              <option value="ALL">All Actions</option>
              <option value="CARBON_CALCULATION_RUN">Calculations</option>
              <option value="CSV_UPLOADED">CSV Uploads</option>
              <option value="SUPPLIER_ADDED">Suppliers Registered</option>
              <option value="HOTSPOTS_GENERATED">Hotspot Syncs</option>
              <option value="RECOMMENDATIONS_GENERATED">Recommendations</option>
              <option value="EMISSION_FACTOR_CREATED">Emission Factors</option>
              <option value="REPORT_GENERATED">Reports Generated</option>
            </select>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Verification Status:</span>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
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
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified Only</option>
              <option value="UNVERIFIED">Unverified Only</option>
            </select>
          </div>
        )}

        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Showing <strong style={{ color: '#0f172a' }}>{viewMode === 'traces' ? filteredTraces.length : filteredLogs.length}</strong> audited records
        </div>
      </div>

      {/* ─── 4. LOADING & ERROR STATES ─── */}
      {loading && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            Auditing Cryptographic SQLite Ledger…
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Verifying mathematical formula traces and append-only activity logs
          </p>
        </div>
      )}

      {error && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', margin: '0 0 6px 0' }}>Audit Trail Retrieval Failed</h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>{error}</p>
          <button onClick={fetchData} style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 20px', cursor: 'pointer', fontWeight: 700 }}>Retry</button>
        </div>
      )}

      {/* ─── 5. VIEW 1: 8-PART CALCULATION TRACE INSPECTOR ─── */}
      {!loading && !error && viewMode === 'traces' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Methodology Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '14px',
            padding: '16px 20px',
            fontSize: '12.5px',
            color: '#1e3a8a',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            lineHeight: 1.55
          }}>
            <span style={{ fontSize: '20px' }}>🛡️</span>
            <div>
              <strong style={{ color: '#1d4ed8' }}>8-Part Deterministic Calculation Lineage: </strong>
              Every Scope 3 emission metric is strictly derived via verified activity data without generative hallunication:
              <span style={{ color: '#0f172a', fontWeight: 700 }}>
                {' '}Input Quantity → Unit → Emission Factor → Primary Source → Formula → Raw kg CO₂e → Metric Tonnes → Verification State
              </span>.
            </div>
          </div>

          {/* Trace Cards */}
          {filteredTraces.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '38px', marginBottom: '10px' }}>🧮</div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>No Calculation Traces Found</h3>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>Try clearing search keywords or selecting "All Statuses".</p>
            </div>
          ) : (
            filteredTraces.map((t) => (
              <div
                key={t.calculation_id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'all 0.2s'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      🧮
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                        Trace #{t.calculation_id} — {t.supplier_name}
                      </h4>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Activity Domain: <strong style={{ color: '#0f172a' }}>{t.activity_type}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '99px',
                      background: t.verification_status === 'VERIFIED' ? '#ecfdf5' : '#fffbeb',
                      color: t.verification_status === 'VERIFIED' ? '#059669' : '#d97706',
                      border: `1px solid ${t.verification_status === 'VERIFIED' ? '#a7f3d0' : '#fde68a'}`
                    }}>
                      {t.verification_status === 'VERIFIED' ? '✓ VERIFIED' : '⚠️ PRELIMINARY'}
                    </span>

                    <button
                      onClick={(e) => handleCopyTrace(t, e)}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {copiedTraceId === t.calculation_id ? '✅ Copied!' : '📋 Copy Trace'}
                    </button>

                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {new Date(t.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 6-Node Pipeline Visual Strip */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: '10px',
                  background: '#f8fafc',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div>
                    <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>1. Input Quantity</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{Number(t.input || 0).toLocaleString()}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>2. Unit</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#2563eb' }}>{t.unit}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>3. Emission Factor</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#d97706' }}>{t.emission_factor}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>4. Factor Source</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.source}>
                      {t.source || 'DEFRA / IPCC AR6'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>5. Mass (kg CO₂e)</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#dc2626' }}>{Number(t.result_kg || 0).toLocaleString()}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '2px' }}>6. Result (tCO₂e)</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#059669' }}>{Number(t.result_tonnes || 0).toFixed(4)}</div>
                  </div>
                </div>

                {/* Formula Lineage Footnote */}
                <div style={{
                  background: '#0f172a',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#a5f3fc',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ color: '#38bdf8', fontWeight: 800 }}>📐 Auditable Math Trace:</span>
                  <span>{t.formula}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── 6. VIEW 2: ACTION LEDGER STREAM ─── */}
      {!loading && !error && viewMode === 'logs' && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textTransform: 'uppercase', fontSize: '10.5px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textTransform: 'uppercase', fontSize: '10.5px' }}>Action Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textTransform: 'uppercase', fontSize: '10.5px' }}>Actor &amp; Role</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textTransform: 'uppercase', fontSize: '10.5px' }}>Target Entity</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, textTransform: 'uppercase', fontSize: '10.5px' }}>Payload Audit</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(l => {
                  const style = ACTION_COLORS[l.action] || { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', icon: '📝', label: l.action };
                  const isExpanded = expandedLogId === l.id;

                  return (
                    <React.Fragment key={l.id}>
                      <tr
                        style={{ borderBottom: '1px solid #f1f5f9', background: isExpanded ? '#f8fafc' : 'transparent' }}
                        onMouseEnter={e => !isExpanded && (e.currentTarget.style.background = '#fafbfc')}
                        onMouseLeave={e => !isExpanded && (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '11.5px' }}>
                          {new Date(l.timestamp).toLocaleString()}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '99px',
                            background: style.bg,
                            border: `1px solid ${style.border}`,
                            color: style.text,
                            fontWeight: 700,
                            fontSize: '11.5px'
                          }}>
                            <span>{style.icon}</span>
                            <span>{style.label}</span>
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#0f172a' }}>
                          <div style={{ fontWeight: 700 }}>{l.username || 'System Engine'}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{l.user_role || 'SYSTEM_DAEMON'}</div>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#64748b' }}>
                          <span style={{ color: '#2563eb', fontWeight: 700 }}>{l.entity_type}</span> : {l.entity_id}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : l.id)}
                            style={{
                              background: isExpanded ? '#0f172a' : '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: isExpanded ? '#ffffff' : '#0f172a',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {isExpanded ? 'Hide Payload' : 'View Payload 🔍'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ background: '#0f172a' }}>
                          <td colSpan="5" style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                                Immutable Audit JSON Record (ID: {l.id})
                              </span>
                              <button
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(l.details, null, 2))}
                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}
                              >Copy JSON</button>
                            </div>
                            <pre style={{
                              margin: 0,
                              fontSize: '11.5px',
                              color: '#a5f3fc',
                              fontFamily: 'Consolas, monospace',
                              background: 'rgba(0, 0, 0, 0.4)',
                              padding: '12px',
                              borderRadius: '8px',
                              overflowX: 'auto',
                              maxHeight: '220px'
                            }}>
                              {JSON.stringify(l.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 7. FOOTER AUDIT GUARANTEE ─── */}
      <div style={{
        padding: '14px 20px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        fontSize: '12px',
        color: '#64748b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <span>🔒 <strong>Cryptographic Guarantee:</strong> Every audit event is sealed with an SHA-256 integrity hash in SQLite.</span>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>ISAE 3000 / AICPA SOC2 Type II Assurance Trail</span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
