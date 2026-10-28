import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Amount, Badge, Dialog, EmptyState, MobileList, MobileListItem, Skeleton,
} from '../../components/ui';
import { CategoryBars } from '../../components/charts';
import TransactionTable from '../../components/TransactionTable.jsx';
import { useIsCompact } from '../../styles/breakpoints.js';
import { categoryColor } from '../../utils/categoryColors.js';
import { toCardTableRow } from '../../utils/cardTransactionRow.jsx';
import { STATEMENT_STATUS, dayLabel, rangeLabel } from '../../components/cards/cardFormat.js';

// Everything on a statement is billed, and the breakdown carries no splits.
const OMIT = ['method', 'tags'];
const LABELS = { description: 'Merchant' };
const STATEMENT_ORDER = { key: 'date', direction: 'asc' };

function CategorySplit({ cats }) {
  return (
    <CategoryBars
      ariaLabel="Statement spend by category"
      items={cats.map((c) => ({
        key: c.categoryId || 'uncat',
        label: c.categoryName || 'Uncategorised',
        value: Number(c.amount),
        color: c.categoryId
          ? categoryColor({ color: c.categoryColor, name: c.categoryName })
          : 'var(--ink-gray-4)',
      }))}
      showPercent
    />
  );
}

/**
 * Phones: the statement's total as the hero with paid, due and status under
 * it, the category split, then the transactions as plain two-line rows.
 */
function PhoneBreakdown({ statement, status, cats, transactions, loading }) {
  return (
    <div className="carddm-bd">
      <div className="carddm-bd__hero">
        <div className="carddm-bd__total">
          <span className="carddm-bd__label">Total</span>
          <Amount className="carddm-bd__amount" value={Number(statement.totalAmount)} tone="inherit" />
          <span className="carddm-bd__line">
            <Amount value={Number(statement.paidAmount)} tone="inherit" /> paid · Due{' '}
            {dayLabel(statement.dueDate, { year: true })}
          </span>
        </div>
        <Badge theme={status.theme} label={status.label} />
      </div>

      {loading ? (
        <div className="cardd-breakdown__loading" aria-busy="true">
          <Skeleton height={14} width="40%" />
          <Skeleton height={10} width="100%" />
          <Skeleton height={10} width="85%" />
          <Skeleton height={10} width="70%" />
        </div>
      ) : (
        <>
          <section className="carddm-bd__section" aria-label="By category">
            <h4 className="carddm-bd__heading">By category</h4>
            {cats.length === 0 ? (
              <p className="carddm-bd__empty">No transactions in this statement.</p>
            ) : (
              <CategorySplit cats={cats} />
            )}
          </section>

          <section className="carddm-bd__section" aria-label="Transactions">
            <h4 className="carddm-bd__heading">
              Transactions <span className="carddm-bd__count">{transactions.length}</span>
            </h4>
            {transactions.length === 0 ? (
              <p className="carddm-bd__empty">Nothing is linked to this statement.</p>
            ) : (
              <MobileList aria-label="Transactions on this statement">
                {transactions.map((t) => {
                  const amt = Number(t.amount);
                  return (
                    <MobileListItem
                      key={t.id}
                      title={t.merchant}
                      subtitle={[dayLabel(t.txnDate), t.category?.name].filter(Boolean).join(' · ')}
                      value={
                        <Amount
                          value={t.isRefund ? amt : -amt}
                          sign={t.isRefund ? 'always' : 'never'}
                          tone={t.isRefund ? 'in' : 'inherit'}
                        />
                      }
                    />
                  );
                })}
              </MobileList>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/**
 * One statement: its totals, spend by category and the transactions on it
 * (GET /cards/statements/:id/breakdown) — in the card ledger's table on
 * wider screens, as plain rows on phones. `data.loading` shows skeletons
 * while the breakdown loads; `data.statement` is the row that was clicked.
 */
export default function StatementBreakdownDialog({ data, onClose, onDelete }) {
  const { statement, categories: cats = [], transactions = [], loading } = data;
  const status = STATEMENT_STATUS[statement.status] || { label: statement.status, theme: 'gray' };
  const isCompact = useIsCompact();
  const rows = useMemo(() => transactions.map((t) => toCardTableRow(t)), [transactions]);

  return (
    <Dialog
      open
      onClose={onClose}
      size="3xl"
      title={rangeLabel(statement.cycleStart, statement.cycleEnd)}
      actions={[
        onDelete && {
          label: 'Delete statement',
          icon: Trash2,
          theme: 'red',
          variant: 'ghost',
          onClick: () => onDelete(statement),
        },
        { label: 'Close' },
      ]}
    >
      {isCompact ? (
        <PhoneBreakdown
          statement={statement}
          status={status}
          cats={cats}
          transactions={transactions}
          loading={loading}
        />
      ) : (
        <>
        <dl className="cardd-facts">
          <div>
            <dt>Total</dt>
            <dd>
              <Amount value={Number(statement.totalAmount)} tone="inherit" />
            </dd>
          </div>
          <div>
            <dt>Paid</dt>
            <dd>
              <Amount value={Number(statement.paidAmount)} tone="inherit" />
            </dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{dayLabel(statement.dueDate, { year: true })}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <Badge theme={status.theme} label={status.label} />
            </dd>
          </div>
        </dl>

        {loading ? (
          <div className="cardd-breakdown__loading" aria-busy="true">
            <Skeleton height={14} width="40%" />
            <Skeleton height={10} width="100%" />
            <Skeleton height={10} width="85%" />
            <Skeleton height={10} width="70%" />
          </div>
        ) : (
          <>
            <section className="cardd-breakdown__section" aria-label="By category">
              <h4 className="cardd-breakdown__heading">By category</h4>
              {cats.length === 0 ? (
                <p className="cardd-breakdown__empty">No transactions in this statement.</p>
              ) : (
                <CategorySplit cats={cats} />
              )}
            </section>

            <section className="cardd-breakdown__section" aria-label="Transactions">
              <h4 className="cardd-breakdown__heading">
                Transactions <span className="cardd-breakdown__count">{transactions.length}</span>
              </h4>
              {transactions.length === 0 ? (
                <EmptyState size="sm" title="No transactions" description="Nothing is linked to this statement." />
              ) : (
                <TransactionTable
                  rows={rows}
                  columnLabels={LABELS}
                  omitColumns={OMIT}
                  defaultSort={STATEMENT_ORDER}
                  storageKey="fintrack.ledger.statement"
                />
              )}
            </section>
          </>
        )}
        </>
      )}
    </Dialog>
  );
}
