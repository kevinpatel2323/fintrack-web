import { createContext, useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, PanelRightOpen } from 'lucide-react';
import Dropdown from './Dropdown.jsx';
import Tooltip from './Tooltip.jsx';
import './Sidebar.css';

// Port of frappe-ui's Sidebar family (Sidebar, SidebarHeader, SidebarItem,
// SidebarLabel, SidebarCollapseToggle). The app composes its own body from
// these; see components/shell/AppSidebar.jsx.

const SidebarContext = createContext({ collapsed: false });

export function useSidebar() {
  return useContext(SidebarContext);
}

export function Sidebar({ collapsed = false, label = 'Primary', className = '', children }) {
  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <nav
        className={`ui-sidebar${collapsed ? ' ui-sidebar--collapsed' : ''} ${className}`.trim()}
        data-state={collapsed ? 'collapsed' : 'expanded'}
        aria-label={label}
      >
        {children}
      </nav>
    </SidebarContext.Provider>
  );
}

/** Logo + title block, optionally a dropdown trigger (`menuItems`). 48px tall
 *  so it lines up with the page header. */
export function SidebarHeader({ logo, title, subtitle, menuItems }) {
  const { collapsed } = useSidebar();
  const identity = (
    <>
      <span className="ui-sidebar-header__logo">{logo}</span>
      <span className="ui-sidebar-header__text ui-sidebar__fade">
        <span className="ui-sidebar-header__title truncate">{title}</span>
        {subtitle && <span className="ui-sidebar-header__subtitle truncate">{subtitle}</span>}
      </span>
    </>
  );

  return (
    <div className="ui-sidebar-header">
      {menuItems ? (
        <Dropdown options={menuItems} placement="bottom-start">
          <button
            type="button"
            className={`ui-sidebar-header__trigger${collapsed ? ' is-collapsed' : ''}`}
            aria-label={`${title} menu`}
          >
            {identity}
            <ChevronDown className="ui-sidebar-header__chevron ui-sidebar__fade" size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </Dropdown>
      ) : (
        <div className="ui-sidebar-header__trigger is-static">{identity}</div>
      )}
    </div>
  );
}

/** A nav row. `to` renders a router NavLink (active from the route unless
 *  `active` is given); otherwise a button calling `onClick`. `suffix` is the
 *  muted count on the right (hidden when collapsed). */
export function SidebarItem({ icon: Icon, label, to, end, active, onClick, suffix, suffixLabel, alert = false }) {
  const { collapsed } = useSidebar();
  const name = suffix && suffixLabel ? `${label} · ${suffixLabel}` : label;

  const inner = (
    <>
      <Tooltip text={label} placement="right" disabled={!collapsed}>
        <span className="ui-sidebar-item__icon">
          {Icon && <Icon size={16} strokeWidth={1.5} aria-hidden />}
          {alert && collapsed && <span className="ui-sidebar-item__dot" aria-hidden />}
        </span>
      </Tooltip>
      <span className="ui-sidebar-item__label ui-sidebar__fade">
        <span className="truncate">{label}</span>
      </span>
    </>
  );

  const suffixEl = suffix != null && suffix !== '' && suffix !== 0 && (
    <span className={`ui-sidebar-item__suffix ui-sidebar__fade${alert ? ' is-alert' : ''}`} aria-hidden>
      {suffix}
    </span>
  );

  if (to) {
    return (
      <NavLink
        to={to}
        end={end}
        aria-label={name}
        className={({ isActive }) =>
          `ui-sidebar-item${(active ?? isActive) ? ' is-active' : ''}`
        }
      >
        {inner}
        {suffixEl}
      </NavLink>
    );
  }
  return (
    <button
      type="button"
      className={`ui-sidebar-item${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-label={name}
    >
      {inner}
      {suffixEl}
    </button>
  );
}

/** Section caption; turns into a hairline when the sidebar is collapsed. */
export function SidebarLabel({ children }) {
  return (
    <div className="ui-sidebar-label">
      <h3 className="ui-sidebar-label__text ui-sidebar__fade">{children}</h3>
      <hr className="ui-sidebar-label__rule" aria-hidden />
    </div>
  );
}

export function SidebarCollapseToggle({ onToggle }) {
  const { collapsed } = useSidebar();
  return (
    <SidebarItem
      icon={(props) => (
        <PanelRightOpen {...props} className={`ui-sidebar-toggle__icon${collapsed ? ' is-flipped' : ''}`} />
      )}
      label={collapsed ? 'Expand' : 'Collapse'}
      onClick={onToggle}
    />
  );
}
