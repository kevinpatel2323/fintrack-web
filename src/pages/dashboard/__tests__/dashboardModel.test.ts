import { describe, expect, it } from 'vitest';
import {
  OTHERS_KEY,
  UNCATEGORISED_KEY,
  attentionItems,
  balanceTotals,
  categoryRows,
  comparisonLabel,
  defaultDateRange,
  filterRecent,
  formatRangeLabel,
  matchPreset,
  monthBounds,
  percentChange,
  rangeDays,
  rangePresets,
  shortDate,
  signedAmount,
  summaryStats,
  transactionsLink,
} from '../dashboardModel.js';

const TODAY = new Date(2026, 9, 28); // 28 Oct 2026, local

describe('date ranges', () => {
  it('opens on the last 30 days, which is the "Last 30 days" preset', () => {
    const range = defaultDateRange(TODAY);
    expect(range).toEqual({ startDate: '2026-09-28', endDate: '2026-10-28' });
    expect(matchPreset(rangePresets(TODAY), range)?.label).toBe('Last 30 days');
  });

  it('builds calendar presets', () => {
    const byLabel = Object.fromEntries(rangePresets(TODAY).map((p) => [p.label, p.value]));
    expect(byLabel['This month']).toEqual({ start: '2026-10-01', end: '2026-10-28' });
    expect(byLabel['Last month']).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(byLabel['Last 3 months']).toEqual({ start: '2026-07-28', end: '2026-10-28' });
    expect(byLabel['This year']).toEqual({ start: '2026-01-01', end: '2026-10-28' });
  });

  it('clamps "Last 3 months" to the shorter month', () => {
    const p = rangePresets(new Date(2026, 4, 31)).find((x) => x.label === 'Last 3 months');
    expect(p?.value.start).toBe('2026-02-28');
  });

  it('labels the comparison with the real window length', () => {
    expect(rangeDays('2026-09-28', '2026-10-28')).toBe(31);
    expect(comparisonLabel({ startDate: '2026-09-28', endDate: '2026-10-28' })).toBe('vs previous 31 days');
    expect(comparisonLabel({ startDate: '2026-10-28', endDate: '2026-10-28' })).toBe('vs previous day');
    expect(comparisonLabel({ startDate: '2026-10-01', endDate: '2026-10-28' }, { short: true })).toBe('vs previous');
  });

  it('formats ranges and dates', () => {
    expect(formatRangeLabel({ startDate: '2026-09-28', endDate: '2026-10-28' })).toBe('28 Sep – 28 Oct 2026');
    expect(formatRangeLabel({ startDate: '2025-12-01', endDate: '2026-01-03' })).toBe('1 Dec 2025 – 3 Jan 2026');
    expect(shortDate('2026-10-05')).toBe('5 Oct');
    expect(shortDate('2026-10-05T10:00:00.000Z'.slice(0, 10), { withYear: true })).toBe('5 Oct 2026');
    expect(shortDate(null)).toBe('');
    expect(monthBounds('2026-02')).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
  });

  it('links to the transactions list with its own URL params', () => {
    const range = { startDate: '2026-10-01', endDate: '2026-10-28' };
    expect(transactionsLink(range, { tab: 'spent' })).toBe('/transactions?start=2026-10-01&end=2026-10-28&tab=spent');
    expect(transactionsLink(range)).toBe('/transactions?start=2026-10-01&end=2026-10-28');
  });
});

