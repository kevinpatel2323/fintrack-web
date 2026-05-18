import { NavLink } from 'react-router-dom';
import {
  IcLogo, IcHome, IcList, IcCal, IcFriends, IcTag, IcUpload,
  IcSparkle, IcSettings,
} from './Icon.jsx';
import { Avatar } from './primitives.jsx';

const NAV = [
  { to: '/',             label: 'Overview',     icon: IcHome,   end: true },
  { to: '/transactions', label: 'Transactions', icon: IcList },
  { to: '/calendar',     label: 'Calendar',     icon: IcCal },
  { to: '/friends',      label: 'People',       icon: IcFriends },
  { to: '/categories',   label: 'Categories',   icon: IcTag },
  { to: '/import',       label: 'Import',       icon: IcUpload },
];

export default function Sidebar() {
  return (
    <aside className="ft-sidebar">
      <div className="ft-sidebar__brand">
        <IcLogo size={28} />
        <span>Fintrack</span>
      </div>

      <nav className="ft-sidebar__nav" aria-label="Primary">
        {NAV.map((item) => {
          const Ic = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `ft-sidebar__nav-item${isActive ? ' ft-sidebar__nav-item--active' : ''}`
              }
            >
              <Ic size={18} />
              <span>{item.label}</span>
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
            color: 'var(--ft-accent)',
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
