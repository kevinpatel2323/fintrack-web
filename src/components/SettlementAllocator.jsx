import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button, ErrorMessage, LoadingIndicator } from './ui';
import { AllocRowView, AllocTable } from './people/AllocTable.jsx';
import { fetchOpenDues } from '../services/friendsApi.js';
import { friendFirstName } from '../utils/ledgerParties.js';
import { fillGroup, groupOpenMinor } from '../utils/entryGroups.js';
import { useIsCompact } from '../styles/breakpoints.js';
import {
  availableMinor,
  checkDraft,
  fillOldestFirst,
  minorToInput,
  netAllOff,
  rupees,
  toMinor,
} from '../utils/settlementAllocation.js';
import './people/allocation.css';

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

const entryName = (row) => {
  const tx = row.transaction || {};
  return tx.upiName || tx.narration || row.note || 'Entry';
};

/**
 * Applies one settlement across a friend's open entries, each by its own
 * amount — part of an entry is fine. Entries on the other side can be ticked
 * too: they are netted in, so a payment plus what the user owes the friend
 * clears that much more (Tally's receipt that knocks off both debit and credit
 * bills). Money another settlement left on account can be refunded. Whatever
 * is not applied stays on account. A group of entries ("Ketul's wedding")
 * is one row: ticking it settles the group as a whole, netting its two sides
 * against each other; its entries can still be opened and changed one by one.
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
  // Phones: 36px controls (a size up from the desktop's).
  const phone = useIsCompact();
  const controlSize = phone ? 'md' : 'sm';

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
          groups: res?.groups || [],
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

  // Grouped entries show under their group, not in the side lists.
  const { groupBlocks, groupedIds, sides } = useMemo(() => {
    const byId = new Map(dues.map((d) => [String(d.id), d]));
    const blocks = (loaded?.groups ?? [])
      .map((g) => ({ ...g, members: g.entryIds.map((id) => byId.get(String(id))).filter(Boolean) }))
      .filter((g) => g.members.length > 0);
    const ids = new Set(blocks.flatMap((g) => g.members.map((m) => String(m.id))));
    const lists = [];
    for (const side of ['OWES_ME', 'I_OWE']) {
      const rows = dues.filter((d) => d.direction === side && !ids.has(String(d.id)));
      if (rows.length) lists.push({ side, rows });
    }
    return { groupBlocks: blocks, groupedIds: ids, sides: lists };
  }, [dues, loaded]);

  /**
   * "Fill oldest first" / "Net all off" for a side list: they work on the
   * entries listed there, around whatever the groups already take.
   */
  function fillLoose(fill, side) {
    const groupPart = {};
    const loosePart = {};
    for (const [id, value] of Object.entries(draft)) (groupedIds.has(id) ? groupPart : loosePart)[id] = value;
    let groupTake = 0;
    for (const row of dues) {
      const id = String(row.id);
      if (!(id in groupPart)) continue;
      const minor = toMinor(Number(groupPart[id]) || 0);
      groupTake += row.direction === side ? minor : -minor;
    }
    const loose = dues.filter((d) => !groupedIds.has(String(d.id)));
    onDraftChange({ ...fill(amountMinor - groupTake, loose, side, loosePart, refundable), ...groupPart });
  }

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

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!loaded) return <LoadingIndicator text={`Loading ${first}'s open entries…`} />;

  const balance = loaded.balance;
  const settledSide = status.side === 'received' ? 'OWES_ME' : 'I_OWE';
  const hasDraft = Object.keys(draft).length > 0;

  return (
    <div className="alloc">
      {balance && <BalanceLine balance={balance} first={first} />}

      {dues.length === 0 && refundable.length === 0 && (
        <p className="alloc-section__note">
          Nothing is open with {first}. The whole {rupees(amountMinor)} stays on account and can
          be applied when a new entry comes up.
        </p>
      )}

      {groupBlocks.length > 0 && (
        <section className="alloc-section">
          <div className="alloc-section__head">
            <h4 className="alloc-section__title">Groups</h4>
          </div>
          <AllocTable label="Groups">
            {groupBlocks.map((g) => (
              <GroupBlock
                key={g.id}
                group={g}
                draft={draft}
                status={status}
                settledSide={settledSide}
                first={first}
                amountMinor={amountMinor}
                onDraftChange={onDraftChange}
              />
            ))}
          </AllocTable>
        </section>
      )}

      {sides.map(({ side, rows }) => (
        <section key={side} className="alloc-section">
          <div className="alloc-section__head">
            <h4 className="alloc-section__title">
              {SIDE_LABEL[side](first)}
              <span className="alloc-section__total">
                {rupees(rows.reduce((sum, d) => sum + availableMinor(d), 0))}
              </span>
            </h4>
            <div className="alloc-section__actions">
              <Button size={controlSize} variant="subtle" label="Fill oldest first" onClick={() => fillLoose(fillOldestFirst, side)} />
              {sides.length > 1 && (
                <Button
                  size={controlSize}
                  variant="ghost"
                  label="Net all off"
                  tooltip="Net all of these off and clear that much more of the other side"
                  onClick={() => fillLoose(netAllOff, side)}
                />
              )}
            </div>
          </div>
          <AllocTable label={SIDE_LABEL[side](first)}>
            {rows.map((row) => (
              <AllocRow
                key={row.id}
                row={row}
                draft={draft}
                rowError={status.rowErrors[String(row.id)]}
                netted={hasDraft && row.direction !== settledSide}
                onToggle={() => toggle(row)}
                onChange={(value) => onDraftChange({ ...draft, [String(row.id)]: value })}
              />
            ))}
          </AllocTable>
        </section>
      ))}

      {refundable.length > 0 && (
        <section className="alloc-section">
          <div className="alloc-section__head">
            <h4 className="alloc-section__title">Money on account you can refund</h4>
          </div>
          <AllocTable label="Money on account" openLabel="On account" applyLabel="Refund">
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
          </AllocTable>
        </section>
      )}

      <div className="alloc-foot">
        <span>
          Applied <strong>{rupees(status.appliedMinor)}</strong> of {rupees(amountMinor)}
        </span>
        <span className={status.onAccountMinor > 0 ? 'alloc-foot__on-account' : undefined}>
          On account <strong>{rupees(status.onAccountMinor)}</strong>
        </span>
        {hasDraft && (
          <Button className="alloc-foot__clear" size={controlSize} variant="ghost" label="Clear" onClick={() => onDraftChange({})} />
        )}
      </div>
      {hasDraft && status.valid && (
        <p className="alloc-explain">
          {status.nettedMinor > 0 &&
            `${rupees(status.settledMinor)} cleared, ${rupees(status.nettedMinor)} of it by netting off what ${
              status.side === 'received' ? `you owe ${first}` : `${first} owes you`
            }. `}
          {status.refundMinor > 0 && `${rupees(status.refundMinor)} refunded. `}
          Reads as money {status.side === 'received' ? `${first} paid you` : `you paid ${first}`}.
        </p>
      )}
      <ErrorMessage message={status.errors.filter((e) => e !== 'Fix the highlighted amounts.')} />
    </div>
  );
}

