import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge, PageBody, PageHeader, TabButtons } from '../components/ui';
import { MANAGE_NAV, useNavBadges } from '../components/shell/nav.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useImportSchedule } from '../hooks/useImportSchedule.js';
import { useTheme } from '../hooks/useTheme.js';
import { useIsCompact } from '../styles/breakpoints.js';
import YouPhone from './you/YouPhone.jsx';
import './You.css';

const DESCRIPTIONS = {
  '/categories': 'Rename and recolour categories',
  '/import': 'Upload an HDFC bank or card statement',
  '/security': 'Passkeys and sign-out',
};

const THEMES = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

// Everything that isn't a main destination, plus appearance. Phones render
// YouPhone (the hub behind the header's You button).
export default function You() {
  const { authDisabled } = useAuth();
  const { mode, setMode } = useTheme();
  const badges = useNavBadges();
  const { data: schedule } = useImportSchedule();
  // Name the oldest waiting statement, so the row says what to go and get.
  const nextUp = schedule?.cards?.find((c) => c.status === 'ready');
  const rows = MANAGE_NAV.filter((r) => !(r.authOnly && authDisabled));
  const isMobile = useIsCompact();

  // Phones: the hub behind the header's You button, as its own layout.
  if (isMobile) {
    return (
      <YouPhone
        rows={rows}
        badges={badges}
        descriptions={DESCRIPTIONS}
        nextUp={nextUp}
        mode={mode}
        setMode={setMode}
      />
    );
  }

  return (
    <>
      <PageHeader title="More" />
      <PageBody width="narrow" className="more-page">
        <section className="more-group" aria-label="Manage">
          {rows.map((row) => {
            const Icon = row.icon;
            const badge = badges[row.to];
            const nudge =
              row.to === '/import' && badge && nextUp
                ? `Next: ${nextUp.next.label} · ${nextUp.card.nickname || nextUp.card.name} •• ${nextUp.card.last4}`
                : null;
            return (
              <Link key={row.to} to={row.to} className="more-row" aria-label={badge ? `${row.label} · ${badge.label}` : undefined}>
                <span className="more-row__icon">
                  <Icon size={16} strokeWidth={1.5} aria-hidden />
                </span>
                <span className="more-row__text">
                  <span className="more-row__label">{row.label}</span>
                  <span className={`more-row__description${nudge ? ' is-nudge' : ''}`}>
                    {nudge || DESCRIPTIONS[row.to]}
                  </span>
                </span>
                {badge && <Badge theme="red" label={String(badge.count)} />}
                <ChevronRight className="more-row__chevron" size={16} strokeWidth={1.5} aria-hidden />
              </Link>
            );
          })}
        </section>

        <section className="more-group more-group--padded" aria-labelledby="more-appearance">
          <div className="more-setting">
            <span id="more-appearance" className="more-row__label">Appearance</span>
            <TabButtons options={THEMES} value={mode} onChange={setMode} />
          </div>
        </section>
      </PageBody>
    </>
  );
}
