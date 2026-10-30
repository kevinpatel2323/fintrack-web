import { describe, expect, it } from 'vitest';
import { accountNameIndex } from '../../../utils/accounts.js';
import {
  ENCRYPTED_TEXT,
  filterMemos,
  fmtCountdown,
  fmtMemoDay,
  fmtMemoTime,
  fmtRelative,
  fmtTxnDate,
  mapLink,
  memoAccount,
  memoAmount,
  memoAmountSortValue,
  memoDateSortValue,
  memoDay,
  memoLocationState,
  memoMatches,
  memoMessageState,
  memoMethod,
  memoPayee,
  memoSigned,
  memoSummaryLine,
  memoTime,
  memoTotals,
  memosListPath,
  normaliseMemo,
  parseMemosParams,
  patchMemosParams,
} from '../memoModel.js';
import { memosPeriodQuery } from '../../../services/memosApi.js';

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
  it('builds a Google Maps link from numeric coordinates', () => {
    expect(mapLink({ latitude: 23.0225, longitude: 72.5714 })).toBe('https://www.google.com/maps/search/?api=1&query=23.0225,72.5714');
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
  const month = { startIso: '2026-10-01', endIso: '2026-10-31' };

  it('reads the tab, search and period, ignoring unknown values', () => {
    expect(parseMemosParams(new URLSearchParams('tab=no-memo&q=%20chai%20&start=2026-09-01&end=2026-09-30'), month))
      .toEqual({ tab: 'no-memo', q: 'chai', start: '2026-09-01', end: '2026-09-30' });
    expect(parseMemosParams(new URLSearchParams('tab=bogus&start=sept'), month))
      .toEqual({ tab: 'all', q: '', start: '2026-10-01', end: '2026-10-31' });
  });

  it('leaves the defaults out of the URL', () => {
    const prev = new URLSearchParams('tab=debit&q=amazon&other=1');
    expect(patchMemosParams(prev, { tab: 'all' }).toString()).toBe('q=amazon&other=1');
    expect(patchMemosParams(prev, { q: '  ' }).toString()).toBe('tab=debit&other=1');
    expect(patchMemosParams(prev, { tab: 'credit', q: 'swiggy' }).toString()).toBe('tab=credit&q=swiggy&other=1');
    expect(patchMemosParams(prev, { start: '2026-09-01', end: '2026-09-30' }).toString())
      .toBe('tab=debit&q=amazon&other=1&start=2026-09-01&end=2026-09-30');
    expect(patchMemosParams(new URLSearchParams('start=2026-09-01&end=2026-09-30'), { start: '', end: '' }).toString())
      .toBe('');
  });

  it('builds the list path the record page goes back to', () => {
    expect(memosListPath('tab=debit&q=chai')).toBe('/memos?tab=debit&q=chai');
    expect(memosListPath('?tab=debit')).toBe('/memos?tab=debit');
    expect(memosListPath('')).toBe('/memos');
    expect(memosListPath(undefined)).toBe('/memos');
  });
});

describe('memosPeriodQuery', () => {
  it('asks for a whole period at once', () => {
    expect(memosPeriodQuery({ start: '2026-10-01', end: '2026-10-31' })).toBe('?start=2026-10-01&end=2026-10-31&pageSize=5000');
    expect(memosPeriodQuery({})).toBe('?pageSize=5000');
  });
});

