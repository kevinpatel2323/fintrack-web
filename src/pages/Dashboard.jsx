import { useMemo, useState } from 'react';
import { CalendarDays, Plus, Upload } from 'lucide-react';
import { Button, DateRangePicker, PageBody, PageHeader, Select } from '../components/ui';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { useImportSchedule } from '../hooks/useImportSchedule.js';
import { useReviewSummary } from '../hooks/useReviewSummary.js';
import { useIsCompact } from '../styles/breakpoints.js';
import {
  attentionItems, defaultDateRange, formatRangeLabel, matchPreset, rangePresets, summaryStats,
} from './dashboard/dashboardModel.js';
import { useCardDues } from './dashboard/useCardDues.js';
import {
  AccountsCard, AttentionCard, CategoryCard, DashboardError, PeopleCard, RecentCard, StatGrid, TrendCard,
} from './dashboard/DashboardSections.jsx';
import './Dashboard.css';

// "New transaction" opens the Transactions page, as it always has; this state
// asks that page to open its new-transaction form straight away (it lands on
// the list, where "New transaction" is the primary action, either way).
const NEW_TRANSACTION_STATE = { openNewTransaction: true };

export default function Dashboard() {
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const { data, loading, error, refresh } = useDashboardData(dateRange, '');
  const isMobile = useIsCompact();

  const { data: schedule } = useImportSchedule();
  const { data: review } = useReviewSummary();
  const dues = useCardDues();

  // Presets are relative to today; work them out once per visit.
  const presets = useMemo(() => rangePresets(), []);
  const stats = useMemo(() => summaryStats(data), [data]);
  const attention = useMemo(
    () =>
      attentionItems({
        dues,
        schedule,
        review,
        // Only from a settled response, so the count matches the range shown.
        breakdown: loading ? null : data?.categoryBreakdown,
        range: dateRange,
      }),
    [dues, schedule, review, loading, data, dateRange],
  );

  const firstLoad = loading && !data;
  const refreshing = loading && Boolean(data);
  const hasContent = Boolean(data) || loading;

  const setRange = ({ start, end }) => {
    // Clearing the field is not a range; keep the current one.
    if (start && end) setDateRange({ startDate: start, endDate: end });
  };

  const header = (
    <PageHeader
      title={isMobile ? 'Home' : 'Dashboard'}
      actions={
        <>
          <DateRangePicker
            className="dash-range"
            aria-label="Date range"
            value={{ start: dateRange.startDate, end: dateRange.endDate }}
            onChange={setRange}
            presets={presets.map(({ label, value }) => ({ label, value }))}
          />
          <Button iconLeft={Upload} label="Import statement" to="/import" />
          <Button
            variant="solid"
            iconLeft={Plus}
            label="New transaction"
            to="/transactions"
            state={NEW_TRANSACTION_STATE}
          />
        </>
      }
      mobileActions={
        <Button
          variant="ghost"
          size="md"
          icon={Plus}
          label="New transaction"
          to="/transactions"
          state={NEW_TRANSACTION_STATE}
        />
      }
    />
  );

  const errorPanel = error && !loading && <DashboardError error={error} onRetry={refresh} />;
  const attentionCard = attention.length > 0 && <AttentionCard items={attention} />;
  const statGrid = hasContent && (
    <StatGrid stats={stats} range={dateRange} loading={loading} compact={isMobile} />
  );

  if (isMobile) {
    return (
      <>
        {header}
        <PageBody className="dash-page">
          <MobileRangeSelect presets={presets} range={dateRange} onChange={setDateRange} />
          {errorPanel}
          {statGrid}
          {attentionCard}
          {hasContent && (
            <div className={`dash-mobile-stack${refreshing ? ' is-refreshing' : ''}`} aria-busy={loading || undefined}>
              <RecentCard items={data?.recentTransactions} loading={firstLoad} limit={5} />
              <CategoryCard breakdown={data?.categoryBreakdown} range={dateRange} loading={firstLoad} limit={3} />
              <PeopleCard balances={data?.friendBalances} loading={firstLoad} />
            </div>
          )}
        </PageBody>
      </>
    );
  }

  return (
    <>
      {header}
      <PageBody className="dash-page">
        {errorPanel}
        {statGrid}
        {attentionCard}
        {hasContent && (
          <div className={`dash-grid${refreshing ? ' is-refreshing' : ''}`} aria-busy={loading || undefined}>
            <TrendCard trends={data?.monthlyTrends} loading={firstLoad} />
            <CategoryCard breakdown={data?.categoryBreakdown} range={dateRange} loading={firstLoad} />
            <RecentCard items={data?.recentTransactions} loading={firstLoad} />
            <div className="dash-stack">
              <PeopleCard balances={data?.friendBalances} loading={firstLoad} />
              <AccountsCard accounts={data?.accountSummary} loading={firstLoad} />
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

/** Phone: the range as a preset menu (the calendar picker is too wide there). */
function MobileRangeSelect({ presets, range, onChange }) {
  const current = matchPreset(presets, range);
  const options = presets.map((p) => ({ label: p.label, value: p.key }));
  if (!current) options.unshift({ label: formatRangeLabel(range), value: 'custom', disabled: true });

  return (
    <div className="dash-mobile-range">
      <Select
        prefix={CalendarDays}
        aria-label="Date range"
        options={options}
        value={current ? current.key : 'custom'}
        onChange={(e) => {
          const preset = presets.find((p) => p.key === e.target.value);
          if (preset) onChange({ startDate: preset.value.start, endDate: preset.value.end });
        }}
      />
    </div>
  );
}
