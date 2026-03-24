'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
};

const THEME_STORAGE_KEY = 'autodrive-theme-mode';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyResolvedTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

function readForcedThemeFromUrl(): ResolvedTheme | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('theme');
  if (forced === 'dark') return 'dark';
  if (forced === 'light') return 'light';
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    const forcedTheme = readForcedThemeFromUrl();
    if (forcedTheme) {
      setModeState(forcedTheme);
      setResolvedTheme(forcedTheme);
      applyResolvedTheme(forcedTheme);
      return;
    }

    const stored = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) || 'system';
    const normalized: ThemeMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    const initialResolved = normalized === 'system' ? getSystemPreference() : normalized;

    setModeState(normalized);
    setResolvedTheme(initialResolved);
    applyResolvedTheme(initialResolved);
  }, []);

  useEffect(() => {
    const forcedTheme = readForcedThemeFromUrl();
    if (forcedTheme) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      if (mode !== 'system') return;
      const nextTheme: ResolvedTheme = event.matches ? 'dark' : 'light';
      setResolvedTheme(nextTheme);
      applyResolvedTheme(nextTheme);
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }

    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [mode]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    const forcedTheme = readForcedThemeFromUrl();
    if (forcedTheme) {
      setModeState(forcedTheme);
      setResolvedTheme(forcedTheme);
      applyResolvedTheme(forcedTheme);
      return;
    }

    const normalized: ThemeMode = nextMode === 'light' || nextMode === 'dark' || nextMode === 'system' ? nextMode : 'system';
    const nextResolved = normalized === 'system' ? getSystemPreference() : normalized;

    localStorage.setItem(THEME_STORAGE_KEY, normalized);
    setModeState(normalized);
    setResolvedTheme(nextResolved);
    applyResolvedTheme(nextResolved);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      setMode,
    }),
    [mode, resolvedTheme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider.');
  }
  return context;
}
