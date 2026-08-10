/**
 * Shared mapping from a card transaction to the row shape TransactionTable and
 * TransactionMobileList render, so every place a card ledger appears — the
 * card's own tab, and the covered list on a bill payment's detail page —
 * renders identically.
 */

/** Where a card transaction sits in the billing cycle — the card ledger's
 *  analogue of the bank ledger's "Method" column. */
export function cardTxnStatus(txn) {
  if (txn.paidByPaymentId) return 'Paid';
  return txn.statementId ? 'Billed' : 'Unbilled';
}

export function CardRefundBadge() {
  return (
    <span
      style={{
        marginLeft: 8,
        padding: '1px 6px',
        borderRadius: 6,
        background: 'var(--ft-income-soft)',
        color: 'var(--ft-income)',
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      Refund
    </span>
  );
}

/**
 * @param row              a card transaction from the API
 * @param tagsByTransaction map of id -> friend tags; a missing entry means
 *                          "not loaded yet" and renders as a placeholder
 */
export function toCardTableRow(row, tagsByTransaction = {}) {
  const tags = tagsByTransaction[row.id];
  // A refund credits the card, so it reads as money in — same convention as a
  // deposit on the bank ledger.
  const isIncome = Boolean(row.isRefund);
  const status = cardTxnStatus(row);

  return {
    id: row.id,
    raw: row,
    date: row.txnDate,
    title: row.merchant || '',
    subtitle: row.notes || status,
    titleBadge: row.isRefund ? <CardRefundBadge /> : null,
    category: row.category,
    categoryId: row.categoryId,
    method: status,
    tagCount: tags === undefined ? null : tags.length,
    amount: Number(row.amount || 0),
    isIncome,
    expandable: false,
    mobileSubtitle: row.notes || status,
    metaTrailing: null,
  };
}
