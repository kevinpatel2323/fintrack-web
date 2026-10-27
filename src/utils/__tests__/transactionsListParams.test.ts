import { describe, expect, it } from 'vitest';
import {
  parseTransactionsListParams,
  patchTransactionsListParams,
  transactionsListPath,
} from '../transactionsListParams.js';

describe('transactionsListParams', () => {
  const defaults = { startIso: '2026-06-01', endIso: '2026-06-30' };

  it('parses valid URL params with defaults for missing values', () => {
    const params = new URLSearchParams('start=2026-01-01&end=2026-01-31&tab=spent&q=coffee');
    expect(parseTransactionsListParams(params, defaults)).toEqual({
      rangeStart: '2026-01-01',
      rangeEnd: '2026-01-31',
      filterTab: 'spent',
      search: 'coffee',
      categoryFilter: '',
    });
  });

  it('falls back to defaults for invalid dates', () => {
    const params = new URLSearchParams('start=bad&tab=nope');
    expect(parseTransactionsListParams(params, defaults)).toEqual({
      rangeStart: defaults.startIso,
      rangeEnd: defaults.endIso,
      filterTab: 'all',
      search: '',
      categoryFilter: '',
    });
  });

  it('patches start, end, tab, and search', () => {
    const next = patchTransactionsListParams(new URLSearchParams(), {
      rangeStart: '2026-03-01',
      rangeEnd: '2026-03-15',
      filterTab: 'earned',
      search: '  rent ',
    });
    expect(next.toString()).toBe('start=2026-03-01&end=2026-03-15&tab=earned&q=rent');
  });

  it('reads category=none as the Uncategorised filter and other values as category ids', () => {
    expect(parseTransactionsListParams(new URLSearchParams('category=none'), defaults).categoryFilter)
      .toBe('__none__');
    expect(parseTransactionsListParams(new URLSearchParams('category=12'), defaults).categoryFilter)
      .toBe('12');
    expect(parseTransactionsListParams(new URLSearchParams('category='), defaults).categoryFilter)
      .toBe('');
  });

  it('patches the category filter, writing Uncategorised as category=none', () => {
    const start = new URLSearchParams('tab=spent');
    expect(patchTransactionsListParams(start, { categoryFilter: '__none__' }).toString())
      .toBe('tab=spent&category=none');
    expect(patchTransactionsListParams(start, { categoryFilter: 7 }).toString())
      .toBe('tab=spent&category=7');
    const cleared = patchTransactionsListParams(new URLSearchParams('tab=spent&category=none'), { categoryFilter: '' });
    expect(cleared.toString()).toBe('tab=spent');
    expect(patchTransactionsListParams(start, { categoryFilter: null }).toString()).toBe('tab=spent');
  });

  it('builds list path with or without leading question mark', () => {
    expect(transactionsListPath('start=2026-01-01')).toBe('/transactions?start=2026-01-01');
    expect(transactionsListPath('?start=2026-01-01')).toBe('/transactions?start=2026-01-01');
    expect(transactionsListPath('')).toBe('/transactions');
  });
});
