import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Amount, Avatar, Button } from './ui';
import { ledgerDirectionPhrase } from '../utils/ledgerParties.js';
import { rupees, toMinor } from '../utils/settlementAllocation.js';
import SettlementAllocationModal from './SettlementAllocationModal.jsx';
import './people/FriendTagCard.css';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

// Money the friend owes reads in the money-in tone; the rest stays in ink.
function amountTone(direction) {
  if (direction === 'OWES_ME') return 'in';
  if (direction === 'NOTHING_OUTSTANDING') return 'muted';
  return 'out';
}

function transactionMeta(transaction) {
  const items = [
    formatDate(transaction?.transactionDate),
    transaction?.upiBank || (transaction?.isManual ? 'Manual' : null),
  ].filter(Boolean);
  return items.length ? items.join(' · ') : 'Transaction split';
}

/**
 * One line on how far a tag is settled, bill-wise: what an entry still has
 * pending, or how much of a settlement is applied and how much is on account.
 * Links made before amounts were recorded keep the old "Settles 2" wording —
 * there are no amounts to show for them.
 */
function settlementLine(tag) {
  const settles = tag.settlesTransactions || [];
  const settledBy = tag.settledBy || [];

  if (tag.direction === 'SETTLEMENT' && tag.settlementLegacy === false) {
    const applied = toMinor(tag.allocatedAmount);
    const onAccount = toMinor(tag.unallocatedAmount);
    const writtenOff = toMinor(tag.writtenOffAmount);
    const extra = writtenOff > 0 ? ` · ${rupees(writtenOff)} written off` : '';
    if (applied === 0 && onAccount > 0) {
      return { text: `${rupees(onAccount)} on account — not applied to any entry${extra}`, warn: true };
    }
    const what = toMinor(tag.refundedAmount) === applied
      ? 'Refund'
      : `Applied to ${settles.length} ${settles.length === 1 ? 'entry' : 'entries'}`;
    return onAccount > 0
      ? { text: `${rupees(applied)} ${what.toLowerCase()} · ${rupees(onAccount)} on account${extra}`, warn: true }
      : { text: `${what}${extra}`, warn: false };
  }
  if ((tag.direction === 'OWES_ME' || tag.direction === 'I_OWE') && tag.settlementLegacy === false) {
    // Paid, netted and written off all count as cleared.
    const cleared = toMinor(tag.settledAmount) + toMinor(tag.nettedAmount) + toMinor(tag.writtenOffAmount);
    if (tag.settlementStatus === 'partial') {
      return { text: `${rupees(cleared)} cleared · ${rupees(toMinor(tag.pendingAmount))} pending`, warn: true };
    }
    if (tag.settlementStatus === 'settled') return { text: 'Settled', warn: false };
    return null;
  }

  const legacy = [
    settles.length > 0 ? `Settles ${settles.length}` : null,
    settledBy.length > 0 ? `Settled by ${settledBy.length}` : null,
  ].filter(Boolean).join(' · ');
  return legacy ? { text: legacy, warn: false } : null;
}

export function FriendTagCard({ tag, transaction, friendName, onRemove, onAllocationChanged }) {
  const displayName = friendName || tag.friend?.name || `Friend #${tag.friendId}`;
  const amount = Number(tag.amount || 0);
  const tx = tag.transaction || transaction;
  const note = typeof tag.note === 'string' ? tag.note.trim() : '';
  const settlement = settlementLine(tag);
  const [allocating, setAllocating] = useState(false);
  const canAllocate = tag.direction === 'SETTLEMENT' && Boolean(onAllocationChanged);

  return (
    <article className="people-tag-card">
      <Avatar label={displayName} size="xl" aria-hidden />

      <div className="people-tag-card__body">
        <h4 className="people-tag-card__name">{displayName}</h4>
        <p className="people-tag-card__line">
          {ledgerDirectionPhrase(tag.direction, displayName)} · {transactionMeta(tx)}
        </p>
        {note ? <p className="people-tag-card__line">{note}</p> : null}
        {tag.entryGroup?.title ? <p className="people-tag-card__line">Part of {tag.entryGroup.title}</p> : null}
        {settlement ? (
          <p className="people-tag-card__line" data-tone={settlement.warn ? 'warn' : undefined}>
            {settlement.text}
          </p>
        ) : null}
        {canAllocate ? (
          <Button
            className="people-tag-card__action"
            size="sm"
            variant="subtle"
            label={
              tag.settlementLegacy === false && toMinor(tag.allocatedAmount) === 0
                ? 'Apply to entries'
                : 'Change what it settles'
            }
            onClick={() => setAllocating(true)}
          />
        ) : null}
      </div>

      <div className="people-tag-card__side">
        <Amount className="people-tag-card__amount" value={amount} tone={amountTone(tag.direction)} />
        {onRemove ? (
          <Button
            variant="ghost"
            icon={Trash2}
            label={`Remove split for ${displayName}`}
            tooltip="Remove split"
            onClick={onRemove}
          />
        ) : null}
      </div>

      {allocating ? (
        <SettlementAllocationModal
          tag={tag}
          friendName={displayName}
          onClose={() => setAllocating(false)}
          onSaved={onAllocationChanged}
        />
      ) : null}
    </article>
  );
}
