import React from 'react';
import GlobalNavbar from '../components/GlobalNavbar';
import Sidebar from '../components/Sidebar';
import { AppSettingsProvider } from '../lib/appSettings';
import './Layout.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppSettingsProvider>
      <div className="layout layout-app">
        <GlobalNavbar />
        <div className="layout-body-container">
          <Sidebar />
          <main className="layout-main-content">{children}</main>
        </div>
      </div>
    </AppSettingsProvider>
  );
}
