import React, { useState, useRef, useEffect } from 'react';

export default function Header({
  period,
  setPeriod,
  searchTerm,
  setSearchTerm,
  user,
  currentUser,
  onLogout,
  onOpenGuide,
  onToggleSidebar,
  onToggleMobileMenu,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef(null);
  const userRef = useRef(null);

  const activeUser = user || currentUser || {};

  // Close popups on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute User Display Information
  const roleRaw = (activeUser.role || 'COMPANY_MANAGER').toUpperCase();

  let roleBadge = 'COMPANY MANAGER';
  let roleTitle = 'Sustainability & Scope 3 Lead';
  let orgName = activeUser.company_name || activeUser.company || 'Apex Motors Corporation';
  let defaultName = 'Kavya Sharma';

  if (roleRaw.includes('SUPPLIER')) {
    roleBadge = 'SUPPLIER';
    roleTitle = 'Supplier ESG Representative';
    orgName = activeUser.supplier_name || activeUser.supplier || 'Apex Battery Systems GmbH';
    defaultName = 'Apex Battery Representative';
  } else if (roleRaw.includes('AUDITOR')) {
    roleBadge = 'AUDITOR';
    roleTitle = 'Third-Party GHG Verifier';
    orgName = 'ESG Assurance & Certification Corp';
    defaultName = 'Dr. Elena Rostova';
  }

  const rawName = activeUser.first_name 
    ? `${activeUser.first_name} ${activeUser.last_name || ''}`.trim()
    : activeUser.user?.first_name
    ? `${activeUser.user.first_name} ${activeUser.user.last_name || ''}`.trim()
    : activeUser.name || activeUser.username || defaultName;

  const userName = rawName;
  const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'CP';

  return (
    <header className="app-header">
      {/* Left: Mobile Toggle & Global Search */}
      <div className="header-left">
        <button
          className="mobile-sidebar-toggle"
          onClick={onToggleSidebar || onToggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>

        <div className="header-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="header-search-input"
            placeholder="Search suppliers, activities, reports..."
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm && setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm && setSearchTerm('')}>✕</button>
          )}
        </div>
      </div>

      {/* Right: Period Filter, Guide, Notifications, User Profile Menu */}
      <div className="header-right">
        {/* Reporting Period Filter */}
        <div className="header-control-group">
          <label htmlFor="period-selector" className="header-control-label">Period:</label>
          <select
            id="period-selector"
            className="header-select-input"
            value={period || 'All Periods'}
            onChange={(e) => setPeriod && setPeriod(e.target.value)}
          >
            <option value="All Periods">All Periods (Consolidated)</option>
            <option value="2024-Q1">2024-Q1 (Audited)</option>
            <option value="2024-Q2">2024-Q2</option>
          </select>
        </div>

        {/* Role Badge Indicator */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.06em',
          background: roleBadge === 'COMPANY MANAGER' ? 'rgba(6, 95, 70, 0.1)' : roleBadge === 'SUPPLIER' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 118, 110, 0.12)',
          color: roleBadge === 'COMPANY MANAGER' ? '#065F46' : roleBadge === 'SUPPLIER' ? '#047857' : '#0F766E',
          border: `1px solid ${roleBadge === 'COMPANY MANAGER' ? 'rgba(6, 95, 70, 0.2)' : roleBadge === 'SUPPLIER' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 118, 110, 0.25)'}`
        }}>
          [ {roleBadge} ]
        </div>

        {/* ESG Knowledge Guide Button */}
        <button
          className="btn-header-guide"
          onClick={() => onOpenGuide && onOpenGuide('scope3')}
          title="Open Scope 3 & ESG Reference Standards Guide"
        >
          📖 ESG Guide
        </button>

        {/* Notification Bell with Dropdown */}
        <div className="header-notif-wrapper" ref={notifRef}>
          <button
            className="header-icon-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View notifications"
            title="System alerts and activity notifications"
          >
            🔔
            <span className="notif-badge-dot"></span>
          </button>

          {showNotifications && (
            <div className="dropdown-panel notif-dropdown">
              <div className="dropdown-header">
                <h4 className="dropdown-title">System Notifications</h4>
                <span className="dropdown-tag">Live Audits</span>
              </div>
              <div className="notif-list">
                <div className="notif-item">
                  <span className="notif-icon">🛡️</span>
                  <div className="notif-content">
                    <p className="notif-text"><strong>Role Session Active</strong>: Logged in as [{roleBadge}] on {orgName}.</p>
                    <span className="notif-time">Just now</span>
                  </div>
                </div>
                <div className="notif-item">
                  <span className="notif-icon">🔥</span>
                  <div className="notif-content">
                    <p className="notif-text"><strong>High Hotspot Identified</strong>: Siberia & Nord Smelting Co contributes &gt;30% of total Scope 3 footprint.</p>
                    <span className="notif-time">10 mins ago</span>
                  </div>
                </div>
                <div className="notif-item">
                  <span className="notif-icon">📋</span>
                  <div className="notif-content">
                    <p className="notif-text"><strong>Audit Ledger Verified</strong>: SQLite cryptographic record log is intact.</p>
                    <span className="notif-time">1 hour ago</span>
                  </div>
                </div>
              </div>
              <div className="dropdown-footer">
                <span className="text-muted">SQLite Real-time Assurance Log</span>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="header-user-wrapper" ref={userRef}>
          <button
            className="header-user-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User account menu"
          >
            <div className="user-avatar">{userInitials}</div>
            <div className="user-text-stack">
              <span className="user-name">{userName}</span>
              <span className="user-role">{roleBadge}</span>
            </div>
            <span className="user-menu-chevron">▼</span>
          </button>

          {showUserMenu && (
            <div className="dropdown-panel user-dropdown">
              <div className="user-dropdown-header">
                <div className="user-avatar lg">{userInitials}</div>
                <div>
                  <div className="user-dropdown-name">{userName}</div>
                  <div className="user-dropdown-role">{roleTitle}</div>
                  <div className="user-dropdown-org">{orgName}</div>
                </div>
              </div>

              <div className="user-dropdown-links">
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onOpenGuide) onOpenGuide('scope3');
                  }}
                >
                  📖 ESG Knowledge Standards
                </button>
                <div className="dropdown-item" style={{ fontSize: '12px', color: '#64748B', cursor: 'default' }}>
                  🏢 Entity: <strong>{orgName}</strong>
                </div>
              </div>

              <div className="user-dropdown-footer">
                <button
                  className="btn-dropdown-logout"
                  onClick={() => {
                    setShowUserMenu(false);
                    if (onLogout) onLogout();
                  }}
                >
                  🚪 Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
