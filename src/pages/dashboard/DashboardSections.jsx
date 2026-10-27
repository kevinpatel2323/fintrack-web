import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, ArrowRight, ChevronRight, CreditCard, Landmark, Scale, Tag, Upload, Users,
} from 'lucide-react';
import {
  Amount, Avatar, Badge, Button, Card, EmptyState, ErrorMessage, Skeleton, StatCard, TabButtons,
} from '../../components/ui';
import { BarChart, CategoryBars } from '../../components/charts';
import { CategoryBadge } from '../../components/common/Category.jsx';
import { categoryColor } from '../../utils/categoryColors.js';
import {
  OTHERS_KEY, UNCATEGORISED_KEY, balanceTotals, categoryRows, comparisonLabel, filterRecent,
  formatRangeLabel, monthBounds, monthShort, shortDate, signedAmount, transactionsLink,
} from './dashboardModel.js';

const MINUS = '−';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Ghost "View all" for a card footer, its label lined up with the rows above. */
function ViewAll({ to, label = 'View all' }) {
  return <Button className="dash-viewall" variant="ghost" label={label} iconRight={ArrowRight} to={to} />;
}

/** Placeholder rows shaped like the list they stand in for. */
function RowsSkeleton({ rows = 4, lead = 'none', twoLine = false }) {
  return (
    <ul className="dash-list" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className={`dash-skel-row${twoLine ? ' is-two-line' : ''}`}>
          {lead === 'circle' && <Skeleton circle width={28} height={28} />}
          {lead === 'square' && <Skeleton width={28} height={28} />}
          <span className="dash-skel-row__text">
            <Skeleton height={12} width={`${55 - (i % 3) * 10}%`} />
            {twoLine && <Skeleton height={10} width="30%" />}
          </span>
          <Skeleton height={12} width={64} />
        </li>
      ))}
    </ul>
  );
}

/* ── Stats ──────────────────────────────────────────────────────────────── */

function rateText(rate) {
  if (rate === null || rate === undefined) return null;
  const r = Math.round(rate);
  return `${r < 0 ? MINUS : ''}${Math.abs(r)}%`;
}

/**
 * Spent, Earned, Net and Savings rate for the range, each against the same
 * number of days just before it. Spending going up reads red.
 */
export function StatGrid({ stats, range, loading, compact = false }) {
  const vs = comparisonLabel(range, { short: compact });
  const deltaProps = (stat, deltaUnit = '%') =>
    stat.delta === null || stat.delta === undefined
      ? {}
      : { delta: stat.delta, deltaUnit, deltaLabel: vs };

  return (
    <div className="dash-stats">
      <StatCard
        label="Spent"
        value={<Amount value={stats.spent.value} tone="inherit" />}
        positiveIsGood={false}
        to={transactionsLink(range, { tab: 'spent' })}
        loading={loading}
        {...deltaProps(stats.spent)}
      />
      <StatCard
        label="Earned"
        value={<Amount value={stats.earned.value} tone="inherit" />}
        to={transactionsLink(range, { tab: 'earned' })}
        loading={loading}
        {...deltaProps(stats.earned)}
      />
      <StatCard
        label="Net"
        value={<Amount value={stats.net.value} sign="always" tone="inherit" />}
        to={transactionsLink(range)}
        loading={loading}
        {...deltaProps(stats.net)}
      />
      {/* The savings delta is in percentage points, not a percent of a percent. */}
      <StatCard
        label="Savings rate"
        value={rateText(stats.savings.value)}
        loading={loading}
        {...deltaProps(stats.savings, ' pts')}
      />
    </div>
  );
}

/* ── Needs attention ────────────────────────────────────────────────────── */

const ATTENTION_ICONS = {
  bill: CreditCard,
  import: Upload,
  review: Scale,
  uncategorised: Tag,
};

