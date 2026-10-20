import { NavLink, useLocation } from 'react-router-dom';
import { IcHome, IcList, IcCal, IcCard, IcFriends, IcUser } from './Icon.jsx';
import { useImportSchedule } from '../../hooks/useImportSchedule.js';
import { useReviewSummary } from '../../hooks/useReviewSummary.js';

const TABS = [
  { to: '/',             label: 'Home',     icon: IcHome,    match: (p) => p === '/' },
  { to: '/transactions', label: 'Activity', icon: IcList,    match: (p) => p.startsWith('/transactions') },
  { to: '/calendar',     label: 'Calendar', icon: IcCal,     match: (p) => p.startsWith('/calendar') },
  { to: '/cards',        label: 'Cards',    icon: IcCard,    match: (p) => p.startsWith('/cards') },
  { to: '/friends',      label: 'People',   icon: IcFriends, match: (p) => p.startsWith('/friends') },
  { to: '/you',          label: 'You',      icon: IcUser,    match: (p) => p.startsWith('/you') || p.startsWith('/categories') || p.startsWith('/import') },
];

export default function MobileTabBar() {
  const loc = useLocation();
  // Import lives under "You" on mobile, so that tab carries the nudge when a
  // card statement is out and not imported yet.
  const { data: schedule } = useImportSchedule();
  const toImport = schedule?.pendingCount ?? 0;
  // People carries one when older settlements need reviewing.
  const { data: review } = useReviewSummary();
  const toReview = review?.needingReview ?? 0;
  const alerts = {
    '/you': toImport > 0 ? `${toImport} card statement${toImport === 1 ? '' : 's'} to import` : null,
    '/friends': toReview > 0 ? `${toReview} older settlement${toReview === 1 ? '' : 's'} to review` : null,
  };
  return (
    <nav className="ft-tabbar" aria-label="Bottom navigation">
      {TABS.map((tab) => {
        const Ic = tab.icon;
        const active = tab.match(loc.pathname);
        const alert = alerts[tab.to];
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`ft-tabbar__item${active ? ' ft-tabbar__item--active' : ''}`}
            aria-label={alert ? `${tab.label} · ${alert}` : undefined}
          >
            <span className="ft-tabbar__icon">
              <Ic size={22} stroke={active ? 2 : 1.75} />
              {alert && <span className="ft-tabbar__dot" aria-hidden />}
            </span>
            <span className="ft-tabbar__label">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
