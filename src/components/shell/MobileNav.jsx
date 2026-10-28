import { forwardRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MOBILE_TABS, useNavBadges } from './nav.js';

// frappe-ui MobileNav: equal-width tabs, 24px icon over an xs label. Tapping
// the tab you're on scrolls the page back to the top instead of re-navigating.
const MobileNav = forwardRef(function MobileNav({ onReselect }, ref) {
  const { pathname } = useLocation();
  const badges = useNavBadges();
  // Import lives under You on phones, so the header's You button carries
  // its nudge (YouButton.jsx); People keeps its own.
  const alerts = { '/friends': badges['/friends']?.label };

  return (
    <nav ref={ref} className="mobile-nav" aria-label="Primary">
      {MOBILE_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        const alert = alerts[tab.to];
        const isCurrent = pathname === tab.to;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`mobile-nav__item${active ? ' is-active' : ''}`}
            aria-current={isCurrent ? 'page' : undefined}
            aria-label={alert ? `${tab.label} · ${alert}` : tab.label}
            onClick={(e) => {
              if (isCurrent) {
                e.preventDefault();
                onReselect?.();
              }
            }}
          >
            <span className="mobile-nav__icon">
              <Icon size={24} strokeWidth={1.5} aria-hidden />
              {alert && <span className="mobile-nav__dot" aria-hidden />}
            </span>
            <span className="mobile-nav__label">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
});

export default MobileNav;
