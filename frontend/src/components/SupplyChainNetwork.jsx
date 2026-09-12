import React, { useState } from 'react';

export default function SupplyChainNetwork({ hierarchyData }) {
  const [selectedNode, setSelectedNode] = useState(null);

  const companyName = hierarchyData?.company || 'Enterprise Supply Chain';
  const tree = hierarchyData?.tree || [];
  const summary = hierarchyData?.summary || {};

  return (
    <div className="card chart-card">
      <div className="chart-header flex-between">
        <div>
          <h3 className="chart-title">Multi-Tier Supply Chain Network Hierarchy</h3>
          <p className="chart-subtitle">Direct relationship paths connecting Tier 1, Tier 2, and Tier 3 partners</p>
        </div>
        <div className="network-summary-pills">
          <span className="net-pill pill-t1">{summary.tier1_count || 0} Tier 1</span>
          <span className="net-pill pill-t2">{summary.tier2_count || 0} Tier 2</span>
          <span className="net-pill pill-t3">{summary.tier3_count || 0} Tier 3</span>
        </div>
      </div>

      <div className="network-tree-canvas">
        {/* Step 0: Anchor Enterprise Node */}
        <div className="tree-column enterprise-col">
          <div className="tier-col-header">
            <span className="col-badge badge-company">Anchor Enterprise</span>
          </div>

          <div
            className={`network-node node-enterprise ${selectedNode?.name === companyName ? 'node-selected' : ''}`}
            onClick={() => setSelectedNode({
              name: companyName,
              tier: 'Reporting Company',
              sector: 'Automotive & Clean Transport',
              status: 'ACTIVE',
              desc: 'Focal reporting enterprise auditing Scope 3 greenhouse gas protocol across suppliers.'
            })}
          >
            <div className="node-icon-bubble">🏭</div>
            <div className="node-text-wrap">
              <h4 className="node-name">{companyName}</h4>
              <span className="node-role">Scope 3 Reporting Entity</span>
            </div>
            <span className="node-pulse"></span>
          </div>
        </div>

        {/* Tree Flow Columns */}
        <div className="tree-cascade">
          {tree.map((t1) => (
            <div key={t1.id} className="tree-branch">
              {/* Connector from Company to Tier 1 */}
              <div className="branch-line-h"></div>

              {/* Tier 1 Node */}
              <div className="branch-node-box">
                <div
                  className={`network-node node-t1 ${selectedNode?.id === t1.id ? 'node-selected' : ''}`}
                  onClick={() => setSelectedNode(t1)}
                >
                  <div className="node-tag-row">
                    <span className="node-tier-tag tier-1">Tier 1</span>
                    <span className="node-status-dot active"></span>
                  </div>
                  <h4 className="node-name">{t1.supplier}</h4>
                  <div className="node-subline">{t1.industry_sector}</div>
                  <div className="node-loc">{t1.country}</div>
                  <div className="node-share-pill">{t1.procurement_share_pct}% Share</div>
                </div>

                {/* Sub-branches for Tier 2 */}
                {t1.children && t1.children.length > 0 && (
                  <div className="sub-branch-group">
                    {t1.children.map((t2) => (
                      <div key={t2.id} className="sub-branch-item">
                        {/* Connector from Tier 1 to Tier 2 */}
                        <div className="branch-line-h-sub"></div>

                        {/* Tier 2 Node */}
                        <div
                          className={`network-node node-t2 ${selectedNode?.id === t2.id ? 'node-selected' : ''}`}
                          onClick={() => setSelectedNode(t2)}
                        >
                          <div className="node-tag-row">
                            <span className="node-tier-tag tier-2">Tier 2</span>
                            <span className="node-status-dot active"></span>
                          </div>
                          <h4 className="node-name">{t2.supplier}</h4>
                          <div className="node-subline">{t2.industry_sector}</div>
                          <div className="node-loc">{t2.country}</div>
                          <div className="node-share-pill">{t2.procurement_share_pct}% Share</div>
                        </div>

                        {/* Sub-branches for Tier 3 */}
                        {t2.children && t2.children.length > 0 && (
                          <div className="sub-tier3-group">
                            {t2.children.map((t3) => (
                              <div key={t3.id} className="tier3-item">
                                <div className="branch-line-h-sub"></div>
                                <div
                                  className={`network-node node-t3 ${selectedNode?.id === t3.id ? 'node-selected' : ''}`}
                                  onClick={() => setSelectedNode(t3)}
                                >
                                  <div className="node-tag-row">
                                    <span className="node-tier-tag tier-3">Tier 3</span>
                                    <span className="node-status-dot active"></span>
                                  </div>
                                  <h4 className="node-name">{t3.supplier}</h4>
                                  <div className="node-subline">{t3.industry_sector}</div>
                                  <div className="node-loc">{t3.country}</div>
                                  <div className="node-share-pill">{t3.procurement_share_pct}% Share</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Inspector Drawer */}
      {selectedNode && (
        <div className="node-inspector">
          <div className="inspector-header">
            <span className="inspector-title">Entity Profile & Hierarchy Trace</span>
            <button className="inspector-close" onClick={() => setSelectedNode(null)}>✕</button>
          </div>
          <div className="inspector-content">
            <div className="inspector-field">
              <span className="inspector-k">Entity Name:</span>
              <strong className="inspector-v">{selectedNode.supplier || selectedNode.name}</strong>
            </div>
            <div className="inspector-field">
              <span className="inspector-k">Tier Depth:</span>
              <span className="inspector-v">Tier {selectedNode.tier}</span>
            </div>
            <div className="inspector-field">
              <span className="inspector-k">Industry Sector:</span>
              <span className="inspector-v">{selectedNode.industry_sector || selectedNode.sector}</span>
            </div>
            <div className="inspector-field">
              <span className="inspector-k">Location & Country:</span>
              <span className="inspector-v">{selectedNode.location ? `${selectedNode.location}, ` : ''}{selectedNode.country || 'Global'}</span>
            </div>
            {selectedNode.contact_email && (
              <div className="inspector-field">
                <span className="inspector-k">Contact Channel:</span>
                <span className="inspector-v">{selectedNode.contact_email}</span>
              </div>
            )}
            {selectedNode.supplier_code && (
              <div className="inspector-field">
                <span className="inspector-k">Supplier Code:</span>
                <span className="inspector-v">{selectedNode.supplier_code}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
