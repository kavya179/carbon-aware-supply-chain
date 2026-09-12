import React, { useState, useEffect } from 'react';
import { MdAutoGraph, MdArrowForward } from 'react-icons/md';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './Recommendations.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Recommendations() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Fetch suppliers on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API}/suppliers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          const list = data.data.docs || data.data;
          setSuppliers(list);
          if (list.length > 0) {
            setSelectedSupplier(list[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch suppliers', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Fetch recommendations when supplier changes
  useEffect(() => {
    if (!selectedSupplier) return;
    fetchRecommendations(selectedSupplier);
  }, [selectedSupplier]);

  const fetchRecommendations = async (supplierId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API}/recommendations/${supplierId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setRecommendations(data.data);
      } else {
        setRecommendations([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    if (!selectedSupplier) return;
    setGenerating(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API}/recommendations/generate/${selectedSupplier}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Recommendations generated successfully!');
        fetchRecommendations(selectedSupplier);
      } else {
        toast.error(data.error || 'Failed to generate recommendations. (Does this supplier have footprint data?)');
      }
    } catch (err) {
      toast.error('Network error while generating');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="recommendations-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Insights & Circular Strategies</h1>
          <p className="page-subtitle">Rule-based carbon reduction recommendations based on exact footprint data.</p>
        </div>
      </div>

      <div className="recommendations-controls">
        <select 
          className="rec-supplier-select"
          value={selectedSupplier}
          onChange={(e) => setSelectedSupplier(e.target.value)}
        >
          {suppliers.length === 0 ? (
            <option value="">No suppliers available</option>
          ) : (
            suppliers.map(s => (
              <option key={s._id} value={s._id}>
                {s.name} (Tier {s.tier})
              </option>
            ))
          )}
        </select>
        
        <button 
          className="rec-generate-btn"
          onClick={generateRecommendations}
          disabled={!selectedSupplier || generating}
        >
          <MdAutoGraph size={20} />
          {generating ? 'Analyzing Footprint...' : 'Generate New Insights'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#e8f4f8' }}>Loading insights...</div>
      ) : recommendations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <MdAutoGraph size={48} style={{ color: '#8ba3b5', marginBottom: '1rem' }} />
          <h3 style={{ color: '#e8f4f8', marginBottom: '0.5rem' }}>No insights available</h3>
          <p style={{ color: '#8ba3b5' }}>
            Click "Generate New Insights" to run the rules engine against this supplier's latest footprint data.
          </p>
        </div>
      ) : (
        <div className="rec-grid">
          {recommendations.map(rec => (
            <div key={rec._id} className="rec-card">
              
              <div className="rec-header">
                <span className={`rec-type-badge type-${rec.type}`}>{rec.type} Optimization</span>
                <div className="rec-savings">
                  <span className="rec-savings-value">-{rec.percentageReduction}%</span>
                  <span className="rec-savings-label">Est. Reduction</span>
                </div>
              </div>

              <div className="rec-body">
                <div className="rec-section">
                  <span className="rec-section-title">Current Situation</span>
                  <span className="rec-section-content">{rec.currentSituation}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', color: '#8ba3b5' }}>
                  <MdArrowForward size={20} />
                </div>

                <div className="rec-section">
                  <span className="rec-section-title" style={{ color: '#00d68f' }}>Recommended Alternative</span>
                  <span className="rec-section-content" style={{ fontWeight: 500 }}>{rec.recommendedAlternative}</span>
                </div>
              </div>

              <div className="rec-comparison">
                <div className="rec-comp-col">
                  <span className="rec-comp-label">Current CO2e</span>
                  <span className="rec-comp-val">{rec.currentCO2e.toLocaleString()} kg</span>
                </div>
                <div className="rec-comp-col new">
                  <span className="rec-comp-label">Estimated New</span>
                  <span className="rec-comp-val reduced">{rec.alternativeCO2e.toLocaleString()} kg</span>
                </div>
              </div>

              <div className="rec-insight-banner">
                💡 Switching to this alternative reduces emissions by <strong>{rec.co2Savings.toLocaleString()} kg CO2e</strong> ({rec.percentageReduction}%).
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
