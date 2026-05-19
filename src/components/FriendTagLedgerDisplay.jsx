import { ledgerDirectionPhrase } from '../utils/ledgerParties.js';
import { friendTint, initialsOf } from '../utils/categoryColors.js';
import { IcTrash } from './ui/Icon.jsx';
import { inr } from '../utils/inr.js';

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

export function FriendTagCard({ tag, transaction, friendName, onRemove }) {
  const displayName = friendName || tag.friend?.name || `Friend #${tag.friendId}`;
  const tone = directionTone(tag.direction);
  const amount = Number(tag.amount || 0);
  const tx = tag.transaction || transaction;
  const tint = friendTint(displayName);
  const note = typeof tag.note === 'string' ? tag.note.trim() : '';
  const settles = tag.settlesTransactions || [];
  const settledBy = tag.settledBy || [];
  const settlementSummary = [
    settles.length > 0 ? `Settles ${settles.length}` : null,
    settledBy.length > 0 ? `Settled by ${settledBy.length}` : null,
  ].filter(Boolean).join(' · ');

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
        {settlementSummary ? <p className="friend-tag-card__note">{settlementSummary}</p> : null}
      </div>

      <div className="friend-tag-card__side">
        <strong style={{ color: tagAmountColor(tag.direction) }}>{inr(amount)}</strong>
        {onRemove ? (
          <button className="friend-tag-card__delete" type="button" onClick={onRemove} aria-label={`Remove split for ${displayName}`}>
            <IcTrash size={14} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
