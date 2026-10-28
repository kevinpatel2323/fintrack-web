import { useCallback, useMemo, useState } from 'react';
import { toBankTableRow } from '../../components/transactions/bankTransactionRow.jsx';
import { ccExpansionItems } from '../../components/transactions/transactionListModel.js';
import { toCardTableRow } from '../../utils/cardTransactionRow.jsx';
import { dayUncategorizedCount } from './calendarModel.js';

/**
 * The selected day's rows, shared by the desktop table and the phone list:
 * what still needs a category first (and which those are), then the rest in
 * the day's own order; which card bill payments are expanded, and the card
 * transactions each one covers (fetched on first expand).
 */
export function useDayRows({ txs, ccDetailByTransaction, onLoadCcDetail, cardTags }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const { rows, pendingIds } = useMemo(() => {
    const pending = new Set(
      txs.filter((t) => dayUncategorizedCount([t], ccDetailByTransaction) > 0).map((t) => t.id),
    );
    const ordered = [...txs.filter((t) => pending.has(t.id)), ...txs.filter((t) => !pending.has(t.id))];
    const tagsByTransaction = Object.fromEntries(txs.map((t) => [t.id, t.friendTags || []]));
    return { rows: ordered.map((t) => toBankTableRow(t, tagsByTransaction)), pendingIds: pending };
  }, [txs, ccDetailByTransaction]);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!ccDetailByTransaction[id]) onLoadCcDetail(id);
  }, [ccDetailByTransaction, onLoadCcDetail]);

  const expansionRows = useCallback(
    (row) => ccExpansionItems(row.id, ccDetailByTransaction[row.id], (t) => toCardTableRow(t, cardTags)),
    [ccDetailByTransaction, cardTags],
  );

  return { rows, pendingIds, expandedIds, toggleExpand, expansionRows };
}
