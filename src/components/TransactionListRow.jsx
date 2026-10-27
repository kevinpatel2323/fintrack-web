import { Amount } from './ui';
import { CategoryIcon } from './common/Category.jsx';
import { formatDateShort } from './TransactionTable.jsx';
import { signedAmount } from './transactions/transactionListModel.js';
import './transactions/transactions.css';

/**
 * One ledger row outside a table: category tile (tap to recategorise), title,
 * a muted second line, amount. The phone ledger uses it, and so do narrow
 * panels such as the calendar's day list — anywhere a table would not fit.
 *
 * `nested` renders it as a subordinate of the row above (the card transactions
 * a bill payment covers). `showDate` puts the row's own date in the second
 * line, which the day-grouped list does not need but nested rows do.
 */
export default function TransactionListRow({
  row,
  categories = [],
  onAssignCategory,
  onOpenDetail,
  nested = false,
  nestedLast = false,
  showDate = false,
}) {
  const secondary = row.mobileSubtitle ?? row.subtitle;
  const categoryName = row.category?.name || 'Uncategorized';

  return (
    <div className={['txl-item', nested && 'txl-item--nested', nested && nestedLast && 'is-last'].filter(Boolean).join(' ')}>
      {onAssignCategory ? (
        // The tile is a native select laid over the category icon: a phone
        // opens its own picker, which beats any custom menu at this size.
        <label className="txl-item__category" title="Change category">
          <CategoryIcon category={row.category} size={nested ? 28 : 32} />
          <select
            className="txl-item__category-select"
            value={row.categoryId || ''}
            aria-label={`Category: ${categoryName}. Change category`}
            onChange={(e) => onAssignCategory(row.id, e.target.value)}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <span className="txl-item__category">
          <CategoryIcon category={row.category} size={nested ? 28 : 32} />
        </span>
      )}

      <button type="button" className="txl-item__body" onClick={() => onOpenDetail?.(row.raw ?? row)}>
        <span className="txl-item__text">
          <span className="txl-item__title truncate">{row.title || '—'}</span>
          <span className="txl-item__meta">
            {showDate && <span className="txl-item__meta-date">{formatDateShort(row.date)}</span>}
            {row.titleBadge}
            {secondary ? <span className="txl-item__meta-copy truncate">{secondary}</span> : null}
            {row.metaTrailing && <span className="txl-item__meta-trailing">{row.metaTrailing}</span>}
          </span>
        </span>
        <Amount className="txl-item__amount" value={signedAmount(row)} sign="always" />
      </button>
    </div>
  );
}
