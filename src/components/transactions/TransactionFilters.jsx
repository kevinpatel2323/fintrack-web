import { useEffect, useMemo, useState } from 'react';
import { Button, DateRangePicker, FormControl, FormLabel, Select, Sheet, TabButtons } from '../ui';
import { categoryOptions } from '../common/Category.jsx';
import { accountChoices } from '../../utils/accounts.js';
import { getLast30DayRange } from '../../utils/dateUtils.js';
import { getCurrentMonthRange, matchMonthValue } from './transactionListModel.js';
import './transactions.css';

/** All / Spent / Earned — the list's `tab` URL param. */
export const TYPE_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Spent', value: 'spent' },
  { label: 'Earned', value: 'earned' },
];

/** "All accounts", then each account by its holder's name (`accountNames` from `useAccountNames()`). */
export function accountOptions(accountNames) {
  return [{ label: 'All accounts', value: '' }, ...accountChoices(accountNames)];
}

/** Category filter choices: Uncategorised first, then each category with its tile. */
export function useCategoryFilterOptions(categories) {
  return useMemo(
    () => categoryOptions(categories || [], { label: 'Uncategorised', value: '__none__' }),
    [categories],
  );
}

/**
 * Period control: a month picker (the last 24 months), and a date range once
 * "Custom range" is picked or the URL holds a range that is not one month.
 * Writes through `onChange(startIso, endIso)`.
 */
export function TransactionPeriodFilter({ rangeStart, rangeEnd, onChange, monthOptions, stacked = false, size }) {
  // Only the phone sheet passes a size; the desktop toolbar keeps the default.
  const sizeProps = size ? { size } : {};
  const selectedMonth = matchMonthValue(rangeStart, rangeEnd, monthOptions);
  const [custom, setCustom] = useState(false);

  // A new range (from here, a preset or "Clear filters") ends custom mode;
  // it comes straight back when the range is not a whole month.
  useEffect(() => {
    setCustom(false);
  }, [rangeStart, rangeEnd]);

  const showRange = custom || !selectedMonth;

  const presets = useMemo(() => {
    const month = getCurrentMonthRange();
    const last30 = getLast30DayRange();
    const prev = monthOptions[1];
    return [
      { label: 'This month', value: { start: month.startIso, end: month.endIso } },
      ...(prev ? [{ label: 'Last month', value: { start: prev.startIso, end: prev.endIso } }] : []),
      { label: 'Last 30 days', value: { start: last30.startIso, end: last30.endIso } },
    ];
  }, [monthOptions]);

  return (
    <div className={stacked ? 'txl-period txl-period--stacked' : 'txl-period'}>
      <Select
        {...sizeProps}
        aria-label="Month"
        className="txl-period__month"
        options={[
          ...monthOptions.map((m) => ({ label: m.label, value: m.value })),
          { label: 'Custom range', value: 'custom' },
        ]}
        value={showRange ? 'custom' : selectedMonth}
        onChange={(e) => {
          const { value } = e.target;
          if (value === 'custom') {
            setCustom(true);
            return;
          }
          const m = monthOptions.find((o) => o.value === value);
          if (!m) return;
          // Re-picking the month already in range changes nothing upstream,
          // so leave custom mode here rather than waiting for a new range.
          setCustom(false);
          onChange(m.startIso, m.endIso);
        }}
      />
      {showRange && (
        <DateRangePicker
          {...sizeProps}
          aria-label="Date range"
          className="txl-period__range"
          value={{ start: rangeStart, end: rangeEnd }}
          onChange={({ start, end }) => {
            if (start && end) onChange(start, end);
          }}
          presets={presets}
        />
      )}
    </div>
  );
}

/**
 * Phone filters in a bottom sheet (HRMS / frappe-ui mobile): every filter the
 * desktop toolbar has, one per row. Each control applies at once, so the list
 * behind the sheet and the "Show N results" count follow along; Clear puts
 * them all back, period included. Search stays on the page.
 */
export function TransactionFilterSheet({
  open,
  onClose,
  activeCount,
  onReset,
  filterTab,
  onFilterTabChange,
  rangeStart,
  rangeEnd,
  onRangeChange,
  monthOptions,
  accountNames,
  account,
  onAccountChange,
  categoryOptions,
  category,
  onCategoryChange,
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
      className="txl-filter-sheet"
      footer={(
        <>
          <Button size="lg" label="Clear" disabled={!activeCount} onClick={onReset} />
          <Button size="lg" variant="solid" label={showLabel} loading={loading} onClick={onClose} />
        </>
      )}
    >
      <div className="txl-filters">
        <div className="txl-filters__field">
          <FormLabel as="div" label="Period" />
          <TransactionPeriodFilter
            stacked
            size="lg"
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onChange={onRangeChange}
            monthOptions={monthOptions}
          />
        </div>
        <div className="txl-filters__field">
          <FormLabel as="div" label="Type" />
          <TabButtons
            fluid
            size="md"
            aria-label="Type"
            options={TYPE_OPTIONS}
            value={filterTab}
            onChange={onFilterTabChange}
          />
        </div>
        <FormControl
          type="combobox"
          size="lg"
          label="Category"
          options={categoryOptions}
          value={category || null}
          onChange={(value) => onCategoryChange(value || '')}
          placeholder="All categories"
          searchPlaceholder="Search categories"
          clearable
        />
        <FormControl
          type="select"
          size="lg"
          label="Account"
          options={accountOptions(accountNames)}
          value={account}
          onChange={(e) => onAccountChange(e.target.value)}
        />
      </div>
    </Sheet>
  );
}
