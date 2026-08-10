import { useMemo } from 'react';
import { Num } from './ui/primitives.jsx';
import TransactionListRow from './TransactionListRow.jsx';
import { inr } from '../utils/inr.js';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

/**
 * Mobile counterpart to TransactionTable: the same normalized rows, grouped by
 * day with a running net per day. Shared by the bank ledger and a card's
 * ledger so both read identically on a phone.
 */
export default function TransactionMobileList({
  rows,
  categories = [],
  onAssignCategory,
  onOpenDetail,
}) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const d = r.date ? new Date(r.date) : null;
      const key = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [rows]);

  return (
    <div className="txn-grouped">
      {groups.map(([dateKey, items]) => {
        const net = items.reduce(
          (s, r) => s + (r.isIncome ? Number(r.amount) : -Number(r.amount)),
          0,
        );
        return (
          <div key={dateKey}>
            <div className="txn-grouped__head">
              <span>{formatDate(dateKey)}</span>
              <Num size={12} weight={600} color={net >= 0 ? 'var(--ft-income)' : 'var(--ft-spend)'}>
                {inr(net, { sign: true })}
              </Num>
            </div>
            <div>
              {items.map((row) => (
                <TransactionListRow
                  key={row.id}
                  row={row}
                  categories={categories}
                  onAssignCategory={onAssignCategory}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
