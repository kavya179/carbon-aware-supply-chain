import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import './CsvUpload.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const DATA_TYPES = [
  { id: 'energy',    label: 'Energy Data',    icon: '⚡', color: '#f59e0b' },
  { id: 'transport', label: 'Transport Data',  icon: '🚛', color: '#3b82f6' },
  { id: 'material',  label: 'Material Data',   icon: '🏭', color: '#8b5cf6' },
];

export default function CsvUpload() {
  const [dataType, setDataType]           = useState('energy');
  const [supplierId, setSupplierId]       = useState('');
  const [reportingStart, setReportingStart] = useState('');
  const [reportingEnd, setReportingEnd]   = useState('');
  const [file, setFile]                   = useState(null);
  const [isDragging, setIsDragging]       = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [result, setResult]               = useState(null);
  const [activeResultTab, setActiveResultTab] = useState('valid');
  const fileInputRef = useRef(null);

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast.error('Only .csv files are accepted.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('File exceeds 5 MB limit.');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const onFileChange = (e) => handleFile(e.target.files[0]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true);  };
  const onDragLeave = ()  => setIsDragging(false);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file)        { toast.error('Please select a CSV file.');    return; }
    if (!supplierId)  { toast.error('Supplier ID is required.');     return; }
    if (!reportingStart || !reportingEnd) {
      toast.error('Reporting period dates are required.');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('supplierId', supplierId);
      formData.append('reportingStart', reportingStart);
      formData.append('reportingEnd', reportingEnd);

      const res = await fetch(`${API}/submissions/upload/${dataType}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok && res.status !== 207) throw new Error(json.error || 'Upload failed');

      setResult(json);
      setActiveResultTab(json.invalidRows?.length > 0 ? 'invalid' : 'valid');

      if (json.summary?.stored > 0) {
        toast.success(`${json.summary.stored} records stored successfully!`);
      } else {
        toast.error('No valid rows to store. Check the validation errors below.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API}/submissions/templates/${dataType}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { toast.error('Could not download template.'); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `template_${dataType}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const clearFile = () => { setFile(null); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const activeType = DATA_TYPES.find(t => t.id === dataType);

  return (
    <div className="cu-page">
      {/* ── Header ── */}
      <div className="cu-header">
        <div>
          <h1 className="cu-title">Bulk CSV Upload</h1>
          <p className="cu-subtitle">Upload energy, transport or material data from a CSV file</p>
        </div>
        <a href="/submit" className="cu-back-link">✏️ Manual entry instead</a>
      </div>

      {/* ── Top Row: Type Selector + Template Download ── */}
      <div className="cu-top-row">
        <div className="cu-type-cards">
          {DATA_TYPES.map((t) => (
            <button
              key={t.id} type="button"
              className={`cu-type-card ${dataType === t.id ? 'cu-type-active' : ''}`}
              style={dataType === t.id ? { borderColor: t.color, boxShadow: `0 0 0 2px ${t.color}22` } : {}}
              onClick={() => { setDataType(t.id); setResult(null); }}
            >
              <span className="cu-type-icon">{t.icon}</span>
              <span className="cu-type-label">{t.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button" id="downloadTemplateBtn"
          className="cu-template-btn"
          onClick={handleDownloadTemplate}
        >
          ⬇ Download Template
        </button>
      </div>

      <div className="cu-layout">
        {/* ── Left: Upload Form ── */}
        <div className="cu-form-card">
          <form onSubmit={handleUpload}>
            {/* Supplier + Dates */}
            <div className="cu-fields">
              <div className="cu-field">
                <label className="cu-label">Supplier ID <span className="cu-req">*</span></label>
                <input
                  id="csvSupplierId"
                  className="cu-input" placeholder="e.g. SUP-1-AB3C4D"
                  value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                />
              </div>
              <div className="cu-field">
                <label className="cu-label">Reporting Start <span className="cu-req">*</span></label>
                <input
                  id="csvReportingStart"
                  type="date" className="cu-input"
                  value={reportingStart} onChange={(e) => setReportingStart(e.target.value)}
                />
              </div>
              <div className="cu-field">
                <label className="cu-label">Reporting End <span className="cu-req">*</span></label>
                <input
                  id="csvReportingEnd"
                  type="date" className="cu-input"
                  value={reportingEnd} onChange={(e) => setReportingEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Drop Zone */}
            <div
              className={`cu-dropzone ${isDragging ? 'cu-dropzone-active' : ''} ${file ? 'cu-dropzone-filled' : ''}`}
              onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
              onClick={() => !file && fileInputRef.current?.click()}
              style={file ? { borderColor: activeType.color } : {}}
            >
              <input
                ref={fileInputRef} type="file" accept=".csv,.txt"
                className="cu-file-input" onChange={onFileChange}
                id="csvFileInput"
              />
              {!file ? (
                <>
                  <div className="cu-drop-icon">📂</div>
                  <p className="cu-drop-text">Drag & drop your CSV here</p>
                  <p className="cu-drop-hint">or click to browse · Max 5 MB</p>
                </>
              ) : (
                <div className="cu-file-selected">
                  <div className="cu-file-info">
                    <span className="cu-file-icon">📄</span>
                    <div>
                      <p className="cu-file-name">{file.name}</p>
                      <p className="cu-file-size">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button" className="cu-clear-btn"
                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                    title="Remove file"
                  >×</button>
                </div>
              )}
            </div>

            <button
              type="submit" id="uploadCsvBtn"
              className="cu-upload-btn" disabled={uploading || !file}
              style={{ background: uploading || !file ? undefined : `linear-gradient(135deg, ${activeType.color}, ${activeType.color}cc)` }}
            >
              {uploading
                ? <><span className="cu-spinner" /> Processing…</>
                : <><span>{activeType.icon}</span> Upload {activeType.label}</>
              }
            </button>
          </form>

          {/* Expected Columns Guide */}
          <div className="cu-guide">
            <h4 className="cu-guide-title">Required Columns for {activeType.label}</h4>
            <div className="cu-guide-cols">
              {dataType === 'energy' && <>
                <code>energy_source</code><code>energy_consumption</code><code>unit</code>
                <span className="cu-optional-col">reporting_start</span>
                <span className="cu-optional-col">reporting_end</span>
                <span className="cu-optional-col">notes</span>
              </>}
              {dataType === 'transport' && <>
                <code>transport_mode</code><code>distance</code><code>distance_unit</code>
                <span className="cu-optional-col">weight</span>
                <span className="cu-optional-col">weight_unit</span>
                <span className="cu-optional-col">reporting_start</span>
              </>}
              {dataType === 'material' && <>
                <code>material_type</code><code>quantity</code><code>unit</code>
                <span className="cu-optional-col">material_category</span>
                <span className="cu-optional-col">recycled_content_pct</span>
                <span className="cu-optional-col">origin_country</span>
              </>}
            </div>
            <p className="cu-guide-hint"><code>Required</code> · <span className="cu-optional-col">Optional</span></p>
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="cu-results">
          {!result ? (
            <div className="cu-results-empty">
              <div className="cu-results-icon">📊</div>
              <p>Upload results will appear here</p>
              <p className="cu-results-hint">Download a template to get started with the correct column format</p>
            </div>
          ) : (
            <div className="cu-animate-in">
              {/* Summary Banner */}
              <div className="cu-summary-grid">
                <div className="cu-summary-card cu-s-total">
                  <div className="cu-s-num">{result.summary?.total}</div>
                  <div className="cu-s-label">Total Rows</div>
                </div>
                <div className="cu-summary-card cu-s-valid">
                  <div className="cu-s-num">{result.summary?.valid}</div>
                  <div className="cu-s-label">Valid</div>
                </div>
                <div className="cu-summary-card cu-s-stored">
                  <div className="cu-s-num">{result.summary?.stored}</div>
                  <div className="cu-s-label">Stored</div>
                </div>
                <div className="cu-summary-card cu-s-error">
                  <div className="cu-s-num">{result.summary?.invalid}</div>
                  <div className="cu-s-label">Errors</div>
                </div>
              </div>

              {result.batchId && (
                <div className="cu-batch-id">
                  Batch ID: <code>{result.batchId}</code>
                </div>
              )}

              {/* Result Tabs */}
              <div className="cu-result-tabs">
                <button
                  type="button"
                  className={`cu-rtab ${activeResultTab === 'valid' ? 'cu-rtab-active cu-rtab-success' : ''}`}
                  onClick={() => setActiveResultTab('valid')}
                >
                  ✓ Valid Rows ({result.validRows?.length || 0})
                </button>
                <button
                  type="button"
                  className={`cu-rtab ${activeResultTab === 'invalid' ? 'cu-rtab-active cu-rtab-error' : ''}`}
                  onClick={() => setActiveResultTab('invalid')}
                >
                  ✕ Errors ({result.invalidRows?.length || 0})
                </button>
              </div>

              {/* Valid Rows Table */}
              {activeResultTab === 'valid' && (
                <div className="cu-table-wrap">
                  {result.validRows?.length === 0 ? (
                    <div className="cu-no-rows">No valid rows found.</div>
                  ) : (
                    <table className="cu-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          {result.validRows[0] && Object.keys(result.validRows[0].data || {})
                            .filter(k => !k.startsWith('_'))
                            .slice(0, 6)
                            .map(k => <th key={k}>{k}</th>)}
                          <th>Warnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.validRows.map((row) => (
                          <tr key={row.rowNumber}>
                            <td className="cu-row-num">{row.rowNumber}</td>
                            {Object.entries(row.data || {})
                              .filter(([k]) => !k.startsWith('_'))
                              .slice(0, 6)
                              .map(([k, v]) => (
                                <td key={k} title={String(v)}>
                                  {String(v ?? '—').length > 18
                                    ? String(v).substring(0, 18) + '…'
                                    : String(v ?? '—')}
                                </td>
                              ))}
                            <td>
                              {row.warnings?.length > 0
                                ? <span className="cu-warn-badge" title={row.warnings.map(w => w.message).join('\n')}>⚠ {row.warnings.length}</span>
                                : <span className="cu-ok-badge">✓</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Invalid Rows */}
              {activeResultTab === 'invalid' && (
                <div className="cu-error-list">
                  {result.invalidRows?.length === 0 ? (
                    <div className="cu-no-rows cu-no-errors">🎉 No validation errors!</div>
                  ) : (
                    result.invalidRows.map((row) => (
                      <div key={row.rowNumber} className="cu-error-row">
                        <div className="cu-error-row-header">
                          <span className="cu-error-row-num">Row {row.rowNumber}</span>
                          <span className="cu-error-count">{row.errors.length} error(s)</span>
                        </div>
                        <div className="cu-error-items">
                          {row.errors.map((err, i) => (
                            <div key={i} className="cu-error-item">
                              <span className="cu-error-field">{err.field}</span>
                              <span className="cu-error-msg">{err.message}</span>
                              {err.value !== undefined && (
                                <span className="cu-error-val">Value: "{String(err.value)}"</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
