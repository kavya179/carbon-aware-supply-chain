import React from 'react';
import ConceptTooltip from './ConceptTooltip';

export default function ActivityBreakdown({ activities = [], totalTonnes = 0, onOpenGuide }) {
  const activityIcons = {
    'MATERIAL': '📦',
    'ELECTRICITY': '⚡',
    'FUEL': '🔥',
    'TRANSPORT': '🚚',
    'OTHER': '⚙️'
  };

  const activityColors = {
    'MATERIAL': '#8b5cf6', // Violet
    'ELECTRICITY': '#06b6d4', // Cyan
    'FUEL': '#f97316', // Orange
    'TRANSPORT': '#10b981', // Emerald
    'OTHER': '#64748b'
  };

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <div>
          <div className="title-with-tooltip">
            <h3 className="chart-title">Emissions by Operational Activity</h3>
            <ConceptTooltip
              conceptId="emission-factor"
              label="Activity-Based Accounting"
              tooltipText="Emissions categorized by activity: Materials (embodied), Electricity (purchased), Fuel (combustion), and Logistics."
              onOpenGuide={onOpenGuide}
            />
          </div>
          <p className="chart-subtitle">GHG Protocol Scope 3 activity-level carbon breakdown</p>
        </div>
        <span className="unit-badge">Unit: tCO₂e</span>
      </div>

      <div className="activity-cards-grid">
        {activities.map((act) => {
          const color = activityColors[act.activity_code] || '#3b82f6';
          const icon = activityIcons[act.activity_code] || '📊';
          const tonnes = Number(act.total_emissions_tonnes || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

          return (
            <div key={act.activity_code} className="activity-stat-card">
              <div className="activity-stat-top">
                <div className="activity-icon-box" style={{ backgroundColor: `${color}15`, color: color }}>
                  {icon}
                </div>
                <div className="activity-pct-pill" style={{ color: color, borderColor: `${color}40` }}>
                  {act.contribution_pct}% Share
                </div>
              </div>

              <h4 className="activity-name">{act.activity_name}</h4>

              <div className="activity-tonnes-val">
                <span className="activity-num">{tonnes}</span>
                <span className="activity-u">tCO₂e</span>
              </div>

              <div className="activity-progress-bar">
                <div
                  className="activity-progress-fill"
                  style={{
                    width: `${Math.min(Math.max(act.contribution_pct, 2), 100)}%`,
                    backgroundColor: color
                  }}
                ></div>
              </div>

              <div className="activity-source-meta">
                <span className="source-label">Driver:</span>
                <span className="source-val">{act.top_supplier || 'Multiple entities'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
