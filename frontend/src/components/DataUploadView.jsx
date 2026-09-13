import React, { useState, useRef } from 'react';

const SCHEMA_FIELDS = [
  { col: 'supplier_code',     type: 'String',  req: true,  example: 'SUP-DEMO-T1-01',                       desc: 'Unique registered supplier identifier in the SQLite ledger' },
  { col: 'activity_type',     type: 'String',  req: true,  example: 'Virgin Aluminium, Electricity, Diesel', desc: 'Name of the operational activity (mapped to emission factor library)' },
  { col: 'activity_category', type: 'String',  req: false, example: 'MATERIAL, ELECTRICITY, FUEL, TRANSPORT',desc: 'GHG Protocol Scope 3 activity category code' },
  { col: 'quantity',          type: 'Decimal', req: true,  example: '20000.00',                              desc: 'Numerical quantity of consumption or usage' },
  { col: 'unit',              type: 'String',  req: true,  example: 'kg, kWh, litre, tonne-km',             desc: 'Unit of measurement (must match emission factor library)' },
  { col: 'reporting_period',  type: 'String',  req: true,  example: '2024-Q1, 2024-Annual',                 desc: 'Fiscal/reporting period in YYYY-QN or YYYY-Annual format' },
  { col: 'transport_mode',    type: 'String',  req: false, example: 'Road, Sea, Air, Rail',                 desc: 'Required only for TRANSPORT category records' },
  { col: 'distance_km',       type: 'Decimal', req: false, example: '3701.00',                              desc: 'Distance in km — required for freight logistics records' },
];

const SAMPLE_CSV = `supplier_code,activity_type,activity_category,quantity,unit,reporting_period
SUP-DEMO-T1-01,Virgin Aluminium Ingots,MATERIAL,20000,kg,2024-Annual
SUP-DEMO-T1-01,Purchased Electricity,ELECTRICITY,1450000,kWh,2024-Annual
SUP-DEMO-T2-01,Industrial Diesel,FUEL,45000,litre,2024-Annual
SUP-DEMO-T3-01,Road Freight,TRANSPORT,125000,tonne-km,2024-Annual`;

