import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type TargetSystem = 'spectre' | 'cm';

export const SYSTEM_INFO: Record<TargetSystem, { name: string; unitItems: string; unitOne: string; lede: string }> = {
  spectre: {
    name: 'SPECTRE',
    unitItems: 'דיווחים',
    unitOne: 'דיווח',
    lede: 'סימולציות של זרם דיווחים לקליטה, לסינון ולהערכה, כולל דיווחים כפולים, שגויים ורעש רקע.',
  },
  cm: {
    name: 'ניהול לחימה',
    unitItems: 'אירועים',
    unitOne: 'אירוע',
    lede: 'סימולציות של אירועים מבצעיים לטיפול, להקצאת כוחות ולמעקב, בקצב ובמשך מוגדרים.',
  },
};

interface AppSettings {
  theme: Theme;
  sys: TargetSystem;
  setTheme: (theme: Theme) => void;
  setSys: (sys: TargetSystem) => void;
}

const AppSettingsContext = createContext<AppSettings>({
  theme: 'light',
  sys: 'spectre',
  setTheme: () => {},
  setSys: () => {},
});

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readStored('cobra-theme', ['light', 'dark'] as const, 'light'));
  const [sys, setSys] = useState<TargetSystem>(() => readStored('cobra-sys', ['spectre', 'cm'] as const, 'spectre'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('cobra-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.sys = sys;
    try { localStorage.setItem('cobra-sys', sys); } catch { /* ignore */ }
  }, [sys]);

  return (
    <AppSettingsContext.Provider value={{ theme, sys, setTheme, setSys }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
