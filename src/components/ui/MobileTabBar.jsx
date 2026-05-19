import { NavLink, useLocation } from 'react-router-dom';
import { IcHome, IcList, IcCard, IcFriends, IcUser } from './Icon.jsx';

const TABS = [
  { to: '/',             label: 'Home',     icon: IcHome,   match: (p) => p === '/' },
  { to: '/transactions', label: 'Activity', icon: IcList,   match: (p) => p.startsWith('/transactions') },
  { to: '/cards',        label: 'Cards',    icon: IcCard,   match: (p) => p.startsWith('/cards') },
  { to: '/friends',      label: 'People',   icon: IcFriends,match: (p) => p.startsWith('/friends') },
  { to: '/you',          label: 'You',      icon: IcUser,   match: (p) => p.startsWith('/you') || p.startsWith('/categories') || p.startsWith('/import') || p.startsWith('/calendar') },
];

export default function MobileTabBar() {
  const loc = useLocation();
  return (
    <nav className="ft-tabbar" aria-label="Bottom navigation">
      {TABS.map((tab) => {
        const Ic = tab.icon;
        const active = tab.match(loc.pathname);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`ft-tabbar__item${active ? ' ft-tabbar__item--active' : ''}`}
          >
            <Ic size={22} stroke={active ? 2 : 1.75} />
            <span className="ft-tabbar__label">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
