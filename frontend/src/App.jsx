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
import HotspotsView from './components/HotspotsView';
import RecommendationsPanel from './components/RecommendationsPanel';
import ReportingPanel from './components/ReportingPanel';
import AuditTrailPanel from './components/AuditTrailPanel';
import MLEstimationPanel from './components/MLEstimationPanel';
import SettingsView from './components/SettingsView';
import SupplierDashboard from './components/SupplierDashboard';
import AuditorDashboard from './components/AuditorDashboard';
import AccessRestricted from './components/AccessRestricted';
import SustainabilityConceptsModal from './components/SustainabilityConceptsModal';
import './App.css';

// Normalize role string
function getNormalizedRole(user) {
  if (!user || !user.role) return 'COMPANY_MANAGER';
  const r = String(user.role).toUpperCase();
  if (r.includes('SUPPLIER')) return 'SUPPLIER';
  if (r.includes('AUDITOR')) return 'AUDITOR';
  return 'COMPANY_MANAGER';
}

// Default route for a given normalized role
function getDefaultRouteForRole(normRole) {
  if (normRole === 'SUPPLIER') return '/supplier/dashboard';
  if (normRole === 'AUDITOR') return '/auditor/dashboard';
  return '/manager/dashboard';
}

// Parse pathname into role and tab
function parsePath(pathname) {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  const parts = clean.split('/');
  if (parts.length === 0 || !parts[0]) {
    return { rolePrefix: null, subtab: 'dashboard' };
  }
  const rolePrefix = parts[0].toLowerCase();
  const subtab = parts[1] ? parts[1].toLowerCase() : 'dashboard';
  return { rolePrefix, subtab };
}

