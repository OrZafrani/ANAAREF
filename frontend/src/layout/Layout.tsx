import React from 'react';
import GlobalNavbar from '../components/GlobalNavbar';
import Sidebar from '../components/Sidebar';
import './Layout.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout-app">
      <GlobalNavbar />
      <div className="layout-body-container">
        <Sidebar />
        <main className="layout-main-content">{children}</main>
      </div>
    </div>
  );
}
