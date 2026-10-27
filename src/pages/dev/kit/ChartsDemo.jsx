// Charts section of the dev UI kit (/ui-kit): every chart component with
// realistic fake data, plus the edge cases (empty, all-zero, one point,
// negative values), so the set can be reviewed against Frappe UI in both themes.

import { useState } from 'react';
import {
  BarChart,
  CategoryBars,
  ChartCard,
  ChartLegend,
  DonutChart,
  LineChart,
  Sparkline,
} from '../../../components/charts/index.js';
import { inr, inrCompact } from '../../../utils/inr.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (iso) => MONTHS[Number(String(iso).slice(5, 7)) - 1] ?? String(iso);

const CASHFLOW = [
  { month: '2026-05-01', spent: 78420, earned: 142000 },
  { month: '2026-06-01', spent: 91250, earned: 142000 },
  { month: '2026-07-01', spent: 66830, earned: 148500 },
  { month: '2026-08-01', spent: 104900, earned: 142000 },
  { month: '2026-09-01', spent: 72310, earned: 156200 },
  { month: '2026-10-01', spent: 84210, earned: 142000 },
];

const CASHFLOW_SERIES = [
  { key: 'spent', label: 'Spent', color: 'var(--chart-out)' },
  { key: 'earned', label: 'Earned', color: 'var(--chart-in)' },
];

// What is left after the ₹60k monthly SIP + rent transfer: some months go negative.
const NET = CASHFLOW.map(({ month, spent, earned }) => ({ month, net: earned - spent - 60000 }));

const SPEND_MIX = [
  { month: '2026-05-01', essentials: 41200, lifestyle: 28120, travel: 9100 },
  { month: '2026-06-01', essentials: 41800, lifestyle: 33450, travel: 16000 },
  { month: '2026-07-01', essentials: 40900, lifestyle: 25930, travel: 0 },
  { month: '2026-08-01', essentials: 42300, lifestyle: 31600, travel: 31000 },
  { month: '2026-09-01', essentials: 41500, lifestyle: 27810, travel: 3000 },
  { month: '2026-10-01', essentials: 43100, lifestyle: 35110, travel: 6000 },
];

const CARDS = [
  { month: '2026-05-01', regalia: 32400, amazon: 18200, cashback: 9800 },
  { month: '2026-06-01', regalia: 41800, amazon: 22650, cashback: 12100 },
  { month: '2026-07-01', regalia: 27300, amazon: 15900, cashback: 8400 },
  { month: '2026-08-01', regalia: 56200, amazon: 19800, cashback: 14300 },
  { month: '2026-09-01', regalia: 30100, amazon: 21400, cashback: 7600 },
  { month: '2026-10-01', regalia: 36900, amazon: 24300, cashback: 10200 },
];

const MERCHANTS = [
  { merchant: 'Swiggy', amount: 9840 },
  { merchant: 'Amazon', amount: 8420 },
  { merchant: 'BigBasket', amount: 7310 },
  { merchant: 'Uber', amount: 4260 },
  { merchant: 'BookMyShow', amount: 2150 },
  { merchant: 'Apollo Pharmacy', amount: 1890 },
];

// Weekly spend with week 5 not imported yet: the line breaks instead of dipping to zero.
const WEEKLY = [
  { week: 'W1', spend: 18420 },
  { week: 'W2', spend: 22150 },
  { week: 'W3', spend: 16980 },
  { week: 'W4', spend: 25610 },
  { week: 'W5', spend: null },
  { week: 'W6', spend: 19840 },
  { week: 'W7', spend: 21330 },
  { week: 'W8', spend: 17200 },
];

const CATEGORIES = [
  { key: 'rent', label: 'Rent', value: 25000, color: 'var(--cat-rent)', hint: '1 txn' },
  { key: 'food', label: 'Food & dining', value: 12400, color: 'var(--cat-food)', hint: '23 txns' },
  { key: 'shopping', label: 'Shopping', value: 10320, color: 'var(--cat-shopping)', hint: '9 txns' },
  { key: 'grocery', label: 'Groceries', value: 9850, color: 'var(--cat-grocery)', hint: '12 txns' },
  { key: 'bills', label: 'Bills & utilities', value: 8130, color: 'var(--cat-bills)', hint: '6 txns' },
  { key: 'health', label: 'Health', value: 7360, color: 'var(--cat-health)', hint: '3 txns' },
  { key: 'transport', label: 'Transport', value: 6260, color: 'var(--cat-transport)', hint: '31 txns' },
  { key: 'entmt', label: 'Entertainment', value: 4890, color: 'var(--cat-entmt)', hint: '5 txns' },
];

