import { NavLink } from 'react-router-dom';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

export default function MobileBottomNav() {
  const show = useMediaQuery('(max-width: 719px)');
  if (!show) return null;

  const linkClass = ({ isActive }) =>
    `mobile-bottom-nav__link${isActive ? ' mobile-bottom-nav__link--active' : ''}`;

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      <NavLink className={linkClass} to="/" end>
        <span className="mobile-bottom-nav__icon" aria-hidden>
          ◎
        </span>
        <span>Overview</span>
      </NavLink>
      <NavLink className={linkClass} to="/transactions">
        <span className="mobile-bottom-nav__icon" aria-hidden>
          ≡
        </span>
        <span>Txns</span>
      </NavLink>
      <NavLink className={linkClass} to="/calendar">
        <span className="mobile-bottom-nav__icon" aria-hidden>
          ▦
        </span>
        <span>Cal</span>
      </NavLink>
      <NavLink className={linkClass} to="/friends">
        <span className="mobile-bottom-nav__icon" aria-hidden>
          ◉
        </span>
        <span>Friends</span>
      </NavLink>
    </nav>
  );
}
