import { useCallback, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, CreditCard, Plus } from 'lucide-react';
import {
  Amount, Button, Card, Combobox, EmptyState, ErrorMessage, Spinner,
} from '../../components/ui';
import { CategoryIcon } from '../../components/common/Category.jsx';
import TransactionListRow from '../../components/TransactionListRow.jsx';
import { toCardTableRow } from '../../utils/cardTransactionRow.jsx';
import { categoryColor } from '../../utils/categoryColors.js';
import { BillRow } from './Bills.jsx';
import {
  accountSuffix, formatDayLong, isTransactionCategorized, sumSpent, sumEarned,
  txDescription, txMethod, txSignedAmount, txTitle,
} from './calendarModel.js';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/** Category picker options, with a "No category" choice for rows that have one. */
function useCategoryOptions(categories) {
  return useMemo(() => {
    const options = categories.map((c) => ({
      label: c.name,
      value: String(c.id),
      icon: <span className="cal-swatch" style={{ background: categoryColor(c) }} aria-hidden="true" />,
    }));
    return { options, withNone: [{ label: 'No category', value: '' }, ...options] };
  }, [categories]);
}

/**
 * The selected day: its totals, the transactions (rows open the transaction;
 * the category is set in place; card bill payments expand to the card
 * transactions they cover) and the subscription bills due that day.
 */
