import { Button, FormLabel, Sheet, TabButtons } from '../../components/ui';
import { TransactionPeriodFilter } from '../../components/transactions/TransactionFilters.jsx';
import { TABS } from './memoModel.js';

/**
 * Phone filters in a bottom sheet, like Transactions' (TransactionFilterSheet):
 * the period (the same month picker / date range as the desktop toolbar) and
 * the segment. Each control applies at once, so the list behind the sheet and
 * "Show N results" follow along; Clear puts both back. Search stays on the page.
 */
export default function MemoFilterSheet({
  open,
  onClose,
  activeCount,
  onReset,
  tab,
  onTabChange,
  start,
  end,
  onRangeChange,
  monthOptions,
  resultCount,
  loading = false,
}) {
  const showLabel = loading || resultCount == null
    ? 'Show results'
    : `Show ${resultCount} result${resultCount === 1 ? '' : 's'}`;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      title="Filters"
      className="memos-m-filter-sheet"
      footer={(
        <>
          <Button size="lg" label="Clear" disabled={!activeCount} onClick={onReset} />
          <Button size="lg" variant="solid" label={showLabel} loading={loading} onClick={onClose} />
        </>
      )}
    >
      <div className="memos-m-filters">
        <div className="memos-m-filters__field">
          <FormLabel as="div" label="Period" />
          <TransactionPeriodFilter
            stacked
            size="lg"
            rangeStart={start}
            rangeEnd={end}
            onChange={onRangeChange}
            monthOptions={monthOptions}
          />
        </div>
        <div className="memos-m-filters__field">
          <FormLabel as="div" label="Show" />
          <TabButtons
            fluid
            size="md"
            aria-label="Show"
            options={TABS.map((t) => ({ label: t.label, value: t.id }))}
            value={tab}
            onChange={onTabChange}
          />
        </div>
      </div>
    </Sheet>
  );
}
