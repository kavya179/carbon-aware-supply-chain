import React, { useState, useRef, useEffect } from 'react';

export default function Header({
  period,
  setPeriod,
  searchTerm,
  setSearchTerm,
  currentUser,
  onLogout,
  onOpenGuide,
  onToggleSidebar,
  recentActivities = []
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef(null);
  const userRef = useRef(null);

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

  const userName = currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : 'Kavya Sharma';
  const userRole = currentUser?.role === 'AUDITOR' ? 'Third-Party Auditor' : currentUser?.role === 'SUPPLIER' ? 'Supplier Representative' : 'Company Manager';
  const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'KS';

  return (
    <header className="app-header">
      {/* Left: Mobile Toggle & Global Search */}
      <div className="header-left">
        <button
          className="mobile-sidebar-toggle"
          onClick={onToggleSidebar}
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
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>
      </div>

      {/* Right: Period Filter, Guide, Notifications, User Menu */}
      <div className="header-right">
        {/* Reporting Period Filter */}
        <div className="header-control-group">
          <label htmlFor="period-selector" className="header-control-label">Period:</label>
          <select
            id="period-selector"
            className="header-select-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="All Periods">All Periods (Consolidated)</option>
            <option value="2024-Q1">2024-Q1 (Audited)</option>
          </select>
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
                  <span className="notif-icon">🔥</span>
                  <div className="notif-content">
                    <p className="notif-text"><strong>High Hotspot Identified</strong>: Siberia & Nord Smelting Co contributes &gt;30% of total Scope 3 footprint.</p>
                    <span className="notif-time">Just now</span>
                  </div>
                </div>
                <div className="notif-item">
                  <span className="notif-icon">🤖</span>
                  <div className="notif-content">
                    <p className="notif-text"><strong>ML Gap Detected</strong>: Alpine Precision Components missing energy telemetry. Ready for estimation.</p>
                    <span className="notif-time">10 mins ago</span>
                  </div>
                </div>
                <div className="notif-item">
                  <span className="notif-icon">📋</span>
                  <div className="notif-content">
                    <p className="notif-text"><strong>Report Finalized</strong>: 2024-Q1 Scope 3 ESG Disclosure generated and ready for export.</p>
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
              <span className="user-role">{userRole}</span>
            </div>
            <span className="user-menu-chevron">▼</span>
          </button>

          {showUserMenu && (
            <div className="dropdown-panel user-dropdown">
              <div className="user-dropdown-header">
                <div className="user-avatar lg">{userInitials}</div>
                <div>
                  <div className="user-dropdown-name">{userName}</div>
                  <div className="user-dropdown-role">{userRole}</div>
                  <div className="user-dropdown-org">Apex Motors Corporation</div>
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
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowUserMenu(false);
                  }}
                >
                  ⚙️ Account & Compliance Settings
                </button>
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
