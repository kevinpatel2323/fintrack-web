import { forwardRef } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Amount, Button, MobileSection, Skeleton } from '../../components/ui';
import TransactionListRow from '../../components/TransactionListRow.jsx';
import { PhoneBillList } from './Bills.jsx';
import { formatDayLong, formatDayMedium, sumEarned, sumSpent } from './calendarModel.js';
import { useDayRows } from './useDayRows.js';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * Phone: the selected day as a section. "Wed, 28 Oct", what happened that
 * day and "Add transaction" on top; then the day's transactions as Activity's
 * phone rows, the ones still to categorise first and tinted. Tapping a row
 * opens the transaction, tapping its category tile recategorises it in place.
 * A card bill payment can show the card transactions it covers underneath
 * (tap one to manage it). Bills due that day follow.
 */
const DayTransactionsPhone = forwardRef(function DayTransactionsPhone(
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
  const { rows, pendingIds, expandedIds, toggleExpand, expansionRows } = useDayRows({
    txs, ccDetailByTransaction, onLoadCcDetail, cardTags,
  });

  const spent = sumSpent(txs);
  const earned = sumEarned(txs);
  const meta = [];
  if (txs.length) meta.push(`${txs.length} transaction${txs.length === 1 ? '' : 's'}`);
  if (bills.length) meta.push(`${bills.length} bill${bills.length === 1 ? '' : 's'} due`);
  const description = meta.length > 0 ? (
    <>
      {meta.join(' · ')}
      {spent > 0 && <>{' · '}<Amount value={spent} sign="never" tone="inherit" /> spent</>}
      {earned > 0 && <>{' · '}<Amount value={earned} sign="always" tone="in" /> earned</>}
      {pendingIds.size > 0 && <span className="cal-dayview__todo"> · {pendingIds.size} to categorise</span>}
    </>
  ) : loading ? null : 'No transactions or bills';

  return (
    <div ref={ref} className="cal-pday">
      <MobileSection
        title={formatDayMedium(iso)}
        aria-label={formatDayLong(iso)}
        aside={<Button iconLeft={Plus} label="Add transaction" onClick={onAddTransaction} className="cal-pday__add" />}
      >
        {/* Under the title row rather than beside the button, so a busy
            day's facts get the full width. */}
        {description && <p className="cal-pday__meta">{description}</p>}
        {txs.length === 0 && loading && (
          <div className="cal-pday__skeleton" aria-busy="true" aria-label="Loading transactions">
            {[0, 1].map((i) => <Skeleton key={i} height={40} />)}
          </div>
        )}

        {txs.length > 0 && (
          <div className="cal-pday__rows" role="list" aria-label="Transactions">
            {rows.map((row) => {
              const open = expandedIds.has(row.id);
              return (
                <div key={row.id} role="listitem" className={cx('cal-pday__row', pendingIds.has(row.id) && 'is-pending')}>
                  <TransactionListRow
                    row={row}
                    categories={categories}
                    onAssignCategory={onAssignCategory}
                    onOpenDetail={() => onOpenDetail(row.raw)}
                  />
                  {row.expandable && (
                    <button
                      type="button"
                      className={cx('cal-pday__expand', open && 'is-open')}
                      aria-expanded={open}
                      onClick={() => toggleExpand(row.id)}
                    >
                      <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
                      {open ? 'Hide card transactions' : 'Show card transactions'}
                    </button>
                  )}
                  {open && (
                    <div className="cal-pday__nested">
                      {expansionRows(row).map((item) => (item.kind === 'nested' ? (
                        <TransactionListRow
                          key={item.key}
                          row={item}
                          nested
                          nestedLast={item.last}
                          showDate
                          categories={categories}
                          onAssignCategory={onAssignCardCategory}
                          onOpenDetail={() => onOpenCardManage(item.id)}
                        />
                      ) : (
                        <p key={item.key} className="cal-pday__note">
                          <span>{item.text}</span>
                          {item.kind === 'remainder' && (
                            <Amount value={item.amount} decimals={2} tone="muted" />
                          )}
                        </p>
                      )))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {bills.length > 0 && (
          <div className="cal-pday__bills">
            <h3 className="cal-pday__label">Bills due</h3>
            <PhoneBillList
              items={bills}
              subsById={subsById}
              categoriesById={categoriesById}
              onOpenSubscription={onOpenSubscription}
              showDate={false}
              label="Bills due"
            />
          </div>
        )}

      </MobileSection>
    </div>
  );
});

export default DayTransactionsPhone;
