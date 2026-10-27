import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar.jsx';
import MobileNav from './MobileNav.jsx';
import { useIsCompact, QUERY_EXPANDED } from '../../styles/breakpoints.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import './AppShell.css';

const COLLAPSE_KEY = 'fintrack.sidebar';

function readCollapsePref() {
  try {
    const v = localStorage.getItem(COLLAPSE_KEY);
    return v === 'collapsed' ? true : v === 'expanded' ? false : null;
  } catch {
    return null;
  }
}

/** Scrolls the shell's scroll area to the top whenever the route changes. */
function useScrollReset(ref) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [pathname, ref]);
}

/**
 * The app frame (frappe-ui DesktopShell / MobileShell). Desktop: sidebar plus
 * a content column whose body scrolls under a sticky PageHeader. Phone: the
 * page scrolls between its header and the bottom tab bar.
 */
export default function AppShell({ children }) {
  const isMobile = useIsCompact();
  const isExpandedTier = useMediaQuery(QUERY_EXPANDED);
  const [pref, setPref] = useState(readCollapsePref);
  const scrollRef = useRef(null);
  useScrollReset(scrollRef);

  // Below 1100px the sidebar starts as an icon rail; the user's choice wins.
  const collapsed = pref ?? !isExpandedTier;
  const toggle = useCallback(() => {
    const next = !collapsed;
    setPref(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? 'collapsed' : 'expanded');
    } catch {
      /* private mode — the toggle still works for this session */
    }
  }, [collapsed]);

  if (isMobile) {
    return (
      <div className="mobile-shell">
        <div className="mobile-shell__scroll" ref={scrollRef}>
          {children}
        </div>
        <MobileNav onReselect={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppSidebar collapsed={collapsed} onToggleCollapsed={toggle} />
      <div className="app-shell__content">
        <main className="app-shell__scroll" ref={scrollRef}>
          {children}
        </main>
      </div>
    </div>
  );
}
