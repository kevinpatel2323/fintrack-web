import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChevronDown, Landmark, Upload, Users } from 'lucide-react';
import {
  Amount, Avatar, Button, Dialog, Dropdown, EmptyState, FormControl, MobileList, MobileListItem,
  MobileSection, PageBody, Skeleton, StatCard, TabButtons,
} from '../../components/ui';
import { CategoryBars } from '../../components/charts';
import { CategoryIcon } from '../../components/common/Category.jsx';
import {
  OTHERS_KEY, UNCATEGORISED_KEY, balanceTotals, categoryRows, filterRecent, formatRangeLabel, matchPreset,
  rangeDays, shortDate, signedAmount, transactionsLink,
} from './dashboardModel.js';
import {
  ACTIVITY_OPTIONS, ATTENTION_ICONS, DashboardError, RecentEmpty, TREND_DESCRIPTION, TREND_OPTIONS, TrendChart,
  categoryItems, rateText,
} from './DashboardSections.jsx';
import './DashboardPhone.css';

/*
 * Home on phones (< 768px), after frappe-ui's AccountingMobile recipe: one
 * column of sections rather than a stack of cards. Period, four figure tiles,
 * what needs attention, then recent activity, spending by category, people,
 * the monthly chart and accounts. Same data and links as the desktop
 * dashboard (Dashboard.jsx owns the state; DashboardSections.jsx the shared
 * pieces).
 */

const cx = (...parts) => parts.filter(Boolean).join(' ');

export default function DashboardPhone({ data, loading, error, onRetry, range, onRangeChange, presets, stats, attention }) {
  const firstLoad = loading && !data;
  const refreshing = loading && Boolean(data);
  const hasContent = Boolean(data) || loading;

  return (
    <PageBody className="home-page">
      <PeriodControl presets={presets} range={range} onChange={onRangeChange} />
      {error && !loading && <DashboardError error={error} onRetry={onRetry} />}
      <div className={cx('home-body', refreshing && 'is-refreshing')} aria-busy={loading || undefined}>
        {hasContent && <Figures stats={stats} range={range} loading={loading} />}
        {attention.length > 0 && <AttentionSection items={attention} />}
        {hasContent && (
          <>
            <RecentSection items={data?.recentTransactions} loading={firstLoad} />
            <CategorySection breakdown={data?.categoryBreakdown} range={range} loading={firstLoad} />
            <PeopleSection balances={data?.friendBalances} loading={firstLoad} />
            <TrendSection trends={data?.monthlyTrends} loading={firstLoad} />
            <AccountsSection accounts={data?.accountSummary} loading={firstLoad} />
          </>
        )}
      </div>
    </PageBody>
  );
}

/* ── Period ─────────────────────────────────────────────────────────────── */

/**
 * The range as a compact menu button: the presets (an action sheet on
 * phones) plus "Custom range", which asks for the two dates.
 */
function PeriodControl({ presets, range, onChange }) {
  const [customOpen, setCustomOpen] = useState(false);
  const current = matchPreset(presets, range);

  const options = [
    {
      group: 'Presets',
      hideLabel: true,
      items: presets.map((p) => ({
        label: p.label,
        selected: current?.key === p.key,
        onClick: () => onChange({ startDate: p.value.start, endDate: p.value.end }),
      })),
    },
    {
      group: 'Custom',
      hideLabel: true,
      items: [{ label: 'Custom range…', icon: CalendarDays, selected: !current, onClick: () => setCustomOpen(true) }],
    },
  ];

  return (
    <div className="home-period">
      <Dropdown options={options} label="Period">
        <Button
          className="home-period__button"
          iconLeft={CalendarDays}
          iconRight={ChevronDown}
          label={current ? current.label : 'Custom range'}
          aria-label={`Period: ${current ? current.label : formatRangeLabel(range)}`}
        />
      </Dropdown>
      <span className="home-period__dates tabular-nums">{formatRangeLabel(range)}</span>
      <CustomRangeDialog
        open={customOpen}
        range={range}
        onClose={() => setCustomOpen(false)}
        onApply={(next) => {
          onChange(next);
          setCustomOpen(false);
        }}
      />
    </div>
  );
}

/** Any range, as the desktop date-range picker allows: a From and a To date. */
function CustomRangeDialog({ open, range, onClose, onApply }) {
  const [draft, setDraft] = useState({ start: range.startDate, end: range.endDate });
  const [wasOpen, setWasOpen] = useState(open);
  // Start from the range on screen each time the sheet opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft({ start: range.startDate, end: range.endDate });
  }
  const ready = Boolean(draft.start && draft.end);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Custom range"
      size="sm"
      actions={[
        { label: 'Cancel' },
        {
          label: 'Show range',
          variant: 'solid',
          disabled: !ready,
          onClick: () => {
            // Either order works, as it does in the desktop picker.
            const [startDate, endDate] = [draft.start, draft.end].sort();
            onApply({ startDate, endDate });
          },
        },
      ]}
    >
      <FormControl
        type="date"
        label="From"
        value={draft.start}
        onChange={(start) => setDraft((d) => ({ ...d, start }))}
      />
      <FormControl type="date" label="To" value={draft.end} onChange={(end) => setDraft((d) => ({ ...d, end }))} />
    </Dialog>
  );
}

