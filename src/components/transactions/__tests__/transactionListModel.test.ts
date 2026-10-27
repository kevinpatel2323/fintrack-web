import { describe, expect, it } from 'vitest';
import {
  ccExpansionItems,
  countActiveFilters,
  emptyManualForm,
  flattenWithExpansion,
  formatDayLabel,
  formatRangeLabel,
  getCurrentMonthRange,
  getMonthOptions,
  groupRowsByDay,
  manualFormToPayload,
  matchMonthValue,
  signedAmount,
  validateManualForm,
} from '../transactionListModel.js';

const NOW = new Date(2026, 9, 28, 12); // 28 Oct 2026, local noon

describe('periods', () => {
  it('builds the current month and the last N months, newest first', () => {
    expect(getCurrentMonthRange(NOW)).toEqual({ startIso: '2026-10-01', endIso: '2026-10-31' });
    const months = getMonthOptions(3, NOW);
    expect(months.map((m) => m.value)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(months[1]).toMatchObject({ startIso: '2026-09-01', endIso: '2026-09-30' });
  });

  it('matches a range to a whole month only', () => {
    const months = getMonthOptions(3, NOW);
    expect(matchMonthValue('2026-09-01', '2026-09-30', months)).toBe('2026-09');
    expect(matchMonthValue('2026-09-01', '2026-09-29', months)).toBe('');
  });

  it('labels a custom range, with the year once when both ends share it', () => {
    expect(formatRangeLabel('2026-10-01', '2026-10-15')).toBe('1 Oct – 15 Oct 2026');
    expect(formatRangeLabel('2025-12-20', '2026-01-05')).toBe('20 Dec 2025 – 5 Jan 2026');
    expect(formatRangeLabel('', '2026-01-05')).toBe('');
  });
});

describe('day groups', () => {
  const rows = [
    { id: 1, date: '2026-10-27T00:00:00.000Z', amount: 100, isIncome: false },
    { id: 2, date: '2026-10-28T00:00:00.000Z', amount: 50, isIncome: true },
    { id: 3, date: '2026-10-27T00:00:00.000Z', amount: 30, isIncome: true },
    { id: 4, date: null, amount: 5, isIncome: false },
  ];

  it('groups newest day first, keeps row order and nets each day', () => {
    const groups = groupRowsByDay(rows);
    expect(groups.map((g) => g.key)).toEqual(['unknown', '2026-10-28', '2026-10-27']);
    const oct27 = groups.find((g) => g.key === '2026-10-27');
    expect(oct27.rows.map((r) => r.id)).toEqual([1, 3]);
    expect(oct27.net).toBe(-70);
  });

  it('signs amounts by direction', () => {
    expect(signedAmount({ amount: '12.5', isIncome: false })).toBe(-12.5);
    expect(signedAmount({ amount: 12, isIncome: true })).toBe(12);
  });

  it('labels today, yesterday and other days', () => {
    expect(formatDayLabel('2026-10-28', NOW)).toBe('Today');
    expect(formatDayLabel('2026-10-27', NOW)).toBe('Yesterday');
    expect(formatDayLabel('2026-10-21', NOW)).toMatch(/21 Oct/);
    expect(formatDayLabel('2025-11-03', NOW)).toMatch(/2025/);
    expect(formatDayLabel('unknown', NOW)).toBe('No date');
  });
});

describe('nested card bill rows', () => {
  const toRow = (t: { id: number; amount: number }) => ({ id: t.id, amount: t.amount, isIncome: false });

  it('inserts children only after expanded rows', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const out = flattenWithExpansion(rows, new Set([2]), (r: { id: number }) => [{ key: `${r.id}:a` }, { key: `${r.id}:b` }]);
    expect(out.map((r: { id?: number; key?: string }) => r.key ?? r.id)).toEqual([1, 2, '2:a', '2:b', 3]);
    expect(flattenWithExpansion(rows, new Set(), () => [{}])).toBe(rows);
  });

  it('shows a note while loading, on error and when unlinked', () => {
    expect(ccExpansionItems(9, undefined, toRow)).toEqual([
      { kind: 'note', key: '9:note', parentId: 9, text: 'Loading card transactions…' },
    ]);
    expect(ccExpansionItems(9, { error: 'Nope' }, toRow)[0].text).toBe('Nope');
    expect(ccExpansionItems(9, { linked: false }, toRow)[0].text).toBe('Not linked to a card bill.');
    expect(ccExpansionItems(9, { linked: true, coveredTransactions: [] }, toRow)[0].text)
      .toBe('No card transactions covered.');
  });

  it('maps covered transactions and appends the remainder line', () => {
    const items = ccExpansionItems(
      9,
      { linked: true, remainder: '120.5', coveredTransactions: [{ id: 1, amount: 10 }, { id: 2, amount: 20 }] },
      toRow,
    );
    expect(items.map((i: { key: string }) => i.key)).toEqual(['9:1', '9:2', '9:remainder']);
    expect(items[0]).toMatchObject({ kind: 'nested', id: 1, last: false });
    expect(items[1]).toMatchObject({ kind: 'nested', id: 2, last: false });
    expect(items[2]).toMatchObject({ kind: 'remainder', amount: 120.5, text: 'Carried forward / other charges' });

    const settled = ccExpansionItems(9, { linked: true, remainder: 0, coveredTransactions: [{ id: 1, amount: 10 }] }, toRow);
    expect(settled).toHaveLength(1);
    expect(settled[0].last).toBe(true);
    const short = ccExpansionItems(9, { linked: true, remainder: -4, coveredTransactions: [] }, toRow);
    expect(short[1].text).toBe('Not covered by this payment');
  });
});

describe('filters', () => {
  const defaultRange = { startIso: '2026-10-01', endIso: '2026-10-31' };

  it('counts type, account, category and a non-default period', () => {
    const base = { filterTab: 'all', account: '', category: '', rangeStart: '2026-10-01', rangeEnd: '2026-10-31', defaultRange };
    expect(countActiveFilters(base)).toBe(0);
    expect(countActiveFilters({ ...base, filterTab: 'spent', account: 'x', category: '__none__' })).toBe(3);
    expect(countActiveFilters({ ...base, rangeStart: '2026-09-01', rangeEnd: '2026-09-30' })).toBe(1);
  });
});

describe('manual transaction form', () => {
  it('flags each invalid field', () => {
    const errors = validateManualForm({
      ...emptyManualForm(''),
      type: 'SETTLEMENT',
      settlementDirection: '',
      amount: '-2',
      balance: '-1',
    });
    expect(Object.keys(errors).sort()).toEqual(
      ['amount', 'balance', 'narration', 'settlementDirection', 'transactionDate'].sort(),
    );
    expect(validateManualForm({ ...emptyManualForm('2026-10-28'), narration: 'Chai', amount: '20' })).toEqual({});
  });

  it('builds the same request body the page always sent', () => {
    const form = {
      ...emptyManualForm('2026-10-28'),
      narration: '  Chai ',
      amount: '20.5',
      balance: '',
      upiName: ' Ramesh ',
    };
    expect(manualFormToPayload(form)).toEqual({
      transactionDate: '2026-10-28',
      narration: 'Chai',
      type: 'PAID',
      settlementDirection: undefined,
      amount: 20.5,
      balance: undefined,
      upiName: 'Ramesh',
      upiDescription: undefined,
      upiBank: undefined,
    });
    expect(manualFormToPayload({ ...form, type: 'SETTLEMENT', settlementDirection: 'DEPOSIT', balance: '0' }))
      .toMatchObject({ settlementDirection: 'DEPOSIT', balance: 0 });
  });
});
