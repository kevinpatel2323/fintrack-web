import { useNavigate } from 'react-router-dom';
import { LogOut, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import {
  Sidebar, SidebarCollapseToggle, SidebarHeader, SidebarItem, SidebarLabel,
} from '../ui/Sidebar.jsx';
import Logo from './Logo.jsx';
import { MANAGE_NAV, PRIMARY_NAV, useNavBadges } from './nav.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../hooks/useTheme.js';

const THEME_OPTIONS = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor },
];

export default function AppSidebar({ collapsed, onToggleCollapsed }) {
  const { authDisabled, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const badges = useNavBadges();

  const menuItems = [
    {
      group: 'Appearance',
      items: THEME_OPTIONS.map((t) => ({
        label: t.label,
        icon: t.icon,
        selected: mode === t.mode,
        onClick: () => setMode(t.mode),
      })),
    },
    ...(authDisabled
      ? []
      : [
          {
            items: [
              { label: 'Security', icon: ShieldCheck, onClick: () => navigate('/security') },
              { label: 'Log out', icon: LogOut, onClick: logout },
            ],
          },
        ]),
  ];

  const renderItem = (item) => {
    const badge = badges[item.to];
    return (
      <SidebarItem
        key={item.to}
        to={item.to}
        end={item.end}
        icon={item.icon}
        label={item.label}
        suffix={badge?.count}
        suffixLabel={badge?.label}
        alert={Boolean(badge)}
      />
    );
  };

  return (
    <Sidebar collapsed={collapsed}>
      <SidebarHeader logo={<Logo />} title="Fintrack" subtitle="Personal finance" menuItems={menuItems} />
      <div className="app-sidebar__body">
        {PRIMARY_NAV.map(renderItem)}
        <SidebarLabel>Manage</SidebarLabel>
        {MANAGE_NAV.filter((i) => !(i.authOnly && authDisabled)).map(renderItem)}
      </div>
      <div className="app-sidebar__footer">
        <SidebarCollapseToggle onToggle={onToggleCollapsed} />
      </div>
    </Sidebar>
  );
}
