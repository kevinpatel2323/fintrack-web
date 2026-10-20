import { useEffect, useMemo, useState } from 'react';
import { fetchOpenDues } from '../services/friendsApi.js';
import { friendFirstName } from '../utils/ledgerParties.js';
import {
  availableMinor,
  checkDraft,
  fillOldestFirst,
  minorToInput,
  netAllOff,
  rupees,
  toMinor,
} from '../utils/settlementAllocation.js';
import '../styles/settlement-allocator.css';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

const SIDE_LABEL = {
  OWES_ME: (first) => `Open entries ${first} owes you`,
  I_OWE: (first) => `Open entries you owe ${first}`,
};

/**
 * Applies one settlement across a friend's open entries, each by its own
 * amount — part of an entry is fine. Entries on the other side can be ticked
 * too: they are netted in, so a payment plus what the user owes the friend
 * clears that much more (Tally's receipt that knocks off both debit and credit
 * bills). Money another settlement left on account can be refunded. Whatever
 * is not applied stays on account.
 *
 * Controlled: `draft` is `{ [tagId]: amountString }` and changes go through
 * `onDraftChange`. Validity is reported through `onStatusChange` so the
 * surrounding form can hold its submit button.
 *
 * @param {object} props
 * @param {string|number} props.friendId
 * @param {string} props.friendName
 * @param {number} props.amountMinor  the settlement, in paise
 * @param {string|number} [props.settlementTagId]  set when editing an existing settlement
 * @param {Record<string, string>} props.draft
 * @param {(draft: Record<string, string>) => void} props.onDraftChange
 * @param {(status: ReturnType<typeof checkDraft>) => void} [props.onStatusChange]
 * @param {(dues: object[], refundable: object[]) => void} [props.onDuesLoaded]
 */
