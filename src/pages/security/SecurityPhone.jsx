import { KeyRound, LogOut, Plus, Trash2 } from 'lucide-react';
import {
  Badge, Button, EmptyState, ErrorMessage, MobileActionBar, MobileList, MobileListItem, MobileSection, PageBody,
  Skeleton,
} from '../../components/ui';

/*
 * Security on phones: a pushed page under You (Back falls back to /you).
 * Passkeys as an inset list, each with a `…` holding Remove; Log out as a red
 * row; "Add passkey" in the bottom action bar. Security.jsx owns the state
 * and handlers; the desktop page there stays as it was.
 */

function RowIcon({ icon: Icon }) {
  return (
    <span className="security-m-icon">
      <Icon size={16} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

export default function SecurityPhone({ credentials, loading, error, fmtDate, onAdd, onRemove, onSignOut }) {
  const onlyOne = credentials.length <= 1;

  return (
    <>
      <PageBody className="security-m-page">
        <MobileSection
          title="Passkeys"
          description="Devices that can sign in to Fintrack. Keep at least two so you always have a way back in."
        >
          {loading ? (
            <div className="security-m-skeleton" aria-busy="true">
              {[0, 1].map((i) => (
                <div className="security-m-skeleton__row" key={i}>
                  <Skeleton width={32} height={32} />
                  <span className="security-m-skeleton__text">
                    <Skeleton height={14} width="50%" />
                    <Skeleton height={11} width="70%" />
                  </span>
                </div>
              ))}
            </div>
          ) : credentials.length === 0 ? (
            <EmptyState
              size="sm"
              icon={KeyRound}
              title="No passkeys yet"
              description="Add one to sign in with Touch ID, Face ID or a security key."
            />
          ) : (
            <MobileList variant="inset" aria-label="Passkeys">
              {credentials.map((c) => {
                const created = fmtDate(c.createdAt);
                const used = fmtDate(c.lastUsedAt);
                const name = c.label || 'Unnamed passkey';
                return (
                  <MobileListItem
                    key={c.id}
                    leading={<RowIcon icon={KeyRound} />}
                    title={name}
                    subtitle={`${created ? `Added ${created}` : 'Added recently'}${used ? ` · Last used ${used}` : ' · Not used yet'}`}
                    value={c.backedUp ? <Badge label="Synced" /> : undefined}
                    actionsLabel={`Actions for ${name}`}
                    actions={[
                      {
                        label: 'Remove passkey',
                        icon: Trash2,
                        theme: 'red',
                        disabled: onlyOne,
                        description: onlyOne ? 'Add another passkey before removing this one' : undefined,
                        onClick: () => onRemove(c),
                      },
                    ]}
                  />
                );
              })}
            </MobileList>
          )}
          {error && <ErrorMessage message={error} />}
        </MobileSection>

        <MobileSection
          title="Session"
          description="Sessions last one hour, then you sign in again with your passkey."
        >
          <MobileList variant="inset" aria-label="Session">
            <MobileListItem leading={<RowIcon icon={LogOut} />} title="Log out" tone="red" onClick={onSignOut} />
          </MobileList>
        </MobileSection>
      </PageBody>

      <MobileActionBar>
        <Button size="lg" variant="solid" iconLeft={Plus} label="Add passkey" onClick={onAdd} />
      </MobileActionBar>
    </>
  );
}
