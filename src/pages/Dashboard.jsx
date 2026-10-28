import { useMemo, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button, DateRangePicker, PageBody, PageHeader } from '../components/ui';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { useImportSchedule } from '../hooks/useImportSchedule.js';
import { useReviewSummary } from '../hooks/useReviewSummary.js';
import { useIsCompact } from '../styles/breakpoints.js';
import { attentionItems, defaultDateRange, rangePresets, summaryStats } from './dashboard/dashboardModel.js';
import { useCardDues } from './dashboard/useCardDues.js';
import {
  AccountsCard, AttentionCard, CategoryCard, DashboardError, PeopleCard, RecentCard, StatGrid, TrendCard,
} from './dashboard/DashboardSections.jsx';
import DashboardPhone from './dashboard/DashboardPhone.jsx';
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
  const statGrid = hasContent && <StatGrid stats={stats} range={dateRange} loading={loading} />;

  if (isMobile) {
    // Phones get their own layout: one column of sections (dashboard/DashboardPhone.jsx).
    return (
      <>
        {header}
        <DashboardPhone
          data={data}
          loading={loading}
          error={error}
          onRetry={refresh}
          range={dateRange}
          onRangeChange={setDateRange}
          presets={presets}
          stats={stats}
          attention={attention}
        />
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
