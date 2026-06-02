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
    });
  });

  it('falls back to defaults for invalid dates', () => {
    const params = new URLSearchParams('start=bad&tab=nope');
    expect(parseTransactionsListParams(params, defaults)).toEqual({
      rangeStart: defaults.startIso,
      rangeEnd: defaults.endIso,
      filterTab: 'all',
      search: '',
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

  it('builds list path with or without leading question mark', () => {
    expect(transactionsListPath('start=2026-01-01')).toBe('/transactions?start=2026-01-01');
    expect(transactionsListPath('?start=2026-01-01')).toBe('/transactions?start=2026-01-01');
    expect(transactionsListPath('')).toBe('/transactions');
  });
});
