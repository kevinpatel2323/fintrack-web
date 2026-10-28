import { useMemo } from 'react';
import { Amount, AvatarGroup, Combobox } from './ui';
import { CategoryIcon, categoryOptions as buildCategoryOptions } from './common/Category.jsx';
import { formatDateShort } from './TransactionTable.jsx';
import { signedAmount } from './transactions/transactionListModel.js';
import './transactions/transactions.css';

/**
 * One ledger row outside a table (phones): the category tile (tap it to
 * recategorise), a one-line title, a muted line with the category and a
 * short hint, and the amount with who it's split with under it. The phone
 * ledger uses it, and so do a calendar day and a bill's covered list.
 *
 * Second line: `[badge] Category · hint`, where the badge is
 * `row.mobileBadge ?? row.titleBadge` (card bill, refund) and the hint is
 * `row.mobileSubtitle ?? row.subtitle` (an account, a billing status), then
 * `row.metaTrailing` when a mapper still sets one.
 *
 * `nested` renders it as a subordinate of the row above (the card transactions
 * a bill payment covers). `showDate` starts the second line with the row's
 * own date, which the day-grouped list does not need but flat lists do.
 */
const NO_CATEGORY = '__none__';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export default function TransactionListRow({
  row,
  categories = [],
  onAssignCategory,
  onOpenDetail,
  nested = false,
  nestedLast = false,
  showDate = false,
}) {
  const hint = row.mobileSubtitle ?? row.subtitle;
  const badge = row.mobileBadge ?? row.titleBadge;
  // Same options (and look) as the category picker everywhere else.
  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories, { label: 'No category', value: NO_CATEGORY }),
    [categories],
  );
  const categoryName = row.category?.name;
  const tile = <CategoryIcon category={row.category} size={nested ? 28 : 32} />;

  return (
    <div
      className={cx(
        'txl-item',
        nested && 'txl-item--nested',
        nested && nestedLast && 'is-last',
        !categoryName && 'is-uncategorised',
      )}
    >
      {onAssignCategory ? (
        <Combobox
          options={categoryOptions}
          value={row.categoryId ? String(row.categoryId) : NO_CATEGORY}
          onChange={(value) => onAssignCategory(row.id, value === NO_CATEGORY || value == null ? '' : value)}
          searchPlaceholder="Search categories"
          aria-label={categoryName ? `Category: ${categoryName}. Change category` : 'Set category'}
          title="Change category"
          triggerClassName="txl-item__category"
          renderTrigger={() => tile}
        />
      ) : (
        <span className="txl-item__category">{tile}</span>
      )}

      <button type="button" className="txl-item__body" onClick={() => onOpenDetail?.(row.raw ?? row)}>
        <span className="txl-item__text">
          <span className="txl-item__title">{row.title || '—'}</span>
          <span className="txl-item__meta">
            {showDate && <span className="txl-item__meta-date">{formatDateShort(row.date)}</span>}
            {badge && <span className="txl-item__badge">{badge}</span>}
            <span className="txl-item__meta-copy">
              <span className={categoryName ? 'txl-item__cat' : 'txl-item__cat is-empty'}>
                {categoryName || 'Uncategorised'}
              </span>
              {hint ? <> · {hint}</> : null}
              {row.metaTrailing ? <> · {row.metaTrailing}</> : null}
            </span>
          </span>
        </span>
        <span className="txl-item__end">
          <Amount className="txl-item__amount" value={signedAmount(row)} sign="always" />
          {row.people?.length > 0 && (
            <AvatarGroup
              people={row.people}
              size="md"
              max={3}
              interactive={false}
              label="Split with"
              className="txl-item__people"
            />
          )}
        </span>
      </button>
    </div>
  );
}
