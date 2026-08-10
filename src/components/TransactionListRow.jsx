import { Num } from './ui/primitives.jsx';
import { TransactionCategoryGlyph, formatDateShort } from './TransactionTable.jsx';
import { inr } from '../utils/inr.js';
import '../styles/transactions-redesign.css';

/**
 * One ledger row outside a table: category glyph (tap to recategorise), title,
 * meta line, amount. This is the non-table counterpart of TransactionTableRow,
 * used by the mobile ledger and by narrow panels such as the calendar's day
 * list — anywhere a <table> would not fit.
 *
 * `nested` renders it as a subordinate of the row above (the card transactions
 * a bill payment covers). `showDate` puts the row's own date in the meta line,
 * which the grouped mobile list does not need but nested rows do.
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
  return (
    <div className={`txn-mobile-row${
      nested ? ` txn-mobile-row--nested${nestedLast ? ' is-last' : ''}` : ''}`}>
      {/* Category glyph — tap to pick category */}
      <label
        className="txn-mobile-row__cat-pick"
        title="Change category"
        onClick={(e) => e.stopPropagation()}
      >
        <TransactionCategoryGlyph category={row.category} size={nested ? 30 : 38} />
        <select
          className="txn-mobile-cat-select"
          value={row.categoryId || ''}
          onChange={(e) => { e.stopPropagation(); onAssignCategory(row.id, e.target.value); }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
          ))}
        </select>
      </label>

      {/* Tap-to-open body */}
      <button
        type="button"
        className="txn-mobile-row__body"
        onClick={() => onOpenDetail?.(row.raw ?? row)}
      >
        <div className="txn-mobile-row__copy">
          <div className="txn-mobile-row__title">{row.title || '—'}</div>
          <div className="txn-mobile-row__meta">
            {showDate && (
              <span className="txn-mobile-row__meta-date">{formatDateShort(row.date)}</span>
            )}
            {row.titleBadge}
            <span className="txn-mobile-row__meta-copy">
              {row.mobileSubtitle ?? row.subtitle}
            </span>
            {row.metaTrailing && (
              <span className="txn-mobile-row__meta-trailing">{row.metaTrailing}</span>
            )}
          </div>
        </div>
        <div className="txn-mobile-row__amount">
          <Num size={nested ? 13 : 14} weight={600} color={row.isIncome ? 'var(--ft-income)' : 'var(--ft-spend)'}>
            {inr(row.isIncome ? row.amount : -row.amount, { sign: row.isIncome })}
          </Num>
        </div>
      </button>
    </div>
  );
}
