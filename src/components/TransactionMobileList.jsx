import { useMemo } from 'react';
import { Amount } from './ui';
import TransactionListRow from './TransactionListRow.jsx';
import { formatDayLabel, groupRowsByDay } from './transactions/transactionListModel.js';
import './transactions/transactions.css';

/**
 * Phone counterpart to TransactionTable: the same normalized rows, grouped by
 * day under sticky date headers that carry the day's net. Shared by the bank
 * ledger and a card's ledger so both read identically on a phone.
 */
export default function TransactionMobileList({
  rows,
  categories = [],
  onAssignCategory,
  onOpenDetail,
}) {
  const groups = useMemo(() => groupRowsByDay(rows), [rows]);

  return (
    <div className="txl-days">
      {groups.map((group) => (
        <section key={group.key} className="txl-day" aria-label={formatDayLabel(group.key)}>
          <h3 className="txl-day__head">
            <span>{formatDayLabel(group.key)}</span>
            <Amount value={group.net} sign="always" tone="muted" />
          </h3>
          <div className="txl-day__rows">
            {group.rows.map((row) => (
              <TransactionListRow
                key={row.id}
                row={row}
                categories={categories}
                onAssignCategory={onAssignCategory}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
