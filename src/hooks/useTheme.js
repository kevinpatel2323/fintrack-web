import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'fintrack.theme';

/** 'system' follows the OS; 'light' / 'dark' pin it via [data-theme] on <html>. */
export const THEME_MODES = ['system', 'light', 'dark'];

// Keeps the mobile browser chrome in step with the page canvas.
const CHROME_COLOR = { light: '#F4F5F7', dark: '#0A0B0E' };

function readStored() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefers() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Applies the mode to <html> and syncs <meta name="theme-color">.
 * Exported so the pre-paint inline script in index.html and this hook stay
 * in agreement about what "applying a theme" means.
 */
export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'system') delete root.dataset.theme;
  else root.dataset.theme = mode;

  const resolved = mode === 'system' ? systemPrefers() : mode;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', CHROME_COLOR[resolved]));
  return resolved;
}

export function useTheme() {
  const [mode, setMode] = useState(readStored);
  const [resolved, setResolved] = useState(() =>
    (readStored() === 'system' ? systemPrefers() : readStored()));

  useEffect(() => {
    setResolved(applyTheme(mode));
    try {
      if (mode === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* private browsing — the theme still applies for this session */
    }
  }, [mode]);

  // While on 'system', track OS changes live.
  useEffect(() => {
    if (mode !== 'system') return undefined;
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return undefined;
    const onChange = () => setResolved(applyTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((m) => THEME_MODES[(THEME_MODES.indexOf(m) + 1) % THEME_MODES.length]);
  }, []);

  return { mode, resolved, setMode, cycle };
}