const PEOPLE = [
  { label: 'Ketul', value: 14200 },
  { label: 'Riya', value: 9100 },
  { label: 'Aman', value: 6350 },
  { label: 'Neha', value: 4800 },
  { label: 'Dev', value: 2650 },
  { label: 'Ishaan', value: 1900 },
  { label: 'Mira', value: 850 },
];

const DAILY_SPEND = [2310, 4120, 1890, 6420, 2950, 1210, 3380, 5120, 2240, 2780, 8950, 1640, 3020, 2470];
const MONTHLY_EARNED = CASHFLOW.map((r) => ({ value: r.earned }));
const SAVINGS_RATE = [44.8, 35.7, 55.0, 26.1, 53.7, 40.7];

function StatCard({ title, value, caption, children }) {
  return (
    <ChartCard>
      <div className="text-sm text-ink-gray-5">{title}</div>
      <div className="text-3xl font-semibold text-ink-gray-9 tabular-nums">{value}</div>
      <div className="text-sm text-ink-gray-5">{caption}</div>
      {children}
    </ChartCard>
  );
}

export default function ChartsDemo() {
  const [picked, setPicked] = useState('Nothing yet');

  return (
    <section className="uikit-section">
      <h2>Charts</h2>

      <div className="uikit-group">
        <h3>Stat cards with sparklines</h3>
        <div className="ui-chart-deck">
          <StatCard title="Spent in October" value={inr(84210)} caption="16% more than September">
            <Sparkline data={DAILY_SPEND} height={40} />
          </StatCard>
          <StatCard title="Earned in October" value={inr(142000)} caption="Salary credited on 1 Oct">
            <Sparkline data={MONTHLY_EARNED} valueKey="value" height={40} color="var(--chart-in)" />
          </StatCard>
          <StatCard title="Savings rate" value="40.7%" caption="6-month average 42.7%">
            <Sparkline data={SAVINGS_RATE} height={40} area={false} color="var(--chart-series-5)" />
          </StatCard>
        </div>
        <div className="uikit-row">
          <span className="text-sm text-ink-gray-7">Swiggy, last 14 days</span>
          <Sparkline data={DAILY_SPEND} width={96} height={20} area={false} color="var(--cat-food)" />
          <span className="text-sm text-ink-gray-7">Single value</span>
          <Sparkline data={[4200]} width={96} height={20} />
          <span className="text-sm text-ink-gray-7">No data</span>
          <Sparkline data={[]} width={96} height={20} />
        </div>
      </div>

      <div className="uikit-group">
        <h3>Bar charts</h3>
        <div className="ui-chart-deck">
          <ChartCard title="Spent vs earned" subtitle="Last 6 months">
            <BarChart
              data={CASHFLOW}
              xKey="month"
              series={CASHFLOW_SERIES}
              formatXLabel={monthLabel}
              onBarClick={(row, key) => setPicked(`${monthLabel(row.month)} · ${key}`)}
              ariaLabel="Spent and earned per month, May to October"
            />
          </ChartCard>
          <ChartCard title="Where it went" subtitle="Stacked, default frappe palette">
            <BarChart
              data={SPEND_MIX}
              xKey="month"
              stacked
              series={[
                { key: 'essentials', label: 'Essentials' },
                { key: 'lifestyle', label: 'Lifestyle' },
                { key: 'travel', label: 'Travel' },
              ]}
              formatXLabel={monthLabel}
            />
          </ChartCard>
          <ChartCard title="Left after investments" subtitle="Negative months sit below the zero line">
            <BarChart
              data={NET}
              xKey="month"
              series={[{ key: 'net', label: 'Net' }]}
              formatXLabel={monthLabel}
              formatValue={(n) => inr(n, { sign: true })}
            />
          </ChartCard>
          <ChartCard title="Top merchants" subtitle="October, horizontal">
            <BarChart
              data={MERCHANTS}
              xKey="merchant"
              horizontal
              height={220}
              series={[{ key: 'amount', label: 'Spent', color: 'var(--chart-out)' }]}
              onBarClick={(row) => setPicked(row.merchant)}
            />
          </ChartCard>
        </div>
        <p className="text-sm text-ink-gray-5">Last click: {picked}</p>
      </div>

      <div className="uikit-group">
        <h3>Line charts</h3>
        <div className="ui-chart-deck">
          <ChartCard title="Cash flow" subtitle="Monotone curve with area fill" className="ui-chart-deck-wide">
            <LineChart
              data={CASHFLOW}
              xKey="month"
              series={CASHFLOW_SERIES}
              formatXLabel={monthLabel}
              area
              curve="monotone"
            />
          </ChartCard>
          <ChartCard title="Card spend" subtitle="Three lines, default palette">
            <LineChart
              data={CARDS}
              xKey="month"
              series={[
                { key: 'regalia', label: 'HDFC Regalia' },
                { key: 'amazon', label: 'ICICI Amazon Pay' },
                { key: 'cashback', label: 'SBI Cashback' },
              ]}
              formatXLabel={monthLabel}
            />
          </ChartCard>
          <ChartCard title="Weekly spend" subtitle="Dots on, week 5 missing">
            <LineChart data={WEEKLY} xKey="week" series={[{ key: 'spend', label: 'Spent' }]} showDots />
          </ChartCard>
        </div>
      </div>

      <div className="uikit-group">
        <h3>Donut and category bars</h3>
        <div className="ui-chart-deck">
          <ChartCard title="Spending by category" subtitle="October">
            <DonutChart
              data={CATEGORIES}
              centerLabel="Spent"
              legend="right"
              onSliceClick={(slice) => setPicked(slice.label)}
            />
          </ChartCard>
          <ChartCard title="Top categories" subtitle="October, top 5 of 8">
            <CategoryBars
              items={CATEGORIES.map((c) => ({ ...c, onClick: () => setPicked(c.label) }))}
              max={5}
              showPercent
            />
          </ChartCard>
          <ChartCard title="Who owes you" subtitle="Default palette, tail grouped into Others">
            <DonutChart
              data={PEOPLE}
              size={128}
              maxSlices={5}
              centerLabel="Owed"
              formatValue={inrCompact}
              legend="bottom"
            />
          </ChartCard>
        </div>
      </div>

      <div className="uikit-group">
        <h3>Legend on its own</h3>
        <div className="uikit-row">
          <ChartLegend items={CASHFLOW_SERIES.map((s) => ({ ...s }))} />
        </div>
        <ChartCard>
          <ChartLegend
            layout="vertical"
            formatValue={inr}
            items={CATEGORIES.slice(0, 4).map((c) => ({ ...c, hint: undefined }))}
          />
        </ChartCard>
      </div>

      <div className="uikit-group">
        <h3>Edge cases</h3>
        <div className="ui-chart-deck">
          <ChartCard title="No data" subtitle="Empty array">
            <BarChart data={[]} xKey="month" series={CASHFLOW_SERIES} height={160} emptyText="No transactions in this period" />
          </ChartCard>
          <ChartCard title="All zero" subtitle="Baseline only">
            <LineChart
              data={CASHFLOW.map((r) => ({ month: r.month, spent: 0 }))}
              xKey="month"
              series={[{ key: 'spent', label: 'Spent' }]}
              formatXLabel={monthLabel}
              height={160}
            />
          </ChartCard>
          <ChartCard title="One point" subtitle="A single month">
            <BarChart data={CASHFLOW.slice(-1)} xKey="month" series={CASHFLOW_SERIES} formatXLabel={monthLabel} height={160} />
          </ChartCard>
          <ChartCard title="One point, line" subtitle="Drawn as a dot">
            <LineChart data={CASHFLOW.slice(-1)} xKey="month" series={CASHFLOW_SERIES} formatXLabel={monthLabel} height={160} />
          </ChartCard>
          <ChartCard title="Donut states" subtitle="Empty, and all zero">
            <div className="uikit-row">
              <DonutChart data={[]} size={120} emptyText="No spending yet" />
              <DonutChart data={[{ label: 'Food', value: 0 }, { label: 'Rent', value: 0 }]} size={120} centerLabel="Spent" />
            </div>
          </ChartCard>
          <ChartCard title="Category bars" subtitle="Empty">
            <CategoryBars items={[]} emptyText="No categories yet" />
          </ChartCard>
        </div>
      </div>
    </section>
  );
}