export default function DayPanel({
  iso,
  txs,
  bills,
  loading = false,
  categories,
  categoriesById,
  categoryStatusByTransaction,
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
}) {
  const categoryOptions = useCategoryOptions(categories);
  const spent = sumSpent(txs);
  const earned = sumEarned(txs);
  const empty = txs.length === 0 && bills.length === 0;

  const counts = [];
  if (txs.length > 0) counts.push(`${txs.length} transaction${txs.length === 1 ? '' : 's'}`);
  if (bills.length > 0) counts.push(`${bills.length} bill${bills.length === 1 ? '' : 's'} due`);

  return (
    <Card
      as="section"
      title={formatDayLong(iso)}
      description={counts.length ? counts.join(' · ') : null}
      actions={
        <Button variant="ghost" icon={Plus} label="Add a transaction on this day" tooltip="Add transaction" onClick={onAddTransaction} />
      }
      padding="none"
      className="cal-card cal-day-panel"
    >
      {txs.length > 0 && (
        <dl className="cal-day-panel__totals">
          <div>
            <dt>Spent</dt>
            <dd><Amount value={spent} sign="never" tone={spent > 0 ? 'out' : 'muted'} /></dd>
          </div>
          <div>
            <dt>Earned</dt>
            <dd><Amount value={earned} sign={earned > 0 ? 'always' : 'never'} tone={earned > 0 ? 'in' : 'muted'} /></dd>
          </div>
        </dl>
      )}

      {empty ? (
        loading ? (
          <div className="cal-day-panel__loading"><Spinner size="sm" /></div>
        ) : (
          <EmptyState
            size="sm"
            icon={CalendarDays}
            title="Nothing on this day"
            description="No transactions or bills."
            action={<Button iconLeft={Plus} label="Add transaction" onClick={onAddTransaction} />}
          />
        )
      ) : (
        <>
          {txs.length > 0 && (
            <ul className="cal-txns" aria-label="Transactions">
              {txs.map((t) => (
                <DayTxRow
                  key={t.id}
                  tx={t}
                  categoryOptions={categoryOptions}
                  categories={categories}
                  categoryStatus={categoryStatusByTransaction[t.id]}
                  onAssignCategory={onAssignCategory}
                  onOpenDetail={() => onOpenDetail(t)}
                  ccDetail={ccDetailByTransaction[t.id]}
                  onLoadCcDetail={onLoadCcDetail}
                  cardTags={cardTags}
                  onAssignCardCategory={onAssignCardCategory}
                  onOpenCardManage={onOpenCardManage}
                />
              ))}
            </ul>
          )}
          {bills.length > 0 && (
            <div className="cal-day-panel__bills">
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
        </>
      )}
    </Card>
  );
}

// ── Day transaction row ─────────────────────────────────────────────────────
// CC bill payments expand in place (same getCcLink payload as Transactions)
// and list the covered card transactions under the row. Expand state lives on
// the row; the fetched detail is cached by the page.
function DayTxRow({
  tx, categoryOptions, categories, categoryStatus, onAssignCategory, onOpenDetail,
  ccDetail, onLoadCcDetail, cardTags, onAssignCardCategory, onOpenCardManage,
}) {
  const cc = tx.ccBillPayment;
  const [expanded, setExpanded] = useState(false);
  const title = txTitle(tx);
  const description = txDescription(tx);
  const meta = [description !== title ? description : null, txMethod(tx), accountSuffix(tx.accountNumber)]
    .filter(Boolean)
    .join(' · ');
  const categorized = isTransactionCategorized(tx);
  const saving = categoryStatus === 'Saving…';
  const failed = categoryStatus && !saving;

  // Fetch on first expand only; the page-level cache persists across collapses.
  const toggleCc = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next && !ccDetail) onLoadCcDetail(tx.id);
  }, [expanded, ccDetail, tx.id, onLoadCcDetail]);

  function pickCategory(value) {
    // Clearing an uncategorised row changes nothing.
    if (!value && !categorized) return;
    onAssignCategory(tx.id, value || '');
  }

  return (
    <li className={cx('cal-txn', expanded && 'is-expanded')}>
      <div className="cal-txn__row">
        <CategoryIcon category={tx.category} size={28} className="cal-txn__icon" />
        <button type="button" className="cal-txn__open" onClick={onOpenDetail}>
          <span className="cal-txn__title truncate">{title}</span>
          <Amount value={txSignedAmount(tx)} sign="always" className="cal-txn__amount" />
        </button>
        <div className="cal-txn__sub">
          <Combobox
            size="xs"
            variant={categorized ? 'ghost' : 'subtle'}
            options={categorized ? categoryOptions.withNone : categoryOptions.options}
            value={categorized ? String(tx.categoryId) : null}
            onChange={pickCategory}
            placeholder="Add category"
            searchPlaceholder="Search categories"
            disabled={saving}
            aria-label={categorized ? `Category: ${tx.category?.name || 'set'}. Change category` : 'Add a category'}
            className={cx('cal-txn__category', categorized && 'is-ghost')}
          />
          {categoryStatus ? (
            <span className={cx('cal-txn__status', failed && 'is-error')} role={failed ? 'alert' : undefined}>
              {categoryStatus}
            </span>
          ) : (
            meta && <span className="cal-txn__meta truncate">{meta}</span>
          )}
          {cc && (
            <Button
              variant="ghost"
              size="xs"
              iconLeft={CreditCard}
              iconRight={expanded ? ChevronDown : ChevronRight}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} card transactions${cc.cardLast4 ? ` for card •• ${cc.cardLast4}` : ''}`}
              className="cal-txn__cc-toggle"
              onClick={toggleCc}
            >
              {cc.cardLast4 ? `•• ${cc.cardLast4}` : 'Card bill'}
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <CcChildren
          detail={ccDetail}
          categories={categories}
          tagsByTransaction={cardTags}
          onAssignCategory={onAssignCardCategory}
          onOpenManage={onOpenCardManage}
        />
      )}
    </li>
  );
}

// The card transactions a bill payment covers, in the shared ledger row. The
// remainder is not a transaction, so it keeps its own line.
function CcChildren({ detail, categories, tagsByTransaction, onAssignCategory, onOpenManage }) {
  if (!detail || detail.loading) {
    return (
      <div className="cal-txn__children cal-txn__note">
        <Spinner size="xs" /> Loading card transactions…
      </div>
    );
  }
  if (detail.error) {
    return (
      <div className="cal-txn__children cal-txn__note">
        <ErrorMessage message={detail.error} />
      </div>
    );
  }
  if (!detail.linked) {
    return <div className="cal-txn__children cal-txn__note">Not linked to a card bill.</div>;
  }

  const covered = detail.coveredTransactions || [];
  const remainder = Number(detail.remainder || 0);

  return (
    <div className="cal-txn__children">
      {covered.length === 0 && <p className="cal-txn__note">No card transactions covered.</p>}
      {covered.map((t, i) => (
        <TransactionListRow
          key={t.id}
          nested
          nestedLast={i === covered.length - 1}
          showDate
          row={toCardTableRow(t, tagsByTransaction)}
          categories={categories}
          onAssignCategory={onAssignCategory}
          onOpenDetail={() => onOpenManage(t.id)}
        />
      ))}
      {remainder !== 0 && (
        <div className="cal-txn__remainder">
          <span className="truncate">
            {remainder > 0 ? 'Carried forward / other charges' : 'Not covered by this payment'}
          </span>
          <Amount value={remainder} decimals={2} tone="muted" />
        </div>
      )}
    </div>
  );
}
