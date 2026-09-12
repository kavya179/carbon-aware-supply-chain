import React, { useState } from 'react';

export default function SignupPage({ onSignupSuccess, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'COMPANY_MANAGER',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.email.trim() || !formData.password) {
      setError('Please fill out all required fields.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSignupSuccess(formData);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try a different username/email.');
    } finally {
      setLoading(false);
    }
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
            Join the enterprise sustainability platform purpose-built for transparent multi-tier Scope 3 carbon reduction.
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

      {/* Split Right: Clean White Signup Form Card */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Create Your Account</h2>
            <p className="auth-card-subtitle">Get started with your enterprise sustainability workspace</p>
          </div>

          {error && (
            <div className="auth-error-banner">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className="form-input"
                placeholder="e.g. Kavya Sharma"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label className="form-label" htmlFor="username">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="form-input"
                  placeholder="e.g. ksharma"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email">Corporate Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-input"
                  placeholder="kavya@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Select Your Role</label>
              <div className="role-selector-grid">
                <label className={`role-radio-card ${formData.role === 'COMPANY_MANAGER' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="COMPANY_MANAGER"
                    checked={formData.role === 'COMPANY_MANAGER'}
                    onChange={handleChange}
                  />
                  <div className="role-radio-info">
                    <span className="role-title">🏢 Company Manager</span>
                    <span className="role-desc">OEM & Sustainability Lead</span>
                  </div>
                </label>

                <label className={`role-radio-card ${formData.role === 'SUPPLIER' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="SUPPLIER"
                    checked={formData.role === 'SUPPLIER'}
                    onChange={handleChange}
                  />
                  <div className="role-radio-info">
                    <span className="role-title">🏭 Supplier</span>
                    <span className="role-desc">Tier 1/2/3 Data Contributor</span>
                  </div>
                </label>

                <label className={`role-radio-card ${formData.role === 'AUDITOR' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="AUDITOR"
                    checked={formData.role === 'AUDITOR'}
                    onChange={handleChange}
                  />
                  <div className="role-radio-info">
                    <span className="role-title">🛡️ Auditor</span>
                    <span className="role-desc">Assurance & Verification</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-grid-2col">
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
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Min. 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Complete Enterprise Registration'}
            </button>
          </form>

          <div className="auth-card-footer">
            <span>Already have an account?</span>
            <button
              type="button"
              className="btn-text-link font-semibold"
              onClick={onSwitchToLogin}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