/**
 * A group as one row: tick it to settle the whole group (its smaller side
 * netted in), or type how much of the payment goes to it — it is spread over
 * the group's entries oldest first. "Show entries" opens the entries for
 * changing one by one.
 */
function GroupBlock({ group, draft, status, settledSide, first, amountMinor, onDraftChange }) {
  const [open, setOpen] = useState(false);
  const phone = useIsCompact();
  const [typed, setTyped] = useState(null);
  const { members } = group;
  const ids = members.map((m) => String(m.id));
  const selected = ids.some((id) => id in draft);
  const openMinor = groupOpenMinor(members);
  const sideOpen = (side) => members.filter((m) => m.direction === side).reduce((sum, m) => sum + availableMinor(m), 0);
  const mainSide = sideOpen('I_OWE') > sideOpen('OWES_ME') ? 'I_OWE' : 'OWES_ME';
  const drafted = (test) =>
    members.filter((m) => String(m.id) in draft && test(m))
      .reduce((sum, m) => sum + toMinor(Number(draft[String(m.id)]) || 0), 0);
  const appliedMinor = Math.max(drafted((m) => m.direction === mainSide) - drafted((m) => m.direction !== mainSide), 0);
  const after = openMinor - appliedMinor;
  const memberError = ids.some((id) => status.rowErrors[id]);
  const typedMinor = typed === null ? null : toMinor(Number(typed) || 0);
  const over = typedMinor !== null && typedMinor > openMinor;

  function toggle() {
    setTyped(null);
    if (selected) {
      const next = { ...draft };
      for (const id of ids) delete next[id];
      onDraftChange(next);
      return;
    }
    const left = amountMinor - status.appliedMinor;
    onDraftChange(fillGroup(left > 0 ? Math.min(openMinor, left) : openMinor, members, draft));
  }

  function changeAmount(value) {
    setTyped(value);
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n) || n < 0) return;
    onDraftChange(fillGroup(Math.min(toMinor(n), openMinor), members, draft));
  }

  let afterText;
  if (over) afterText = `Only ${rupees(openMinor)} open in this group`;
  else if (memberError) afterText = 'Check the entries below';
  else if (after === 0) afterText = 'Cleared';
  else afterText = `${rupees(after)} left`;

  const meta = (
    <>
      {members.length} open {members.length === 1 ? 'entry' : 'entries'} ·{' '}
      {mainSide === 'I_OWE' ? `you owe ${first}` : `${first} owes you`}
      {sideOpen('I_OWE') > 0 && sideOpen('OWES_ME') > 0 && ' net'}
    </>
  );

  return (
    <div className="alloc-group" role="rowgroup" aria-label={group.title}>
      <AllocRowView
        name={group.title}
        meta={meta}
        open={rupees(openMinor)}
        selected={selected}
        editing={selected || typed !== null}
        onToggle={toggle}
        value={typed ?? minorToInput(appliedMinor)}
        onChange={changeAmount}
        onBlur={() => setTyped(null)}
        after={afterText}
        tone={memberError || over ? 'error' : after === 0 ? 'done' : undefined}
        invalid={memberError || over}
        inputLabel={`Amount for ${group.title}`}
        extra={
          <Button
            className="alloc-group__toggle"
            size={phone ? 'md' : 'xs'}
            variant="ghost"
            iconLeft={open ? ChevronDown : ChevronRight}
            aria-expanded={open}
            label={open ? 'Hide entries' : `Show ${members.length === 1 ? 'entry' : `${members.length} entries`}`}
            onClick={() => setOpen(!open)}
          />
        }
      />
      {open && (
        <div className="alloc-group__members" role="presentation">
          {members.map((row) => (
            <AllocRow
              key={row.id}
              row={row}
              draft={draft}
              rowError={status.rowErrors[String(row.id)]}
              netted={Object.keys(draft).length > 0 && row.direction !== settledSide}
              onToggle={() => {
                const next = { ...draft };
                if (String(row.id) in next) delete next[String(row.id)];
                else next[String(row.id)] = minorToInput(availableMinor(row));
                onDraftChange(next);
              }}
              onChange={(value) => onDraftChange({ ...draft, [String(row.id)]: value })}
            />
          ))}
        </div>
      )}
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

  let meta = formatDate(tx.transactionDate);
  if (refund) meta += ` · money ${row.settlementSide === 'paid' ? `you paid ${first}` : `${first} paid you`}`;
  else if (partlyPaid) meta += ` · ${rupees(available)} of ${rupees(toMinor(row.amount))} open`;

  let afterText;
  if (rowError) afterText = rowError;
  else if (refund) afterText = after === 0 ? 'Refunded in full' : `${rupees(after)} still on account`;
  else if (after === 0) afterText = netted ? 'Netted off' : 'Cleared';
  else afterText = `${rupees(after)} left`;

  return (
    <AllocRowView
      name={entryName(row)}
      meta={meta}
      open={rupees(available)}
      selected={selected}
      onToggle={onToggle}
      value={draft[id]}
      onChange={onChange}
      after={afterText}
      tone={rowError ? 'error' : after === 0 ? 'done' : undefined}
      invalid={Boolean(rowError)}
      inputLabel={`Amount for ${tx.upiName || tx.narration || 'this entry'}`}
    />
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
    <div className="alloc-balance">
      <span className="alloc-balance__net">
        Net balance:{' '}
        <strong>
          {net > 0 ? `${first} owes you ${rupees(net)}` : net < 0 ? `you owe ${first} ${rupees(-net)}` : 'all square'}
        </strong>
      </span>
      {parts.length > 1 && <span className="alloc-balance__parts">= {parts.join(' ')}</span>}
    </div>
  );
}