/** Rows that each go straight to where the user fixes them. Render only when there are items. */
export function AttentionCard({ items }) {
  return (
    <Card
      as="section"
      padding="none"
      className="dash-attention"
      title={
        <span className="dash-card-title">
          Needs attention
          <Badge label={items.length} />
        </span>
      }
    >
      <ul className="dash-list">
        {items.map((item) => {
          const Icon = ATTENTION_ICONS[item.kind] ?? ArrowRight;
          return (
            <li key={item.key}>
              <Link to={item.to} className={`dash-attn${item.tone === 'due' ? ' is-due' : ''}`}>
                <span className="dash-tile">
                  <Icon size={16} strokeWidth={1.5} aria-hidden />
                </span>
                <span className="dash-row-text">
                  <span className="dash-row-title truncate">{item.title}</span>
                  <span className="dash-row-meta dash-attn__detail truncate">{item.detail}</span>
                </span>
                {item.amount !== undefined && (
                  <Amount
                    className="dash-row-amount"
                    value={item.amount}
                    sign="never"
                    tone={item.tone === 'due' ? 'due' : 'out'}
                  />
                )}
                <span className="dash-attn__action">{item.action}</span>
                <ChevronRight className="dash-chevron" size={16} strokeWidth={1.5} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ── Income vs expenses ─────────────────────────────────────────────────── */

const TREND_OPTIONS = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '1Y', value: 12 },
];
const TREND_DESCRIPTION = { 3: 'Last 3 months', 6: 'Last 6 months', 12: 'Last 12 months' };
const TREND_SERIES = [
  { key: 'spent', label: 'Spent', color: 'var(--chart-out)' },
  { key: 'earned', label: 'Earned', color: 'var(--chart-in)' },
];

/** Monthly spent vs earned. A bar opens that month's transactions. */
export function TrendCard({ trends, loading, height = 240 }) {
  const navigate = useNavigate();
  const [months, setMonths] = useState(6);
  const rows = useMemo(
    () =>
      (trends ?? []).slice(-months).map((t) => ({
        month: t.month,
        spent: Number(t.totalSpent) || 0,
        earned: Number(t.totalIncome) || 0,
      })),
    [trends, months],
  );
  // Months with nothing in them would draw bare axes; show the empty state.
  const hasActivity = rows.some((r) => r.spent || r.earned);

  return (
    <Card
      as="section"
      className="dash-trend"
      title="Income vs expenses"
      description={TREND_DESCRIPTION[months]}
      actions={
        <TabButtons options={TREND_OPTIONS} value={months} onChange={setMonths} aria-label="Months shown" />
      }
    >
      {loading ? (
        <div aria-busy="true">
          <Skeleton height={height} />
        </div>
      ) : (
        <BarChart
          data={hasActivity ? rows : []}
          xKey="month"
          series={TREND_SERIES}
          height={height}
          formatXLabel={monthShort}
          emptyText="No transactions in these months"
          ariaLabel={`Spent and earned per month, ${TREND_DESCRIPTION[months].toLowerCase()}`}
          onBarClick={(row, key) =>
            navigate(transactionsLink(monthBounds(row.month), { tab: key === 'earned' ? 'earned' : 'spent' }))
          }
        />
      )}
    </Card>
  );
}

/* ── Spending by category ───────────────────────────────────────────────── */

function rowColor(row) {
  if (row.key === UNCATEGORISED_KEY) return 'var(--ink-gray-5)';
  if (row.key === OTHERS_KEY) return 'var(--ink-gray-4)';
  return categoryColor(row.category);
}

/** Ranked category spend for the range; the tail folds into one row so shares add up. */
export function CategoryCard({ breakdown, range, loading, limit = 5 }) {
  const rows = useMemo(() => categoryRows(breakdown, limit), [breakdown, limit]);
  return (
    <Card
      as="section"
      className="dash-categories"
      title="Spending by category"
      description={formatRangeLabel(range)}
      footer={<ViewAll to="/categories" />}
    >
      {loading ? (
        <RowsSkeleton rows={limit} />
      ) : (
        <CategoryBars
          items={rows.map((r) => ({
            key: r.key,
            label: r.label,
            value: r.value,
            color: rowColor(r),
            hint: plural(r.count, 'txn'),
          }))}
          sorted={false}
          showPercent
          emptyText="No spending in this range"
          ariaLabel="Spending by category"
        />
      )}
    </Card>
  );
}

/* ── Recent activity ────────────────────────────────────────────────────── */

const ACTIVITY_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Spent', value: 'spent' },
  { label: 'Earned', value: 'earned' },
];

function RecentEmpty({ filter, total }) {
  if (filter === 'all' || total === 0) {
    return (
      <EmptyState
        size="sm"
        icon={ArrowLeftRight}
        title="No transactions yet"
        description="Import a bank statement to see your activity here."
        action={<Button label="Import statement" iconLeft={Upload} to="/import" />}
      />
    );
  }
  return (
    <EmptyState
      size="sm"
      icon={ArrowLeftRight}
      title={filter === 'spent' ? 'No spending in recent activity' : 'Nothing earned in recent activity'}
      description={`None of the latest ${plural(total, 'transaction')} ${filter === 'spent' ? 'is a withdrawal' : 'is a deposit'}.`}
    />
  );
}

/** The latest bank transactions; each row opens the transaction. */
export function RecentCard({ items, loading, limit = 10 }) {
  const [filter, setFilter] = useState('all');
  const all = items ?? [];
  const rows = filterRecent(all, filter).slice(0, limit);

  return (
    <Card
      as="section"
      padding="none"
      className="dash-recent"
      title="Recent activity"
      actions={
        <TabButtons options={ACTIVITY_OPTIONS} value={filter} onChange={setFilter} aria-label="Show transactions" />
      }
      footer={<ViewAll to="/transactions" />}
    >
      {loading ? (
        <RowsSkeleton rows={Math.min(limit, 6)} />
      ) : rows.length === 0 ? (
        <RecentEmpty filter={filter} total={all.length} />
      ) : (
        <ul className="dash-list" aria-label="Recent transactions">
          {rows.map((tx, i) => {
            const name = tx.upiName || tx.narration || 'Transaction';
            const note = tx.upiName && tx.upiDescription ? tx.upiDescription : '';
            return (
              <li key={tx.id ?? i}>
                <Link to={`/transactions/${tx.id}`} state={{ tx }} className="dash-txn">
                  <span className="dash-txn__date tabular-nums" title={shortDate(tx.transactionDate, { withYear: true })}>
                    {shortDate(tx.transactionDate)}
                  </span>
                  <span className="dash-txn__name truncate" title={name}>
                    {name}
                    {note && <span className="dash-txn__note"> · {note}</span>}
                  </span>
                  <span className="dash-txn__cat">
                    <CategoryBadge category={tx.category} />
                  </span>
                  <Amount className="dash-txn__amount" value={signedAmount(tx)} sign="always" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── People ─────────────────────────────────────────────────────────────── */

/** Open balances, largest first (API order); each row opens the person. */
export function PeopleCard({ balances, loading, limit = 5 }) {
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
    <Card
      as="section"
      padding="none"
      className="dash-people"
      title="People"
      description={totals}
      footer={<ViewAll to="/friends" />}
    >
      {loading ? (
        <RowsSkeleton rows={4} lead="circle" twoLine />
      ) : list.length === 0 ? (
        <EmptyState size="sm" icon={Users} title="Everyone is settled up" description="No one owes you and you owe no one." />
      ) : (
        <ul className="dash-list">
          {list.slice(0, limit).map((f) => {
            const n = Number(f.netBalance) || 0;
            return (
              <li key={f.friendId}>
                <Link to={`/friends/${f.friendId}`} className="dash-row">
                  <Avatar label={f.friendName} size="lg" aria-hidden />
                  <span className="dash-row-text">
                    <span className="dash-row-title truncate">{f.friendName}</span>
                    <span className="dash-row-meta">{Math.abs(n) < 1 ? 'Settled' : n > 0 ? 'Owes you' : 'You owe'}</span>
                  </span>
                  <Amount className="dash-row-amount" value={Math.abs(n)} sign="never" tone="out" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── Accounts ───────────────────────────────────────────────────────────── */

/** Bank accounts with the balance from their latest transaction. */
export function AccountsCard({ accounts, loading }) {
  const list = accounts ?? [];
  return (
    <Card as="section" padding="none" className="dash-accounts" title="Accounts">
      {loading ? (
        <RowsSkeleton rows={2} lead="square" twoLine />
      ) : list.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Landmark}
          title="No bank accounts yet"
          description="Import a bank statement to add one."
          action={<Button label="Import statement" iconLeft={Upload} to="/import" />}
        />
      ) : (
        <ul className="dash-list">
          {list.map((a) => {
            const last4 = String(a.accountNumber || '').slice(-4);
            const asOf = shortDate(a.lastTransactionDate, { withYear: true });
            const count = Number(a.transactionCount) || 0;
            return (
              <li key={a.accountId || a.accountNumber} className="dash-row is-static">
                <span className="dash-tile">
                  <Landmark size={16} strokeWidth={1.5} aria-hidden />
                </span>
                <span className="dash-row-text">
                  <span className="dash-row-title truncate">HDFC •• {last4}</span>
                  <span className="dash-row-meta truncate">
                    {asOf ? `Balance as of ${asOf}` : 'No transactions yet'}
                    {count > 0 ? ` · ${count.toLocaleString('en-IN')} transactions` : ''}
                  </span>
                </span>
                <Amount className="dash-row-amount" value={Number(a.currentBalance) || 0} tone="out" />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── Error ──────────────────────────────────────────────────────────────── */

export function DashboardError({ error, onRetry }) {
  return (
    <Card className="dash-error">
      <div className="dash-error__body">
        <ErrorMessage message={error} />
        <Button label="Retry" onClick={onRetry} />
      </div>
    </Card>
  );
}
