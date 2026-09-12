import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  MdDashboard,
  MdFactory,
  MdShowChart,
  MdAnalytics,
  MdLightbulb,
  MdChevronLeft,
  MdChevronRight,
  MdAssignment,
  MdLogout,
  MdEco,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: MdDashboard, exact: true, roles: ['company_manager', 'auditor', 'supplier'] },
  { to: '/suppliers', label: 'Suppliers', icon: MdFactory, roles: ['company_manager', 'auditor'] },
  { to: '/emissions', label: 'Emissions', icon: MdShowChart, roles: ['company_manager', 'auditor', 'supplier'] },
  { to: '/analytics', label: 'Analytics', icon: MdAnalytics, roles: ['company_manager', 'auditor'] },
  { to: '/submit', label: 'Submit Data', icon: MdAssignment, roles: ['company_manager', 'supplier'] },
  { to: '/recommendations', label: 'AI Insights', icon: MdLightbulb, roles: ['company_manager', 'auditor', 'supplier'] },
];

function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  
  // Filter nav items based on user role
  const filteredNavItems = NAV_ITEMS.filter(item => 
    !user || item.roles.includes(user.role)
  );

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <MdEco size={22} />
        </div>
        {!collapsed && (
          <div className="sidebar__logo-text">
            <span className="sidebar__logo-title">CarbonTrack</span>
            <span className="sidebar__logo-sub">Supply Chain</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {filteredNavItems.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={20} className="sidebar__nav-icon" />
            {!collapsed && <span className="sidebar__nav-label">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer / User Info */}
      {!collapsed && (
        <div className="sidebar__footer">
          <div className="sidebar__user-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'Guest'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
          
          <button 
            onClick={logout}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              background: 'var(--status-red-bg)', color: 'var(--status-red)', 
              border: 'none', borderRadius: '6px', padding: '0.5rem',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
              width: '100%', transition: 'all 0.2s'
            }}
          >
            <MdLogout size={16} /> Logout
          </button>
        </div>
      )}

      {/* Collapse Toggle */}
      <button className="sidebar__toggle" onClick={onToggle} aria-label="Toggle sidebar">
        {collapsed ? <MdChevronRight size={18} /> : <MdChevronLeft size={18} />}
      </button>
    </aside>
  );
}

export default Sidebar;