export default function SettlementAllocator({
  friendId,
  friendName,
  amountMinor,
  settlementTagId,
  draft,
  onDraftChange,
  onStatusChange,
  onDuesLoaded,
}) {
  const [loaded, setLoaded] = useState(null);
  const [loadError, setLoadError] = useState('');
  const first = friendFirstName(friendName);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setLoadError('');
    fetchOpenDues(friendId, settlementTagId)
      .then((res) => {
        if (cancelled) return;
        const next = {
          dues: res?.data || [],
          refundable: res?.refundable || [],
          balance: res?.balance || null,
        };
        setLoaded(next);
        onDuesLoaded?.(next.dues, next.refundable);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message || 'Could not load the entries.');
      });
    return () => {
      cancelled = true;
    };
    // onDuesLoaded is a one-shot seed for the caller; refetching when its
    // identity changes would reset an edit in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId, settlementTagId]);

  const dues = loaded?.dues ?? [];
  const refundable = loaded?.refundable ?? [];
  const status = useMemo(
    () => checkDraft({ amountMinor, dues, refundable, draft }),
    [amountMinor, dues, refundable, draft],
  );

  useEffect(() => {
    onStatusChange?.(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const sides = useMemo(() => {
    const groups = [];
    for (const side of ['OWES_ME', 'I_OWE']) {
      const rows = dues.filter((d) => d.direction === side);
      if (rows.length) groups.push({ side, rows });
    }
    return groups;
  }, [dues]);

  function toggle(row) {
    const id = String(row.id);
    const next = { ...draft };
    if (id in next) {
      delete next[id];
    } else {
      const left = amountMinor - status.appliedMinor;
      // Netting in an entry from the other side adds to what can be cleared,
      // so it starts at its full pending amount.
      const netting = row.direction !== 'SETTLEMENT'
        && row.direction !== (status.side === 'received' ? 'OWES_ME' : 'I_OWE')
        && Object.keys(draft).length > 0;
      const take = netting ? availableMinor(row) : Math.min(availableMinor(row), Math.max(left, 0));
      next[id] = take > 0 ? minorToInput(take) : '';
    }
    onDraftChange(next);
  }

  if (loadError) return <p className="settle-alloc__error">{loadError}</p>;
  if (!loaded) return <p className="status">Loading {first}'s open entries…</p>;

  const balance = loaded.balance;
  const settledSide = status.side === 'received' ? 'OWES_ME' : 'I_OWE';

  return (
    <div className="settle-alloc">
      {balance && <BalanceLine balance={balance} first={first} />}

      {dues.length === 0 && refundable.length === 0 && (
        <p className="settle-alloc__empty">
          Nothing is open with {first}. The whole {rupees(amountMinor)} stays on account and can
          be applied when a new entry comes up.
        </p>
      )}

      {sides.map(({ side, rows }) => (
        <section key={side} className="settle-alloc__group">
          <div className="settle-alloc__group-head">
            <span>
              {SIDE_LABEL[side](first)} ·{' '}
              {rupees(rows.reduce((sum, d) => sum + availableMinor(d), 0))}
            </span>
            <span className="settle-alloc__actions">
              <button
                type="button"
                className="settle-alloc__fill"
                onClick={() => onDraftChange(fillOldestFirst(amountMinor, dues, side, draft, refundable))}
              >
                Fill oldest first
              </button>
              {sides.length > 1 && (
                <button
                  type="button"
                  className="settle-alloc__fill settle-alloc__fill--quiet"
                  title={`Net all of these off and clear that much more of the other side`}
                  onClick={() => onDraftChange(netAllOff(amountMinor, dues, side, draft, refundable))}
                >
                  Net all off
                </button>
              )}
            </span>
          </div>
          {rows.map((row) => (
            <AllocRow
              key={row.id}
              row={row}
              draft={draft}
              rowError={status.rowErrors[String(row.id)]}
              netted={Object.keys(draft).length > 0 && row.direction !== settledSide}
              onToggle={() => toggle(row)}
              onChange={(value) => onDraftChange({ ...draft, [String(row.id)]: value })}
            />
          ))}
        </section>
      ))}

      {refundable.length > 0 && (
        <section className="settle-alloc__group">
          <div className="settle-alloc__group-head">
            <span>Money on account you can refund</span>
          </div>
          {refundable.map((row) => (
            <AllocRow
              key={row.id}
              row={row}
              draft={draft}
              rowError={status.rowErrors[String(row.id)]}
              refund
              first={first}
              onToggle={() => toggle(row)}
              onChange={(value) => onDraftChange({ ...draft, [String(row.id)]: value })}
            />
          ))}
        </section>
      )}

      <div className="settle-alloc__foot">
        <span>
          Applied <strong>{rupees(status.appliedMinor)}</strong> of {rupees(amountMinor)}
        </span>
        <span className={status.onAccountMinor > 0 ? 'settle-alloc__on-account' : ''}>
          On account <strong>{rupees(status.onAccountMinor)}</strong>
        </span>
        {Object.keys(draft).length > 0 && (
          <button type="button" className="settle-alloc__clear" onClick={() => onDraftChange({})}>
            Clear
          </button>
        )}
      </div>
      {Object.keys(draft).length > 0 && status.valid && (
        <p className="settle-alloc__explain">
          {status.nettedMinor > 0 &&
            `${rupees(status.settledMinor)} cleared, ${rupees(status.nettedMinor)} of it by netting off what ${
              status.side === 'received' ? `you owe ${first}` : `${first} owes you`
            }. `}
          {status.refundMinor > 0 && `${rupees(status.refundMinor)} refunded. `}
          Reads as money {status.side === 'received' ? `${first} paid you` : `you paid ${first}`}.
        </p>
      )}
      {status.errors
        .filter((e) => e !== 'Fix the highlighted amounts.')
        .map((e) => (
          <p key={e} className="settle-alloc__error">
            {e}
          </p>
        ))}
    </div>
  );
}

function AllocRow({ row, draft, rowError, netted, refund, first, onToggle, onChange }) {
  const id = String(row.id);
  const selected = id in draft;
  const available = availableMinor(row);
  const typed = toMinor(Number(draft[id]) || 0);
  const after = available - typed;
  const tx = row.transaction || {};
  const partlyPaid = !refund && toMinor(row.amount) !== available;

  let meta;
  if (refund) {
    meta = `${rupees(available)} on account · money ${row.settlementSide === 'paid' ? `you paid ${first}` : `${first} paid you`}`;
  } else if (partlyPaid) {
    meta = `${rupees(available)} of ${rupees(toMinor(row.amount))} open`;
  } else {
    meta = rupees(available);
  }

  let afterText;
  if (rowError) afterText = rowError;
  else if (refund) afterText = after === 0 ? 'Refunded in full' : `${rupees(after)} still on account`;
  else if (after === 0) afterText = netted ? 'Netted off' : 'Cleared';
  else afterText = `${rupees(after)} left`;

  return (
    <div
      className={`settle-alloc__row${selected ? ' settle-alloc__row--selected' : ''}${rowError ? ' settle-alloc__row--error' : ''}`}
    >
      <label className="settle-alloc__pick">
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <span className="settle-alloc__what">
          <span className="settle-alloc__name">{tx.upiName || tx.narration || row.note || 'Entry'}</span>
          <span className="settle-alloc__meta">
            {formatDate(tx.transactionDate)} · {meta}
          </span>
        </span>
      </label>
      {selected && (
        <div className="settle-alloc__apply">
          <input
            type="text"
            inputMode="decimal"
            className="settle-alloc__amount"
            aria-label={`Amount for ${tx.upiName || tx.narration || 'this entry'}`}
            value={draft[id]}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0.00"
          />
          <span
            className={`settle-alloc__after${rowError ? ' settle-alloc__after--error' : after === 0 ? ' settle-alloc__after--full' : ''}`}
          >
            {afterText}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The friend's balance and how it splits into what is open entry by entry, so
 * the "open entries" totals below never read as the balance itself.
 */
function BalanceLine({ balance, first }) {
  const net = toMinor(balance.net);
  const parts = [
    toMinor(balance.openOwesMe) > 0 ? `${rupees(toMinor(balance.openOwesMe))} open from ${first}` : null,
    toMinor(balance.openIOwe) > 0 ? `− ${rupees(toMinor(balance.openIOwe))} open from you` : null,
    toMinor(balance.onAccountReceived) > 0 ? `− ${rupees(toMinor(balance.onAccountReceived))} on account` : null,
    toMinor(balance.onAccountPaid) > 0 ? `+ ${rupees(toMinor(balance.onAccountPaid))} you paid on account` : null,
    toMinor(balance.legacyDifference) !== 0
      ? `${toMinor(balance.legacyDifference) < 0 ? '−' : '+'} ${rupees(Math.abs(toMinor(balance.legacyDifference)))} from older settlements`
      : null,
  ].filter(Boolean);

  return (
    <div className="settle-alloc__balance">
      <span>
        Net balance:{' '}
        <strong>
          {net > 0 ? `${first} owes you ${rupees(net)}` : net < 0 ? `you owe ${first} ${rupees(-net)}` : 'all square'}
        </strong>
      </span>
      {parts.length > 1 && <span className="settle-alloc__balance-parts">= {parts.join(' ')}</span>}
    </div>
  );
}
