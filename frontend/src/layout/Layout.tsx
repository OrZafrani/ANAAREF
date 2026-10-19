import React, { useEffect, useState } from 'react';
import GlobalNavbar from '../components/GlobalNavbar';
import Sidebar from '../components/Sidebar';
import './Layout.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('cobra-theme') === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    localStorage.setItem('cobra-theme', theme);
  }, [theme]);

  return (
    <div className="layout layout-app" data-theme={theme}>
      <GlobalNavbar
        theme={theme}
        onThemeToggle={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      />
      <div className="layout-body-container">
        <Sidebar />
        <main className="layout-main-content">{children}</main>
      </div>
    </div>
  );
}
