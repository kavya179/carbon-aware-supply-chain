/**
 * API Service for Carbon-Aware Supply Chain Dashboard
 * Architecture Pipeline:
 * React (Port 5173) -> Node.js Express Gateway (Port 5000) -> Django REST Framework (Port 8000) -> SQLite / ML Model
 */

const NODE_GATEWAY_URL = 'http://127.0.0.1:5000/api';
const DJANGO_DIRECT_URL = 'http://127.0.0.1:8000/api';

// Primary route through Node.js Express API Gateway
let API_BASE_URL = NODE_GATEWAY_URL;

const DEFAULT_CREDENTIALS = {
  username: 'mgr_apex',
  password: 'SecurePass123!'
};

let cachedToken = null;

export const authService = {
  async getValidToken() {
    if (cachedToken) {
      return cachedToken;
    }
    const stored = localStorage.getItem('access_token');
    if (stored) {
      cachedToken = stored;
      return stored;
    }
    // Auto-authenticate
    return await this.login(DEFAULT_CREDENTIALS.username, DEFAULT_CREDENTIALS.password);
  },

  async login(username, password) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        throw new Error(`Authentication failed with status ${res.status}`);
      }
      const data = await res.json();
      const token = data.tokens?.access;
      if (token) {
        cachedToken = token;
        localStorage.setItem('access_token', token);
        localStorage.setItem('user_profile', JSON.stringify(data.user));
        return token;
      }
      throw new Error('No access token returned');
    } catch (err) {
      console.warn('[AUTH THROUGH NODE GATEWAY FAILED, TRYING DJANGO DIRECT]', err);
      // Fallback to direct Django if gateway is starting up
      try {
        const resDirect = await fetch(`${DJANGO_DIRECT_URL}/auth/login/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (resDirect.ok) {
          const dataDirect = await resDirect.json();
          const token = dataDirect.tokens?.access;
          if (token) {
            cachedToken = token;
            localStorage.setItem('access_token', token);
            localStorage.setItem('user_profile', JSON.stringify(dataDirect.user));
            return token;
          }
        }
      } catch (directErr) {
        console.error('[AUTH DIRECT FAILED]', directErr);
      }
      throw err;
    }
  },

  logout() {
    cachedToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_profile');
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user_profile') || '{}');
    } catch {
      return {};
    }
  }
};

async function apiRequest(endpoint, options = {}) {
  const token = await authService.getValidToken();
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  try {
    let res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    // If unauthorized, attempt re-login once
    if (res.status === 401) {
      localStorage.removeItem('access_token');
      cachedToken = null;
      const newToken = await authService.getValidToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API Error ${res.status}: ${errorText || res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    // If Node.js gateway is temporarily unreachable, fallback to direct Django
    if (API_BASE_URL !== DJANGO_DIRECT_URL && err.message.includes('Failed to fetch')) {
      console.warn(`[GATEWAY FALLBACK] Routing request to Django direct: ${endpoint}`);
      let resFallback = await fetch(`${DJANGO_DIRECT_URL}${endpoint}`, {
        ...options,
        headers
      });
      if (!resFallback.ok) {
        const errorText = await resFallback.text();
        throw new Error(`API Error ${resFallback.status}: ${errorText || resFallback.statusText}`);
      }
      return await resFallback.json();
    }
    throw err;
  }
}

export const carbonApi = {
  // Master Dashboard KPI & Tier Aggregation
  async getDashboard(period = null) {
    const query = period ? `?reporting_period=${encodeURIComponent(period)}` : '';
    return await apiRequest(`/analytics/dashboard/${query}`);
  },

  // Complete Hotspot Overview across all 5 dimensions
  async getHotspotsOverview(period = null, highThreshold = null, medThreshold = null) {
    const params = new URLSearchParams();
    if (period) params.append('reporting_period', period);
    if (highThreshold) params.append('high_threshold', highThreshold);
    if (medThreshold) params.append('medium_threshold', medThreshold);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiRequest(`/hotspots/overview/${query}`);
  },

  // Multi-tier supply chain network hierarchy tree
  async getHierarchy() {
    return await apiRequest('/supply-chain/hierarchy/');
  },

  // Detailed material hotspots
  async getMaterialEmissions(period = null) {
    const query = period ? `?reporting_period=${encodeURIComponent(period)}` : '';
    return await apiRequest(`/analytics/emissions/material/${query}`);
  },

  // Detailed transport hotspots
  async getTransportEmissions(period = null) {
    const query = period ? `?reporting_period=${encodeURIComponent(period)}` : '';
    return await apiRequest(`/analytics/emissions/transport/${query}`);
  },

  // Synchronize detected hotspots to SQLite
  async syncHotspots(period = null) {
    return await apiRequest('/hotspots/sync/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporting_period: period })
    });
  },

  // Rule-based Circular and Lower-Carbon Recommendations (Phase 14)
  async getRecommendations(period = null, category = null) {
    const params = new URLSearchParams();
    if (period) params.append('reporting_period', period);
    if (category) params.append('category', category);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiRequest(`/recommendations/overview/${query}`);
  },

  // Generate and persist recommendations to SQLite
  async generateRecommendations(period = null) {
    return await apiRequest('/recommendations/generate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporting_period: period })
    });
  },

  // Compliance & Audit Trail (Phase 15)
  async getAuditLogs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.action) params.append('action', filters.action);
    if (filters.search) params.append('search', filters.search);
    if (filters.entity_type) params.append('entity_type', filters.entity_type);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiRequest(`/audit-logs/${query}`);
  },

  async getAuditSummary() {
    return await apiRequest('/audit-logs/summary/');
  },

  async getCalculationTraces(period = null) {
    const query = period ? `?reporting_period=${encodeURIComponent(period)}` : '';
    return await apiRequest(`/audit-logs/calculation-traces/${query}`);
  },

  // Carbon Reporting (Phase 16)
  async getReportData(period = null) {
    const query = period ? `?period=${encodeURIComponent(period)}` : '';
    return await apiRequest(`/reports/data/${query}`);
  },

  async generateReport(period = null, title = null) {
    return await apiRequest('/reports/generate/', {
      method: 'POST',
      body: JSON.stringify({
        period: period || null,
        title: title || `Scope 3 Emissions Report — ${period || 'All Periods'}`,
      }),
    });
  },

  async listReports() {
    return await apiRequest('/reports/list/');
  },

  getReportPDFUrl(period = null) {
    const base = `${API_BASE_URL}/reports/pdf/`;
    if (period) return `${base}?period=${encodeURIComponent(period)}`;
    return base;
  },

  // ── Machine Learning & Gap-Filling Endpoints (Phase 18, 19, 20) ────────────

  // Check ML model status, benchmarks, and feature weights
  async getMLStatus() {
    return await apiRequest('/ml/status/');
  },

  // Detect missing activity streams across all suppliers in SQLite
  async getMLDataGaps() {
    return await apiRequest('/ml/data-gaps/');
  },

  // Run ML Scope 3 emission estimation for gap-filling
  async predictMLEmissions(payload) {
    return await apiRequest('/ml/predict/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Batch ML estimation
  async batchPredictMLEmissions(records) {
    return await apiRequest('/ml/batch-predict/', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  },

  // Supplier Activity Data Endpoints
  async getActivityData(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.supplier_id) searchParams.append('supplier_id', params.supplier_id);
    if (params.reporting_period) searchParams.append('reporting_period', params.reporting_period);
    if (params.verification_status) searchParams.append('verification_status', params.verification_status);
    if (params.domain) searchParams.append('domain', params.domain);
    if (params.search) searchParams.append('search', params.search);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return await apiRequest(`/activity-data/${query}`);
  },

  async submitActivityData(payload) {
    return await apiRequest('/activity-data/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateVerificationStatus(activityId, status, notes = '') {
    return await apiRequest(`/activity-data/${activityId}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        verification_status: status,
        verification_notes: notes,
      }),
    });
  },

  async getCalculations(period = null) {
    const query = period ? `?reporting_period=${encodeURIComponent(period)}` : '';
    return await apiRequest(`/calculations/${query}`);
  },

  // Gateway health verification
  async getGatewayHealth() {
    try {
      const res = await fetch('http://127.0.0.1:5000/api/health');
      if (res.ok) return await res.json();
    } catch {
      return { status: 'gateway_offline' };
    }
  }
};
