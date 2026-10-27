import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'fintrack.theme';

/** 'system' follows the OS; 'light' / 'dark' pin it. Either way <html> carries
 *  the resolved theme in [data-theme], which is all the stylesheets read. */
export const THEME_MODES = ['system', 'light', 'dark'];

// Keeps the mobile browser chrome in step with the page canvas.
const CHROME_COLOR = { light: '#FFFFFF', dark: '#171717' };

function readStored() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefers() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Applies the mode to <html> and syncs <meta name="theme-color">.
 * Exported so the pre-paint inline script in index.html and this hook stay
 * in agreement about what "applying a theme" means.
 */
export function applyTheme(mode) {
  const root = document.documentElement;
  const resolved = mode === 'system' ? systemPrefers() : mode;
  if (root.dataset.theme !== resolved) {
    // Suppress transitions for the swap frame so surfaces don't cross-fade.
    root.classList.add('no-transition');
    root.dataset.theme = resolved;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-transition')));
  }
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
