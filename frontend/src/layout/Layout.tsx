import React from 'react';
import { Link } from 'react-router-dom';
import './Layout.css';

export default function Layout({ children }: { children: React.ReactNode }) {
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
