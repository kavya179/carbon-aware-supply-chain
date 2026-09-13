import React from 'react';

const NAV_GROUPS = [
  {
    id: 'main',
    label: 'MAIN NAVIGATION',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'suppliers', label: 'Suppliers', icon: '🏢' },
      { id: 'network', label: 'Supply Chain', icon: '🕸️' },
      { id: 'upload', label: 'Data Upload', icon: '📤' },
      { id: 'calculations', label: 'Carbon Calculation', icon: '🔢' },
    ]
  },
  {
    id: 'analytics',
    label: 'ANALYTICS & ACTIONS',
    items: [
      { id: 'hotspots', label: 'Hotspots', icon: '🔥' },
      { id: 'recommendations', label: 'Recommendations', icon: '🌱' },
      { id: 'reports', label: 'Reports', icon: '📋' },
    ]
  },
  {
    id: 'assurance',
    label: 'ASSURANCE & TOOLS',
    badge: 'AUDITED',
    items: [
      { id: 'audit', label: 'Audit Trail', icon: '🛡️' },
      { id: 'ml', label: 'ML Gap-Filling', icon: '🤖' },
      { id: 'settings', label: 'Settings & Standards', icon: '⚙️' },
    ]
  }
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
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="nav-group-section">
              <div className="nav-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{group.label}</span>
                {group.badge && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: 'rgba(5, 150, 105, 0.12)',
                    color: '#059669',
                    letterSpacing: '0.04em'
                  }}>
                    {group.badge}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {group.items.map((item) => {
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
              </div>
            </div>
          ))}
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
