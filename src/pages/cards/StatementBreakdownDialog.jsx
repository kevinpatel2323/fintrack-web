import { Trash2 } from 'lucide-react';
import { Amount, Badge, Dialog, EmptyState, Skeleton } from '../../components/ui';
import { CategoryBars } from '../../components/charts';
import { categoryColor } from '../../utils/categoryColors.js';
import { STATEMENT_STATUS, dayLabel, rangeLabel } from '../../components/cards/cardFormat.js';

/**
 * One statement: its totals, spend by category and the transactions on it
 * (GET /cards/statements/:id/breakdown). `data.loading` shows skeletons while
 * the breakdown loads; `data.statement` is the row that was clicked.
 */
export default function StatementBreakdownDialog({ data, onClose, onDelete }) {
  const { statement, categories: cats = [], transactions = [], loading } = data;
  const status = STATEMENT_STATUS[statement.status] || { label: statement.status, theme: 'gray' };

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
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
            )}
          </section>

          <section className="cardd-breakdown__section" aria-label="Transactions">
            <h4 className="cardd-breakdown__heading">
              Transactions <span className="cardd-breakdown__count">{transactions.length}</span>
            </h4>
            {transactions.length === 0 ? (
              <EmptyState size="sm" title="No transactions" description="Nothing is linked to this statement." />
            ) : (
              <ul className="cardd-breakdown__list">
                {transactions.map((t) => {
                  const amt = Number(t.amount);
                  return (
                    <li key={t.id} className="cardd-breakdown__row">
                      <span className="cardd-breakdown__date">{dayLabel(t.txnDate)}</span>
                      <span className="cardd-breakdown__merchant truncate" title={t.merchant}>
                        {t.merchant}
                      </span>
                      <Amount
                        className="cardd-breakdown__amount"
                        value={t.isRefund ? amt : -amt}
                        sign={t.isRefund ? 'always' : 'never'}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </Dialog>
  );
}
