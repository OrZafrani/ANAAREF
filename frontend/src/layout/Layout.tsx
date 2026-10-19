import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isSimulationBuilder = location.pathname.startsWith('/simulations');

  if (isSimulationBuilder) {
    return <div className="layout-builder">{children}</div>;
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="header-spacer" />
        <Link to="/" title="חזרה לדף הראשי">
          <img src="/cobra_logo.png" alt="Cobra logo" className="logo" />
        </Link>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
