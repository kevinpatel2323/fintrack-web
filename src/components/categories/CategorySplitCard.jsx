import { PieChart, RotateCw } from 'lucide-react';
import { Button, Card, EmptyState, ErrorMessage, Skeleton } from '../ui';
import { DonutChart } from '../charts';
import { inrCompact } from '../../utils/inr.js';

/** Slices shown by name; the rest fold into one "N more" slice. */
const NAMED_SLICES = 6;
const moreLabel = (count) => `${count} more`;

/**
 * The month's spending split as a donut, with a legend of the top six
 * categories plus "N more". `items` are `{ key, label, value, color }` with a
 * positive value (money spent).
 */
export default function CategorySplitCard({ month, items, total, loading, error, onRetry, className = '' }) {
  const data = items;

  let body;
  if (error) {
    body = (
      <div className="catg-split__error">
        <ErrorMessage message={error} />
        <Button size="sm" iconLeft={RotateCw} label="Try again" onClick={onRetry} />
      </div>
    );
  } else if (loading) {
    body = (
      <div className="catg-split__loading" aria-busy="true">
        <Skeleton circle width={160} height={160} />
        <Skeleton height={12} width="80%" />
        <Skeleton height={12} width="64%" />
        <Skeleton height={12} width="72%" />
      </div>
    );
  } else if (!data.length) {
    body = (
      <EmptyState
        size="sm"
        icon={PieChart}
        title={`No spending in ${month.short}`}
      />
    );
  } else {
    body = (
      <DonutChart
        className="catg-split__chart"
        data={data}
        size={160}
        centerLabel="Spent"
        centerValue={inrCompact(total)}
        legend="right"
        maxSlices={NAMED_SLICES + 1}
        othersLabel={moreLabel}
        ariaLabel={`Spending by category in ${month.label}`}
      />
    );
  }

  return (
    <Card as="section" className={`catg-split ${className}`.trim()} title="Spending by category" description={month.label}>
      {body}
    </Card>
  );
}