/* ── Figures ────────────────────────────────────────────────────────────── */

/**
 * Spent, Earned, Net and Savings rate as 2×2 kit StatCard tiles (compact on
 * phones), each with its change against the same number of days just before
 * the range; one line under the tiles says what they compare with.
 */
function Figures({ stats, range, loading }) {
  const days = rangeDays(range?.startDate, range?.endDate);
  const versus = days <= 1 ? 'the previous day' : `the previous ${days} days`;
  const anyDelta = ['spent', 'earned', 'net', 'savings'].some((k) => typeof stats[k].delta === 'number');
  const delta = (stat, deltaUnit = '%') =>
    typeof stat.delta === 'number' ? { delta: stat.delta, deltaUnit } : {};

  return (
    <MobileSection aria-label="Summary" className="home-figures">
      <div className="home-tiles">
        <StatCard
          label="Spent"
          value={<Amount value={stats.spent.value} tone="inherit" />}
          positiveIsGood={false}
          to={transactionsLink(range, { tab: 'spent' })}
          loading={loading}
          {...delta(stats.spent)}
        />
        <StatCard
          label="Earned"
          value={<Amount value={stats.earned.value} tone="inherit" />}
          to={transactionsLink(range, { tab: 'earned' })}
          loading={loading}
          {...delta(stats.earned)}
        />
        <StatCard
          label="Net"
          value={<Amount value={stats.net.value} sign="always" tone="inherit" />}
          to={transactionsLink(range)}
          loading={loading}
          {...delta(stats.net)}
        />
        {/* The savings delta is in percentage points, not a percent of a percent. */}
        <StatCard
          label="Savings rate"
          value={rateText(stats.savings.value)}
          loading={loading}
          {...delta(stats.savings, ' pts')}
        />
      </div>
      {!loading && anyDelta && <p className="home-figures__caption">Changes compare with {versus}.</p>}
    </MobileSection>
  );
}

/* ── Shared bits ────────────────────────────────────────────────────────── */

/** A 32px gray tile holding a 16px icon (the leading slot of a row). */
function IconTile({ icon: Icon }) {
  return (
    <span className="home-icon-tile">
      <Icon size={16} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

/** Placeholder rows shaped like the phone list they stand in for. */
function RowsSkeleton({ rows = 4, lead = 'square' }) {
  return (
    <div className="home-skel" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="home-skel__row">
          {lead && <Skeleton circle={lead === 'circle'} width={32} height={32} />}
          <span className="home-skel__text">
            <Skeleton height={14} width={`${62 - (i % 3) * 12}%`} />
            <Skeleton height={11} width="34%" />
          </span>
          <Skeleton height={14} width={64} />
        </div>
      ))}
    </div>
  );
}

/* ── Needs attention ────────────────────────────────────────────────────── */

/** Each row goes straight to where the user fixes it. */
function AttentionSection({ items }) {
  return (
    <MobileSection title="Needs attention" className="home-attention">
      <MobileList aria-label="Needs attention">
        {items.map((item) => (
          <MobileListItem
            key={item.key}
            to={item.to}
            leading={<IconTile icon={ATTENTION_ICONS[item.kind] ?? ArrowRight} />}
            title={item.title}
            subtitle={<span className={item.tone === 'due' ? 'home-due' : undefined}>{item.detail}</span>}
            value={
              item.amount !== undefined ? (
                <Amount value={item.amount} sign="never" tone={item.tone === 'due' ? 'due' : 'out'} />
              ) : undefined
            }
            chevron
          />
        ))}
      </MobileList>
    </MobileSection>
  );
}

/* ── Recent activity ────────────────────────────────────────────────────── */

function RecentSection({ items, loading, limit = 5 }) {
  const [filter, setFilter] = useState('all');
  const all = items ?? [];
  const rows = filterRecent(all, filter).slice(0, limit);

  return (
    <MobileSection title="Recent activity" action={{ label: 'View all', to: '/transactions' }}>
      {/* Nothing to filter until there is activity. */}
      {(loading || all.length > 0) && (
        <TabButtons
          className="home-segment"
          fluid
          options={ACTIVITY_OPTIONS}
          value={filter}
          onChange={setFilter}
          aria-label="Show transactions"
        />
      )}
      {loading ? (
        <RowsSkeleton rows={limit} />
      ) : rows.length === 0 ? (
        <RecentEmpty filter={filter} total={all.length} />
      ) : (
        <MobileList aria-label="Recent transactions">
          {rows.map((tx, i) => {
            const name = tx.upiName || tx.narration || 'Transaction';
            const category = tx.category?.name || 'Uncategorised';
            return (
              <MobileListItem
                key={tx.id ?? i}
                to={`/transactions/${tx.id}`}
                state={{ tx }}
                leading={<CategoryIcon category={tx.category} size={32} />}
                title={name}
                subtitle={`${shortDate(tx.transactionDate)} · ${category}`}
                value={<Amount value={signedAmount(tx)} sign="always" />}
              />
            );
          })}
        </MobileList>
      )}
    </MobileSection>
  );
}

