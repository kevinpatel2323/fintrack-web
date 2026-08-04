import Portal from './Portal.jsx';
import SplitTransactionForm from './SplitTransactionForm.jsx';
import { FriendTagCard } from './FriendTagLedgerDisplay.jsx';
import { IcClose } from './ui/Icon.jsx';
import { inr } from '../utils/inr.js';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

/**
 * The "manage transaction" sheet: category, splits and friend tags for one
 * transaction. Shared by the bank ledger and a card's ledger — a card
 * transaction is managed exactly like a bank one, the only difference being
 * the ledger-specific buttons passed in via `actions`.
 *
 * `amountIn` / `amountOut` describe the transaction in ledger terms: a card
 * refund is money in, an ordinary card spend is money out.
 */
export default function TransactionManageSheet({
  transaction,
  date,
  metaLine,
  amountIn = 0,
  amountOut = 0,
  categories = [],
  categoryId,
  onAssignCategory,
  categoryStatus,
  actions,
  friends = [],
  tags = [],
  tagsStatus,
  splitApplying = false,
  onApplySplit,
  onDeleteTag,
  onClose,
}) {
  const inAmount = Number(amountIn || 0);
  const outAmount = Number(amountOut || 0);
  const splitTotal = outAmount > 0 ? outAmount : inAmount > 0 ? inAmount : 0;

  return (
    <Portal>
      <div
        className="calendar-sheet-backdrop"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="calendar-sheet" role="dialog" aria-modal="true">
          <div className="calendar-sheet__header">
            <div>
              <h3>{formatDate(date)}</h3>
              <p>
                {tags.length} {tags.length === 1 ? 'friend tag' : 'friend tags'}
                {' · '}
                {outAmount > 0 ? `Out ${inr(outAmount)}` : `In ${inr(inAmount)}`}
              </p>
              {metaLine ? <p className="calendar-sheet__header-meta">{metaLine}</p> : null}
            </div>
            <button className="ghost calendar-sheet__close" type="button" onClick={onClose} aria-label="Close">
              <IcClose size={16} />
            </button>
          </div>
          <div className="calendar-summary-strip">
            <div>
              <span>Total in</span>
              <strong>{inr(inAmount)}</strong>
            </div>
            <div>
              <span>Total out</span>
              <strong>{inr(outAmount)}</strong>
            </div>
            <div>
              <span>Net</span>
              <strong>{inr(inAmount - outAmount, { sign: true })}</strong>
            </div>
          </div>
          <div className="calendar-manage-shell">
            <div className="friend-tags-panel">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select
                  className="txn-assign-select"
                  value={categoryId || ''}
                  onChange={(e) => onAssignCategory(e.target.value)}
                  aria-label="Category for this transaction"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
                {categoryStatus ? <span className="status">{categoryStatus}</span> : null}
                {actions}
              </div>
              {splitTotal > 0 ? (
                <SplitTransactionForm
                  key={`split-${transaction?.id}`}
                  totalAmount={splitTotal}
                  participants={friends.map((f) => ({ id: String(f.id), name: f.name }))}
                  taggedFriendIds={tags.map((t) => String(t.friendId))}
                  defaultDirection="OWES_ME"
                  applying={splitApplying}
                  onApplySplit={onApplySplit}
                />
              ) : null}
              {tagsStatus && <p className="status">{tagsStatus}</p>}
              <div className="friend-tags-list">
                {tags.length === 0 ? (
                  <p className="empty">No friend attached.</p>
                ) : (
                  tags.map((tag) => (
                    <FriendTagCard
                      key={tag.id}
                      tag={tag}
                      transaction={transaction}
                      friendName={tag.friend?.name || String(tag.friendId)}
                      onRemove={() => onDeleteTag(tag.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
