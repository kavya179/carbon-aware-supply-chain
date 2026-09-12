import React, { useState, useEffect } from 'react';
import { MdCheckCircle, MdAutoAwesome } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import './Emissions.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Emissions() {
  const { user } = useAuth();
  const [footprints, setFootprints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmissions = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API}/footprint/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setFootprints(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch emissions', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmissions();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const DataStatusBadge = ({ isEstimated, fieldName }) => {
    if (isEstimated) {
      return (
        <span className="ai-badge">
          <MdAutoAwesome size={12} /> AI Estimated
          <span className="ai-tooltip">
            <strong>Missing Data Detected.</strong><br/>
            The supplier failed to provide {fieldName} data. 
            A Scikit-learn Random Forest model was used to accurately estimate this value based on historical supply chain trends to prevent gaps in the total footprint.
          </span>
        </span>
      );
    }
    return (
      <span className="verified-badge">
        <MdCheckCircle size={12} /> Verified
      </span>
    );
  };

  return (
    <div className="emissions-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Emissions Data Log</h1>
          <p className="page-subtitle">Track, audit, and verify all Scope 3 footprint records.</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="emissions-table-container">
          <table className="emissions-table">
            <thead>
              <tr>
                <th>Date Submitted</th>
                <th>Supplier</th>
                <th>Energy Input</th>
                <th>Transport Input</th>
                <th>Material Input</th>
                <th>Total Footprint (tCO2e)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center' }}>Loading emissions data...</td></tr>
              ) : footprints.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center' }}>No footprint records found.</td></tr>
              ) : (
                footprints.map(record => (
                  <tr key={record._id}>
                    <td style={{ color: '#8ba3b5' }}>{formatDate(record.createdAt)}</td>
                    <td>
                      <span className="em-supplier">{record.supplier?.name || 'Unknown'}</span>
                      <span className="em-tier">Tier {record.supplier?.tier || '?'}</span>
                    </td>
                    
                    {/* Energy Column */}
                    <td>
                      <div className="em-data-cell">
                        <span className="em-val">
                          {record.inputs?.energy?.consumption || 0} {record.inputs?.energy?.unit || 'kWh'}
                        </span>
                        <DataStatusBadge 
                          isEstimated={record.results?.estimationFlags?.energy} 
                          fieldName="Energy Consumption"
                        />
                      </div>
                    </td>

                    {/* Transport Column */}
                    <td>
                      <div className="em-data-cell">
                        <span className="em-val">
                          {record.inputs?.transport?.distance || 0} km • {record.inputs?.transport?.weight || 0} kg
                        </span>
                        <DataStatusBadge 
                          isEstimated={record.results?.estimationFlags?.transport} 
                          fieldName="Transport Distance"
                        />
                      </div>
                    </td>

                    {/* Material Column */}
                    <td>
                      <div className="em-data-cell">
                        <span className="em-val">
                          {record.inputs?.material?.quantity || 0} {record.inputs?.material?.unit || 'kg'}
                        </span>
                        <DataStatusBadge 
                          isEstimated={record.results?.estimationFlags?.material} 
                          fieldName="Material Quantity"
                        />
                      </div>
                    </td>

                    {/* Result Column */}
                    <td>
                      <span className="em-total">{Math.round(record.results?.totalEmissions_tCO2e || 0).toLocaleString()} t</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
