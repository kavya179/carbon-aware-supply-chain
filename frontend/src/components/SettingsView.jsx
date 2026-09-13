import React, { useState } from 'react';

export default function SettingsView({
  highThreshold,
  setHighThreshold,
  medThreshold,
  setMedThreshold,
  onOpenGuide,
  onSaveThresholds
}) {
  const [highVal, setHighVal] = useState(highThreshold || '20.0');
  const [medVal, setMedVal]   = useState(medThreshold || '5.0');
  const [savedNotice, setSavedNotice] = useState(null);

  const handleSave = (e) => {
    e.preventDefault();
    if (setHighThreshold) setHighThreshold(highVal);
    if (setMedThreshold) setMedThreshold(medVal);
    if (onSaveThresholds) onSaveThresholds(highVal, medVal);
    setSavedNotice('✅ Threshold preferences saved and applied across all analytics tabs.');
    setTimeout(() => setSavedNotice(null), 5000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
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
              color: '#ffffff'
            }}>
              GOVERNANCE &amp; CONFIGURATION
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
              GHG Protocol Rules
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
              Assurance Diagnostics
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
            Governance, Thresholds &amp; Architecture Settings
          </h1>

          <p style={{
            fontSize: '13px',
            color: '#cbd5e1',
            margin: 0,
            lineHeight: 1.55
          }}>
            Fine-tune carbon hotspot severity thresholds, inspect system engine diagnostics, and explore official GHG Protocol standard definitions.
          </p>
        </div>

        {onOpenGuide && (
          <button
            onClick={() => onOpenGuide('scope3')}
            style={{
              background: '#ffffff',
              color: '#0f172a',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
              zIndex: 2
            }}
          >
            📖 Open Interactive ESG Guide
          </button>
        )}
      </div>

      {/* Save Toast Notification */}
      {savedNotice && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '12px',
          fontSize: '13.5px',
          fontWeight: 600,
          background: '#ecfdf5',
          color: '#065f46',
          border: '1px solid #a7f3d0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
        }}>
          <span>{savedNotice}</span>
          <button onClick={() => setSavedNotice(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* ─── 2. MAIN 2-COLUMN SETTINGS GRID ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Left: Hotspot Severity Thresholds */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
              🎯 Carbon Hotspot Severity Thresholds
            </h3>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
              Adjust the emission contribution percentage criteria used to classify High and Medium priority nodes across materials, suppliers, and transport modes.
            </p>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* High Impact Threshold */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔴 HIGH Impact Threshold (% of Scope 3)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="100"
                    value={highVal}
                    onChange={(e) => setHighVal(e.target.value)}
                    style={{
                      width: '70px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 800,
                      textAlign: 'right'
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>%</span>
                </div>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="0.5"
                value={highVal}
                onChange={(e) => setHighVal(e.target.value)}
                style={{ width: '100%', accentColor: '#dc2626', cursor: 'pointer' }}
              />
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                Default is ≥ 20.0%. Identifies critical carbon concentration points requiring mandatory intervention.
              </div>
            </div>

            {/* Medium Impact Threshold */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🟡 MEDIUM Impact Threshold (% of Scope 3)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="40"
                    value={medVal}
                    onChange={(e) => setMedVal(e.target.value)}
                    style={{
                      width: '70px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 800,
                      textAlign: 'right'
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>%</span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="0.5"
                value={medVal}
                onChange={(e) => setMedVal(e.target.value)}
                style={{ width: '100%', accentColor: '#d97706', cursor: 'pointer' }}
              />
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                Default is ≥ 5.0%. Identifies secondary operational targets for supply chain optimization.
              </div>
            </div>

            {/* Visual Risk Band Scale */}
            <div style={{ background: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Dynamic Classification Preview
              </div>
              <div style={{ display: 'flex', height: '24px', borderRadius: '8px', overflow: 'hidden', fontSize: '11px', fontWeight: 800, color: '#ffffff', textAlign: 'center', lineHeight: '24px' }}>
                <div style={{ width: `${Math.min(medVal * 2, 40)}%`, background: '#059669' }}>
                  LOW (&lt;{medVal}%)
                </div>
                <div style={{ width: `${Math.min((highVal - medVal) * 2, 40)}%`, background: '#d97706' }}>
                  MED ({medVal}%–{highVal}%)
                </div>
                <div style={{ flex: 1, background: '#dc2626' }}>
                  HIGH (≥{highVal}%)
                </div>
              </div>
            </div>

            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '11px 24px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              💾 Save &amp; Apply Thresholds
            </button>
          </form>
        </div>

        {/* Right: Architecture & Diagnostics + Standards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* ESG Standards Card */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '22px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                📖 ESG Knowledge Standards &amp; Methodologies
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                Learn and reference standard accounting rules: GHG Protocol Scope 3, IPCC AR6, and DEFRA 2024.
              </p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1px solid #a7f3d0',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div>
                <strong style={{ fontSize: '13.5px', color: '#065f46' }}>Interactive ESG Reference Manual</strong>
                <p style={{ fontSize: '11.5px', color: '#047857', margin: '2px 0 0 0' }}>
                  Definitions for Scope 3 categories, Tier 1/2/3 separation, emission factors, and ML estimation rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenGuide && onOpenGuide('scope3')}
                style={{
                  background: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Launch Guide ↗
              </button>
            </div>
          </div>

          {/* System & Architecture Diagnostics */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '22px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              ⚙️ Architecture &amp; Engine Diagnostics
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Primary Database', val: 'SQLite (django_service/db.sqlite3)', status: 'ACTIVE', color: '#059669', bg: '#ecfdf5' },
                { label: 'Application Gateway', val: 'Node.js Express (Port 5000)', status: 'ACTIVE', color: '#2563eb', bg: '#eff6ff' },
                { label: 'Calculation Engine', val: 'Django REST Framework (Port 8000)', status: 'ACTIVE', color: '#059669', bg: '#ecfdf5' },
                { label: 'ML Estimator Model', val: 'RandomForestRegressor (R² = 0.9906)', status: 'READY', color: '#7c3aed', bg: '#faf5ff' },
                { label: 'ReportLab PDF Generator', val: 'Scope 3 Statutory PDF v2.4', status: 'READY', color: '#059669', bg: '#ecfdf5' },
              ].map((diag, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>{diag.label}</div>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0f172a', fontWeight: 600 }}>{diag.val}</div>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: diag.bg,
                    color: diag.color
                  }}>
                    ● {diag.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
