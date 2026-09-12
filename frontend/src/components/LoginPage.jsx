import React, { useState } from 'react';

export default function LoginPage({ onLoginSuccess, onSwitchToSignup }) {
  const [username, setUsername] = useState('demo_manager');
  const [password, setPassword] = useState('DemoManager2026!');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onLoginSuccess(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Invalid username or password. Try demo accounts below.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoUser, demoPass) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="auth-page-wrapper">
      {/* Split Left: Brand Introduction */}
      <div className="auth-brand-side">
        <div className="auth-brand-content">
          <div className="auth-logo-badge">
            <span className="auth-logo-icon">🌿</span>
            <span className="auth-logo-text">Carbon-Aware Platform</span>
          </div>

          <h1 className="auth-hero-heading">
            Track. Analyze. <span className="text-emerald-bright">Reduce.</span>
          </h1>

          <p className="auth-hero-sub">
            Build a cleaner, more transparent and sustainable supply chain with auditable Scope 3 greenhouse gas intelligence.
          </p>

          <div className="auth-features-list">
            <div className="auth-feature-pill">
              <span className="pill-check">✓</span>
              <span><strong>Multi-Tier Traceability</strong> across Tier 1, Tier 2, and Tier 3</span>
            </div>
            <div className="auth-feature-pill">
              <span className="pill-check">✓</span>
              <span><strong>Zero Double Counting</strong> deterministic accounting engine</span>
            </div>
            <div className="auth-feature-pill">
              <span className="pill-check">✓</span>
              <span><strong>ML Gap-Filling</strong> for non-reporting sub-tier suppliers</span>
            </div>
            <div className="auth-feature-pill">
              <span className="pill-check">✓</span>
              <span><strong>Assurance-Ready</strong> immutable SQLite audit ledger</span>
            </div>
          </div>

          <div className="auth-brand-footer">
            <span>GHG Protocol Scope 3 Compliant</span>
            <span className="sep">•</span>
            <span>Single-File SQLite Database Architecture</span>
          </div>
        </div>
      </div>

      {/* Split Right: Clean White Login Form Card */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Welcome Back</h2>
            <p className="auth-card-subtitle">Sign in to your enterprise sustainability account</p>
          </div>

          {error && (
            <div className="auth-error-banner">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username or Corporate Email</label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g. demo_manager"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="password">Password</label>
                <button
                  type="button"
                  className="btn-text-link"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="form-options-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="btn-text-link"
                onClick={() => alert('Demo Password: Use DemoManager2026! or click 1-Click Demo Logins below.')}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          {/* 1-Click Quick Demo Shortcuts */}
          <div className="demo-shortcuts-box">
            <div className="demo-shortcuts-title">⚡ Quick 1-Click Demo Accounts:</div>
            <div className="demo-btns-grid">
              <button
                type="button"
                className="btn-demo-shortcut"
                onClick={() => handleQuickLogin('demo_manager', 'DemoManager2026!')}
              >
                <strong>🏢 Manager</strong>
                <span>Apex Motors</span>
              </button>
              <button
                type="button"
                className="btn-demo-shortcut"
                onClick={() => handleQuickLogin('demo_auditor', 'DemoAuditor2026!')}
              >
                <strong>🛡️ Auditor</strong>
                <span>ESG Assurance</span>
              </button>
              <button
                type="button"
                className="btn-demo-shortcut"
                onClick={() => handleQuickLogin('demo_supplier', 'DemoSupplier2026!')}
              >
                <strong>🏭 Supplier</strong>
                <span>Apex Battery</span>
              </button>
            </div>
          </div>

          <div className="auth-card-footer">
            <span>Don't have an enterprise account?</span>
            <button
              type="button"
              className="btn-text-link font-semibold"
              onClick={onSwitchToSignup}
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
