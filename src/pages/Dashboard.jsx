import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import {
  Card, WidgetCard, Num, Pill, StatCard, Overline, SectionTitle,
  Avatar, CatGlyph, HeroAmount, PrimaryBtn, GhostBtn,
} from '../components/ui/primitives.jsx';
import {
  IcPlus, IcSearch, IcBell, IcSparkle, IcChevD, IcCal, IcUpload,
} from '../components/ui/Icon.jsx';
import { inr, inrCompact } from '../utils/inr.js';
import { friendTint, initialsOf } from '../utils/categoryColors.js';
import './dashboard-redesign.css';

function getDefaultDateRange() {
  const today = new Date();
  const thirty = new Date(today);
  thirty.setDate(today.getDate() - 30);
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startDate: f(thirty), endDate: f(today) };
}

function monthLabel(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const [dateRange] = useState(getDefaultDateRange);
  const { data, loading, error, refresh } = useDashboardData(dateRange, '');
  const isMobile = useMediaQuery('(max-width: 720px)');

  if (isMobile) return <MobileHome data={data} loading={loading} error={error} dateRange={dateRange} refresh={refresh} />;
  return <DesktopOverview data={data} loading={loading} error={error} dateRange={dateRange} refresh={refresh} />;
}

/* ============ DESKTOP ============ */

function DesktopOverview({ data, loading, error, dateRange, refresh }) {
  const navigate = useNavigate();
  const [trendRange, setTrendRange] = useState('6M');
  const [activityTab, setActivityTab] = useState('All');

  const spent = data?.spendingOverview?.totalSpent ?? 0;
  const earned = data?.spendingOverview?.totalIncome ?? 0;
  const net = data?.spendingOverview?.netChange ?? 0;
  const savings = data?.incomeVsExpenses?.savingsRate ?? 0;
  const comp = data?.spendingOverview?.comparisonPeriod;
  const compPct = Math.abs(comp?.percentageChange || 0);

  return (
    <>
      <header className="ft-page-header">
        <div>
          <p className="ft-page-header__sub">Welcome back</p>
          <h1 className="ft-page-header__title">Overview</h1>
        </div>
        <div className="ft-page-header__actions">
          <button className="ft-date-chip" type="button" onClick={refresh}>
            <IcCal size={14} style={{ color: 'var(--ft-text-dim)' }} />
            <span>{monthLabel(dateRange.startDate)}</span>
            <span className="ft-date-chip__hint">·</span>
            <span className="ft-date-chip__hint">vs prev</span>
            <IcChevD size={12} style={{ color: 'var(--ft-text-dim)' }} />
          </button>
          <GhostBtn onClick={() => navigate('/import')}>
            <IcUpload size={14} /> Import
          </GhostBtn>
          <PrimaryBtn onClick={() => navigate('/transactions')}>
            <IcPlus size={14} /> New transaction
          </PrimaryBtn>
        </div>
      </header>

      {error && (
        <Card style={{ marginBottom: 16, borderColor: 'var(--ft-spend)', color: 'var(--ft-spend)' }}>
          {error}
        </Card>
      )}

      <div className="ft-stat-row">
        <StatCard
          label="Net change"
          value={loading ? '—' : inr(net, { sign: true })}
          delta={comp ? { up: (comp.percentageChange || 0) >= 0, text: `${compPct.toFixed(1)}% vs prev` } : null}
        />
        <StatCard
          label="Spent"
          value={loading ? '—' : inr(spent)}
          delta={comp ? { up: comp.totalSpent <= spent, text: 'this period' } : null}
        />
        <StatCard
          label="Earned"
          value={loading ? '—' : inr(earned)}
          delta={{ up: true, text: 'this period' }}
        />
        <StatCard
          label="Savings rate"
          accent
          value={loading ? '—' : `${savings.toFixed(0)}%`}
          delta={{ up: savings >= 0, text: 'of income' }}
        />
      </div>

      <div className="ft-grid-2-col">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WidgetCard
            title="Income vs expenses"
            subtitle="Last 6 months"
            actions={{ options: ['1M', '3M', '6M', '1Y'], value: trendRange, onChange: setTrendRange }}
          >
            <TrendChart trends={data?.monthlyTrends || []} />
          </WidgetCard>

          <WidgetCard
            title="Recent activity"
            subtitle={`${data?.recentTransactions?.length || 0} transactions`}
            actions={{ options: ['All', 'Spent', 'Earned'], value: activityTab, onChange: setActivityTab }}
          >
            <RecentList items={data?.recentTransactions || []} filter={activityTab} onOpen={(id) => navigate(`/transactions/${id}`)} />
          </WidgetCard>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WidgetCard
            title="Spending by category"
            subtitle={monthLabel(dateRange.startDate)}
            link={{ label: 'See all', onClick: () => navigate('/categories') }}
          >
            <CategoryDonut breakdown={data?.categoryBreakdown} />
          </WidgetCard>

          <WidgetCard
            title="People"
            subtitle={`${data?.friendBalances?.length || 0} outstanding balances`}
            link={{ label: 'See all', onClick: () => navigate('/friends') }}
          >
            <PeopleList items={data?.friendBalances || []} onOpen={(id) => navigate(`/friends/${id}`)} />
          </WidgetCard>

          <WidgetCard
            title="Accounts"
            subtitle={`${data?.accountSummary?.length || 0} linked`}
          >
            <AccountsList items={data?.accountSummary || []} />
          </WidgetCard>
        </div>
      </div>
    </>
  );
}

