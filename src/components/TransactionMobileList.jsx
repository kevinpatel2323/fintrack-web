import { useMemo } from 'react';
import { Amount } from './ui';
import TransactionListRow from './TransactionListRow.jsx';
import { formatDayLabel, groupRowsByDay } from './transactions/transactionListModel.js';
import './transactions/transactions.css';

/**
 * Phone counterpart to TransactionTable: the same normalized rows, grouped by
 * day under sticky date headers that carry the day's net. Shared by the bank
 * ledger and a card's ledger so both read identically on a phone.
 *
 * Optional:
 * - `bleed` runs the list edge to edge inside the page gutter, rows padded by
 *   the gutter (the phone list rule); off, it sits inside its container.
 * - `grouped={false}` drops the day headers for a list ordered by something
 *   other than date; each row then shows its own date.
 * - `dayOrder="asc"` puts the oldest day first.
 *
 * Date headers pin under `--list-toolbar-height` (a page's sticky toolbar).
 */
export default function TransactionMobileList({
  rows,
  categories = [],
  onAssignCategory,
  onOpenDetail,
  bleed = false,
  grouped = true,
  dayOrder = 'desc',
}) {
  const groups = useMemo(() => (grouped ? groupRowsByDay(rows, dayOrder) : null), [rows, grouped, dayOrder]);
  const className = bleed ? 'txl-days txl-days--bleed' : 'txl-days';

  const renderRow = (row, showDate) => (
    <TransactionListRow
      key={row.id}
      row={row}
      showDate={showDate}
      categories={categories}
      onAssignCategory={onAssignCategory}
      onOpenDetail={onOpenDetail}
    />
  );

  if (!groups) {
    return (
      <div className={className}>
        <div className="txl-day__rows">{(rows || []).map((row) => renderRow(row, true))}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {groups.map((group) => (
        <section key={group.key} className="txl-day" aria-label={formatDayLabel(group.key)}>
          <h3 className="txl-day__head">
            <span>{formatDayLabel(group.key)}</span>
            <Amount value={group.net} sign="always" tone="muted" />
          </h3>
          <div className="txl-day__rows">{group.rows.map((row) => renderRow(row, false))}</div>
        </section>
      ))}
    </div>
  );
}
