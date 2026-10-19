import React, { useEffect, useState } from 'react';
import './Layout.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('cobra-theme') === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    localStorage.setItem('cobra-theme', theme);
  }, [theme]);

  return (
    <div className="layout" data-theme={theme}>
      <header className="header" dir="rtl">
        <div className="brand-lockup">
          <img src="/cobra_logo.png" alt="" className="logo" />
          <div className="brand-copy">
            <strong>COBRA</strong>
            <span>בנייה, ניהול והרצת סימולציות</span>
          </div>
        </div>
        <div className="header-controls">
          <span className="system-name">מערכת יעד</span>
          <div className="module-switch" aria-label="מערכת פעילה">
            <span className="module-tab is-active"><i />SPECTRE</span>
            <span className="module-tab"><i />ניהול לחימה</span>
          </div>
          <button
            className="theme-toggle"
            type="button"
            aria-label="החלפת ערכת נושא"
            onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
          >
            <span aria-hidden="true">{theme === 'light' ? '☾' : '☼'}</span>
            {theme === 'light' ? 'מצב כהה' : 'מצב בהיר'}
          </button>
          <span className="user-badge" aria-label="משתמש מחובר">ממ</span>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
