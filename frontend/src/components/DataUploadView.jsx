import React, { useState } from 'react';

export default function DataUploadView({ onRefreshData }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadSuccess(null);
      setUploadError(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select a CSV file to upload.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      // FormData payload
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('access_token');
      const res = await fetch('http://127.0.0.1:5000/api/upload-csv/', {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Upload failed: ${errText || res.statusText}`);
      }

      const result = await res.json();
      setUploadSuccess(`✅ Successfully ingested and calculated ${result.records_created || result.created_count || 'activity'} records.`);
      setFile(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setUploadError(err.message || 'CSV Ingestion failed. Please verify column headers.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="clean-view-container">
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">Supplier Data Ingestion & CSV Ingestion</h2>
          <p className="view-subtitle">Upload verified operational activity manifests, utility invoices, and freight logs</p>
        </div>
      </div>

      <div className="two-column-split-grid">
        {/* Left Column: Upload Dropzone Card */}
        <div className="clean-card upload-dropzone-card">
          <h3 className="card-heading">Upload Activity Manifest (CSV)</h3>
          <p className="card-subheading">Ingest Scope 3 operational activities for deterministic carbon calculation</p>

          {uploadSuccess && (
            <div className="alert-banner alert-success mb-4">
              <span>{uploadSuccess}</span>
            </div>
          )}

          {uploadError && (
            <div className="alert-banner alert-error mb-4">
              <span>{uploadError}</span>
            </div>
          )}

          <form onSubmit={handleUpload} className="dropzone-form">
            <div className="dropzone-box">
              <input
                type="file"
                id="csv-file-input"
                className="file-input-hidden"
                accept=".csv"
                onChange={handleFileChange}
              />
              <label htmlFor="csv-file-input" className="dropzone-label">
                <span className="dropzone-icon">📁</span>
                <span className="dropzone-text-main">
                  {file ? file.name : 'Choose CSV file or drag and drop here'}
                </span>
                <span className="dropzone-text-sub">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports standard activity manifests (.csv)'}
                </span>
              </label>
            </div>

            <div className="upload-actions-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!file || uploading}
              >
                {uploading ? 'Processing & Calculating...' : '📤 Upload & Calculate Scope 3 CO₂e'}
              </button>

              {file && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFile(null)}
                >
                  Clear File
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Format Specifications & Template */}
        <div className="clean-card upload-guidelines-card">
          <h3 className="card-heading">CSV File Schema & Guidelines</h3>
          <p className="card-subheading">Required headers and format specification for automated emission factor matching</p>

          <div className="guidelines-table-wrap">
            <table className="clean-table schema-table">
              <thead>
                <tr>
                  <th>Column Header</th>
                  <th>Type</th>
                  <th>Example Values</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>supplier_code</code></td>
                  <td>String</td>
                  <td>SUP-DEMO-T1-01</td>
                </tr>
                <tr>
                  <td><code>activity_type</code></td>
                  <td>String</td>
                  <td>Virgin Aluminium, Electricity</td>
                </tr>
                <tr>
                  <td><code>quantity</code></td>
                  <td>Decimal</td>
                  <td>20000.00</td>
                </tr>
                <tr>
                  <td><code>unit</code></td>
                  <td>String</td>
                  <td>kg, kWh, liter, tonne-km</td>
                </tr>
                <tr>
                  <td><code>reporting_period</code></td>
                  <td>String</td>
                  <td>2024-Q1</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="guidelines-footer">
            <div className="tip-box">
              💡 <em>Deterministic engine automatically maps materials, fuels, electricity grids, and freight modes to standard DEFRA/EPA emission factors.</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
