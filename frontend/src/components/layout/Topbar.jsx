import React from 'react';
import { MdNotifications, MdSearch } from 'react-icons/md';
import './Topbar.css';

function Topbar() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="topbar">
      {/* Search */}
      <div className="topbar__search">
        <MdSearch size={18} className="topbar__search-icon" />
        <input
          id="topbar-search"
          type="text"
          placeholder="Search suppliers, emissions..."
          className="topbar__search-input"
        />
      </div>

      <div className="topbar__right">
        {/* Live indicator */}
        <div className="topbar__live">
          <span className="status-dot status-dot--green" />
          <span className="topbar__live-text">Live Data</span>
        </div>

        {/* Date */}
        <span className="topbar__date">{dateStr}</span>

        {/* Notifications */}
        <button id="topbar-notifications" className="topbar__icon-btn" aria-label="Notifications">
          <MdNotifications size={20} />
          <span className="topbar__notif-badge">3</span>
        </button>

        {/* User Avatar */}
        <div className="topbar__avatar" aria-label="User menu">
          <span>HC</span>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
