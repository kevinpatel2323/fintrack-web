import { forwardRef, useMemo } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { Amount, Button, EmptyState, ListColumnsMenu } from '../../components/ui';
import TransactionTable, { transactionColumnChoices, useTransactionColumns } from '../../components/TransactionTable.jsx';
import { BillRow } from './Bills.jsx';
import { formatDayLong, sumEarned, sumSpent } from './calendarModel.js';
import { useDayRows } from './useDayRows.js';

// One day has no use for a Date column.
const OMIT = ['date'];
const COLUMN_CHOICES = transactionColumnChoices().filter((c) => !OMIT.includes(c.id));

/**
 * The selected day's transactions, in the same table as the Transactions page:
 * category set in place, card bill payments expand to the card transactions
 * they cover, rows open the transaction. What still needs a category is
 * listed first and marked, until a header click orders the table. Bills due
 * that day follow the table. Phones render DayTransactionsPhone instead.
 */
const DayTransactions = forwardRef(function DayTransactions(
  {
    iso,
    txs,
    bills,
    loading = false,
    categories,
    categoriesById,
    onAssignCategory,
    onOpenDetail,
    ccDetailByTransaction,
    onLoadCcDetail,
    cardTags,
    onAssignCardCategory,
    onOpenCardManage,
    subsById,
    onOpenSubscription,
    onAddTransaction,
  },
  ref,
) {
  const columnSettings = useTransactionColumns('fintrack.ledger.calendar');
  // To-categorise first, otherwise the day's own order.
  const { rows, pendingIds, expandedIds, toggleExpand, expansionRows } = useDayRows({
    txs, ccDetailByTransaction, onLoadCcDetail, cardTags,
  });
  const expansionHandlers = useMemo(
    () => ({ onAssignCategory: onAssignCardCategory, onOpenManage: onOpenCardManage }),
    [onAssignCardCategory, onOpenCardManage],
  );

  const spent = sumSpent(txs);
  const earned = sumEarned(txs);
  const meta = [];
  if (txs.length) meta.push(`${txs.length} transaction${txs.length === 1 ? '' : 's'}`);
  if (bills.length) meta.push(`${bills.length} bill${bills.length === 1 ? '' : 's'} due`);

  return (
    <section ref={ref} className="cal-dayview" aria-label={`Transactions on ${formatDayLong(iso)}`}>
      <header className="cal-dayview__head">
        <div className="cal-dayview__heading">
          <h2 className="cal-dayview__title">{formatDayLong(iso)}</h2>
          {meta.length > 0 && (
            <p className="cal-dayview__meta">
              {meta.join(' · ')}
              {spent > 0 && (
                <>
                  {' · '}
                  <Amount value={spent} sign="never" tone="inherit" /> spent
                </>
              )}
              {earned > 0 && (
                <>
                  {' · '}
                  <Amount value={earned} sign="always" tone="in" /> earned
                </>
              )}
              {pendingIds.size > 0 && (
                <span className="cal-dayview__todo"> · {pendingIds.size} to categorise</span>
              )}
            </p>
          )}
        </div>
        <div className="cal-dayview__actions">
          {txs.length > 0 && <ListColumnsMenu columns={COLUMN_CHOICES} settings={columnSettings} />}
          <Button iconLeft={Plus} label="Add transaction" onClick={onAddTransaction} />
        </div>
      </header>

      {txs.length === 0 ? (
        !loading && bills.length === 0 && (
          <EmptyState
            size="sm"
            icon={CalendarDays}
            title="Nothing on this day"
            description="No transactions or bills."
          />
        )
      ) : (
        <TransactionTable
          className="cal-dayview__table"
          rows={rows}
          columnSettings={columnSettings}
          omitColumns={OMIT}
          paginate={false}
          categories={categories}
          onAssignCategory={onAssignCategory}
          onOpenDetail={onOpenDetail}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          expansionRows={expansionRows}
          expansionHandlers={expansionHandlers}
          rowClassName={(row) => (pendingIds.has(row.id) ? 'is-pending' : null)}
          loading={loading && txs.length === 0}
        />
      )}

      {bills.length > 0 && (
        <div className="cal-dayview__bills">
          <h3 className="cal-section-label">Bills due</h3>
          <ul className="cal-bills">
            {bills.map((o) => {
              const sub = subsById.get(String(o.subscriptionId));
              return (
                <BillRow
                  key={`${o.subscriptionId}-${o.date}`}
                  occ={o}
                  category={categoriesById.get(String(o.categoryId))}
                  onOpen={sub ? () => onOpenSubscription(sub) : undefined}
                />
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
});

export default DayTransactions;