function TrendChart({ trends }) {
  const data = trends.slice(-6);
  if (data.length === 0) {
    return <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ft-text-faint)', fontSize: 13 }}>No trend data yet</div>;
  }

  const W = 720, H = 220, padL = 30, padR = 8, padT = 14, padB = 30;
  const maxV = Math.max(1, ...data.flatMap((d) => [Number(d.totalIncome) || 0, Number(d.totalSpent) || 0]));
  const cw = W - padL - padR, ch = H - padT - padB;
  const xs = (i) => padL + (i / Math.max(1, data.length - 1)) * cw;
  const ys = (v) => padT + ch - (Number(v) / maxV) * ch;

  const incomePts = data.map((d, i) => [xs(i), ys(d.totalIncome)]);
  const spendPts = data.map((d, i) => [xs(i), ys(d.totalSpent)]);

  const path = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = (pts) =>
    `${path(pts)} L${pts[pts.length - 1][0]},${padT + ch} L${pts[0][0]},${padT + ch} Z`;

  const lastIdx = data.length - 1;

  return (
    <div>
      <div style={{ display: 'flex', gap: 18, marginBottom: 6 }}>
        <Legend dot="var(--ft-income)" label="Income" value={inrCompact(data[lastIdx]?.totalIncome || 0)} />
        <Legend dot="var(--ft-spend)" label="Expense" value={inrCompact(data[lastIdx]?.totalSpent || 0)} />
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#6EE7B7" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF7A7A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FF7A7A" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1={padL} x2={W - padR} y1={padT + ch * p} y2={padT + ch * p}
            stroke="var(--ft-border)" strokeDasharray="2 4" />
        ))}
        <path d={area(incomePts)} fill="url(#gIncome)" />
        <path d={area(spendPts)} fill="url(#gSpend)" />
        <path d={path(incomePts)} fill="none" stroke="#6EE7B7" strokeWidth="2" />
        <path d={path(spendPts)} fill="none" stroke="#FF7A7A" strokeWidth="2" />
        {incomePts[lastIdx] && (
          <>
            <line x1={incomePts[lastIdx][0]} x2={incomePts[lastIdx][0]} y1={padT} y2={padT + ch}
              stroke="var(--ft-accent)" strokeDasharray="3 4" strokeWidth="1" opacity="0.55" />
            <circle cx={incomePts[lastIdx][0]} cy={incomePts[lastIdx][1]} r="4.5" fill="#6EE7B7" stroke="var(--ft-surface)" strokeWidth="2" />
            <circle cx={spendPts[lastIdx][0]} cy={spendPts[lastIdx][1]} r="4.5" fill="#FF7A7A" stroke="var(--ft-surface)" strokeWidth="2" />
          </>
        )}
        {data.map((d, i) => (
          <text key={i} x={xs(i)} y={H - 8} textAnchor="middle"
            fontSize="10" fill="var(--ft-text-faint)" fontFamily="var(--ft-font-ui)">
            {(d.monthLabel || d.month || '').slice(0, 3)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Legend({ dot, label, value }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: dot }} />
      <span style={{ color: 'var(--ft-text-dim)', fontSize: 12, fontWeight: 500 }}>{label}</span>
      <Num size={13} weight={600}>{value}</Num>
    </div>
  );
}

function RecentList({ items, filter, onOpen }) {
  let list = items;
  if (filter === 'Spent') list = items.filter((t) => Number(t.withdrawal) > 0);
  if (filter === 'Earned') list = items.filter((t) => Number(t.deposit) > 0);
  const slice = list.slice(0, 6);
  if (slice.length === 0) return <div className="dash-empty">No activity in this range.</div>;
  return (
    <div className="dash-tx-list">
      {slice.map((tx, i) => <TxRow key={tx.id || i} tx={tx} onOpen={onOpen} />)}
    </div>
  );
}

function TxRow({ tx, onOpen }) {
  const withdrawal = Number(tx.withdrawal || 0);
  const deposit = Number(tx.deposit || 0);
  const isIncome = deposit > 0;
  const amount = isIncome ? deposit : withdrawal;
  const dateStr = tx.transactionDate
    ? new Date(tx.transactionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—';
  return (
    <button
      type="button"
      onClick={() => onOpen?.(tx.id)}
      className="dash-tx-row"
    >
      <CatGlyph category={tx.category} size={36} />
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div className="dash-tx-row__top">
          <span className="dash-tx-row__name">
            {tx.upiName || tx.narration || 'Transaction'}
          </span>
          <Num size={14} weight={600} color={isIncome ? 'var(--ft-income)' : 'var(--ft-text)'}>
            {inr(isIncome ? amount : -amount, { sign: isIncome })}
          </Num>
        </div>
        <div className="dash-tx-row__meta">
          <span>{dateStr}</span>
          {tx.upiDescription && <span>· {tx.upiDescription}</span>}
        </div>
      </div>
    </button>
  );
}

function CategoryDonut({ breakdown }) {
  if (!breakdown?.categories?.length) {
    return <div className="dash-empty">No categorised spend yet.</div>;
  }
  const items = breakdown.categories.slice(0, 6);
  const total = items.reduce((s, c) => s + (Number(c.totalAmount) || 0), 0) || 1;
  const C = 2 * Math.PI * 70;
  const fallbacks = ['#FF8B6B', '#7DB9FF', '#B79CFF', '#FFB454', '#6EE7B7', '#FFD66E'];
  let offset = 0;
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width="160" height="160" viewBox="0 0 180 180" style={{ flexShrink: 0 }}>
        <g transform="translate(90,90) rotate(-90)">
          <circle r="70" fill="none" stroke="var(--ft-surface-2)" strokeWidth="18" />
          {items.map((c, i) => {
            const frac = (Number(c.totalAmount) || 0) / total;
            const len = frac * C - 1.5;
            const dash = `${Math.max(0, len)} ${C}`;
            const off = -offset;
            offset += frac * C;
            const color = c.categoryColor || fallbacks[i % fallbacks.length];
            return (
              <circle key={i} r="70" fill="none" stroke={color} strokeWidth="18"
                strokeDasharray={dash} strokeDashoffset={off} strokeLinecap="butt" />
            );
          })}
        </g>
        <text x="90" y="84" textAnchor="middle" fill="var(--ft-text-dim)" fontSize="10"
          fontFamily="var(--ft-font-ui)" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Total
        </text>
        <text x="90" y="106" textAnchor="middle" fill="var(--ft-text)" fontSize="18"
          fontWeight="600" fontFamily="var(--ft-font-mono)"
          style={{ letterSpacing: '-0.5px' }}>
          {inrCompact(breakdown.totalSpent || total)}
        </text>
      </svg>
      <div style={{ flex: 1, minWidth: 160 }}>
        {items.map((c, i) => {
          const color = c.categoryColor || fallbacks[i % fallbacks.length];
          return (
            <div key={i} className="dash-cat-row">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ft-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.categoryName}
              </span>
              <Num size={12} weight={500} color="var(--ft-text-dim)" style={{ marginLeft: 8 }}>
                {(c.percentage || 0).toFixed(0)}%
              </Num>
              <Num size={13} weight={600} style={{ marginLeft: 10, minWidth: 60, textAlign: 'right' }}>
                {inrCompact(c.totalAmount)}
              </Num>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeopleList({ items, onOpen }) {
  const slice = items.slice(0, 4);
  if (slice.length === 0) return <div className="dash-empty">No outstanding balances.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {slice.map((f) => {
        const netVal = Number(f.netBalance || 0);
        const owes = netVal > 0;
        return (
          <button
            key={f.friendId}
            type="button"
            onClick={() => onOpen?.(f.friendId)}
            className="dash-person"
          >
            <Avatar name={f.friendName} initials={initialsOf(f.friendName)} tint={friendTint(f.friendId)} size={36} />
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ color: 'var(--ft-text)', fontWeight: 500, fontSize: 14 }}>{f.friendName}</div>
              <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>
                {Math.abs(netVal) < 1 ? 'Settled' : owes ? 'Owes you' : 'You owe'}
              </div>
            </div>
            <Num size={14} weight={600} color={owes ? 'var(--ft-income)' : netVal < 0 ? 'var(--ft-spend)' : 'var(--ft-text-dim)'}>
              {inr(Math.abs(netVal))}
            </Num>
          </button>
        );
      })}
    </div>
  );
}

function AccountsList({ items }) {
  if (items.length === 0) return <div className="dash-empty">No linked accounts.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.slice(0, 4).map((a) => (
        <div key={a.accountId || a.accountNumber} className="dash-account-row">
          <div className="dash-account-icon">HD</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--ft-text)', fontWeight: 500, fontSize: 13 }}>HDFC</div>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 11, fontFamily: 'var(--ft-font-mono)' }}>
              •••• {String(a.accountNumber || '').slice(-4)}
            </div>
          </div>
          <Num size={14} weight={600}>{inr(a.currentBalance ?? 0)}</Num>
        </div>
      ))}
    </div>
  );
}

