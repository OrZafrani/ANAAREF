import React from 'react';
import { Link } from 'react-router-dom';
import { MoonIcon, SunIcon } from './Icons';
import { SYSTEM_INFO, useAppSettings, type TargetSystem } from '../lib/appSettings';
import './GlobalNavbar.css';

const SYSTEMS: TargetSystem[] = ['spectre', 'cm'];

export default function GlobalNavbar() {
  const { theme, setTheme, sys, setSys } = useAppSettings();

  return (
    <header className="global-navbar">
      {/* Right side: Cobra Brand Logo & Title */}
      <Link to="/" className="navbar-brand-section" title="חזרה לדף הראשי">
        <img src="/cobra_logo.png" alt="COBRA" className="cobra-brand-logo" />
        <div className="brand-text-block">
          <span className="brand-title-main">COBRA</span>
          <span className="brand-tagline-sub">בנייה, ניהול והרצה סימולציות</span>
        </div>
      </Link>

      {/* Left side: System Selectors, Dark Mode & User Profile */}
      <div className="navbar-controls-section">
        <div className="target-sys-switch">
          <span className="target-sys-label" id="target-sys-label">מערכת יעד</span>
          <div className="seg" role="radiogroup" aria-labelledby="target-sys-label">
            {SYSTEMS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={sys === key}
                className={`seg-btn ${sys === key ? 'on' : ''}`}
                onClick={() => setSys(key)}
              >
                <span className={`sys-swatch sys-swatch-${key}`} />
                <span>{SYSTEM_INFO[key].name}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="btn-darkmode-toggle"
          aria-label="החלפת ערכת נושא"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <MoonIcon size={15} /> : <SunIcon size={15} />}
          <span>{theme === 'light' ? 'מצב כהה' : 'מצב בהיר'}</span>
        </button>

        <div className="user-avatar-badge" title="משתמש מחובר">
          מה
        </div>
      </div>
    </header>
  );
}
