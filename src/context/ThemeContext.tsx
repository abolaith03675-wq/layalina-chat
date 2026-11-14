import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserRole } from '../types/loqana';

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'layali_theme_mode_v1';

interface ThemeContextValue {
  theme: ThemeMode;
  isDarkMode: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  isDarkMode: true,
  setTheme: () => {},
  toggleTheme: () => {},
});

function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme);

  const applyThemeToDom = useCallback((mode: ThemeMode) => {
    const isDark = mode === 'dark';
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', isDark ? '#070a12' : '#ffffff');
    }
  }, []);

  useEffect(() => {
    applyThemeToDom(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage access restrictions
    }
  }, [theme, applyThemeToDom]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDarkMode: theme === 'dark',
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Ensures message text colors remain crisp and readable on both dark (#090d16) and white (#ffffff) surfaces.
 */
export function getReadableTextColor(hex: string | undefined, isDarkMode: boolean): string {
  if (!hex) return isDarkMode ? '#f8fafc' : '#0f172a';
  if (isDarkMode) return hex;

  const normalized = hex.trim().toLowerCase();
  const lightModeMap: Record<string, string> = {
    '#f8fafc': '#0f172a',
    '#ffffff': '#0f172a',
    '#fff': '#0f172a',
    '#e2e8f0': '#1e293b',
    '#cbd5e1': '#334155',
    '#94a3b8': '#475569',
    '#fbbf24': '#b45309',
    '#eab308': '#a16207',
    '#facc15': '#a16207',
    '#fef08a': '#a16207',
    '#38bdf8': '#0369a1',
    '#34d399': '#047857',
    '#22c55e': '#15803d',
    '#c084fc': '#7e22ce',
    '#f472b6': '#be185d',
    '#fb923c': '#c2410c',
    '#ef4444': '#dc2626',
  };

  return lightModeMap[normalized] || hex;
}

/**
 * Ensures role display colors have strong contrast on light surfaces while keeping exact role colors in dark mode.
 */
export function getReadableRoleColor(role: UserRole, isDarkMode: boolean): string {
  if (isDarkMode) {
    switch (role) {
      case 'owner':
        return '#ef4444';
      case 'vip':
        return '#ec4899';
      case 'admin':
        return '#eab308';
      case 'super_admin':
        return '#22c55e';
      case 'member':
        return '#3b82f6';
      case 'guest':
      default:
        return '#94a3b8';
    }
  }

  switch (role) {
    case 'owner':
      return '#dc2626';
    case 'vip':
      return '#db2777';
    case 'admin':
      return '#b45309';
    case 'super_admin':
      return '#15803d';
    case 'member':
      return '#2563eb';
    case 'guest':
    default:
      return '#475569';
  }
}
