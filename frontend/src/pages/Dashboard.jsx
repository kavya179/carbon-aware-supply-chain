import React, { useState, useEffect } from 'react';
import { 
  MdCo2, MdFactory, MdLayers, MdWhatshot, MdTrendingDown 
} from 'react-icons/md';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import SupplierNetworkGraph from '../components/charts/SupplierNetworkGraph';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const COLORS = ['#00d68f', '#3b82f6', '#eab308', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [summary, setSummary] = useState(null);
  const [hotspots, setHotspots] = useState(null);
  const [networkData, setNetworkData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Fetch Aggregation Summary
        const aggRes = await fetch(`${API}/aggregation/summary`, { headers });
        const aggData = await aggRes.json();
        if (aggData.success) setSummary(aggData.data);

        // 2. Fetch Hotspots
        const hotRes = await fetch(`${API}/hotspots`, { headers });
        const hotData = await hotRes.json();
        if (hotData.success) setHotspots(hotData.data);

        // 3. Fetch Network Graph
        const netRes = await fetch(`${API}/suppliers/network`, { headers });
        const netData = await netRes.json();
        if (netData.success) {
          // Add hotspot flag to nodes for D3
          const topSupplierIds = hotData.data?.topSuppliers?.map(s => s.id) || [];
          const processedNodes = (netData.data?.nodes || []).map(n => ({
            ...n,
            isHotspot: topSupplierIds.includes(n.id)
          }));
          setNetworkData({ nodes: processedNodes, links: netData.data?.links || [] });
        }

      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div style={{ color: '#e8f4f8', padding: '2rem' }}>Loading Carbon Intelligence...</div>;
  }

  // Formatting for Recharts
  const materialData = summary?.perMaterial?.map(m => ({
    name: m.material,
    CO2e: Math.round(m.emissions)
  })) || [];

  const tierData = summary?.perTier 
    ? Object.entries(summary.perTier).map(([key, val]) => ({ name: key, value: Math.round(val) }))
    : [];

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Carbon Intelligence</h1>
          <p className="page-subtitle">Multi-tier scope 3 tracking and hotspot detection</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            Total Carbon Footprint <MdCo2 size={24} className="kpi-icon primary" />
          </div>
          <h2 className="kpi-value">{Math.round(summary?.totals?.totalEmissions || 0).toLocaleString()} <span style={{ fontSize: '1rem', color: '#8ba3b5' }}>tCO2e</span></h2>
          <span className="kpi-subtitle">Across entire supply chain</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            Total Suppliers <MdFactory size={20} className="kpi-icon info" />
          </div>
          <h2 className="kpi-value">{summary?.totals?.count || 0}</h2>
          <span className="kpi-subtitle">Active nodes in network</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            Top Hotspot Score <MdWhatshot size={20} className="kpi-icon danger" />
          </div>
          <h2 className="kpi-value">{hotspots?.topSuppliers?.[0]?.score || 0}%</h2>
          <span className="kpi-subtitle">{hotspots?.topSuppliers?.[0]?.name || 'N/A'}</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            Transport Impact <MdLayers size={20} className="kpi-icon warning" />
          </div>
          <h2 className="kpi-value">{Math.round(summary?.totals?.totalTransport || 0).toLocaleString()} <span style={{ fontSize: '1rem', color: '#8ba3b5' }}>tCO2e</span></h2>
          <span className="kpi-subtitle">Total logistics footprint</span>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="dashboard-grid">
        
        {/* Network Graph */}
        <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="dashboard-card-title">Interactive Supply Chain Network</h3>
          <p style={{ margin: '-1rem 0 1.5rem', color: '#8ba3b5', fontSize: '0.85rem' }}>
            Mapping Tier 3 → Tier 1 material flow. <span style={{ color: '#ef4444' }}>Red pulsing nodes indicate carbon hotspots.</span> Size indicates total emissions.
          </p>
          <div className="network-section">
            <SupplierNetworkGraph networkData={networkData} />
          </div>
        </div>

        {/* Hotspots List */}
        <div className="dashboard-card">
          <h3 className="dashboard-card-title">Top Carbon Hotspots</h3>
          <div className="hotspot-list">
            {hotspots?.topSuppliers?.map((h, i) => (
              <div key={h.id} className={`hotspot-item ${h.classification.toLowerCase()}`}>
                <div className="hotspot-info">
                  <span className="hotspot-name">{i + 1}. {h.name}</span>
                  <span className="hotspot-type">{h.classification} Priority • {h.emissions.toLocaleString()} tCO2e</span>
                </div>
                <span className="hotspot-score">{h.score}%</span>
              </div>
            ))}
            {(!hotspots || hotspots.topSuppliers?.length === 0) && (
              <div style={{ color: '#8ba3b5' }}>No hotspot data available.</div>
            )}
          </div>
        </div>

        {/* Breakdown Charts */}
        <div className="dashboard-card">
          <h3 className="dashboard-card-title">Emissions by Tier</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="rgba(255,255,255,0.1)"
                >
                  {tierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15,31,56,0.9)', border: '1px solid rgba(0,214,143,0.3)', borderRadius: '8px', color: '#e8f4f8' }}
                  itemStyle={{ color: '#00d68f' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="dashboard-card-title">Material Footprint Analysis</h3>
          <div className="chart-container" style={{ minHeight: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materialData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#8ba3b5" tick={{ fill: '#8ba3b5' }} />
                <YAxis stroke="#8ba3b5" tick={{ fill: '#8ba3b5' }} tickFormatter={(value) => `${value}t`} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ backgroundColor: 'rgba(15,31,56,0.9)', border: '1px solid rgba(0,214,143,0.3)', borderRadius: '8px', color: '#e8f4f8' }}
                />
                <Bar dataKey="CO2e" fill="#00d68f" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
