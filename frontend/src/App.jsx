import React, { useState, useEffect, useCallback } from 'react';
import { carbonApi, authService } from './services/api';
import KPIGrid from './components/KPIGrid';
import TierDonutChart from './components/TierDonutChart';
import SupplierBarChart from './components/SupplierBarChart';
import ActivityBreakdown from './components/ActivityBreakdown';
import MaterialHotspots from './components/MaterialHotspots';
import TransportHotspots from './components/TransportHotspots';
import HotspotsTable from './components/HotspotsTable';
import SupplyChainNetwork from './components/SupplyChainNetwork';
import RecommendationsPanel from './components/RecommendationsPanel';
import AuditTrailPanel from './components/AuditTrailPanel';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'hotspots' | 'network' | 'recommendations' | 'audit'
  const [period, setPeriod] = useState('All Periods');
  const [highThreshold, setHighThreshold] = useState('20.0');
  const [medThreshold, setMedThreshold] = useState('5.0');

  const [dashboardData, setDashboardData] = useState(null);
  const [hotspotsData, setHotspotsData] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [materialData, setMaterialData] = useState(null);
  const [transportData, setTransportData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = period === 'All Periods' ? null : period;
      const [dash, spots, hier, mat, trans] = await Promise.all([
        carbonApi.getDashboard(p),
        carbonApi.getHotspotsOverview(p, highThreshold, medThreshold),
        carbonApi.getHierarchy(),
        carbonApi.getMaterialEmissions(p),
        carbonApi.getTransportEmissions(p)
      ]);

      setDashboardData(dash);
      setHotspotsData(spots);
      setHierarchyData(hier);
      setMaterialData(mat?.materials || []);
      setTransportData(trans?.transport_modes || trans?.transport || []);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('[DASHBOARD FETCH ERROR]', err);
      setError(err.message || 'Unable to load sustainability data from backend');
    } finally {
      setLoading(false);
    }
  }, [period, highThreshold, medThreshold]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const p = period === 'All Periods' ? null : period;
      const res = await carbonApi.syncHotspots(p);
      setSyncNotice(`✅ ${res.message || 'Successfully synced hotspots to SQLite database.'}`);
      setTimeout(() => setSyncNotice(null), 5000);
      loadData();
    } catch (err) {
      setSyncNotice(`❌ Failed to sync hotspots: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="dashboard-app">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="brand-logo">🌿</div>
          <div className="brand-titles">
            <h1 className="brand-heading">Carbon Intelligence Platform</h1>
            <p className="brand-sub">Multi-Tier Scope 3 Decarbonization & Supplier Traceability</p>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="nav-controls">
          {/* Period Filter */}
          <div className="control-group">
            <label htmlFor="period-select" className="control-label">Reporting Period</label>
            <select
              id="period-select"
              className="select-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="All Periods">All Periods (Consolidated)</option>
              <option value="2024-Q1">2024-Q1 (Audited)</option>
            </select>
          </div>

          {/* Threshold Config Pill */}
          <div className="threshold-pill" title="Configurable Hotspot Impact Thresholds">
            <span className="threshold-label">Thresholds:</span>
            <span className="badge-high">High ≥ {highThreshold}%</span>
            <span className="badge-medium">Med ≥ {medThreshold}%</span>
          </div>

          {/* Refresh Button */}
          <button
            className="btn btn-icon"
            onClick={loadData}
            disabled={loading}
            title="Refresh from SQLite"
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </header>

      {/* Sync Status Banner if active */}
      {syncNotice && (
        <div className="sync-banner">
          <span>{syncNotice}</span>
          <button className="banner-close" onClick={() => setSyncNotice(null)}>✕</button>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <nav className="tab-navigation" aria-label="Dashboard Views">
        <div className="tab-group">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Executive Sustainability Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'hotspots' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('hotspots')}
          >
            🔥 Hotspots & Material Deep-Dive
          </button>
          <button
            className={`tab-btn ${activeTab === 'network' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            🕸️ Multi-Tier Supply Chain Network
          </button>
          <button
            className={`tab-btn ${activeTab === 'recommendations' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            🌱 Circular Decarbonization Actions
          </button>
          <button
            className={`tab-btn ${activeTab === 'audit' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            🛡️ Compliance & Audit Trail
          </button>
        </div>

        <div className="meta-sync-pill">
          <span className="live-pulse"></span>
          <span>Company: <strong>Apex Motors Corporation</strong> (SQLite)</span>
          {lastRefreshed && <span className="timestamp-text">• Updated {lastRefreshed}</span>}
        </div>
      </nav>

      {/* Main Container Area */}
      <main className="main-content">
        {/* Loading State */}
        {loading && !dashboardData && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <h3 className="loading-text">Aggregating Multi-Tier Carbon Footprint...</h3>
            <p className="loading-sub">Auditing Scope 3 calculations across Tier 1, Tier 2, and Tier 3 with zero double counting</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-card">
            <div className="error-icon">⚠️</div>
            <h3 className="error-title">Unable to Connect to Backend Services</h3>
            <p className="error-desc">{error}</p>
            <div className="error-actions">
              <button className="btn btn-primary" onClick={loadData}>Retry Connection</button>
              <span className="error-tip">Verify Django service is active on Port 8000</span>
            </div>
          </div>
        )}

        {/* Loaded Content */}
        {!loading && !error && (
          <>
            {/* 8 Primary KPIs - Always Visible */}
            <KPIGrid dashboardData={dashboardData} hotspotsData={hotspotsData} />

            {/* TAB 1: EXECUTIVE OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="tab-content-fade">
                {/* 2-Column Visual Grid */}
                <div className="charts-grid-2col">
                  {/* Vis 1: Emissions by Tier */}
                  <TierDonutChart
                    tiers={dashboardData?.tier_breakdown || []}
                    totalTonnes={dashboardData?.kpis?.total_co2e_tonnes || 0}
                  />

                  {/* Vis 2: Emissions by Supplier */}
                  <SupplierBarChart
                    suppliers={hotspotsData?.highest_emission_suppliers || []}
                    totalCompanyTonnes={dashboardData?.kpis?.total_co2e_tonnes || 0}
                  />
                </div>

                {/* Vis 3: Emissions by Activity */}
                <div className="mt-6">
                  <ActivityBreakdown
                    activities={hotspotsData?.highest_emission_activities || []}
                    totalTonnes={dashboardData?.kpis?.total_co2e_tonnes || 0}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: HOTSPOTS & DEEP DIVE */}
            {activeTab === 'hotspots' && (
              <div className="tab-content-fade">
                {/* Vis 6: Top Hotspots Table & Explainability */}
                <HotspotsTable
                  suppliers={hotspotsData?.highest_emission_suppliers || []}
                  onSyncHotspots={handleSync}
                  isSyncing={isSyncing}
                />

                {/* 2-Column Grid for Materials & Transport */}
                <div className="charts-grid-2col mt-6">
                  {/* Vis 5: Material Emissions */}
                  <MaterialHotspots
                    materials={hotspotsData?.highest_emission_materials || materialData || []}
                  />

                  {/* Vis 4: Transport Emissions */}
                  <TransportHotspots
                    transportModes={hotspotsData?.highest_emission_transport_modes || transportData || []}
                  />
                </div>
              </div>
            )}

            {/* TAB 3: MULTI-TIER NETWORK */}
            {activeTab === 'network' && (
              <div className="tab-content-fade">
                {/* Vis 7: Multi-tier supply chain network graph */}
                <SupplyChainNetwork hierarchyData={hierarchyData} />
              </div>
            )}

            {/* TAB 4: CIRCULAR & LOWER-CARBON RECOMMENDATIONS */}
            {activeTab === 'recommendations' && (
              <div className="tab-content-fade">
                <RecommendationsPanel period={period} />
              </div>
            )}

            {/* TAB 5: COMPLIANCE & AUDIT TRAIL */}
            {activeTab === 'audit' && (
              <div className="tab-content-fade">
                <AuditTrailPanel period={period} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-left">
          <span>🌿 Carbon-Aware Supply Chain Platform</span>
          <span className="footer-sep">•</span>
          <span>GHG Protocol Scope 3 Compliant</span>
          <span className="footer-sep">•</span>
          <span className="footer-sqlite">Engine: SQLite ONLY</span>
        </div>
        <div className="footer-right">
          <span>Zero Double Counting Guaranteed</span>
          <span className="footer-sep">•</span>
          <span>Rule-Based Deterministic Engine</span>
        </div>
      </footer>
    </div>
  );
}
