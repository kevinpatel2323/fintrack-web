import { useMemo } from 'react';
import { Amount, Card } from '../../components/ui';
import { CategoryBars } from '../../components/charts';
import { buildCategorySpend } from './calendarModel.js';

/** The month's withdrawals by category, from the transactions already loaded. */
export default function CategorySpend({ transactions, monthName, max = 6 }) {
  const { segments, total } = useMemo(() => buildCategorySpend(transactions), [transactions]);
  const items = useMemo(
    () => segments.map((s) => ({ key: s.key, label: s.name, value: s.amount, color: s.color })),
    [segments],
  );

  return (
    <Card
      as="section"
      title="Spending by category"
      actions={total > 0 ? <Amount value={total} sign="never" tone="muted" className="text-sm" /> : null}
      className="cal-card"
    >
      <CategoryBars
        items={items}
        max={max}
        showPercent
        emptyText={`No spending in ${monthName} yet`}
        ariaLabel={`Spending by category in ${monthName}`}
      />
    </Card>
  );
}
