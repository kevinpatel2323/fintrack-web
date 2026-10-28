import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Amount, Button, EmptyState, ListColumnsMenu, Sheet } from '../../components/ui';
import TransactionTable, { transactionColumnChoices, useTransactionColumns } from '../../components/TransactionTable.jsx';
import { BillRow } from './Bills.jsx';
import { formatDayLong, sumEarned, sumSpent } from './calendarModel.js';
import { useDayRows } from './useDayRows.js';

// One day has no use for a Date column.
const OMIT = ['date'];
const COLUMN_CHOICES = transactionColumnChoices().filter((c) => !OMIT.includes(c.id));

// Wide enough for the day's table without sideways scrolling (description,
// category, method, people, amount, manage), and always leaving some of the
// month in view.
const DRAWER_WIDTH = 'min(880px, calc(100vw - 160px))';

/**
 * The selected day in a side drawer over the month (desktop): the same table
 * as the Transactions page — category set in place, card bill payments
 * expand to the card transactions they cover, rows open the transaction.
 * What still needs a category is listed first and marked, until a header
 * click orders the table. Bills due that day follow the table. The header
 * steps to the previous or next day (across months too) and the footer
 * jumps to the next day with something to categorise, so a month can be
 * worked through without closing the drawer. Phones render
 * DayTransactionsPhone under the grid instead.
 */
export default function DayTransactions({
  open,
  onClose,
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
  onStepDay,
  onNextPending,
}) {
  const columnSettings = useTransactionColumns('fintrack.ledger.calendar');
  // To-categorise first, otherwise the day's own order.
  const { rows, pendingIds, expandedIds, toggleExpand, expansionRows } = useDayRows({
    txs, ccDetailByTransaction, onLoadCcDetail, cardTags,
  });
  const expansionHandlers = useMemo(
    () => ({ onAssignCategory: onAssignCardCategory, onOpenManage: onOpenCardManage }),
    [onAssignCardCategory, onOpenCardManage],
  );

  // Stepping to another day starts its table at the top.
  const contentRef = useRef(null);
  useEffect(() => {
    contentRef.current?.closest('.ui-sheet__body')?.scrollTo({ top: 0 });
  }, [iso]);

  const spent = sumSpent(txs);
  const earned = sumEarned(txs);
  const meta = [];
  if (txs.length) meta.push(`${txs.length} transaction${txs.length === 1 ? '' : 's'}`);
  if (bills.length) meta.push(`${bills.length} bill${bills.length === 1 ? '' : 's'} due`);
  const isEmpty = txs.length === 0 && bills.length === 0 && !loading;

  const description = meta.length > 0 ? (
    <>
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
    </>
  ) : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="right"
      width={DRAWER_WIDTH}
      title={formatDayLong(iso)}
      description={description}
      className="cal-dayview"
      bodyClassName="cal-dayview__body"
      actions={(
        <>
          <Button variant="ghost" icon={ChevronLeft} label="Previous day" tooltip="Previous day" onClick={() => onStepDay(-1)} />
          <Button variant="ghost" icon={ChevronRight} label="Next day" tooltip="Next day" onClick={() => onStepDay(1)} />
        </>
      )}
      footer={(
        <>
          <div className="cal-dayview__footer-start">
            {txs.length > 0 && <ListColumnsMenu columns={COLUMN_CHOICES} settings={columnSettings} />}
          </div>
          <Button
            variant={onNextPending ? 'subtle' : 'solid'}
            iconLeft={Plus}
            label="Add transaction"
            onClick={onAddTransaction}
          />
          {onNextPending && (
            <Button variant="solid" label="Next day to fix" iconRight={ArrowRight} onClick={onNextPending} />
          )}
        </>
      )}
    >
      <div ref={contentRef} className="cal-dayview__content">
        {isEmpty ? (
          <EmptyState
            size="sm"
            icon={CalendarDays}
            title="Nothing on this day"
            description="No transactions or bills."
          />
        ) : (txs.length > 0 || loading) && (
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
      </div>
    </Sheet>
  );
}
