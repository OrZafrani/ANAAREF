import React from 'react';
import './Layout.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout">
      <header className="header">
        <div className="header-spacer" />
        <img src="/cobra_logo.png" alt="Cobra logo" className="logo" />
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
