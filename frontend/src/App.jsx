import React, { useState, useEffect, useCallback } from 'react';
import { carbonApi, authService } from './services/api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import DashboardHome from './components/DashboardHome';
import SuppliersView from './components/SuppliersView';
import SupplyChainNetwork from './components/SupplyChainNetwork';
import DataUploadView from './components/DataUploadView';
import CarbonCalculationView from './components/CarbonCalculationView';
import HotspotsTable from './components/HotspotsTable';
import MaterialHotspots from './components/MaterialHotspots';
import TransportHotspots from './components/TransportHotspots';
import RecommendationsPanel from './components/RecommendationsPanel';
import ReportingPanel from './components/ReportingPanel';
import AuditTrailPanel from './components/AuditTrailPanel';
import MLEstimationPanel from './components/MLEstimationPanel';
import SettingsView from './components/SettingsView';
import SustainabilityConceptsModal from './components/SustainabilityConceptsModal';
import './App.css';

export default function App() {
  // Authentication State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    // Default demo session for immediate exploration
    return {
      name: 'Kavya',
      username: 'demo_manager',
      role: 'Company Manager',
      email: 'kavya@apexmotors.com',
      company: 'Apex Motors Corporation'
    };
  });
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'

  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Filter State
  const [period, setPeriod] = useState('All Periods');
  const [highThreshold, setHighThreshold] = useState('20.0');
  const [medThreshold, setMedThreshold] = useState('5.0');

  // Backend Data State
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

  // ESG & Sustainability Concepts Guide Modal State
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideInitialConcept, setGuideInitialConcept] = useState('scope3');

  const handleOpenGuide = useCallback((conceptId = 'scope3') => {
    setGuideInitialConcept(conceptId);
    setIsGuideOpen(true);
  }, []);

  // Primary Data Fetcher
  const loadData = useCallback(async () => {
    if (!user) return;
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
  }, [user, period, highThreshold, medThreshold]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Hotspot Sync
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

  // Handle Authentication
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('user_profile', JSON.stringify(userData));
    setActiveTab('dashboard');
  };

  const handleSignupSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('user_profile', JSON.stringify(userData));
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    authService.logout();
    localStorage.removeItem('user_profile');
    setUser(null);
    setAuthView('login');
  };

  const handleRoleChange = (newRole) => {
    if (!user) return;
    const updated = { ...user, role: newRole };
    setUser(updated);
    localStorage.setItem('user_profile', JSON.stringify(updated));
  };

  // Render Unauthenticated Screen
  if (!user) {
    return (
      <div className="auth-root">
        {authView === 'login' ? (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onSwitchToSignup={() => setAuthView('signup')}
          />
        ) : (
          <SignupPage
            onSignupSuccess={handleSignupSuccess}
            onSwitchToLogin={() => setAuthView('login')}
          />
        )}
      </div>
    );
  }

  // Render Authenticated 3-Part Enterprise Application Shell
  return (
    <div className="app-layout">
      {/* 1. Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Panel Wrapper */}
      <div className="app-main-panel">
        {/* 2. Top Header */}
        <Header
          user={user}
          period={period}
          onPeriodChange={setPeriod}
          onOpenGuide={handleOpenGuide}
          onLogout={handleLogout}
          onRoleChange={handleRoleChange}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Sync Notification Banner */}
        {syncNotice && (
          <div className="sync-banner">
            <span>{syncNotice}</span>
            <button className="banner-close" onClick={() => setSyncNotice(null)}>✕</button>
          </div>
        )}

        {/* 3. Main Content Views */}
        <main className="main-content-area">
          {/* Loading State */}
          {loading && !dashboardData && (
            <div className="loading-state-card">
              <div className="loading-spinner"></div>
              <h3 className="loading-title">Aggregating Multi-Tier Carbon Footprint...</h3>
              <p className="loading-sub">
                Auditing Scope 3 calculations across Tier 1, Tier 2, and Tier 3 with zero double counting
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="error-state-card">
              <div className="error-icon">⚠️</div>
              <div className="error-content">
                <h3 className="error-title">Unable to Connect to Backend Services</h3>
                <p className="error-desc">{error}</p>
                <div className="error-actions">
                  <button className="btn btn-primary" onClick={loadData}>Retry Connection</button>
                  <span className="error-tip">Verify Django service is active on Port 8000</span>
                </div>
              </div>
            </div>
          )}

          {/* View Dispatcher */}
          {!loading && !error && (
            <>
              {/* TAB 1: EXECUTIVE DASHBOARD */}
              {activeTab === 'dashboard' && (
                <DashboardHome
                  user={user}
                  period={period}
                  dashboardData={dashboardData}
                  hotspotsData={hotspotsData}
                  hierarchyData={hierarchyData}
                  materialData={materialData}
                  transportData={transportData}
                  onOpenGuide={handleOpenGuide}
                  onNavigate={setActiveTab}
                />
              )}

              {/* TAB 2: SUPPLIERS */}
              {activeTab === 'suppliers' && (
                <SuppliersView
                  hierarchyData={hierarchyData}
                  hotspotsData={hotspotsData}
                  onOpenGuide={handleOpenGuide}
                />
              )}

              {/* TAB 3: SUPPLY CHAIN NETWORK */}
              {activeTab === 'network' && (
                <div className="view-container">
                  <div className="view-header">
                    <div>
                      <h2 className="view-title">Multi-Tier Supply Chain Network</h2>
                      <p className="view-subtitle">Interactive interactive traceability graph across Tier 1, Tier 2, and Tier 3 tiers</p>
                    </div>
                  </div>
                  <SupplyChainNetwork hierarchyData={hierarchyData} />
                </div>
              )}

              {/* TAB 4: DATA UPLOAD */}
              {activeTab === 'upload' && (
                <DataUploadView onUploadSuccess={loadData} />
              )}

              {/* TAB 5: CARBON CALCULATION */}
              {activeTab === 'calculations' && (
                <CarbonCalculationView period={period} onOpenGuide={handleOpenGuide} />
              )}

              {/* TAB 6: HOTSPOTS */}
              {activeTab === 'hotspots' && (
                <div className="view-container">
                  <div className="view-header">
                    <div>
                      <h2 className="view-title">Carbon Hotspots & Impact Analysis</h2>
                      <p className="view-subtitle">Automated 80/20 Pareto hotspot identification and material/transport breakdown</p>
                    </div>
                    <div className="view-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={handleSync}
                        disabled={isSyncing}
                      >
                        {isSyncing ? '⏳ Syncing...' : '🔄 Sync Hotspots'}
                      </button>
                    </div>
                  </div>

                  <HotspotsTable
                    suppliers={hotspotsData?.highest_emission_suppliers || []}
                    onSyncHotspots={handleSync}
                    isSyncing={isSyncing}
                    onOpenGuide={handleOpenGuide}
                  />

                  <div className="two-column-grid mt-6">
                    <MaterialHotspots
                      materials={hotspotsData?.highest_emission_materials || materialData || []}
                    />
                    <TransportHotspots
                      transportModes={hotspotsData?.highest_emission_transport_modes || transportData || []}
                    />
                  </div>
                </div>
              )}

              {/* TAB 7: RECOMMENDATIONS */}
              {activeTab === 'recommendations' && (
                <div className="view-container">
                  <RecommendationsPanel period={period} />
                </div>
              )}

              {/* TAB 8: REPORTS */}
              {activeTab === 'reports' && (
                <div className="view-container">
                  <ReportingPanel period={period} />
                </div>
              )}

              {/* TAB 9: AUDIT TRAIL */}
              {activeTab === 'audit' && (
                <div className="view-container">
                  <AuditTrailPanel period={period} />
                </div>
              )}

              {/* TAB 10: ML GAP FILLING */}
              {activeTab === 'ml' && (
                <div className="view-container">
                  <MLEstimationPanel onOpenGuide={handleOpenGuide} />
                </div>
              )}

              {/* TAB 11: SETTINGS */}
              {activeTab === 'settings' && (
                <SettingsView
                  highThreshold={highThreshold}
                  medThreshold={medThreshold}
                  onSaveThresholds={(high, med) => {
                    setHighThreshold(high);
                    setMedThreshold(med);
                  }}
                  onOpenGuide={handleOpenGuide}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global ESG Reference & Glossary Modal */}
      <SustainabilityConceptsModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialConceptId={guideInitialConcept}
      />
    </div>
  );
}
