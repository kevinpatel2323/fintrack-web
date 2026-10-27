import { useMemo } from 'react';
import { Amount, AvatarGroup, Combobox } from './ui';
import { CategoryIcon } from './common/Category.jsx';
import { categoryColor } from '../utils/categoryColors.js';
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
const NO_CATEGORY = '__none__';

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
  // Same options (and look) as the category picker everywhere else.
  const categoryOptions = useMemo(
    () => [
      { label: 'No category', value: NO_CATEGORY },
      ...categories.map((c) => ({
        label: c.name,
        value: String(c.id),
        icon: <span className="txl-dot" style={{ background: categoryColor(c) }} aria-hidden="true" />,
      })),
    ],
    [categories],
  );
  const categoryName = row.category?.name || 'Uncategorised';

  return (
    <div className={['txl-item', nested && 'txl-item--nested', nested && nestedLast && 'is-last'].filter(Boolean).join(' ')}>
      {onAssignCategory ? (
        <Combobox
          options={categoryOptions}
          value={row.categoryId ? String(row.categoryId) : NO_CATEGORY}
          onChange={(value) => onAssignCategory(row.id, value === NO_CATEGORY || value == null ? '' : value)}
          searchPlaceholder="Search categories"
          aria-label={`Category: ${categoryName}. Change category`}
          title="Change category"
          triggerClassName="txl-item__category"
          renderTrigger={() => <CategoryIcon category={row.category} size={nested ? 28 : 32} />}
        />
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
        <span className="txl-item__end">
          <Amount className="txl-item__amount" value={signedAmount(row)} sign="always" />
          {row.people?.length > 0 && (
            <AvatarGroup people={row.people} size="md" max={3} interactive={false} label="Split with" className="txl-item__people" />
          )}
        </span>
      </button>
    </div>
  );
}
