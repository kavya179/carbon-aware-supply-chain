import React, { useState } from 'react';

// ── Tier style config ──────────────────────────────────────────
const TIER_CONFIG = {
  1: { label: 'Tier 1', role: 'Direct Supplier',          bg: '#eff6ff', color: '#1e40af', border: 'rgba(37,99,235,0.3)',   dot: '#2563eb', dark: '#1e40af' },
  2: { label: 'Tier 2', role: 'Subcontractor',            bg: '#faf5ff', color: '#5b21b6', border: 'rgba(124,58,237,0.3)',  dot: '#7c3aed', dark: '#5b21b6' },
  3: { label: 'Tier 3', role: 'Raw Material Upstream',    bg: '#fff1f2', color: '#9f1239', border: 'rgba(220,38,38,0.3)',   dot: '#dc2626', dark: '#9f1239' },
};

// ── Node Card ─────────────────────────────────────────────────
function NodeCard({ node, tier, selected, onClick, isHotspot }) {
  const tc = TIER_CONFIG[tier] || TIER_CONFIG[1];
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? tc.bg : '#ffffff',
        border: `1.5px solid ${selected ? tc.dot : '#e2e8f0'}`,
        borderRadius: '12px',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: selected
          ? `0 0 0 3px ${tc.dot}25, 0 4px 14px rgba(0,0,0,0.08)`
          : '0 1px 3px rgba(0,0,0,0.04)',
        minWidth: '170px',
        maxWidth: '200px',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
    >
      {/* Hotspot flame tag */}
      {isHotspot && (
        <div style={{
          position: 'absolute', top: '-8px', right: '10px',
          fontSize: '10px', fontWeight: 800,
          padding: '2px 8px', borderRadius: '99px',
          background: '#dc2626', color: '#fff',
          letterSpacing: '0.04em'
        }}>🔥 HOTSPOT</div>
      )}

      {/* Tier badge + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{
          fontSize: '9.5px', fontWeight: 800, padding: '2px 8px',
          borderRadius: '99px', background: tc.bg, color: tc.color,
          border: `1px solid ${tc.border}`, letterSpacing: '0.04em'
        }}>{tc.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: node.status === 'PENDING_VERIFICATION' ? '#f59e0b' : '#10b981',
          }} />
          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>
            {node.status === 'PENDING_VERIFICATION' ? 'PENDING' : 'ACTIVE'}
          </span>
        </div>
      </div>

      {/* Name */}
      <div style={{
        fontSize: '12.5px', fontWeight: 700, color: '#0f172a',
        lineHeight: 1.35, marginBottom: '4px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }} title={node.supplier}>{node.supplier}</div>

      {/* Sector */}
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.industry_sector || '—'}
      </div>

      {/* Footer metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10.5px', color: '#475569' }}>📍 {node.country || 'Global'}</span>
        {node.procurement_share_pct && (
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '1px 7px',
            borderRadius: '99px', background: '#f1f5f9', color: '#475569',
            marginLeft: 'auto'
          }}>{node.procurement_share_pct}% share</span>
        )}
      </div>
    </div>
  );
}

// ── Horizontal connector line ────────────────────────────────
function HConnector({ color = '#cbd5e1' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      width: '32px', flexShrink: 0,
    }}>
      <div style={{ height: '2px', width: '100%', background: color }} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function SupplyChainNetwork({ hierarchyData }) {
  const [selectedNode, setSelectedNode] = useState(null);

  const companyName = hierarchyData?.company || 'Apex Motors Corporation';
  const tree        = hierarchyData?.tree    || [];
  const summary     = hierarchyData?.summary || {};

  const t1Count = summary.tier1_count || tree.length;
  const t2Count = summary.tier2_count || tree.reduce((a, t1) => a + (t1.children?.length || 0), 0);
  const t3Count = summary.tier3_count || tree.reduce((a, t1) => a + (t1.children || []).reduce((b, t2) => b + (t2.children?.length || 0), 0), 0);
  const totalNodes = 1 + t1Count + t2Count + t3Count;

  const handleSelect = (node) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  };

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
            Multi-Tier Supply Chain Network
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Interactive traceability graph — click any node to inspect the supplier profile and relationship path
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[
            { label: `${t1Count} Tier 1`, bg: '#eff6ff', color: '#1e40af' },
            { label: `${t2Count} Tier 2`, bg: '#faf5ff', color: '#5b21b6' },
            { label: `${t3Count} Tier 3`, bg: '#fff1f2', color: '#9f1239' },
          ].map(p => (
            <span key={p.label} style={{
              fontSize: '11.5px', fontWeight: 700, padding: '4px 12px',
              borderRadius: '99px', background: p.bg, color: p.color
            }}>{p.label}</span>
          ))}
        </div>
      </div>

      {/* ─── SUMMARY STATS ROW ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total Entities',    value: totalNodes, icon: '🕸️', sub: 'All tiers incl. OEM',          bg: '#f8fafc', ac: '#0f172a' },
          { label: 'Tier 1 Direct',     value: t1Count,    icon: '🔵', sub: 'Direct procurement partners',  bg: '#eff6ff', ac: '#1e40af' },
          { label: 'Tier 2 Sub-Tier',   value: t2Count,    icon: '🟣', sub: 'Subcontractor organizations',  bg: '#faf5ff', ac: '#5b21b6' },
          { label: 'Tier 3 Upstream',   value: t3Count,    icon: '🔴', sub: 'Raw material & smelters',      bg: '#fff1f2', ac: '#9f1239' },
        ].map((s, i) => (
          <div key={i} style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: s.bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '18px', flexShrink: 0
            }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.ac, lineHeight: 1, letterSpacing: '-0.03em' }}>{s.value}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{s.label}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── NETWORK GRAPH CANVAS ─── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden'
      }}>
        {/* Canvas header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fafbfc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
              Supply Chain Hierarchy Map · {totalNodes} Nodes
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
            Click any node to inspect → 
          </div>
        </div>

        {/* Scrollable canvas */}
        <div style={{ overflowX: 'auto', padding: '32px 28px', minHeight: '320px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', width: 'max-content' }}>

            {/* ── Column 0: OEM Anchor ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div style={{
                fontSize: '9.5px', fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: '12px', paddingLeft: '2px'
              }}>Anchor Enterprise</div>

              <div
                onClick={() => setSelectedNode(selectedNode?.name === companyName ? null : {
                  id: 'oem',
                  supplier: companyName,
                  industry_sector: 'Automotive & Electric Mobility',
                  country: 'Germany',
                  location: 'Munich',
                  status: 'ACTIVE',
                  supplier_code: 'APEX-MOTORS-OEM',
                  procurement_share_pct: null,
                  _tier: 'OEM'
                })}
                style={{
                  background: selectedNode?.name === companyName || selectedNode?.id === 'oem' ? '#ecfdf5' : '#ffffff',
                  border: `1.5px solid ${selectedNode?.id === 'oem' ? '#059669' : 'rgba(16,185,129,0.4)'}`,
                  borderRadius: '14px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: selectedNode?.id === 'oem'
                    ? '0 0 0 3px rgba(16,185,129,0.2), 0 4px 14px rgba(0,0,0,0.08)'
                    : '0 1px 4px rgba(0,0,0,0.05)',
                  width: '190px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '9px',
                    background: '#ecfdf5', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '18px', flexShrink: 0,
                    border: '1px solid rgba(16,185,129,0.3)'
                  }}>🏢</div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#059669', letterSpacing: '0.04em' }}>OEM ANCHOR</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>ACTIVE</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#065f46', lineHeight: 1.3, marginBottom: '4px' }}>
                  {companyName}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Scope 3 Reporting Entity</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>📍 Munich, Germany</div>
              </div>
            </div>

            {/* ── Tree: T1 → T2 → T3 ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '33px' }}>
              {(tree.length > 0 ? tree : FALLBACK_TREE).map((t1, t1idx) => (
                <div key={t1.id || t1idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0' }}>

                  {/* Connector OEM → T1 */}
                  <div style={{ display: 'flex', alignItems: 'center', height: '48px', marginTop: '8px' }}>
                    <div style={{ height: '2px', width: '28px', background: '#2563eb40' }} />
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#2563eb', flexShrink: 0
                    }} />
                    <div style={{ height: '2px', width: '8px', background: '#2563eb40' }} />
                  </div>

                  {/* T1 Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {t1idx === 0 && (
                      <div style={{
                        fontSize: '9.5px', fontWeight: 700, color: '#94a3b8',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        marginBottom: '12px', paddingLeft: '2px'
                      }}>Tier 1 — Direct</div>
                    )}
                    <NodeCard
                      node={t1}
                      tier={1}
                      selected={selectedNode?.id === t1.id}
                      onClick={() => handleSelect({ ...t1, _tier: 1 })}
                    />
                  </div>

                  {/* T2 sub-branches */}
                  {(t1.children || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {(t1.children || []).map((t2, t2idx) => (
                        <div key={t2.id || t2idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0' }}>

                          {/* Connector T1 → T2 */}
                          <div style={{ display: 'flex', alignItems: 'center', height: '48px', marginTop: '8px' }}>
                            <div style={{ height: '2px', width: '20px', background: '#7c3aed40' }} />
                            <div style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: '#7c3aed', flexShrink: 0
                            }} />
                            <div style={{ height: '2px', width: '8px', background: '#7c3aed40' }} />
                          </div>

                          {/* T2 Column */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {t1idx === 0 && t2idx === 0 && (
                              <div style={{
                                fontSize: '9.5px', fontWeight: 700, color: '#94a3b8',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                marginBottom: '12px', paddingLeft: '2px'
                              }}>Tier 2 — Sub-Tier</div>
                            )}
                            <NodeCard
                              node={t2}
                              tier={2}
                              selected={selectedNode?.id === t2.id}
                              onClick={() => handleSelect({ ...t2, _tier: 2 })}
                            />
                          </div>

                          {/* T3 sub-branches */}
                          {(t2.children || []).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              {(t2.children || []).map((t3, t3idx) => {
                                const isHotspot = t3.supplier?.toLowerCase().includes('siberia') || t3.supplier?.toLowerCase().includes('smelting');
                                return (
                                  <div key={t3.id || t3idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0' }}>

                                    {/* Connector T2 → T3 */}
                                    <div style={{ display: 'flex', alignItems: 'center', height: '48px', marginTop: '8px' }}>
                                      <div style={{ height: '2px', width: '20px', background: isHotspot ? '#dc262640' : '#dc262630' }} />
                                      <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: isHotspot ? '#dc2626' : '#f97316', flexShrink: 0
                                      }} />
                                      <div style={{ height: '2px', width: '8px', background: isHotspot ? '#dc262640' : '#dc262630' }} />
                                    </div>

                                    {/* T3 Column */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                      {t1idx === 0 && t2idx === 0 && t3idx === 0 && (
                                        <div style={{
                                          fontSize: '9.5px', fontWeight: 700, color: '#94a3b8',
                                          textTransform: 'uppercase', letterSpacing: '0.06em',
                                          marginBottom: '12px', paddingLeft: '2px'
                                        }}>Tier 3 — Raw Upstream</div>
                                      )}
                                      <NodeCard
                                        node={t3}
                                        tier={3}
                                        selected={selectedNode?.id === t3.id}
                                        onClick={() => handleSelect({ ...t3, _tier: 3 })}
                                        isHotspot={isHotspot}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── SELECTED NODE INSPECTOR PANEL ─── */}
      {selectedNode && (
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden'
        }}>
          {/* Inspector header */}
          {(() => {
            const tier = selectedNode._tier;
            const tc   = tier && TIER_CONFIG[tier] ? TIER_CONFIG[tier] : { label: 'OEM Anchor', bg: '#ecfdf5', color: '#059669', dot: '#059669', role: 'Reporting Entity' };
            const name = selectedNode.supplier || selectedNode.name || companyName;
            return (
              <>
                <div style={{
                  padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#fafbfc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px' }}>🔍</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Entity Profile & Hierarchy Trace</span>
                    <span style={{
                      fontSize: '10.5px', fontWeight: 800, padding: '2px 10px',
                      borderRadius: '99px', background: tc.bg, color: tc.color
                    }}>{tc.label}</span>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: '#64748b', fontWeight: 600 }}
                  >✕ Close</button>
                </div>

                <div style={{ padding: '24px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>{name}</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                      {tc.role} · {selectedNode.industry_sector || 'Automotive'}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    {[
                      { label: 'Tier Depth',       value: tier ? `Tier ${tier}` : 'OEM' },
                      { label: 'Location',          value: selectedNode.location ? `${selectedNode.location}` : '—' },
                      { label: 'Country',           value: selectedNode.country || 'Germany' },
                      { label: 'Procurement Share', value: selectedNode.procurement_share_pct ? `${selectedNode.procurement_share_pct}%` : '—' },
                    ].map((m, i) => (
                      <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                        <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>{m.label}</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {selectedNode.supplier_code && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                        <span style={{ fontSize: '13px' }}>🏷️</span>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Supplier Code</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{selectedNode.supplier_code}</div>
                        </div>
                      </div>
                    )}
                    {selectedNode.contact_email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                        <span style={{ fontSize: '13px' }}>✉️</span>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contact Channel</div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{selectedNode.contact_email}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedNode.status === 'PENDING_VERIFICATION' ? '#f59e0b' : '#10b981' }} />
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Relationship Status</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                          {selectedNode.status === 'PENDING_VERIFICATION' ? '⏳ Pending Verification' : '✓ Active & Audited'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ─── LEGEND ─── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px',
        padding: '16px 24px', display: 'flex', alignItems: 'center',
        gap: '24px', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>Legend:</span>
        {[
          { dot: '#059669', label: 'Anchor OEM (Reporting Entity)' },
          { dot: '#2563eb', label: 'Tier 1 — Direct Supplier' },
          { dot: '#7c3aed', label: 'Tier 2 — Subcontractor' },
          { dot: '#dc2626', label: 'Tier 3 — Raw Material Upstream' },
          { dot: '#10b981', label: 'Active / Audited' },
          { dot: '#f59e0b', label: 'Pending Verification' },
        ].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: l.dot, flexShrink: 0 }} />
            <span style={{ fontSize: '11.5px', color: '#475569' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#94a3b8' }}>
          ↔ Scroll horizontally to explore full network
        </div>
      </div>
    </div>
  );
}

// ── Fallback demo tree when API has no data ───────────────────
const FALLBACK_TREE = [
  {
    id: 'f-t1-01', supplier: 'Apex Battery Systems GmbH [DEMO]',
    industry_sector: 'Automotive Manufacturing', country: 'Germany',
    location: 'Stuttgart', procurement_share_pct: 45, status: 'ACTIVE',
    children: [
      {
        id: 'f-t2-01', supplier: 'Voltaic Cell Innovations [DEMO]',
        industry_sector: 'Electronics Assembly', country: 'South Korea',
        location: 'Ulsan', procurement_share_pct: 70, status: 'ACTIVE',
        children: [
          { id: 'f-t3-02', supplier: 'Atacama Lithium Refining Ltd [DEMO]', industry_sector: 'Chemical Processing', country: 'Chile', location: 'Antofagasta', procurement_share_pct: 85, status: 'ACTIVE' },
        ]
      }
    ]
  },
  {
    id: 'f-t1-02', supplier: 'Kinetic Motor Works Ltd [DEMO]',
    industry_sector: 'Automotive & Transport Equipment', country: 'United Kingdom',
    location: 'Birmingham', procurement_share_pct: 35, status: 'ACTIVE',
    children: [
      {
        id: 'f-t2-02', supplier: 'Silicon Semi Foundry Inc [DEMO]',
        industry_sector: 'Semiconductor Fabrication', country: 'Taiwan',
        location: 'Hsinchu', procurement_share_pct: 60, status: 'ACTIVE',
        children: [
          { id: 'f-t3-03', supplier: 'Vales Copper & Metals SA [DEMO]', industry_sector: 'Mining & Raw Materials', country: 'Brazil', location: 'Carajas', procurement_share_pct: 75, status: 'ACTIVE' },
        ]
      },
      {
        id: 'f-t2-04', supplier: 'Alpine Precision Components [DEMO]',
        industry_sector: 'Automotive Manufacturing', country: 'Austria',
        location: 'Graz', procurement_share_pct: 40, status: 'PENDING_VERIFICATION',
        children: []
      }
    ]
  },
  {
    id: 'f-t1-03', supplier: 'AeroBody Chassis Systems [DEMO]',
    industry_sector: 'Automotive Manufacturing', country: 'Sweden',
    location: 'Gothenburg', procurement_share_pct: 20, status: 'ACTIVE',
    children: [
      {
        id: 'f-t2-03', supplier: 'Nordic Extrusions AB [DEMO]',
        industry_sector: 'Steel & Metals', country: 'Sweden',
        location: 'Stockholm', procurement_share_pct: 80, status: 'ACTIVE',
        children: [
          { id: 'f-t3-01', supplier: 'Siberia & Nord Smelting Co [DEMO]', industry_sector: 'Mining & Raw Materials', country: 'Russia', location: 'Krasnoyarsk', procurement_share_pct: 90, status: 'ACTIVE' },
          { id: 'f-t3-04', supplier: 'Nordic Recycled Alloys [DEMO]', industry_sector: 'Mining & Raw Materials', country: 'Norway', location: 'Oslo', procurement_share_pct: 10, status: 'ACTIVE' },
        ]
      }
    ]
  },
];
