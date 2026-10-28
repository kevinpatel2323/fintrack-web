import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar.jsx';
import MobileNav from './MobileNav.jsx';
import YouButton from './YouButton.jsx';
import { YOU_PATHS, isTabRoot } from './nav.js';
import { PhoneChromeContext } from '../ui/internal/phoneChrome.js';
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
 * The phone frame (frappe-ui MobileShell): a fixed column of header slot,
 * natively scrolling content, footer slot and — on a tab's own page — the
 * tab bar. Pushed pages (a record, anything under You) hide the tab bar and
 * show Back instead, as Gameplan does with `hideMobileNav`.
 */
function MobileShell({ children, scrollRef }) {
  const { pathname } = useLocation();
  const [headerNode, setHeaderNode] = useState(null);
  const [footerNode, setFooterNode] = useState(null);
  const onTabRoot = isTabRoot(pathname);
  const underYou = YOU_PATHS.some((p) => pathname.startsWith(p));

  const chrome = useMemo(
    () => ({
      headerNode,
      footerNode,
      rootPrefix: onTabRoot ? <YouButton /> : null,
      fallbackBack: underYou && pathname !== '/you' ? '/you' : '/',
    }),
    [headerNode, footerNode, onTabRoot, underYou, pathname],
  );

  return (
    <PhoneChromeContext.Provider value={chrome}>
      <div className="mobile-shell" data-nav={onTabRoot ? '' : undefined}>
        <div className="mobile-shell__header" ref={setHeaderNode} />
        <div className="mobile-shell__scroll" ref={scrollRef}>
          {children}
        </div>
        <div className="mobile-shell__footer" ref={setFooterNode} />
        {onTabRoot && (
          <MobileNav onReselect={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} />
        )}
      </div>
    </PhoneChromeContext.Provider>
  );
}

/**
 * The app frame (frappe-ui DesktopShell / MobileShell) — two navigation
 * models, not one responsive layout. Desktop: sidebar plus a content column
 * whose body scrolls under a sticky PageHeader. Phone: MobileShell above.
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
    return <MobileShell scrollRef={scrollRef}>{children}</MobileShell>;
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
