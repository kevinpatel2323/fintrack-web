import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  buildCategorySpend,
  buildCells,
  dayCardBills,
  dayCategorizationState,
  dayModel,
  defaultDayForMonth,
  displayName,
  groupTransactionsByDay,
  isInMonth,
  nextDateBySubscription,
  parseExdatesText,
  subscriptionStatus,
  txSignedAmount,
  upcomingOccurrences,
  dayUncategorizedCount,
  monthPending,
  nextPendingDay,
} from '../calendarModel.js';

describe('month cells', () => {
  it('covers only the weeks the month touches, starting on Sunday', () => {
    // October 2026 starts on a Thursday and has 31 days: 5 weeks.
    const cells = buildCells(2026, 9);
    expect(cells).toHaveLength(35);
    expect(cells[0]).toEqual({ iso: '2026-09-27', label: 27, inMonth: false });
    expect(cells[4]).toEqual({ iso: '2026-10-01', label: 1, inMonth: true });
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
  });

  it('adds days across month ends', () => {
    expect(addDaysIso('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('selects today in its own month and the 1st elsewhere', () => {
    expect(isInMonth('2026-10-28', 2026, 9)).toBe(true);
    expect(isInMonth('2026-11-01', 2026, 9)).toBe(false);
    expect(defaultDayForMonth(2026, 9, '2026-10-28')).toBe('2026-10-28');
    expect(defaultDayForMonth(2026, 10, '2026-10-28')).toBe('2026-11-01');
  });
});

describe('day state', () => {
  const food = { id: 1, name: 'Food' };

  it('groups transactions by their date', () => {
    const m = groupTransactionsByDay([
      { id: 1, transactionDate: '2026-10-01T00:00:00.000Z' },
      { id: 2, transactionDate: '2026-10-01' },
      { id: 3, transactionDate: null },
    ]);
    expect(m.get('2026-10-01')).toHaveLength(2);
    expect(m.get('unknown')).toHaveLength(1);
  });

  it('needs a category until every transaction and covered card spend has one', () => {
    expect(dayCategorizationState([])).toBeNull();
    expect(dayCategorizationState([{ id: 1, categoryId: 1 }])).toBe('categorized');
    expect(dayCategorizationState([{ id: 1, categoryId: 1 }, { id: 2, categoryId: null }])).toBe('needs-category');
    // A bill payment with an unknown nested state is not complete.
    expect(dayCategorizationState([{ id: 3, categoryId: 1, ccBillPayment: {} }])).toBe('needs-category');
    expect(dayCategorizationState([{ id: 3, categoryId: 1, ccBillPayment: { allCoveredCategorized: true } }])).toBe('categorized');
    // A loaded cc-link detail wins over the payload flag.
    expect(
      dayCategorizationState(
        [{ id: 3, categoryId: 1, ccBillPayment: { allCoveredCategorized: true } }],
        { 3: { coveredTransactions: [{ id: 9, categoryId: null }] } },
      ),
    ).toBe('needs-category');
  });

  it('sums a day and names its card bills', () => {
    const cards = { 7: { id: 7, holder: 'MINAL PATEL', name: 'BizGrow' } };
    const txs = [
      { id: 1, withdrawal: '120.50', categoryId: 1, category: food },
      { id: 2, deposit: '500', categoryId: 1 },
      { id: 3, withdrawal: '9000', categoryId: 1, ccBillPayment: { cardId: 7, cardLast4: '2209', allCoveredCategorized: true } },
    ];
    const day = dayModel(txs, [{ name: 'Netflix' }], {}, cards);
    expect(day.spent).toBeCloseTo(9120.5);
    expect(day.earned).toBe(500);
    expect(day.billCount).toBe(1);
    expect(day.catState).toBe('categorized');
    expect(day.cardBills).toMatchObject({ count: 1, total: 9000, owner: 'Minal Patel', card: 'BizGrow' });
    expect(day.cardBills.title).toBe('Card bill paid for Minal Patel · BizGrow •• 2209 · ₹9,000');
  });

  it('collapses several owners and unknown cards', () => {
    const bills = dayCardBills([
      { withdrawal: 100, ccBillPayment: { cardId: 1, cardLast4: '1111' } },
      { withdrawal: 200, ccBillPayment: { cardId: 2 } },
    ]);
    expect(bills.owner).toBe('Card bill');
    expect(bills.card).toBe('2 cards');
    expect(dayCardBills([{ withdrawal: 5 }])).toBeNull();
  });

  it('title-cases shouting names only', () => {
    expect(displayName('MINAL PATEL')).toBe('Minal Patel');
    expect(displayName("O'BRIEN-SMITH")).toBe("O'Brien-Smith");
    expect(displayName('Het Patel')).toBe('Het Patel');
  });

  it('signs a bank transaction by direction', () => {
    expect(txSignedAmount({ withdrawal: '67' })).toBe(-67);
    expect(txSignedAmount({ deposit: '6265' })).toBe(6265);
  });
});

describe('category spend', () => {
  it('splits withdrawals by category, largest first, uncategorised included', () => {
    const { segments, total } = buildCategorySpend([
      { withdrawal: 100, category: { id: 1, name: 'Food' } },
      { withdrawal: 300, category: null },
      { withdrawal: 50, category: { id: 1, name: 'Food' } },
      { deposit: 999, category: { id: 2, name: 'Salary' } },
    ]);
    expect(total).toBe(450);
    expect(segments.map((s) => [s.key, s.name, s.amount])).toEqual([
      ['uncategorized', 'Uncategorised', 300],
      ['c1', 'Food', 150],
    ]);
    expect(segments[0].fraction).toBeCloseTo(300 / 450);
  });
});

describe('subscriptions', () => {
  const occ = [
    { subscriptionId: '2', date: '2026-11-03' },
    { subscriptionId: '1', date: '2026-10-01' },
    { subscriptionId: '1', date: '2026-11-01' },
    { subscriptionId: '2', date: '2026-10-29' },
  ];

  it('lists bills from today, soonest first', () => {
    expect(upcomingOccurrences(occ, '2026-10-28', 2).map((o) => o.date)).toEqual(['2026-10-29', '2026-11-01']);
  });

  it('finds each subscription\'s next date', () => {
    const next = nextDateBySubscription(occ, '2026-10-28');
    expect(next.get('1')).toBe('2026-11-01');
    expect(next.get('2')).toBe('2026-10-29');
  });

  it('shows one status badge, with active trials as Trial', () => {
    expect(subscriptionStatus({ status: 'active' }).label).toBe('Active');
    expect(subscriptionStatus({ status: 'active', isTrial: true }).label).toBe('Trial');
    expect(subscriptionStatus({ status: 'paused', isTrial: true }).label).toBe('Paused');
    expect(subscriptionStatus({ status: 'cancelled' }).label).toBe('Cancelled');
  });

  it('reads exception dates from lines, commas or spaces', () => {
    expect(parseExdatesText('2026-06-15\n2026-07-15, bad 2026-08-15')).toEqual(['2026-06-15', '2026-07-15', '2026-08-15']);
    expect(parseExdatesText('')).toEqual([]);
  });
});

describe('pending categorisation', () => {
  const tx = (id, categoryId, extra = {}) => ({ id, categoryId, ...extra });

  it('counts uncategorised transactions on a day', () => {
    expect(dayUncategorizedCount([tx(1, 3), tx(2, null), tx(3, '')])).toBe(2);
    expect(dayUncategorizedCount([])).toBe(0);
  });

  it("counts a card bill payment's uncategorised covered transactions when loaded", () => {
    const bill = tx(9, 5, { ccBillPayment: { allCoveredCategorized: false } });
    const detail = { 9: { coveredTransactions: [tx(20, null), tx(21, 4), tx(22, null)] } };
    expect(dayUncategorizedCount([bill], detail)).toBe(2);
    // Not loaded yet: the payload flag counts as one.
    expect(dayUncategorizedCount([bill])).toBe(1);
    expect(dayUncategorizedCount([tx(9, 5, { ccBillPayment: { allCoveredCategorized: true } })])).toBe(0);
  });

  it('summarises the month and finds the next pending day, wrapping', () => {
    const byDay = new Map([
      ['2026-10-02', [tx(1, null)]],
      ['2026-10-05', [tx(2, 1), tx(3, 2)]],
      ['2026-10-09', [tx(4, null), tx(5, null)]],
    ]);
    const days = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-09'];
    expect(monthPending(days, byDay)).toEqual({ days: ['2026-10-02', '2026-10-09'], pending: 3, total: 5 });
    expect(nextPendingDay(['2026-10-02', '2026-10-09'], '2026-10-02')).toBe('2026-10-09');
    expect(nextPendingDay(['2026-10-02', '2026-10-09'], '2026-10-09')).toBe('2026-10-02');
    expect(nextPendingDay([], '2026-10-01')).toBe(null);
  });
});