/* ── Spending by category ───────────────────────────────────────────────── */

/** Ranked spend; a category opens its transactions for the range. */
function CategorySection({ breakdown, range, loading, limit = 5 }) {
  const rows = useMemo(() => categoryRows(breakdown, limit), [breakdown, limit]);
  const items = useMemo(
    () =>
      categoryItems(rows).map((item, i) => {
        const row = rows[i];
        if (row.key === OTHERS_KEY) return item;
        const category = row.key === UNCATEGORISED_KEY ? 'none' : row.key;
        return { ...item, to: transactionsLink(range, { tab: 'spent', extra: { category } }) };
      }),
    [rows, range],
  );

  return (
    <MobileSection
      title="Spending by category"
      description={formatRangeLabel(range)}
      action={{ label: 'View all', to: '/categories' }}
    >
      {loading ? (
        <RowsSkeleton rows={3} lead={null} />
      ) : (
        <CategoryLinks items={items} />
      )}
    </MobileSection>
  );
}

/**
 * CategoryBars, with each row that has a `to` opening it. CategoryBars rows
 * take an onClick; the link itself goes through the router.
 */
function CategoryLinks({ items }) {
  const navigate = useNavigate();
  return (
    <CategoryBars
      className="home-catbars"
      items={items.map(({ to, ...item }) => (to ? { ...item, onClick: () => navigate(to) } : item))}
      sorted={false}
      showPercent
      emptyText="No spending in this range"
      ariaLabel="Spending by category"
    />
  );
}

/* ── People ─────────────────────────────────────────────────────────────── */

function PeopleSection({ balances, loading, limit = 5 }) {
  const list = balances ?? [];
  const { owedToYou, youOwe } = balanceTotals(list);
  const totals =
    loading || (owedToYou <= 0 && youOwe <= 0) ? undefined : (
      <>
        {owedToYou > 0 && (
          <>
            <Amount value={owedToYou} tone="inherit" /> owed to you
          </>
        )}
        {owedToYou > 0 && youOwe > 0 && ' · '}
        {youOwe > 0 && (
          <>
            <Amount value={youOwe} tone="inherit" /> you owe
          </>
        )}
      </>
    );

  return (
    <MobileSection title="People" description={totals} action={{ label: 'View all', to: '/friends' }}>
      {loading ? (
        <RowsSkeleton rows={3} lead="circle" />
      ) : list.length === 0 ? (
        <EmptyState size="sm" icon={Users} title="Everyone is settled up" description="No one owes you and you owe no one." />
      ) : (
        <MobileList aria-label="People">
          {list.slice(0, limit).map((f) => {
            const n = Number(f.netBalance) || 0;
            return (
              <MobileListItem
                key={f.friendId}
                to={`/friends/${f.friendId}`}
                leading={<Avatar label={f.friendName} size="xl" aria-hidden />}
                title={f.friendName}
                subtitle={Math.abs(n) < 1 ? 'Settled' : n > 0 ? 'Owes you' : 'You owe'}
                value={<Amount value={Math.abs(n)} sign="never" tone="out" />}
              />
            );
          })}
        </MobileList>
      )}
    </MobileSection>
  );
}

/* ── Income vs expenses ─────────────────────────────────────────────────── */

function TrendSection({ trends, loading }) {
  const [months, setMonths] = useState(6);
  return (
    <MobileSection
      title="Income vs expenses"
      description={TREND_DESCRIPTION[months]}
      aside={<TabButtons options={TREND_OPTIONS} value={months} onChange={setMonths} aria-label="Months shown" />}
    >
      <div className="home-chart">
        <TrendChart trends={trends} months={months} loading={loading} height={208} />
      </div>
    </MobileSection>
  );
}

/* ── Accounts ───────────────────────────────────────────────────────────── */

function AccountsSection({ accounts, loading }) {
  const list = accounts ?? [];
  return (
    <MobileSection title="Accounts">
      {loading ? (
        <RowsSkeleton rows={2} />
      ) : list.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Landmark}
          title="No bank accounts yet"
          description="Import a bank statement to add one."
          action={<Button label="Import statement" iconLeft={Upload} to="/import" />}
        />
      ) : (
        <MobileList aria-label="Accounts">
          {list.map((a) => {
            const last4 = String(a.accountNumber || '').slice(-4);
            const asOf = shortDate(a.lastTransactionDate, { withYear: true });
            const count = Number(a.transactionCount) || 0;
            return (
              <MobileListItem
                key={a.accountId || a.accountNumber}
                leading={<IconTile icon={Landmark} />}
                title={`HDFC •• ${last4}`}
                subtitle={asOf ? `Balance as of ${asOf}` : 'No transactions yet'}
                value={<Amount value={Number(a.currentBalance) || 0} tone="out" />}
                valueSub={count > 0 ? `${count.toLocaleString('en-IN')} txns` : undefined}
              />
            );
          })}
        </MobileList>
      )}
    </MobileSection>
  );
}
