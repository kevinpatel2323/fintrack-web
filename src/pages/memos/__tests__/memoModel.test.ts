import { describe, expect, it } from 'vitest';
import {
  fmtCountdown,
  fmtMemoTime,
  fmtRelative,
  fmtTxnDate,
  mapLink,
  memoAccount,
  memoAmount,
  memoPayee,
  memoTime,
  normaliseMemo,
  parseMemosParams,
  patchMemosParams,
} from '../memoModel.js';
import { memosQuery } from '../../../services/memosApi.js';

describe('memoPayee', () => {
  it('falls back from merchant to UPI id to sender', () => {
    expect(memoPayee({ merchant: 'AMAZON', vpa: 'amzn@apl', sender: 'HDFCBK' })).toBe('AMAZON');
    expect(memoPayee({ merchant: null, vpa: 'chai@okaxis', sender: 'HDFCBK' })).toBe('chai@okaxis');
    expect(memoPayee({ merchant: '  ', vpa: null, sender: 'VM-HDFCBK' })).toBe('VM-HDFCBK');
  });

  it('says Unknown when nothing was read', () => {
    expect(memoPayee({ merchant: null, vpa: null, sender: null })).toBe('Unknown');
    expect(memoPayee(null)).toBe('Unknown');
  });
});

describe('memoAccount', () => {
  it('uppercases the bank and adds the last four digits', () => {
    expect(memoAccount({ bank: 'hdfc', last4: '2209' })).toBe('HDFC ••2209');
  });

  it('shows whichever half is known, or nothing', () => {
    expect(memoAccount({ bank: 'Icici', last4: null })).toBe('ICICI');
    expect(memoAccount({ bank: null, last4: '6714' })).toBe('••6714');
    expect(memoAccount({ bank: null, last4: null })).toBeNull();
  });
});

describe('memoTime', () => {
  it('prefers received, then captured, then stored', () => {
    expect(memoTime({ receivedAt: 'r', capturedAt: 'c', createdAt: 'x' })).toBe('r');
    expect(memoTime({ receivedAt: null, capturedAt: 'c', createdAt: 'x' })).toBe('c');
    expect(memoTime({ receivedAt: null, capturedAt: null, createdAt: 'x' })).toBe('x');
  });
});

describe('memoAmount', () => {
  it('signs debits as money out and credits as money in', () => {
    expect(memoAmount({ amount: 1234, direction: 'debit' })).toEqual({ value: -1234, sign: 'always', tone: 'out', decimals: 0 });
    expect(memoAmount({ amount: 5000, direction: 'credit' })).toEqual({ value: 5000, sign: 'always', tone: 'in', decimals: 0 });
  });

  it('prints an amount with no direction plain, and paise only when present', () => {
    expect(memoAmount({ amount: 250.5, direction: null })).toEqual({ value: 250.5, sign: 'never', tone: 'inherit', decimals: 2 });
  });

  it('has no value when the amount was not read', () => {
    expect(memoAmount({ amount: null, direction: 'debit' }).value).toBeNull();
    expect(memoAmount({ amount: 'abc', direction: 'debit' }).value).toBeNull();
  });
});

describe('normaliseMemo', () => {
  it('trims, and stores an empty memo as null', () => {
    expect(normaliseMemo('  phone case for Het ')).toBe('phone case for Het');
    expect(normaliseMemo('   ')).toBeNull();
    expect(normaliseMemo(null)).toBeNull();
  });

  it('caps the memo at 500 characters', () => {
    expect(normaliseMemo('x'.repeat(600))).toHaveLength(500);
  });
});

describe('mapLink', () => {
  it('builds an Apple Maps link from numeric coordinates', () => {
    expect(mapLink({ latitude: 23.0225, longitude: 72.5714 })).toBe('https://maps.apple.com/?ll=23.0225,72.5714');
  });

  it('refuses anything that is not a finite number in range', () => {
    expect(mapLink(null)).toBeNull();
    expect(mapLink({ latitude: '23.0', longitude: '72.5' })).toBeNull();
    expect(mapLink({ latitude: NaN, longitude: 72 })).toBeNull();
    expect(mapLink({ latitude: 23, longitude: Infinity })).toBeNull();
    expect(mapLink({ latitude: 123, longitude: 72 })).toBeNull();
    expect(mapLink({ latitude: '1&q=evil', longitude: 2 })).toBeNull();
  });
});

describe('formatting', () => {
  const now = new Date(2026, 9, 29, 15, 0);

  it('prints the received time, with the year only when it differs', () => {
    expect(fmtMemoTime(new Date(2026, 9, 29, 14, 32).toISOString(), now)).toBe('29 Oct 14:32');
    expect(fmtMemoTime(new Date(2025, 0, 3, 9, 5).toISOString(), now)).toBe('3 Jan 2025 09:05');
    expect(fmtMemoTime(null, now)).toBe('—');
  });

  it('prints the bank date', () => {
    expect(fmtTxnDate('2026-10-29')).toBe('29 Oct 2026');
    expect(fmtTxnDate('29/10/2026')).toBeNull();
  });

  it('says how long ago', () => {
    expect(fmtRelative(new Date(2026, 9, 29, 14, 59, 40).toISOString(), now)).toBe('just now');
    expect(fmtRelative(new Date(2026, 9, 29, 14, 55).toISOString(), now)).toBe('5 min ago');
    expect(fmtRelative(new Date(2026, 9, 29, 12, 0).toISOString(), now)).toBe('3 h ago');
    expect(fmtRelative(new Date(2026, 9, 28, 12, 0).toISOString(), now)).toBe('yesterday');
    expect(fmtRelative(new Date(2026, 9, 25, 12, 0).toISOString(), now)).toBe('4 days ago');
    expect(fmtRelative(new Date(2026, 8, 1, 12, 0).toISOString(), now)).toBe('1 Sep');
    expect(fmtRelative(null, now)).toBeNull();
  });

  it('counts a pairing code down', () => {
    expect(fmtCountdown(581_000)).toBe('9:41');
    expect(fmtCountdown(5_000)).toBe('0:05');
    expect(fmtCountdown(-1)).toBe('0:00');
  });
});

describe('URL params', () => {
  it('reads the tab and search, ignoring unknown tabs', () => {
    expect(parseMemosParams(new URLSearchParams('tab=no-memo&q=%20chai%20'))).toEqual({ tab: 'no-memo', q: 'chai' });
    expect(parseMemosParams(new URLSearchParams('tab=bogus'))).toEqual({ tab: 'all', q: '' });
  });

  it('leaves the defaults out of the URL', () => {
    const prev = new URLSearchParams('tab=debit&q=amazon&other=1');
    expect(patchMemosParams(prev, { tab: 'all' }).toString()).toBe('q=amazon&other=1');
    expect(patchMemosParams(prev, { q: '  ' }).toString()).toBe('tab=debit&other=1');
    expect(patchMemosParams(prev, { tab: 'credit', q: 'swiggy' }).toString()).toBe('tab=credit&q=swiggy&other=1');
  });
});

describe('memosQuery', () => {
  it('sends the tab, search and page to the API', () => {
    expect(memosQuery({ tab: 'no-memo', q: ' chai ', page: 2, pageSize: 25 })).toBe('?tab=no-memo&q=chai&page=2&pageSize=25');
    expect(memosQuery({ tab: 'all', q: '', page: 1, pageSize: 50 })).toBe('?page=1&pageSize=50');
  });
});