export default function App() {
  // Authentication State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return null;
  });
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'

  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAccessRestricted, setIsAccessRestricted] = useState(false);

  // Global Filter State
  const [period, setPeriod] = useState('All Periods');
  const [highThreshold, setHighThreshold] = useState('20.0');
  const [medThreshold, setMedThreshold] = useState('5.0');

  // Backend Data State (Manager & Executive analytics)
  const [dashboardData, setDashboardData] = useState(null);
  const [hotspotsData, setHotspotsData] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [materialData, setMaterialData] = useState([]);
  const [transportData, setTransportData] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState(null);

  // ESG & Sustainability Concepts Guide Modal State
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideInitialConcept, setGuideInitialConcept] = useState('scope3');

  const handleOpenGuide = useCallback((conceptId = 'scope3') => {
    setGuideInitialConcept(conceptId);
    setIsGuideOpen(true);
  }, []);

  // Sync URL Path with Role & Tab State
  const syncRouteFromUrl = useCallback(() => {
    if (!user) return;
    const normRole = getNormalizedRole(user);
    const { rolePrefix, subtab } = parsePath(window.location.pathname);

    // If on generic root or old route, push default role route
    if (!rolePrefix || rolePrefix === 'dashboard' || rolePrefix === 'login') {
      const defaultUrl = getDefaultRouteForRole(normRole);
      window.history.replaceState(null, '', defaultUrl);
      setActiveTab('dashboard');
      setIsAccessRestricted(false);
      return;
    }

    // Role route access check
    const expectedPrefix = normRole === 'SUPPLIER' ? 'supplier' : normRole === 'AUDITOR' ? 'auditor' : 'manager';

    if (rolePrefix !== expectedPrefix) {
      // User is trying to access another role's route!
      setIsAccessRestricted(true);
    } else {
      setIsAccessRestricted(false);
      setActiveTab(subtab || 'dashboard');
    }
  }, [user]);

  // Navigate to a tab and update browser URL
  const navigateToTab = useCallback((tabId) => {
    if (!user) return;
    const normRole = getNormalizedRole(user);
    const prefix = normRole === 'SUPPLIER' ? 'supplier' : normRole === 'AUDITOR' ? 'auditor' : 'manager';
    const newPath = `/${prefix}/${tabId}`;

    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    setActiveTab(tabId);
    setIsAccessRestricted(false);
    setMobileMenuOpen(false);
  }, [user]);

  // Listen to browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      syncRouteFromUrl();
    };
    window.addEventListener('popstate', handlePopState);
    syncRouteFromUrl();
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncRouteFromUrl]);

  // Primary Data Fetcher (for Manager views)
  const loadData = useCallback(async () => {
    if (!user) return;
    const normRole = getNormalizedRole(user);
    if (normRole !== 'COMPANY_MANAGER') return; // suppliers & auditors fetch their own endpoints

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

  // Handle Authentication Callbacks
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('user_profile', JSON.stringify(userData));
    const normRole = getNormalizedRole(userData);
    const targetUrl = getDefaultRouteForRole(normRole);
    window.history.pushState(null, '', targetUrl);
    setActiveTab('dashboard');
    setIsAccessRestricted(false);
  };

  const handleSignupSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('user_profile', JSON.stringify(userData));
    const normRole = getNormalizedRole(userData);
    const targetUrl = getDefaultRouteForRole(normRole);
    window.history.pushState(null, '', targetUrl);
    setActiveTab('dashboard');
    setIsAccessRestricted(false);
  };

  const handleLogout = () => {
    authService.logout();
    localStorage.removeItem('user_profile');
    localStorage.removeItem('access_token');
    setUser(null);
    setAuthView('login');
    window.history.pushState(null, '', '/login');
  };

  // Handle Redirection to User's Own Dashboard from Access Restricted Screen
  const handleGoToMyDashboard = () => {
    if (!user) return;
    const normRole = getNormalizedRole(user);
    const defaultUrl = getDefaultRouteForRole(normRole);
    window.history.pushState(null, '', defaultUrl);
    setActiveTab('dashboard');
    setIsAccessRestricted(false);
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

  const normRole = getNormalizedRole(user);

  // Render Authenticated 3-Part Enterprise Application Shell
  return (
    <div className="app-layout">
      {/* 1. Role-Aware Left Sidebar */}
      <Sidebar
        user={user}
        role={normRole}
        activeTab={activeTab}
        onSelectTab={navigateToTab}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Panel Wrapper */}
      <div className="app-main-panel">
        {/* 2. Top Header with Role Badge */}
        <Header
          user={user}
          period={period}
          setPeriod={setPeriod}
          onOpenGuide={handleOpenGuide}
          onLogout={handleLogout}
          onToggleSidebar={() => setMobileMenuOpen(!mobileMenuOpen)}
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
          {/* ACCESS RESTRICTED SCREEN */}
          {isAccessRestricted ? (
            <AccessRestricted user={user} onGoToDashboard={handleGoToMyDashboard} />
          ) : normRole === 'SUPPLIER' ? (
            /* ──────────────── ROLE 2: SUPPLIER SUSTAINABILITY PORTAL ──────────────── */
            <SupplierDashboard
              user={user}
              period={period}
              activeSubTab={activeTab}
              onNavigateTab={navigateToTab}
              onOpenGuide={handleOpenGuide}
            />
          ) : normRole === 'AUDITOR' ? (
            /* ──────────────── ROLE 3: AUDITOR COMPLIANCE & VERIFICATION ───────────── */
            <AuditorDashboard
              user={user}
              period={period}
              activeSubTab={activeTab}
              onNavigateTab={navigateToTab}
              onOpenGuide={handleOpenGuide}
            />
          ) : (
            /* ──────────────── ROLE 1: COMPANY / SUSTAINABILITY MANAGER ────────────── */
            <>
              {/* Loading State for Manager */}
              {loading && !dashboardData && (
                <div className="loading-state-card">
                  <div className="loading-spinner"></div>
                  <h3 className="loading-title">Aggregating Multi-Tier Carbon Footprint...</h3>
                  <p className="loading-sub">
                    Auditing Scope 3 calculations across Tier 1, Tier 2, and Tier 3 with zero double counting
                  </p>
                </div>
              )}

              {/* Error State for Manager */}
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

              {/* View Dispatcher for Manager */}
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
                      onNavigate={navigateToTab}
                    />
                  )}

                  {/* TAB 2: SUPPLY CHAIN NETWORK */}
                  {activeTab === 'network' && (
                    <SupplyChainNetwork hierarchyData={hierarchyData} />
                  )}

                  {/* TAB 3: SUPPLIERS VIEW */}
                  {activeTab === 'suppliers' && (
                    <SuppliersView
                      hierarchyData={hierarchyData}
                      hotspotsData={hotspotsData}
                      onOpenGuide={handleOpenGuide}
                    />
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
                    <HotspotsView
                      suppliers={hotspotsData?.highest_emission_suppliers || []}
                      materials={hotspotsData?.highest_emission_materials || materialData || []}
                      transportModes={hotspotsData?.highest_emission_transport_modes || transportData || []}
                      onSyncHotspots={handleSync}
                      isSyncing={isSyncing}
                      onOpenGuide={handleOpenGuide}
                    />
                  )}

                  {/* TAB 7: RECOMMENDATIONS */}
                  {activeTab === 'recommendations' && (
                    <div className="view-container">
                      <RecommendationsPanel period={period} onOpenGuide={handleOpenGuide} />
                    </div>
                  )}

                  {/* TAB 8: REPORTS */}
                  {activeTab === 'reports' && (
                    <div className="view-container">
                      <ReportingPanel period={period} onOpenGuide={handleOpenGuide} />
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
