import React, { useState } from 'react';

export default function TierDonutChart({ tiers = [], totalTonnes = 0 }) {
  const [activeTier, setActiveTier] = useState(null);

  const colors = {
    1: '#2563eb', // Blue - Tier 1
    2: '#059669', // Emerald - Tier 2
    3: '#d97706', // Amber - Tier 3
  };

  const glowColors = {
    1: 'rgba(37, 99, 235, 0.4)',
    2: 'rgba(5, 150, 105, 0.4)',
    3: 'rgba(217, 119, 6, 0.4)',
  };

  const total = Number(totalTonnes) || 1; // Prevent division by zero
  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const segments = tiers.map((t) => {
    const pct = total > 0 ? (Number(t.co2e_tonnes) / total) : 0;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += pct;

    return {
      tier: t.tier,
      tierName: t.tier_name || `Tier ${t.tier}`,
      tonnes: Number(t.co2e_tonnes) || 0,
      kg: Number(t.co2e_kg) || 0,
      pctDisplay: (pct * 100).toFixed(1),
      color: colors[t.tier] || '#64748b',
      strokeDasharray,
      strokeDashoffset,
      suppliersCount: t.supplier_count || 0
    };
  });

  const currentDisplay = activeTier
    ? segments.find((s) => s.tier === activeTier)
    : null;

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">Emissions by Supply Chain Tier</h3>
          <p className="chart-subtitle">Scope 3 breakdown across direct & sub-tier tiers</p>
        </div>
        <span className="unit-badge">Unit: tCO₂e</span>
      </div>

      <div className="donut-chart-container">
        {/* SVG Donut */}
        <div className="svg-wrapper">
          <svg className="donut-svg" viewBox="0 0 200 200" width="100%" height="220">
            <defs>
              <filter id="donut-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Background Circle */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="rgba(16, 185, 129, 0.08)"
              strokeWidth="22"
            />
            {/* Segments */}
            {segments.map((s) => (
              <circle
                key={s.tier}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={activeTier === s.tier ? "28" : "22"}
                strokeDasharray={s.strokeDasharray}
                strokeDashoffset={s.strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                className="donut-segment"
                filter={activeTier === s.tier ? 'url(#donut-glow)' : undefined}
                onMouseEnter={() => setActiveTier(s.tier)}
                onMouseLeave={() => setActiveTier(null)}
                style={{ cursor: 'pointer', transition: 'stroke-width 0.2s ease, opacity 0.2s ease', opacity: activeTier && activeTier !== s.tier ? 0.3 : 1 }}
              />
            ))}
            {/* Inner Center Content */}
            <text x="100" y="94" textAnchor="middle" className="donut-center-label">
              {currentDisplay ? currentDisplay.tierName : 'Total Scope 3'}
            </text>
            <text x="100" y="116" textAnchor="middle" className="donut-center-val">
              {currentDisplay ? `${currentDisplay.tonnes.toFixed(1)}t` : `${Number(totalTonnes).toFixed(1)}t`}
            </text>
            <text x="100" y="132" textAnchor="middle" className="donut-center-sub">
              {currentDisplay ? `${currentDisplay.pctDisplay}% Share` : 'All Tiers'}
            </text>
          </svg>
        </div>

        {/* Interactive Legend List */}
        <div className="donut-legend">
          {segments.map((s) => (
            <div
              key={s.tier}
              className={`legend-item ${activeTier === s.tier ? 'legend-item-active' : ''}`}
              onMouseEnter={() => setActiveTier(s.tier)}
              onMouseLeave={() => setActiveTier(null)}
            >
              <div className="legend-indicator" style={{ backgroundColor: s.color }}></div>
              <div className="legend-info">
                <div className="legend-title-row">
                  <span className="legend-name">{s.tierName}</span>
                  <span className="legend-pct">{s.pctDisplay}%</span>
                </div>
                <div className="legend-meta">
                  <span>{s.tonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e</span>
                  <span className="dot-sep">•</span>
                  <span>{s.suppliersCount} Suppliers</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