describe('summaryStats', () => {
  const data = {
    spendingOverview: {
      totalSpent: 60000,
      totalIncome: 100000,
      netChange: 40000,
      comparisonPeriod: { totalSpent: 50000, totalIncome: 80000, percentageChange: 20 },
    },
    incomeVsExpenses: { totalIncome: 100000, totalExpenses: 60000, savingsRate: 40 },
  };

  it('compares every figure with the previous period', () => {
    const s = summaryStats(data);
    expect(s.spent).toEqual({ value: 60000, delta: 20 });
    expect(s.earned).toEqual({ value: 100000, delta: 25 });
    // Net 40,000 vs 30,000 before.
    expect(s.net.delta).toBeCloseTo(33.33, 1);
    // Savings 40% vs 37.5%: +2.5 points.
    expect(s.savings.value).toBe(40);
    expect(s.savings.delta).toBeCloseTo(2.5, 5);
  });

  it('shows no delta when there is nothing to compare with', () => {
    const s = summaryStats({
      spendingOverview: {
        totalSpent: 500,
        totalIncome: 0,
        netChange: -500,
        comparisonPeriod: { totalSpent: 0, totalIncome: 0, percentageChange: 0 },
      },
      incomeVsExpenses: { totalIncome: 0, totalExpenses: 500, savingsRate: 0 },
    });
    expect(s.spent.delta).toBeNull();
    expect(s.earned.delta).toBeNull();
    expect(s.net.delta).toBeNull();
    expect(s.savings).toEqual({ value: null, delta: null });
  });

  it('keeps the direction right when the previous figure was negative', () => {
    expect(percentChange(-5000, -10000)).toBe(50);
    expect(percentChange(-5000, 10000)).toBe(-150);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe('lists', () => {
  it('ranks categories and folds the tail into one row', () => {
    const breakdown = {
      categories: [
        { categoryId: '1', categoryName: 'Food', categoryColor: null, totalAmount: 500, transactionCount: 5 },
        { categoryId: null, categoryName: 'Uncategorized', categoryColor: null, totalAmount: 900, transactionCount: 3 },
        { categoryId: '2', categoryName: 'Rent', categoryColor: null, totalAmount: 2000, transactionCount: 1 },
        { categoryId: '3', categoryName: 'Bills', categoryColor: null, totalAmount: 100, transactionCount: 2 },
        { categoryId: '4', categoryName: 'Fuel', categoryColor: null, totalAmount: 50, transactionCount: 1 },
      ],
    };
    const rows = categoryRows(breakdown, 2);
    expect(rows.map((r) => r.key)).toEqual(['2', UNCATEGORISED_KEY, OTHERS_KEY]);
    expect(rows[1].label).toBe('Uncategorised');
    expect(rows[2]).toMatchObject({ label: '3 other categories', value: 650, count: 8 });
    // No fold when only one row would be left over.
    expect(categoryRows(breakdown, 4)).toHaveLength(5);
  });

  it('filters recent activity and signs amounts', () => {
    const items = [
      { id: 1, withdrawal: 67, deposit: 0 },
      { id: 2, withdrawal: 0, deposit: 6265 },
    ];
    expect(filterRecent(items, 'spent').map((t) => t.id)).toEqual([1]);
    expect(filterRecent(items, 'earned').map((t) => t.id)).toEqual([2]);
    expect(filterRecent(items, 'all')).toHaveLength(2);
    expect(items.map(signedAmount)).toEqual([-67, 6265]);
  });

  it('totals balances both ways', () => {
    expect(balanceTotals([{ netBalance: 1200 }, { netBalance: -300 }, { netBalance: 50 }])).toEqual({
      owedToYou: 1250,
      youOwe: 300,
    });
  });
});

describe('attentionItems', () => {
  const range = { startDate: '2026-10-01', endDate: '2026-10-28' };

  it('is empty when nothing needs attention', () => {
    expect(attentionItems({ dues: [], schedule: null, review: null, breakdown: null, range })).toEqual([]);
  });

  it('lists bills due soon, statements to import, reviews and uncategorised spend', () => {
    const items = attentionItems({
      range,
      dues: [
        { cardId: '7', cardName: 'Regalia', last4: '2209', amount: 12000, daysAway: -2, status: 'overdue' },
        { cardId: '8', cardName: 'Millennia', last4: '1111', amount: 3000, daysAway: 20, status: 'upcoming' },
        { cardId: '9', cardName: 'Swiggy', last4: '3333', amount: 0, daysAway: 0, status: 'no-due' },
      ],
      schedule: {
        pendingCount: 2,
        cards: [
          {
            status: 'ready',
            card: { id: '7', name: 'Regalia Gold', nickname: 'Regalia', last4: '2209' },
            next: { label: 'Sep 2026' },
            pending: [{ label: 'Sep 2026' }, { label: 'Oct 2026' }],
          },
          { status: 'waiting', card: { id: '8', name: 'Millennia', last4: '1111' }, next: null, pending: [] },
        ],
      },
      review: { needingReview: 3, friends: [{ friendId: '4', friendName: 'Yash', needingReview: 3 }] },
      breakdown: { categories: [{ categoryId: null, totalAmount: 4200, transactionCount: 6 }] },
    });

    expect(items.map((i) => i.kind)).toEqual(['bill', 'import', 'review', 'uncategorised']);
    expect(items[0]).toMatchObject({ title: 'Regalia bill', detail: 'Overdue by 2 days · •• 2209', tone: 'due', to: '/cards/7' });
    expect(items[1]).toMatchObject({ title: 'Import the Sep 2026 statement', to: '/import' });
    expect(items[1].detail).toBe('Regalia •• 2209 · 2 statements waiting');
    expect(items[2]).toMatchObject({ to: '/friends/4?review=1', detail: '3 settlements saved before amounts were recorded' });
    expect(items[3]).toMatchObject({
      title: 'Categorise 6 transactions',
      amount: 4200,
      to: '/transactions?start=2026-10-01&end=2026-10-28&tab=spent&category=none',
    });
  });

  it('folds many people with settlements to review into one row', () => {
    const friends = ['A', 'B', 'C'].map((n, i) => ({ friendId: String(i), friendName: n, needingReview: 1 }));
    const items = attentionItems({ dues: [], schedule: null, review: { friends }, breakdown: null, range });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Review 3 older settlements', to: '/friends' });
  });
});