/* ============ MOBILE ============ */

function MobileHome({ data, error, refresh }) {
  const navigate = useNavigate();
  const net = data?.spendingOverview?.netChange ?? 0;
  const totalSpent = data?.spendingOverview?.totalSpent ?? 0;
  const totalIncome = data?.spendingOverview?.totalIncome ?? 0;
  const savingsRate = data?.incomeVsExpenses?.savingsRate ?? 0;

  return (
    <>
      <header className="ft-mobile__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name="You" size={36} />
          <div>
            <div className="ft-mobile__hello">Good evening</div>
            <div className="ft-mobile__hello-meta">Welcome back</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ft-mobile__icon-btn" onClick={refresh} aria-label="Refresh">
            <IcSearch size={18} />
          </button>
          <button className="ft-mobile__icon-btn" aria-label="Notifications">
            <IcBell size={18} />
          </button>
        </div>
      </header>

      <main className="ft-mobile__content">
        {error && (
          <Card style={{ borderColor: 'var(--ft-spend)', color: 'var(--ft-spend)' }}>{error}</Card>
        )}

        <Card pad={20}>
          <Overline>Net change</Overline>
          <HeroAmount color="var(--ft-text)" style={{ marginTop: 4 }}>
            {inr(net, { sign: true })}
          </HeroAmount>
          <div
            style={{
              marginTop: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 11px',
              borderRadius: 999,
              background: 'var(--ft-income-soft)',
              color: 'var(--ft-income)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ↑ Saving {savingsRate.toFixed(1)}% this period
          </div>
        </Card>

        <Card pad={18}>
          <SectionTitle>This period</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <MiniStat label="Spent" value={inrCompact(totalSpent)} color="var(--ft-spend)" />
            <MiniStat label="Earned" value={inrCompact(totalIncome)} color="var(--ft-income)" />
            <MiniStat label="Save %" value={`${savingsRate.toFixed(0)}%`} color="var(--ft-accent)" />
          </div>
        </Card>

        <Card pad={18}>
          <SectionTitle action={
            <button className="dash-link" onClick={() => navigate('/transactions')}>View all →</button>
          }>
            Recent activity
          </SectionTitle>
          <div className="dash-tx-list">
            {(data?.recentTransactions || []).slice(0, 4).map((tx, i) => (
              <TxRow key={tx.id || i} tx={tx} onOpen={(id) => navigate(`/transactions/${id}`)} />
            ))}
            {(!data?.recentTransactions || data.recentTransactions.length === 0) && (
              <div className="dash-empty">No transactions yet.</div>
            )}
          </div>
        </Card>

        {(data?.friendBalances || []).length > 0 && (
          <Card pad={18}>
            <SectionTitle action={
              <button className="dash-link" onClick={() => navigate('/friends')}>All →</button>
            }>People</SectionTitle>
            <PeopleList items={data.friendBalances} onOpen={(id) => navigate(`/friends/${id}`)} />
          </Card>
        )}
      </main>
    </>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div
      style={{
        background: 'var(--ft-surface-2)',
        padding: 12,
        borderRadius: 12,
      }}
    >
      <Overline>{label}</Overline>
      <div style={{ marginTop: 6 }}>
        <Num size={18} weight={600} color={color}>{value}</Num>
      </div>
    </div>
  );
}
