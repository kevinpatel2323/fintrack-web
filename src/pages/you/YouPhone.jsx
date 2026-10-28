import { Monitor, Moon, Sun } from 'lucide-react';
import { Badge, MobileList, MobileListItem, MobileSection, PageBody, PageHeader, TabButtons } from '../../components/ui';

/*
 * You on phones: the hub behind the header's You button, after Gameplan's
 * MobileMoreMenu — grouped inset lists under small labels. A pushed page
 * (Back, no tab bar). No profile block: Fintrack has no user name or photo.
 * You.jsx owns the data; the desktop page there stays as it was.
 */

const THEMES = [
  { label: 'Light', value: 'light', icon: Sun },
  { label: 'Dark', value: 'dark', icon: Moon },
  { label: 'System', value: 'system', icon: Monitor },
];

/** 32px gray tile with the row's 16px icon. */
function RowIcon({ icon: Icon }) {
  return (
    <span className="you-m-icon">
      <Icon size={16} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

export default function YouPhone({ rows, badges, descriptions, nextUp, mode, setMode }) {
  return (
    <>
      <PageHeader title="You" />
      <PageBody className="you-m-page">
        <MobileSection title="Manage" className="you-m-group">
          <MobileList variant="inset" aria-label="Manage">
            {rows.map((row) => {
              const badge = badges[row.to];
              const nudge =
                row.to === '/import' && badge && nextUp
                  ? `Next: ${nextUp.next.label} · ${nextUp.card.nickname || nextUp.card.name}\u00a0••\u00a0${nextUp.card.last4}`
                  : null;
              return (
                <MobileListItem
                  key={row.to}
                  to={row.to}
                  leading={<RowIcon icon={row.icon} />}
                  title={row.label}
                  subtitle={nudge ? <span className="you-m-nudge">{nudge}</span> : descriptions[row.to]}
                  value={badge ? <Badge theme="red" label={String(badge.count)} /> : undefined}
                  chevron
                  aria-label={badge ? `${row.label} · ${badge.label}` : undefined}
                />
              );
            })}
          </MobileList>
        </MobileSection>

        <MobileSection title="Appearance" className="you-m-group">
          <TabButtons
            className="you-m-theme"
            fluid
            size="md"
            options={THEMES}
            value={mode}
            onChange={setMode}
            aria-label="Appearance"
          />
          <p className="you-m-footnote">System follows your device’s light or dark setting.</p>
        </MobileSection>
      </PageBody>
    </>
  );
}
