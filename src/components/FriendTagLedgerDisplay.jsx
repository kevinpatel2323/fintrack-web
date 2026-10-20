import { useState } from 'react';
import { ledgerDirectionPhrase } from '../utils/ledgerParties.js';
import { friendTint, initialsOf } from '../utils/categoryColors.js';
import { rupees, toMinor } from '../utils/settlementAllocation.js';
import { IcTrash } from './ui/Icon.jsx';
import { inr } from '../utils/inr.js';
import SettlementAllocationModal from './SettlementAllocationModal.jsx';

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

function directionTone(direction) {
  if (direction === 'OWES_ME') return 'receivable';
  if (direction === 'I_OWE') return 'payable';
  if (direction === 'SETTLEMENT') return 'settlement';
  return 'settled';
}

function tagAmountColor(direction) {
  if (direction === 'OWES_ME') return 'var(--ft-income)';
  if (direction === 'I_OWE') return 'var(--ft-spend)';
  if (direction === 'SETTLEMENT') return 'var(--ft-violet)';
  return 'var(--ft-text-dim)';
}

function TransactionMeta({ transaction }) {
  const items = [
    formatDate(transaction?.transactionDate),
    transaction?.upiBank || (transaction?.isManual ? 'Manual' : null),
  ].filter(Boolean);

  return items.length ? <>{items.join(' · ')}</> : <>Transaction split</>;
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
  const tone = directionTone(tag.direction);
  const amount = Number(tag.amount || 0);
  const tx = tag.transaction || transaction;
  const tint = friendTint(displayName);
  const note = typeof tag.note === 'string' ? tag.note.trim() : '';
  const settlement = settlementLine(tag);
  const [allocating, setAllocating] = useState(false);
  const canAllocate = tag.direction === 'SETTLEMENT' && Boolean(onAllocationChanged);

  return (
    <article className={`friend-tag-card friend-tag-card--${tone}`}>
      <div
        className="friend-tag-card__avatar"
        style={{
          color: tint,
          borderColor: `${tint}55`,
          background: `linear-gradient(135deg, ${tint}33, ${tint}14)`,
        }}
        aria-hidden="true"
      >
        {initialsOf(displayName)}
      </div>

      <div className="friend-tag-card__copy">
        <div className="friend-tag-card__eyebrow">
          <TransactionMeta transaction={tx} />
        </div>
        <h4>{displayName}</h4>
        <p className="friend-tag-card__summary">{ledgerDirectionPhrase(tag.direction, displayName)}</p>
        {note ? <p className="friend-tag-card__note">{note}</p> : null}
        {settlement ? (
          <p className="friend-tag-card__note" style={settlement.warn ? { color: 'var(--ft-warn)' } : undefined}>
            {settlement.text}
          </p>
        ) : null}
        {canAllocate ? (
          <button
            type="button"
            className="friend-tag-card__apply"
            onClick={() => setAllocating(true)}
          >
            {tag.settlementLegacy === false && toMinor(tag.allocatedAmount) === 0
              ? 'Apply to entries'
              : 'Change what it settles'}
          </button>
        ) : null}
      </div>

      <div className="friend-tag-card__side">
        <strong style={{ color: tagAmountColor(tag.direction) }}>{inr(amount)}</strong>
        {onRemove ? (
          <button className="friend-tag-card__delete" type="button" onClick={onRemove} aria-label={`Remove split for ${displayName}`}>
            <IcTrash size={14} />
          </button>
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