describe('the day a memo belongs to', () => {
  it('uses the bank\'s date, else the local day it arrived', () => {
    expect(memoDay({ txnDate: '2026-10-28', receivedAt: new Date(2026, 9, 29, 10).toISOString() })).toBe('2026-10-28');
    expect(memoDay({ txnDate: null, receivedAt: null, capturedAt: new Date(2026, 9, 29, 23, 30).toISOString() })).toBe('2026-10-29');
    expect(memoDay({ txnDate: '29/10/2026', receivedAt: null, capturedAt: null, createdAt: null })).toBeNull();
  });

  it('prints it short, with the year only when it differs', () => {
    const now = new Date(2026, 9, 29);
    expect(fmtMemoDay('2026-10-29', now)).toBe('29 Oct');
    expect(fmtMemoDay('2025-01-03', now)).toBe('3 Jan 2025');
    expect(fmtMemoDay(null, now)).toBe('—');
  });

  it('orders by day, then by arrival within the day; no day sorts last', () => {
    const early = { txnDate: '2026-10-29', receivedAt: '2026-10-29T03:00:00.000Z' };
    const late = { txnDate: '2026-10-29', receivedAt: '2026-10-29T09:00:00.000Z' };
    const before = { txnDate: '2026-10-28', receivedAt: '2026-10-29T12:00:00.000Z' };
    const keys = [late, before, early].map(memoDateSortValue).sort();
    expect(keys).toEqual([before, early, late].map(memoDateSortValue));
    expect(memoDateSortValue({})).toBe('');
  });
});

describe('amounts', () => {
  it('signs money out negative and money in positive', () => {
    expect(memoSigned({ amount: 250, direction: 'debit' })).toBe(-250);
    expect(memoSigned({ amount: '5000.50', direction: 'credit' })).toBe(5000.5);
    expect(memoSigned({ amount: 80, direction: null })).toBe(80);
    expect(memoSigned({ amount: null, direction: 'debit' })).toBeNull();
  });

  it('sorts by spend, as Transactions does: money out first when descending', () => {
    const values = [
      { amount: 5000, direction: 'credit' },
      { amount: 250, direction: 'debit' },
      { amount: 1234, direction: 'debit' },
      { amount: 99, direction: null },
    ].map(memoAmountSortValue);
    expect(values).toEqual([-5000, 250, 1234, 0]);
    expect(memoAmountSortValue({ amount: null, direction: 'debit' })).toBeNull();
  });

  it('totals money out and in, and counts memos still to write', () => {
    expect(memoTotals([
      { amount: 250, direction: 'debit', memo: 'chai' },
      { amount: 1234, direction: 'debit', memo: null },
      { amount: 5000, direction: 'credit', memo: '  ' },
      { amount: null, direction: 'debit', memo: null },
    ])).toEqual({ count: 4, withoutMemo: 3, out: 1484, in: 5000 });
  });
});

describe('method', () => {
  it('names the channel, AutoPay for a mandate', () => {
    expect(memoMethod({ channel: 'upi' })).toBe('UPI');
    expect(memoMethod({ channel: 'netbanking' })).toBe('Net banking');
    expect(memoMethod({ channel: 'mandate' })).toBe('AutoPay');
    expect(memoMethod({ channel: 'cheque' })).toBe('cheque');
    expect(memoMethod({ channel: null })).toBeNull();
  });
});

describe('search and segments', () => {
  const rows = [
    { id: '1', merchant: 'AMAZON', vpa: null, memo: 'phone case for Het', sender: 'AX-HDFCBK-S', bank: 'hdfc', last4: '2209', reference: null, amount: 1234, direction: 'debit' },
    { id: '2', merchant: null, vpa: 'chai.point@okaxis', memo: null, sender: 'VM-HDFCBK', bank: 'hdfc', last4: '6714', reference: '630212340001', amount: 250, direction: 'debit', instrument: 'account' },
    { id: '3', merchant: 'rahul.s@ybl', vpa: 'rahul.s@ybl', memo: null, sender: '+919898794108', bank: 'kotak', last4: '1234', reference: '630212340002', amount: 5000, direction: 'credit' },
  ];
  const ids = (list) => list.map((m) => m.id);

  it('finds text in the payee, UPI id, memo, sender, bank, digits and reference', () => {
    expect(ids(rows.filter((m) => memoMatches(m, 'het')))).toEqual(['1']);
    expect(ids(rows.filter((m) => memoMatches(m, 'OKAXIS')))).toEqual(['2']);
    expect(ids(rows.filter((m) => memoMatches(m, 'kotak')))).toEqual(['3']);
    expect(ids(rows.filter((m) => memoMatches(m, '6714')))).toEqual(['2']);
    expect(ids(rows.filter((m) => memoMatches(m, '630212340002')))).toEqual(['3']);
  });

  it('finds an amount however it is typed', () => {
    expect(ids(rows.filter((m) => memoMatches(m, '₹1,234')))).toEqual(['1']);
    expect(ids(rows.filter((m) => memoMatches(m, '1,234')))).toEqual(['1']);
    expect(ids(rows.filter((m) => memoMatches(m, '5000')))).toEqual(['3']);
    // Plain digits also find account digits and references that contain them.
    expect(ids(rows.filter((m) => memoMatches(m, '1234')))).toEqual(['1', '2', '3']);
  });

  it('finds a bank account by its holder name', () => {
    const names = accountNameIndex([{ accountNumber: '50100123456714', holderName: 'Kevin Patel' }]);
    expect(ids(rows.filter((m) => memoMatches(m, 'kevin', names)))).toEqual(['2']);
    expect(ids(filterMemos(rows, { q: 'kevin', accountNames: names }))).toEqual(['2']);
  });

  it('applies the segment, then the search', () => {
    expect(ids(filterMemos(rows, { tab: 'no-memo' }))).toEqual(['2', '3']);
    expect(ids(filterMemos(rows, { tab: 'debit' }))).toEqual(['1', '2']);
    expect(ids(filterMemos(rows, { tab: 'credit', q: 'rahul' }))).toEqual(['3']);
    expect(ids(filterMemos(rows, { tab: 'all', q: '' }))).toEqual(['1', '2', '3']);
  });
});

