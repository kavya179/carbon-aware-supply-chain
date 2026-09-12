import React, { useState, useEffect, useCallback } from 'react';
import { carbonApi } from '../services/api';

const ACTION_COLORS = {
  CARBON_CALCULATION_RUN: { bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8', text: '#38bdf8', icon: '🧮' },
  CARBON_CALCULATED: { bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8', text: '#38bdf8', icon: '🧮' },
  CSV_UPLOADED: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#10b981', icon: '📂' },
  CSV_DATA_UPLOADED: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#10b981', icon: '📂' },
  SUPPLIER_ADDED: { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#a855f7', icon: '🏢' },
  SUPPLIER_UPDATED: { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#a855f7', icon: '✏️' },
  HOTSPOTS_GENERATED: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444', icon: '🔥' },
  RECOMMENDATIONS_GENERATED: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#f59e0b', icon: '🌱' },
  EMISSION_FACTOR_CREATED: { bg: 'rgba(14, 165, 233, 0.15)', border: '#0ea5e9', text: '#0ea5e9', icon: '📊' },
  EMISSION_FACTOR_UPDATED: { bg: 'rgba(14, 165, 233, 0.15)', border: '#0ea5e9', text: '#0ea5e9', icon: '🔄' },
  ACTIVITY_DATA_SUBMITTED: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6', icon: '📝' },
  ACTIVITY_DATA_VERIFIED: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#22c55e', icon: '✅' },
  REPORT_GENERATED: { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899', text: '#ec4899', icon: '📄' },
  USER_LOGIN: { bg: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '#94a3b8', icon: '🔐' },
};

export default function AuditTrailPanel({ period }) {
  const [viewMode, setViewMode] = useState('traces'); // 'traces' | 'logs'
  const [logs, setLogs] = useState([]);
  const [traces, setTraces] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

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

  const filteredLogs = logs.filter(l => {
    if (filterAction !== 'ALL' && l.action !== filterAction) return false;
    return true;
  });

  return (
    <div className="audit-panel-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        border: '1.5px solid rgba(5, 150, 105, 0.2)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{ maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f2017' }}>
              Scope 3 Compliance & Immutable Audit Trail
            </h3>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
              background: '#d1fae5',
              color: '#059669',
              border: '1px solid rgba(5, 150, 105, 0.3)',
              letterSpacing: '0.05em'
            }}>
              SQLITE IMMUTABLE LEDGER
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#5a8a6a', lineHeight: 1.5 }}>
            Historical audit trail tracking all supplier modifications, data submissions, calculation traces,
            and report issuances. Audit records strictly forbid updates and deletions to prevent silent tampering.
          </p>
        </div>

        {/* View Switcher & Refresh Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: '#fff',
            padding: '4px',
            borderRadius: '10px',
            border: '1.5px solid rgba(16, 185, 129, 0.18)',
            display: 'flex',
            gap: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <button
              onClick={() => setViewMode('traces')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'traces' ? '#059669' : 'transparent',
                color: viewMode === 'traces' ? '#fff' : '#5a8a6a',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              🔬 8-Part Calculation Traces
            </button>
            <button
              onClick={() => setViewMode('logs')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'logs' ? '#059669' : 'transparent',
                color: viewMode === 'logs' ? '#fff' : '#5a8a6a',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              📋 Immutable Action Ledger
            </button>
          </div>

          <button
            onClick={fetchData}
            className="btn-secondary"
            style={{ padding: '9px 14px', fontSize: '0.82rem' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#fff', border: '1.5px solid rgba(16, 185, 129, 0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: '#5a8a6a', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Total Audit Events</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f2017', marginTop: '4px', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
              {summary.total_audit_events}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '4px', fontWeight: 500 }}>● 100% Retained in SQLite</div>
          </div>

          <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#fff', border: '1.5px solid rgba(16, 185, 129, 0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: '#5a8a6a', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Calculation Traces</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', marginTop: '4px', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
              {traces.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#5a8a6a', marginTop: '4px' }}>Input → Factor → Result Audited</div>
          </div>

          <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#fff', border: '1.5px solid rgba(16, 185, 129, 0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: '#5a8a6a', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>CSV Upload Events</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed', marginTop: '4px', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
              {(summary.action_breakdown?.CSV_UPLOADED || 0) + (summary.action_breakdown?.CSV_DATA_UPLOADED || 0)}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#5a8a6a', marginTop: '4px' }}>Row Validation Logged</div>
          </div>

          <div style={{ padding: '16px 20px', borderRadius: '12px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid rgba(5, 150, 105, 0.2)', boxShadow: '0 2px 8px rgba(5,150,105,0.1)' }}>
            <div style={{ fontSize: '0.75rem', color: '#5a8a6a', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Tamper Protection</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669', marginTop: '4px', fontFamily: 'Outfit, sans-serif' }}>
              ENFORCED
            </div>
            <div style={{ fontSize: '0.72rem', color: '#5a8a6a', marginTop: '4px' }}>Edits & Deletes Rejected</div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p>Auditing historical logs and calculation traces from SQLite database...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* VIEW 1: 8-PART CALCULATION TRACE INSPECTOR */}
      {!loading && !error && viewMode === 'traces' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.15)',
            fontSize: '0.84rem',
            color: '#cbd5e1'
          }}>
            <strong style={{ color: '#38bdf8' }}>Auditor Verification Protocol: </strong>
            Every carbon value is produced via a deterministic rule-based formula preserving:
            <span style={{ color: '#f8fafc' }}>
              {' '}Input Quantity → Unit → Emission Factor → Documented Source → Formula → Result → Timestamp → Verification Status
            </span>. Zero Machine Learning is utilized for carbon accounting.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {traces.map((t, idx) => (
              <div
                key={idx}
                className="glass-card"
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* Trace Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🧮</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>
                        Calculation #{t.calculation_id} — {t.supplier_name}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Activity Domain: {t.activity_type}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: t.verification_status === 'VERIFIED' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: t.verification_status === 'VERIFIED' ? '#4ade80' : '#fbbf24',
                      border: `1px solid ${t.verification_status === 'VERIFIED' ? '#22c55e' : '#f59e0b'}`
                    }}>
                      STATUS: {t.verification_status}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(t.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 8-Part Pipeline Visualization */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(148, 163, 184, 0.1)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>1. Input Value</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc' }}>{t.input.toLocaleString()}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>2. Unit</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#38bdf8' }}>{t.unit}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>3. Emission Factor</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#fbbf24' }}>{t.emission_factor}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>4. Source</div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.source}>
                      {t.source}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>5. Result (kg CO₂e)</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ef4444' }}>{t.result_kg.toLocaleString()}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>6. Result (tCO₂e)</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ef4444' }}>{t.result_tonnes.toLocaleString()}</div>
                  </div>
                </div>

                {/* Formula Lineage */}
                <div style={{
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px dashed rgba(56, 189, 248, 0.3)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: '#cbd5e1',
                  fontFamily: 'monospace'
                }}>
                  <strong style={{ color: '#38bdf8' }}>Mathematical Trace: </strong>
                  {t.formula}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: ACTION LEDGER STREAM */}
      {!loading && !error && viewMode === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action Filter Pills & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { label: 'All Actions', value: 'ALL' },
                { label: 'Calculations', value: 'CARBON_CALCULATION_RUN' },
                { label: 'CSV Uploads', value: 'CSV_UPLOADED' },
                { label: 'Suppliers', value: 'SUPPLIER_ADDED' },
                { label: 'Hotspots', value: 'HOTSPOTS_GENERATED' },
                { label: 'Recommendations', value: 'RECOMMENDATIONS_GENERATED' },
                { label: 'Emission Factors', value: 'EMISSION_FACTOR_CREATED' },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilterAction(f.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: filterAction === f.value ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)',
                    background: filterAction === f.value ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                    color: filterAction === f.value ? '#38bdf8' : '#94a3b8',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search actions, entities, or users..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(15, 23, 42, 0.7)',
                color: '#f8fafc',
                fontSize: '0.82rem',
                minWidth: '260px'
              }}
            />
          </div>

          {/* Event Stream Table */}
          <div className="glass-card" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px' }}>Action</th>
                  <th style={{ padding: '12px 16px' }}>User & Role</th>
                  <th style={{ padding: '12px 16px' }}>Target Entity</th>
                  <th style={{ padding: '12px 16px' }}>Details Payload</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(l => {
                  const style = ACTION_COLORS[l.action] || { bg: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '#94a3b8', icon: '📝' };
                  const isExpanded = expandedLogId === l.id;

                  return (
                    <React.Fragment key={l.id}>
                      <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.08)', background: isExpanded ? 'rgba(30, 41, 59, 0.5)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                          {new Date(l.timestamp).toLocaleString()}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: style.bg,
                            border: `1px solid ${style.border}`,
                            color: style.text,
                            fontWeight: 600,
                            fontSize: '0.74rem'
                          }}>
                            <span>{style.icon}</span>
                            <span>{l.action}</span>
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#f8fafc' }}>
                          <div style={{ fontWeight: 600 }}>{l.username || 'System Engine'}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{l.user_role || 'SYSTEM'}</div>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                          <span style={{ color: '#38bdf8' }}>{l.entity_type}</span> : {l.entity_id}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : l.id)}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(148, 163, 184, 0.3)',
                              color: '#38bdf8',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            {isExpanded ? 'Hide Payload' : 'View Payload'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ background: 'rgba(15, 23, 42, 0.9)' }}>
                          <td colSpan="5" style={{ padding: '12px 16px' }}>
                            <pre style={{
                              margin: 0,
                              fontSize: '0.75rem',
                              color: '#a7f3d0',
                              fontFamily: 'monospace',
                              background: 'rgba(2, 6, 23, 0.7)',
                              padding: '12px',
                              borderRadius: '8px',
                              overflowX: 'auto',
                              maxHeight: '200px'
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
    </div>
  );
}
