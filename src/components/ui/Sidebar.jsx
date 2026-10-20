import { NavLink } from 'react-router-dom';
import {
  IcLogo, IcHome, IcList, IcCal, IcCard, IcFriends, IcTag, IcUpload,
  IcSparkle, IcSettings, IcCommand,
} from './Icon.jsx';
import { Avatar } from './primitives.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useImportSchedule } from '../../hooks/useImportSchedule.js';
import { useReviewSummary } from '../../hooks/useReviewSummary.js';

const NAV = [
  { to: '/',             label: 'Overview',     icon: IcHome,   end: true },
  { to: '/transactions', label: 'Transactions', icon: IcList },
  { to: '/cards',        label: 'Cards',        icon: IcCard },
  { to: '/calendar',     label: 'Calendar',     icon: IcCal },
  { to: '/friends',      label: 'People',       icon: IcFriends },
  { to: '/categories',   label: 'Categories',   icon: IcTag },
  { to: '/import',       label: 'Import',       icon: IcUpload },
  { to: '/security',     label: 'Security',     icon: IcCommand, authOnly: true },
];

export default function Sidebar() {
  const { authDisabled } = useAuth();
  const nav = authDisabled ? NAV.filter((item) => !item.authOnly) : NAV;
  // Card statements that are out but not imported yet, badged on Import.
  const { data: schedule } = useImportSchedule();
  const toImport = schedule?.pendingCount ?? 0;
  // Older settlements that don't match their entries, badged on People.
  const { data: review } = useReviewSummary();
  const toReview = review?.needingReview ?? 0;
  const badges = {
    '/import': [toImport, (n) => `${n} card statement${n === 1 ? '' : 's'} to import`],
    '/friends': [toReview, (n) => `${n} older settlement${n === 1 ? '' : 's'} to review`],
  };
  return (
    <aside className="ft-sidebar">
      <div className="ft-sidebar__brand">
        <IcLogo size={28} />
        <span>Fintrack</span>
      </div>

      <nav className="ft-sidebar__nav" aria-label="Primary">
        {nav.map((item) => {
          const Ic = item.icon;
          const [badge = 0, describe] = badges[item.to] ?? [];
          const name = badge ? `${item.label} · ${describe(badge)}` : item.label;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              /* The label is hidden in the collapsed rail tier, so the link
                 carries its name here instead. */
              title={name}
              aria-label={name}
              className={({ isActive }) =>
                `ft-sidebar__nav-item${isActive ? ' ft-sidebar__nav-item--active' : ''}${badge ? ' ft-sidebar__nav-item--alert' : ''}`
              }
            >
              <Ic size={18} />
              <span>{item.label}</span>
              {badge > 0 && (
                <span className="ft-sidebar__nav-badge ft-sidebar__nav-badge--alert" aria-hidden>
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="ft-sidebar__insight">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--ft-accent-fg)',
            marginBottom: 6,
          }}
        >
          <IcSparkle size={14} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Insight
          </span>
        </div>
        <div className="ft-sidebar__insight-title">Your dining spend is up 18%</div>
        <div>Most of it is on weekends — consider setting a category budget.</div>
      </div>

      <ThemeToggle />

      <div className="ft-sidebar__user">
        <Avatar name="You" size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ft-sidebar__user-name">You</div>
          <div className="ft-sidebar__user-meta">HDFC · Primary</div>
        </div>
        <IcSettings size={16} style={{ color: 'var(--ft-text-dim)' }} />
      </div>
    </aside>
  );
}
