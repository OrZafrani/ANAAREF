import React from 'react';
import { Link } from 'react-router-dom';
import { MoonIcon } from './Icons';
import './GlobalNavbar.css';

export default function GlobalNavbar() {
  return (
    <header className="global-navbar">
      {/* Right side: Cobra Brand */}
      <Link to="/" className="navbar-brand-section" title="חזרה לדף הראשי">
        <img src="/cobra_logo.png" alt="COBRA" className="cobra-brand-logo" />
        <div className="brand-text-block">
          <span className="brand-title-main">COBRA</span>
          <span className="brand-tagline-sub">בנייה, ניהול והרצה סימולציות</span>
        </div>
      </Link>

      {/* Left side: System Selectors, Dark Mode & User Profile */}
      <div className="navbar-controls-section">
        <span className="target-sys-label">מערכת יעד</span>

        <button type="button" className="navbar-pill-btn active-target">
          <span>SPECTRE</span>
          <span className="pill-dot dot-yellow" />
        </button>

        <button type="button" className="navbar-pill-btn">
          <span className="pill-dot dot-purple" />
          <span>ניהול לחימה</span>
        </button>

        <button type="button" className="btn-darkmode-toggle">
          <MoonIcon size={14} />
          <span>מצב כהה</span>
        </button>

        <div className="user-avatar-badge" title="משתמש מחובר">
          מה
        </div>
      </div>
    </header>
  );
}
