import { useEffect, useMemo, useState } from 'react';
import { Button, DateRangePicker, FormControl, FormLabel, Select, Sheet, TabButtons } from '../ui';
import { categoryColor } from '../../utils/categoryColors.js';
import { getLast30DayRange } from '../../utils/dateUtils.js';
import { getCurrentMonthRange, matchMonthValue } from './transactionListModel.js';
import './transactions.css';

/** All / Spent / Earned — the list's `tab` URL param. */
export const TYPE_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Spent', value: 'spent' },
  { label: 'Earned', value: 'earned' },
];

export function accountOptions(accounts) {
  return [{ label: 'All accounts', value: '' }, ...(accounts || []).map((a) => ({ label: a, value: a }))];
}

/** Category filter choices: Uncategorised first, then each category with its colour dot. */
export function useCategoryFilterOptions(categories) {
  return useMemo(() => [
    {
      label: 'Uncategorised',
      value: '__none__',
      icon: <span className="txl-dot txl-dot--empty" aria-hidden="true" />,
    },
    ...(categories || []).map((c) => ({
      label: c.name,
      value: String(c.id),
      // Category colour is per-record data, so it is set inline.
      icon: <span className="txl-dot" style={{ background: categoryColor(c) }} aria-hidden="true" />,
    })),
  ], [categories]);
}

/**
 * Period control: a month picker (the last 24 months), and a date range once
 * "Custom range" is picked or the URL holds a range that is not one month.
 * Writes through `onChange(startIso, endIso)`.
 */
export function TransactionPeriodFilter({ rangeStart, rangeEnd, onChange, monthOptions, stacked = false }) {
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
 * Phone filters in a bottom sheet. Every control applies at once (the list
 * updates behind the sheet); Reset puts all of them back, period included.
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
  accounts,
  account,
  onAccountChange,
  categoryOptions,
  category,
  onCategoryChange,
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      title="Filters"
      footer={(
        <>
          <Button label="Reset" disabled={!activeCount} onClick={onReset} />
          <Button variant="solid" label="Done" onClick={onClose} />
        </>
      )}
    >
      <div className="txl-filters">
        <div className="txl-filters__field">
          <FormLabel as="div" label="Type" />
          <TabButtons fluid aria-label="Type" options={TYPE_OPTIONS} value={filterTab} onChange={onFilterTabChange} />
        </div>
        <div className="txl-filters__field">
          <FormLabel as="div" label="Period" />
          <TransactionPeriodFilter
            stacked
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onChange={onRangeChange}
            monthOptions={monthOptions}
          />
        </div>
        <FormControl
          type="select"
          label="Account"
          options={accountOptions(accounts)}
          value={account}
          onChange={(e) => onAccountChange(e.target.value)}
        />
        <FormControl
          type="combobox"
          label="Category"
          options={categoryOptions}
          value={category || null}
          onChange={(value) => onCategoryChange(value || '')}
          placeholder="All categories"
          searchPlaceholder="Search categories"
          clearable
        />
      </div>
    </Sheet>
  );
}
