import React from 'react';

// Navigation groups by user role
const MANAGER_NAV = [
  {
    id: 'main',
    label: 'MAIN NAVIGATION',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'network', label: 'Supply Chain', icon: '🕸️' },
      { id: 'suppliers', label: 'Suppliers', icon: '🏢' },
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
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ]
  }
];

const SUPPLIER_NAV = [
  {
    id: 'supplier-main',
    label: 'SUPPLIER PORTAL',
    badge: 'ACTIVE',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'profile', label: 'My Profile', icon: '🏢' },
      { id: 'activity-data', label: 'My Activity Data', icon: '📋' },
      { id: 'submit-data', label: 'Submit Data', icon: '📤' },
      { id: 'history', label: 'Submission History', icon: '📜' },
      { id: 'quality', label: 'Data Quality', icon: '📈' },
    ]
  },
  {
    id: 'supplier-tools',
    label: 'SYSTEM & HELP',
    items: [
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ]
  }
];

const AUDITOR_NAV = [
  {
    id: 'auditor-main',
    label: 'ASSURANCE & AUDIT',
    badge: 'ISO 14064',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'verification', label: 'Data Verification', icon: '🛡️' },
      { id: 'calculations', label: 'Carbon Calculations', icon: '🔢' },
      { id: 'suppliers', label: 'Suppliers Under Review', icon: '🏢' },
      { id: 'audit-trail', label: 'Audit Trail', icon: '📜' },
      { id: 'reports', label: 'Reports', icon: '📋' },
    ]
  },
  {
    id: 'auditor-tools',
    label: 'STANDARDS & SYSTEM',
    items: [
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ]
  }
];

export default function Sidebar({ user, role, activeTab, onSelectTab, isOpen, onClose }) {
  const currentRole = (role || user?.role || 'COMPANY_MANAGER').toUpperCase();

  let navGroups = MANAGER_NAV;
  let roleBadgeLabel = 'ENTERPRISE SCOPE 3';

  if (currentRole.includes('SUPPLIER')) {
    navGroups = SUPPLIER_NAV;
    roleBadgeLabel = 'SUPPLIER PORTAL';
  } else if (currentRole.includes('AUDITOR')) {
    navGroups = AUDITOR_NAV;
    roleBadgeLabel = 'AUDITOR ASSURANCE';
  }

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
            <span className="brand-subtitle">{roleBadgeLabel}</span>
          </div>
          {isOpen && (
            <button className="sidebar-close-btn" onClick={onClose} aria-label="Close Navigation">
              ✕
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="sidebar-nav" aria-label="Main Navigation">
          {navGroups.map((group) => (
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
