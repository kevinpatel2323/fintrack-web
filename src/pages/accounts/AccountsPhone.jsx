import { Landmark, Upload } from 'lucide-react';
import {
  Button, EmptyState, MobileList, MobileListItem, MobileSection, PageBody, Skeleton,
} from '../../components/ui';
import { ACCOUNTS_INTRO, plural } from './shared.js';

/*
 * Accounts on phones: a pushed page under You (Back falls back to /you). The
 * accounts as an inset list, each row the holder's name over its number; a
 * tap opens the name dialog (docked as a bottom sheet). Accounts.jsx owns the
 * state and handlers; the desktop page there stays as it was.
 */

function RowIcon() {
  return (
    <span className="accts-m-icon">
      <Landmark size={16} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

/** "50100123456714 · 412 transactions": one line under the name, so no date. */
function accountFacts(a) {
  const parts = [a.accountNumber];
  if (a.transactionCount > 0) parts.push(plural(a.transactionCount, 'transaction'));
  return parts.join(' · ');
}

export default function AccountsPhone({ accounts, loading, error, onRetry, onEdit }) {
  let body;
  if (loading) {
    body = (
      <div className="accts-m-skeleton" aria-busy="true">
        {[0, 1].map((i) => (
          <div className="accts-m-skeleton__row" key={i}>
            <Skeleton width={32} height={32} />
            <span className="accts-m-skeleton__text">
              <Skeleton height={14} width="45%" />
              <Skeleton height={11} width="70%" />
            </span>
          </div>
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <EmptyState
        size="sm"
        icon={Landmark}
        title="Could not load accounts"
        description={error}
        action={<Button label="Try again" onClick={onRetry} />}
      />
    );
  } else if (accounts.length === 0) {
    body = (
      <EmptyState
        size="sm"
        icon={Landmark}
        title="No bank accounts yet"
        description="Import a bank statement to add one."
        action={<Button iconLeft={Upload} label="Import statement" to="/import" />}
      />
    );
  } else {
    body = (
      <MobileList variant="inset" aria-label="Accounts">
        {accounts.map((a) => (
          <MobileListItem
            key={a.id}
            leading={<RowIcon />}
            title={a.holderName || <span className="accts-unnamed">Not named</span>}
            subtitle={<span className="accts-m-facts">{accountFacts(a)}</span>}
            chevron
            onClick={() => onEdit(a)}
            aria-label={`${a.holderName ? `Rename ${a.holderName}` : 'Name account'}, ${a.accountNumber}`}
          />
        ))}
      </MobileList>
    );
  }

  return (
    <PageBody className="accts-m-page">
      <MobileSection title="Bank accounts" description={ACCOUNTS_INTRO}>
        {body}
      </MobileSection>
    </PageBody>
  );
}
