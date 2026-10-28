import { Amount, Card, ListColumnsMenu, MobileSection } from '../ui';
import TransactionTable, { transactionColumnChoices, useTransactionColumns } from '../TransactionTable.jsx';
import TransactionMobileList from '../TransactionMobileList.jsx';

/**
 * "Card bill" section of a bank debit that paid a credit-card bill: the card
 * transactions it covers (managed like any other ledger rows) and whatever
 * part of the payment they don't account for.
 */
const COLUMN_LABELS = { description: 'Merchant', method: 'Status' };
const COLUMN_CHOICES = transactionColumnChoices(COLUMN_LABELS);
export const COVERED_ORDER = { key: 'date', direction: 'asc' };

export default function CardBillCard({
  ccLink,
  rows,
  isMobile,
  categories,
  onAssignCategory,
  onOpenManage,
}) {
  const columnSettings = useTransactionColumns('fintrack.ledger.covered');
  const count = (ccLink.coveredTransactions || []).length;
  const cardLabel = ccLink.card ? `${ccLink.card.name} ····${ccLink.card.last4}` : 'Credit card';
  const remainder = Number(ccLink.remainder || 0);
  const remainderLabel = remainder > 0 ? 'Carried forward / other charges' : 'Not covered by this payment';

  if (isMobile) {
    // Phone: a section, not a boxed card, with the ledger's phone rows edge
    // to edge. Not grouped by day: these all belong to one bill, and a
    // statement cycle would put a date header over nearly every row. Each row
    // carries its own date instead.
    return (
      <MobileSection
        className="txd-m-bill"
        title="Card bill"
        description={`${cardLabel} · ${count} covered card ${count === 1 ? 'transaction' : 'transactions'}`}
      >
        {rows.length === 0 ? (
          <p className="txd-m-muted">No card transactions covered.</p>
        ) : (
          <TransactionMobileList
            bleed
            grouped={false}
            rows={rows}
            categories={categories}
            onAssignCategory={onAssignCategory}
            onOpenDetail={(row) => onOpenManage(row.id)}
          />
        )}
        {remainder !== 0 && (
          <div className="txd-m-bill__remainder">
            <span>{remainderLabel}</span>
            <Amount value={remainder} decimals={2} tone="muted" />
          </div>
        )}
      </MobileSection>
    );
  }

  return (
    <Card
      as="section"
      title="Card bill"
      description={`${cardLabel} · ${count} covered card ${count === 1 ? 'transaction' : 'transactions'}`}
      padding="none"
      actions={<ListColumnsMenu columns={COLUMN_CHOICES} settings={columnSettings} />}
      className="txd-bill"
      footer={remainder !== 0 ? (
        <div className="txd-bill__remainder">
          <span>{remainderLabel}</span>
          <Amount value={remainder} decimals={2} tone="muted" />
        </div>
      ) : null}
    >
      <TransactionTable
        rows={rows}
        columnSettings={columnSettings}
        columnLabels={COLUMN_LABELS}
        categories={categories}
        onAssignCategory={onAssignCategory}
        onOpenManage={onOpenManage}
        onOpenDetail={(row) => onOpenManage(row.id)}
        // Rows arrive oldest first (see TransactionDetail); the table
        // re-orders them from the headers and pages them itself.
        defaultSort={COVERED_ORDER}
        emptyMessage="No card transactions covered."
      />
    </Card>
  );
}