export default function DataUploadView({ onUploadSuccess }) {
  const [file, setFile]               = useState(null);
  const [dragging, setDragging]       = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadResult, setUploadResult] = useState(null); // { type: 'success'|'error', message, details }
  const [activeTab, setActiveTab]     = useState('upload'); // 'upload' | 'schema' | 'sample'
  const fileInputRef = useRef(null);

  const handleFileChange = (f) => {
    if (f && f.name.endsWith('.csv')) {
      setFile(f);
      setUploadResult(null);
    } else if (f) {
      setUploadResult({ type: 'error', message: 'Only .csv files are accepted.' });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    handleFileChange(dropped);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { setUploadResult({ type: 'error', message: 'Please select a CSV file first.' }); return; }

    try {
      setUploading(true);
      setUploadResult(null);

      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('access_token');
      const res = await fetch('http://127.0.0.1:5000/api/upload-csv/', {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || res.statusText);
      }

      const result = await res.json();
      const count = result.records_created ?? result.created_count ?? result.count ?? '—';
      setUploadResult({
        type: 'success',
        message: `Successfully ingested ${count} activity records.`,
        details: result,
      });
      setFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setUploadResult({ type: 'error', message: err.message || 'CSV ingestion failed. Check column headers.' });
    } finally {
      setUploading(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'sample_scope3_activities.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { id: 'upload', label: '📤 Upload CSV' },
    { id: 'schema', label: '🗂️ CSV Schema' },
    { id: 'sample', label: '📄 Sample File' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ─── PAGE HEADER ─── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
        padding: '22px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
            Supplier Data Ingestion &amp; CSV Upload
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Upload verified operational activity manifests — materials, electricity, fuels, and freight logistics
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#ecfdf5', color: '#065f46', borderRadius: '99px', border: '1px solid rgba(16,185,129,0.25)' }}>
            🛡️ DEFRA / EPA Emission Factors
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', background: '#eff6ff', color: '#2563eb', borderRadius: '99px', border: '1px solid rgba(37,99,235,0.2)' }}>
            GHG Protocol Scope 3
          </span>
        </div>
      </div>

      {/* ─── HOW IT WORKS ─── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px',
        padding: '18px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
          How It Works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0' }}>
          {[
            { step: '01', icon: '📁', title: 'Prepare CSV',        desc: 'Format your file using the required column schema' },
            { step: '02', icon: '📤', title: 'Upload File',        desc: 'Select or drag-and-drop your .csv activity manifest' },
            { step: '03', icon: '🧮', title: 'Auto-Calculate',     desc: 'Engine matches each row to a DEFRA/EPA emission factor' },
            { step: '04', icon: '📊', title: 'View Dashboard',     desc: 'Scope 3 totals update across all tiers in real-time' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '0 16px', borderLeft: i > 0 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                }}>{s.icon}</div>
              </div>
              <div>
                <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em', marginBottom: '3px' }}>STEP {s.step}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '3px' }}>{s.title}</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── TABS ─── */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: '9px', border: 'none',
              fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
              background: activeTab === t.id ? '#0f172a' : '#f1f5f9',
              color:      activeTab === t.id ? '#ffffff'  : '#64748b',
              transition: 'all 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ─── TAB 1: UPLOAD ─── */}
      {activeTab === 'upload' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* Left: Dropzone */}
          <div style={{
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
            padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px 0' }}>Upload Activity Manifest</h3>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>Ingest Scope 3 operational activities for deterministic carbon calculation</p>
            </div>

            {/* Success banner */}
            {uploadResult?.type === 'success' && (
              <div style={{
                background: '#ecfdf5', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '10px', padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>✅</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#065f46', marginBottom: '3px' }}>{uploadResult.message}</div>
                  {uploadResult.details && (
                    <div style={{ fontSize: '11.5px', color: '#059669' }}>
                      Carbon calculations have been triggered and the dashboard will reflect updated Scope 3 totals.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error banner */}
            {uploadResult?.type === 'error' && (
              <div style={{
                background: '#fff1f2', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: '10px', padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#9f1239', marginBottom: '3px' }}>Upload Failed</div>
                  <div style={{ fontSize: '11.5px', color: '#dc2626' }}>{uploadResult.message}</div>
                </div>
              </div>
            )}

            {/* Drop zone */}
            <form onSubmit={handleUpload}>
              <div
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? '#2563eb' : file ? '#10b981' : '#cbd5e1'}`,
                  borderRadius: '14px',
                  padding: '40px 24px',
                  textAlign: 'center',
                  background: dragging ? '#eff6ff' : file ? '#ecfdf5' : '#fafbfc',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '16px',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="csv-file-input"
                  accept=".csv"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />

                <div style={{ fontSize: '36px', marginBottom: '12px' }}>
                  {file ? '✅' : dragging ? '📂' : '📁'}
                </div>

                {file ? (
                  <>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>{file.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {(file.size / 1024).toFixed(1)} KB · CSV file ready to upload
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                      {dragging ? 'Drop your CSV file here' : 'Drag & drop your CSV file, or click to browse'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Supports .csv activity manifest format only</div>
                  </>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={!file || uploading}
                  style={{
                    flex: 1, padding: '11px 20px', borderRadius: '9px', border: 'none',
                    fontSize: '13.5px', fontWeight: 700, cursor: file && !uploading ? 'pointer' : 'not-allowed',
                    background: file && !uploading ? '#065f46' : '#e2e8f0',
                    color: file && !uploading ? '#ffffff' : '#94a3b8',
                    transition: 'all 0.15s',
                    boxShadow: file && !uploading ? '0 2px 8px rgba(6,95,70,0.3)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {uploading ? (
                    <>
                      <div style={{
                        width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)',
                        borderTopColor: '#ffffff', borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                      Processing &amp; Calculating Scope 3…
                    </>
                  ) : '📤 Upload & Calculate Scope 3 CO₂e'}
                </button>
                {file && (
                  <button
                    type="button"
                    onClick={() => { setFile(null); setUploadResult(null); }}
                    style={{
                      padding: '11px 16px', borderRadius: '9px',
                      border: '1px solid #e2e8f0', background: '#f8fafc',
                      fontSize: '12.5px', fontWeight: 600, color: '#64748b',
                      cursor: 'pointer',
                    }}
                  >✕ Clear</button>
                )}
              </div>
            </form>
          </div>

          {/* Right: Notes & Tips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Data pipeline info */}
            <div style={{
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px',
              padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', margin: '0 0 14px 0' }}>🔁 Data Processing Pipeline</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { icon: '📁', label: 'CSV File Received',              sub: 'React → Node.js Gateway (Port 5000)' },
                  { icon: '✅', label: 'Schema Validation',              sub: 'Headers, types, and required fields checked' },
                  { icon: '🔍', label: 'Supplier Code Lookup',           sub: 'Matched against SQLite supplier registry' },
                  { icon: '⚡', label: 'Emission Factor Matching',       sub: 'DEFRA / EPA standard factor library applied' },
                  { icon: '🧮', label: 'Deterministic CO₂e Calculation', sub: 'Quantity × Emission Factor = tCO₂e per row' },
                  { icon: '💾', label: 'Persisted to SQLite',            sub: 'Immutable audit trail written to database' },
                  { icon: '📊', label: 'Dashboard Updated',              sub: 'Scope 3 KPIs and charts reflect new data' },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '7px',
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', flexShrink: 0,
                    }}>{step.icon}</div>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>{step.label}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{step.sub}</div>
                    </div>
                    {i < 6 && (
                      <div style={{ position: 'absolute', marginLeft: '13px', marginTop: '28px', width: '1px', height: '10px', background: '#e2e8f0' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick tip */}
            <div style={{
              background: '#fffbeb', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '12px', padding: '16px',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
            }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>💡</span>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>Emission Factor Library</div>
                <div style={{ fontSize: '11.5px', color: '#78350f', lineHeight: 1.5 }}>
                  The deterministic engine automatically maps each activity type to the appropriate DEFRA 2023 or US EPA emission factor.
                  No manual factor entry required.
                </div>
              </div>
            </div>

            {/* Download sample */}
            <button
              onClick={downloadSample}
              style={{
                background: '#ffffff', border: '1px dashed #cbd5e1',
                borderRadius: '12px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '12px',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#2563eb'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: '#eff6ff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '18px', flexShrink: 0,
              }}>📄</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>Download Sample CSV Template</div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>Pre-formatted with correct headers and demo rows</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '13px', color: '#2563eb', fontWeight: 700 }}>↓</div>
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 2: CSV SCHEMA ─── */}
      {activeTab === 'schema' && (
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
          padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px 0' }}>CSV File Schema &amp; Column Specification</h3>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>All required and optional columns for the activity manifest format</p>
            </div>
            <button
              onClick={downloadSample}
              style={{
                background: '#065f46', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '8px 16px',
                fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >📄 Download Template</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafbfc' }}>
                  {['Column Header', 'Type', 'Required', 'Example Value', 'Description'].map(h => (
                    <th key={h} style={{
                      padding: '11px 14px', fontSize: '10.5px', fontWeight: 700,
                      color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em',
                      textAlign: 'left', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCHEMA_FIELDS.map((f, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px' }}>
                      <code style={{
                        fontSize: '12px', fontWeight: 700,
                        background: '#f1f5f9', color: '#0f172a',
                        padding: '2px 8px', borderRadius: '5px', fontFamily: 'monospace',
                      }}>{f.col}</code>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>{f.type}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
                        background: f.req ? '#ecfdf5' : '#f8fafc',
                        color: f.req ? '#059669' : '#94a3b8',
                      }}>{f.req ? 'Required' : 'Optional'}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748b', fontFamily: 'monospace' }}>{f.example}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{f.desc}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: '16px', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.2)',
            borderRadius: '10px', padding: '14px 16px',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>ℹ️</span>
            <div style={{ fontSize: '12px', color: '#1e40af', lineHeight: 1.5 }}>
              <strong>Emission Factor Auto-Matching:</strong> The system cross-references each <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: '4px' }}>activity_type</code> value
              against the built-in DEFRA 2023 / US EPA emission factor library. Common materials, fuel types, electricity grids,
              and transport modes are supported out-of-the-box.
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: SAMPLE FILE ─── */}
      {activeTab === 'sample' && (
        <div style={{
          background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
          padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 3px 0' }}>Sample CSV Activity Manifest</h3>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                Example rows demonstrating materials, electricity, fuel, and transport activity categories
              </p>
            </div>
            <button
              onClick={downloadSample}
              style={{
                background: '#065f46', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '8px 16px',
                fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >↓ Download Template</button>
          </div>

          {/* Code block preview */}
          <div style={{
            background: '#0f172a', borderRadius: '12px', padding: '20px 24px',
            fontFamily: 'Consolas, Monaco, monospace', fontSize: '12.5px',
            lineHeight: 1.7, overflowX: 'auto', marginBottom: '16px',
          }}>
            <div style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.04em' }}>
              sample_scope3_activities.csv
            </div>
            {SAMPLE_CSV.split('\n').map((line, i) => (
              <div key={i}>
                {i === 0 ? (
                  <span style={{ color: '#7dd3fc' }}>{line}</span>
                ) : (
                  <span>
                    {line.split(',').map((cell, ci) => (
                      <span key={ci} style={{ color: ci === 0 ? '#fca5a5' : ci === 2 ? '#86efac' : '#e2e8f0' }}>
                        {cell}{ci < line.split(',').length - 1 ? ',' : ''}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Row explanations */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {[
              { icon: '📦', cat: 'MATERIAL',    color: '#8b5cf6', bg: '#faf5ff', desc: 'Virgin Aluminium Ingots — 20,000 kg purchased from Tier 3 smelter. High embedded carbon intensity.' },
              { icon: '⚡', cat: 'ELECTRICITY', color: '#0891b2', bg: '#ecfeff', desc: 'Purchased electricity — 1.45 MWh from an East Asia grid. Grid intensity 0.582 kg CO₂e/kWh.' },
              { icon: '🔥', cat: 'FUEL',        color: '#ea580c', bg: '#fff7ed', desc: 'Industrial diesel — 45,000 litres consumed in Tier 2 manufacturing operations.' },
              { icon: '🚛', cat: 'TRANSPORT',   color: '#0f766e', bg: '#f0fdf4', desc: 'Road freight — 125,000 tonne-km of upstream logistics (Scope 3 Category 4).' },
            ].map((r, i) => (
              <div key={i} style={{
                background: r.bg, border: `1px solid ${r.color}20`,
                borderRadius: '10px', padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: `${r.color}15`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '15px', flexShrink: 0,
                }}>{r.icon}</div>
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: 800, color: r.color, letterSpacing: '0.04em', marginBottom: '3px' }}>{r.cat}</div>
                  <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.5 }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
