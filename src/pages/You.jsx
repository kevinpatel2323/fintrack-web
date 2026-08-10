import { Link } from 'react-router-dom';
import {
  Card, Avatar, Overline, SectionTitle, GhostBtn,
} from '../components/ui/primitives.jsx';
import { IcUpload, IcTag, IcSettings, IcChevR, IcCal, IcCommand } from '../components/ui/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ROWS = [
  { to: '/import', label: 'Import statement', icon: IcUpload, sub: 'Upload HDFC XLSX' },
  { to: '/calendar', label: 'Calendar', icon: IcCal, sub: 'Month view, bills & activity' },
  { to: '/categories', label: 'Categories', icon: IcTag, sub: 'Manage buckets' },
  { to: '/security', label: 'Security', icon: IcCommand, sub: 'Passkeys & sign-out', authOnly: true },
];

export default function You() {
  const { authDisabled } = useAuth();
  const rows = authDisabled ? ROWS.filter((row) => !row.authOnly) : ROWS;
  return (
    <>
      <header className="ft-mobile__header">
        <h1 className="ft-mobile__title">You</h1>
        <span style={{ width: 40 }} />
      </header>
      <main className="ft-mobile__content">
        <Card pad={20} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name="You" size={56} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>You</div>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 13 }}>HDFC · Primary</div>
          </div>
        </Card>
        <Card pad={6}>
          {rows.map((row, i) => {
            const Ic = row.icon;
            return (
              <Link
                key={row.to}
                to={row.to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, color: 'inherit',
                  borderTop: i ? '1px solid var(--ft-border)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--ft-surface-2)', color: 'var(--ft-text-dim)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ic size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</div>
                  <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>{row.sub}</div>
                </div>
                <IcChevR size={14} style={{ color: 'var(--ft-text-faint)' }} />
              </Link>
            );
          })}
        </Card>
        <Card pad={6}>
          <Link
            to="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12, color: 'inherit',
            }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--ft-surface-2)', color: 'var(--ft-text-dim)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IcSettings size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Settings</div>
              <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>App preferences (coming soon)</div>
            </div>
          </Link>
        </Card>
      </main>
    </>
  );
}
