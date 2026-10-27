import { useMemo } from 'react';
import { LineChart } from '../../components/charts';
import { EmptyState } from '../../components/ui';
import { ledgerRunningBalances } from '../../utils/ledgerParties.js';

const dayKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shortDay = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/**
 * The balance with a friend after each day that has an entry, oldest first,
 * from the ledger's own running balance (`ledgerRunningBalances`), so the
 * last point is the balance on the page. Above zero means they owe you.
 */
export default function BalanceChart({ tags, friendFirst }) {
  const data = useMemo(() => {
    const dated = [...tags]
      .filter((t) => t.transaction?.transactionDate)
      .sort((a, b) => new Date(a.transaction.transactionDate) - new Date(b.transaction.transactionDate));
    const running = ledgerRunningBalances(dated);
    const byDay = new Map();
    dated.forEach((t, i) => {
      const key = dayKey(t.transaction.transactionDate);
      if (key) byDay.set(key, running[i]);
    });
    return [...byDay].map(([day, balance]) => ({ day, balance: Math.round(balance * 100) / 100 }));
  }, [tags]);

  if (data.length < 2) {
    return <EmptyState size="sm" title="Not enough activity to chart" description="The chart starts after a second day of entries." />;
  }

  return (
    <LineChart
      data={data}
      xKey="day"
      series={[{ key: 'balance', label: 'Balance' }]}
      height={180}
      curve="linear"
      area
      formatXLabel={shortDay}
      ariaLabel={`Balance with ${friendFirst} over time`}
    />
  );
}
