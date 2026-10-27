import { Amount, Card } from '../ui';
import TransactionTable, { transactionColumnChoices, useTransactionColumns } from '../TransactionTable.jsx';
import TransactionColumnsMenu from '../transactions/TransactionColumnsMenu.jsx';
import TransactionListRow from '../TransactionListRow.jsx';

/**
 * "Card bill" section of a bank debit that paid a credit-card bill: the card
 * transactions it covers (managed like any other ledger rows) and whatever
 * part of the payment they don't account for.
 */
const COLUMN_LABELS = { description: 'Merchant', method: 'Status' };
const COLUMN_CHOICES = transactionColumnChoices(COLUMN_LABELS);

export default function CardBillCard({
  ccLink,
  rows,
  isMobile,
  categories,
  onAssignCategory,
  onOpenManage,
  sortCol,
  sortDir,
  onSort,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const columnSettings = useTransactionColumns('fintrack.ledger.covered');
  const count = (ccLink.coveredTransactions || []).length;
  const cardLabel = ccLink.card ? `${ccLink.card.name} ····${ccLink.card.last4}` : 'Credit card';
  const remainder = Number(ccLink.remainder || 0);

  return (
    <Card
      as="section"
      title="Card bill"
      description={`${cardLabel} · ${count} covered card ${count === 1 ? 'transaction' : 'transactions'}`}
      padding="none"
      actions={isMobile ? null : <TransactionColumnsMenu columns={COLUMN_CHOICES} settings={columnSettings} />}
      className="txd-bill"
      footer={remainder !== 0 ? (
        <div className="txd-bill__remainder">
          <span>{remainder > 0 ? 'Carried forward / other charges' : 'Not covered by this payment'}</span>
          <Amount value={remainder} decimals={2} tone="muted" />
        </div>
      ) : null}
    >
      {isMobile ? (
        /* Not the day-grouped list: these all belong to one bill, and a
           statement cycle would emit a date header per row. Each row
           carries its own date instead. */
        rows.length === 0 ? (
          <p className="txd-bill__empty">No card transactions covered.</p>
        ) : (
          <div className="txd-bill__rows">
            {rows.map((row) => (
              <TransactionListRow
                key={row.id}
                showDate
                row={row}
                categories={categories}
                onAssignCategory={onAssignCategory}
                onOpenDetail={() => onOpenManage(row.id)}
              />
            ))}
          </div>
        )
      ) : (
        <TransactionTable
          rows={rows}
          columnSettings={columnSettings}
          columnLabels={COLUMN_LABELS}
          categories={categories}
          onAssignCategory={onAssignCategory}
          onOpenManage={onOpenManage}
          onOpenDetail={(row) => onOpenManage(row.id)}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={onSort}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          emptyMessage="No card transactions covered."
        />
      )}
    </Card>
  );
}
