import { Eraser, FolderMinus, ListChecks, MoreHorizontal } from 'lucide-react';
import { Amount, Button, Checkbox, Dropdown } from '../../components/ui';
import { groupIdOf } from '../../utils/entryGroups.js';
import { friendFirstName, ledgerBalanceDelta, ledgerRowAmount } from '../../utils/ledgerParties.js';
import { rupees, toMinor } from '../../utils/settlementAllocation.js';
import '../../components/people/ledger.css';

// What can be bundled into a group; settlements are paid against entries and
// stay outside. Mirrors the API's rule.
const GROUPABLE = new Set(['OWES_ME', 'I_OWE', 'NOTHING_OUTSTANDING']);
export const isGroupable = (t) => GROUPABLE.has(t.direction) && !groupIdOf(t);

export function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Where a row stands bill-wise: an entry's pending, netted or written-off
 * amounts, or a settlement's money still on account. Empty for rows settled
 * by a link from before amounts were recorded — there is nothing to add.
 */
function rowSettlementNotes(tag) {
  if (tag.settlementLegacy !== false) return [];
  const notes = [];
  const writtenOff = toMinor(tag.writtenOffAmount);
  if (tag.direction === 'SETTLEMENT') {
    if (toMinor(tag.refundedAmount) > 0) notes.push({ text: `${rupees(toMinor(tag.refundedAmount))} refund` });
    if (writtenOff > 0) notes.push({ text: `${rupees(writtenOff)} written off` });
    const onAccount = toMinor(tag.unallocatedAmount);
    if (onAccount > 0) notes.push({ text: `${rupees(onAccount)} on account`, tone: 'warn' });
    return notes;
  }
  if (toMinor(tag.nettedAmount) > 0) notes.push({ text: `${rupees(toMinor(tag.nettedAmount))} netted off` });
  if (writtenOff > 0) notes.push({ text: `${rupees(writtenOff)} written off` });
  if (tag.settlementStatus === 'partial') notes.push({ text: `${rupees(toMinor(tag.pendingAmount))} pending`, tone: 'warn' });
  if (tag.settlementStatus === 'settled') notes.push({ text: 'Settled', tone: 'ok' });
  return notes;
}

/** Which way the row moves the balance, in words: "Yash owes you", "You paid Yash". */
function impactWords(tag, first) {
  if (tag.direction === 'OWES_ME') return `${first} owes you`;
  if (tag.direction === 'I_OWE') return `You owe ${first}`;
  if (tag.direction === 'SETTLEMENT') return tag.settlementSide === 'paid' ? `You paid ${first}` : `${first} paid you`;
  return 'Nothing outstanding';
}

const hasPaise = (n) => Math.round(Math.abs(Number(n) || 0) * 100) % 100 !== 0;

/**
 * One ledger entry: date, what it was, which way it moves the balance and by
 * how much (signed: + means more owed to you), where it stands bill-wise, and
 * its actions. `picking` reserves the checkbox column; `pick` is set when
 * this row can be ticked.
 */
export default function LedgerRow({
  tag,
  friendName,
  picking = false,
  pick,
  onAllocate,
  onWriteOff,
  onUndoWriteOff,
  onRemoveFromGroup,
}) {
  const first = friendFirstName(friendName);
  const isSettlement = tag.direction === 'SETTLEMENT';
  const tx = tag.transaction || {};
  const date = tx.transactionDate ? formatDay(tx.transactionDate) : '—';
  const title = tx.upiName || tx.narration || tag.note || 'Transaction';
  const notes = rowSettlementNotes(tag);
  // The entry's own amount, signed the way it moves the balance (write-offs
  // show in the notes, not in this figure).
  const signed = ledgerBalanceDelta({ ...tag, balanceDelta: null });
  const nothing = tag.direction === 'NOTHING_OUTSTANDING';
  // A leftover worth closing: money on account, or the open remainder of an
  // entry that has already been partly paid.
  const leftover = tag.settlementLegacy === false
    ? isSettlement
      ? toMinor(tag.unallocatedAmount)
      : tag.settlementStatus === 'partial' ? toMinor(tag.pendingAmount) : 0
    : 0;
  const applyLabel = tag.settlementLegacy === false && toMinor(tag.allocatedAmount) === 0
    ? 'Apply to entries'
    : 'Change what it settles';
  // Money sitting on account is the thing to act on, so its action is on the row.
  const applyInline = isSettlement && onAllocate && tag.settlementLegacy === false && toMinor(tag.unallocatedAmount) > 0;

  const menu = [
    isSettlement && onAllocate && !applyInline
      ? { label: applyLabel, icon: ListChecks, onClick: () => onAllocate(tag) }
      : null,
    leftover > 0 && onWriteOff
      ? { label: `Write off ${rupees(leftover)}`, icon: Eraser, onClick: () => onWriteOff(tag) }
      : null,
    onRemoveFromGroup ? { label: 'Take out of group', icon: FolderMinus, onClick: onRemoveFromGroup } : null,
  ].filter(Boolean);

  const onRowClick = pick
    ? (e) => {
        if (!e.target.closest('input, button, a, label')) pick.onToggle();
      }
    : undefined;

  return (
    <div
      className="ledger-row"
      data-pickable={pick ? '' : undefined}
      data-selected={pick?.checked ? '' : undefined}
      onClick={onRowClick}
    >
      {picking && (
        <span className="ledger-row__check">
          {pick && <Checkbox checked={pick.checked} onChange={pick.onToggle} aria-label={`Select ${title}`} />}
        </span>
      )}
      <span className="ledger-row__date">{date}</span>
      <div className="ledger-row__main">
        <span className="ledger-row__title">{title}</span>
        <span className="ledger-row__meta">
          <span className="ledger-row__meta-date">{date} · </span>
          {impactWords(tag, first)}
          {notes.map((n) => (
            <span key={n.text}>
              {' · '}
              <span className="ledger-note" data-tone={n.tone}>
                {n.text}
              </span>
            </span>
          ))}
        </span>
        {(tag.writeOffs || []).map((w) => (
          <span key={w.id} className="ledger-row__writeoff">
            {rupees(toMinor(w.amount))} written off{w.reason ? ` · ${w.reason}` : ''}
            {onUndoWriteOff && (
              <Button size="xs" variant="ghost" label="Undo" onClick={() => onUndoWriteOff(w.id)} />
            )}
          </span>
        ))}
        {applyInline && (
          <span className="ledger-row__inline-actions">
            <Button size="sm" variant="subtle" label={applyLabel} onClick={() => onAllocate(tag)} />
          </span>
        )}
      </div>
      <span className="ledger-row__amount">
        {nothing ? (
          <Amount value={Number(ledgerRowAmount(tag)) || 0} tone="muted" />
        ) : (
          <Amount value={signed} sign="always" decimals={hasPaise(signed) ? 2 : 0} />
        )}
      </span>
      <span className="ledger-row__menu">
        {menu.length > 0 && (
          <Dropdown placement="bottom-end" options={menu}>
            <Button variant="ghost" icon={MoreHorizontal} label={`Actions for ${title}`} />
          </Dropdown>
        )}
      </span>
    </div>
  );
}
