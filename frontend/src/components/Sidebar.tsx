import React from 'react';
import { NavLink } from 'react-router-dom';
import { DashboardGridIcon, ContentLibraryIcon } from './Icons';
import './Sidebar.css';

export default function Sidebar() {
  return (
    <aside className="app-sidebar">
      <NavLink
        to="/"
        className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        title="לוח בקרה"
      >
        <span className="sidebar-item-icon">
          <DashboardGridIcon size={18} />
        </span>
        <span className="sidebar-item-text">לוח בקרה</span>
      </NavLink>

      <NavLink
        to="/content-library"
        className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
        title="ספריית תוכן"
      >
        <span className="sidebar-item-icon">
          <ContentLibraryIcon size={18} />
        </span>
        <span className="sidebar-item-text">ספריית תוכן</span>
      </NavLink>
    </aside>
  );
}
