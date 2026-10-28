import { useMemo } from 'react';
import { Amount, Card, MobileSection, Skeleton } from '../../components/ui';
import { CategoryBars } from '../../components/charts';
import { buildCategorySpend } from './calendarModel.js';

/**
 * The month's withdrawals by category, from the transactions already loaded.
 * `loading` (nothing loaded yet) shows placeholder bars, not "No spending".
 * `phone` renders it as a titled section instead of a card.
 */
export default function CategorySpend({ transactions, monthName, max = 6, loading = false, phone = false }) {
  const { segments, total } = useMemo(() => buildCategorySpend(transactions), [transactions]);
  const items = useMemo(
    () => segments.map((s) => ({ key: s.key, label: s.name, value: s.amount, color: s.color })),
    [segments],
  );

  const body = loading ? (
    <div className="cal-spend-skeleton" aria-busy="true" aria-label="Loading spending">
      {[0, 1, 2].map((i) => <Skeleton key={i} height={28} />)}
    </div>
  ) : (
    <CategoryBars
      items={items}
      max={max}
      showPercent
      emptyText={`No spending in ${monthName} yet`}
      ariaLabel={`Spending by category in ${monthName}`}
    />
  );

  if (phone) {
    return (
      <MobileSection
        title="Spending by category"
        description={total > 0 ? <><Amount value={total} sign="never" tone="inherit" /> spent in {monthName}</> : null}
        className="cal-psection cal-pspend"
      >
        {body}
      </MobileSection>
    );
  }

  return (
    <Card
      as="section"
      title="Spending by category"
      actions={total > 0 ? <Amount value={total} sign="never" tone="muted" className="text-sm" /> : null}
      className="cal-card"
    >
      {body}
    </Card>
  );
}
