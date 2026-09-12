import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function SupplierNetworkGraph({ networkData }) {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    if (!networkData || !networkData.nodes) return;
    
    // Process backend data into react-force-graph format
    // Assumes networkData has { nodes: [{ id, name, tier, totalEmissions }], links: [{ source, target }] }
    setGraphData(networkData);
  }, [networkData]);

  // Center the graph on load
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 50);
      }, 500);
    }
  }, [graphData]);

  // Node drawing logic: Hotspots are red, others are tier-colored
  const paintNode = (node, ctx, globalScale) => {
    const isHotspot = node.isHotspot; 
    const size = Math.max(4, Math.log10(node.totalEmissions || 10) * 3);
    
    // Draw hotspot border
    if (isHotspot) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
      ctx.fillStyle = '#ef4444'; // Solid Red outline
      ctx.fill();
    }

    // Node core
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
    
    // Colors by Tier
    if (node.tier === 1) ctx.fillStyle = '#10b981'; // Green
    else if (node.tier === 2) ctx.fillStyle = '#f59e0b'; // Amber
    else if (node.tier === 3) ctx.fillStyle = '#2563eb'; // Blue
    else ctx.fillStyle = '#cbd5e1'; // Company / Other
    
    ctx.fill();

    // Node label
    const label = node.name;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(label, node.x, node.y + size + fontSize);
  };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeLabel={(node) => `
          <div style="background: #ffffff; padding: 8px; border-radius: 4px; border: 1px solid #e2e8f0; color: #0f172a; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <strong style="color: #2563eb">${node.name}</strong><br/>
            Tier: ${node.tier || 'Root'}<br/>
            Emissions: ${Math.round(node.totalEmissions || 0).toLocaleString()} tCO2e
          </div>
        `}
        nodeCanvasObject={paintNode}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkColor={() => 'rgba(139, 163, 181, 0.3)'}
        d3VelocityDecay={0.1}
        cooldownTicks={100}
      />
    </div>
  );
}