describe('what the record page can show', () => {
  it('tells a readable message from an encrypted one and from none', () => {
    expect(memoMessageState(null)).toBe('loading');
    expect(memoMessageState({ hasMessage: true, rawMessage: 'Sent Rs.500' })).toBe('text');
    expect(memoMessageState({ hasMessage: true, rawMessage: null })).toBe('encrypted');
    expect(memoMessageState({ hasMessage: false, rawMessage: null })).toBe('none');
  });

  it('never calls an unreadable location "not recorded"', () => {
    expect(memoLocationState(null)).toEqual({ kind: 'loading' });
    expect(memoLocationState({ hasLocation: true, location: { latitude: 23.02, longitude: 72.57 } }))
      .toEqual({ kind: 'map', href: 'https://www.google.com/maps/search/?api=1&query=23.02,72.57' });
    expect(memoLocationState({ hasLocation: true, location: null })).toEqual({ kind: 'encrypted' });
    expect(memoLocationState({ hasLocation: false, location: null })).toEqual({ kind: 'none' });
    expect(ENCRYPTED_TEXT).toBe('Stored encrypted — this server can’t read it');
  });

  it('sums up what happened in one line', () => {
    expect(memoSummaryLine({ direction: 'debit', txnDate: '2026-10-29', bank: 'hdfc', last4: '6714' }))
      .toBe('You paid · 29 Oct 2026 · HDFC ••6714');
    expect(memoSummaryLine({ direction: 'credit', txnDate: null, receivedAt: null, capturedAt: null, createdAt: null }))
      .toBe('You received');
    expect(memoSummaryLine({ direction: null, txnDate: '2026-10-29' })).toBe('Bank SMS · 29 Oct 2026');
  });
});

describe('memoAccount with account names', () => {
  const names = accountNameIndex([
    { accountNumber: '50100123456714', holderName: 'Kevin Patel' },
    { accountNumber: '50100555552209', holderName: null },
  ]);

  it('shows a bank account SMS by its holder when the last four digits find a named account', () => {
    expect(memoAccount({ bank: 'hdfc', last4: '6714', instrument: 'account' }, names)).toBe('Kevin Patel');
  });

  it('keeps the bank and digits for a card, an unnamed account or no lookup', () => {
    expect(memoAccount({ bank: 'hdfc', last4: '6714', instrument: 'card' }, names)).toBe('HDFC ••6714');
    expect(memoAccount({ bank: 'hdfc', last4: '2209', instrument: 'account' }, names)).toBe('HDFC ••2209');
    expect(memoAccount({ bank: 'hdfc', last4: '6714', instrument: 'account' })).toBe('HDFC ••6714');
  });
});
