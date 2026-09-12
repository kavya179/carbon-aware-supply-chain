import React from 'react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', group: 'main' },
  { id: 'suppliers', label: 'Suppliers', icon: '🏢', group: 'main' },
  { id: 'network', label: 'Supply Chain', icon: '🕸️', group: 'main' },
  { id: 'upload', label: 'Data Upload', icon: '📤', group: 'main' },
  { id: 'calculations', label: 'Carbon Calculation', icon: '🔢', group: 'main' },
  { id: 'hotspots', label: 'Hotspots', icon: '🔥', group: 'analytics' },
  { id: 'recommendations', label: 'Recommendations', icon: '🌱', group: 'analytics' },
  { id: 'reports', label: 'Reports', icon: '📋', group: 'analytics' },
  { id: 'audit', label: 'Audit Trail', icon: '🛡️', group: 'compliance' },
  { id: 'ml', label: 'ML Gap-Filling', icon: '🤖', group: 'compliance' },
  { id: 'settings', label: 'Settings & Guide', icon: '⚙️', group: 'settings' },
];

export default function Sidebar({ activeTab, onSelectTab, isOpen, onClose }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose}></div>}

      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-icon-box">🌿</div>
          <div className="brand-text-stack">
            <span className="brand-title">Carbon-Aware</span>
            <span className="brand-subtitle">Supply Chain Platform</span>
          </div>
          {isOpen && (
            <button className="sidebar-close-btn" onClick={onClose} aria-label="Close Navigation">
              ✕
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="sidebar-nav" aria-label="Main Navigation">
          <div className="nav-section-label">MAIN NAVIGATION</div>
          {NAV_ITEMS.filter(item => item.group === 'main').map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onClose) onClose();
                }}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
                {isActive && <span className="active-indicator"></span>}
              </button>
            );
          })}

          <div className="nav-section-label">ANALYTICS & ACTIONS</div>
          {NAV_ITEMS.filter(item => item.group === 'analytics').map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onClose) onClose();
                }}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
                {isActive && <span className="active-indicator"></span>}
              </button>
            );
          })}

          <div className="nav-section-label">ASSURANCE & TOOLS</div>
          {NAV_ITEMS.filter(item => item.group === 'compliance' || item.group === 'settings').map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onClose) onClose();
                }}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
                {isActive && <span className="active-indicator"></span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="sidebar-footer">
          <div className="sidebar-engine-pill">
            <span className="engine-dot"></span>
            <span>SQLite Verified Engine</span>
          </div>
          <div className="sidebar-version">v2.4 • Scope 3 Compliant</div>
        </div>
      </aside>
    </>
  );
}
