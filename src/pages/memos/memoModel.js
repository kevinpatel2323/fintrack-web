// What a captured bank SMS says, in words and numbers: who it was paid to or
// from, which account, which day it belongs to, its signed amount, the map
// link, the list's filters and URL params. Every parsed field on a memo can be
// null, so each helper has a fallback. No React, so it is unit-tested in node.
// Shared by the list (pages/Memos.jsx, MemosPhone.jsx, memoColumns.jsx) and the
// record page (pages/MemoDetail.jsx, MemoDetailPhone.jsx).

import { accountNameForLast4 } from '../../utils/accounts.js';

export const MEMO_MAX_LENGTH = 500;

/** The list's segments: the `tab` URL param. */
export const TABS = [
  { id: 'all', label: 'All' },
  { id: 'no-memo', label: 'No memo' },
  { id: 'debit', label: 'Debit' },
  { id: 'credit', label: 'Credit' },
];
const TAB_IDS = new Set(TABS.map((t) => t.id));

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const isIsoDay = (value) => typeof value === 'string' && ISO_DAY.test(value);

/** Merchant, else the UPI id, else the SMS sender, else "Unknown". */
export function memoPayee(memo) {
  return text(memo?.merchant) || text(memo?.vpa) || text(memo?.sender) || 'Unknown';
}

/**
 * "HDFC ••2209", "HDFC", "••2209", or null when neither is known. A bank
 * account's SMS shows the holder's name instead ("Kevin Patel") when its last
 * four digits find one named account (`accountNames` from `useAccountNames()`).
 */
export function memoAccount(memo, accountNames) {
  const bank = text(memo?.bank).toUpperCase();
  const last4 = text(memo?.last4);
  const holder = memo?.instrument === 'account' ? accountNameForLast4(last4, accountNames) : null;
  if (holder) return holder;
  if (bank && last4) return `${bank} ••${last4}`;
  if (bank) return bank;
  if (last4) return `••${last4}`;
  return null;
}

/**
 * "You paid · 29 Oct 2026 · HDFC ••6714": what happened, on the bank's date
 * (else when the SMS arrived), from which account — the record's summary line.
 */
export function memoSummaryLine(memo, accountNames) {
  const verb = memo?.direction === 'debit' ? 'You paid' : memo?.direction === 'credit' ? 'You received' : 'Bank SMS';
  const time = memoTime(memo);
  const when = fmtTxnDate(memo?.txnDate) || (time ? fmtMemoTime(time) : null);
  return [verb, when, memoAccount(memo, accountNames)].filter(Boolean).join(' · ');
}

/** When the SMS arrived: received, else captured on the phone, else stored. */
export function memoTime(memo) {
  return memo?.receivedAt || memo?.capturedAt || memo?.createdAt || null;
}

const pad = (n) => String(n).padStart(2, '0');

function toDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The day a memo belongs to, `YYYY-MM-DD`: the date the bank printed in the
 * SMS, else the (local) day it arrived. The API files memos under the same day
 * for the period filter. Null when neither is known.
 */
export function memoDay(memo) {
  if (isIsoDay(memo?.txnDate)) return memo.txnDate;
  const d = toDate(memoTime(memo));
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;
}

/**
 * The Date column's order: the memo's day, then the moment it arrived, so a
 * day's memos stay in arrival order. Blank (sorted last) when there is no day.
 */
export function memoDateSortValue(memo) {
  const day = memoDay(memo);
  if (!day) return '';
  const t = toDate(memoTime(memo));
  return `${day} ${t ? t.toISOString() : ''}`.trim();
}

/**
 * The amount with its ledger sign: money out (debit) negative, money in
 * (credit) positive, an amount with no direction as read. Null when the
 * amount wasn't read.
 */
export function memoSigned(memo) {
  const n = memo?.amount == null || memo.amount === '' ? NaN : Number(memo.amount);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  if (memo.direction === 'debit') return -abs;
  return abs;
}

/**
 * The amount as the kit `Amount` should print it: a debit is money out
 * (negative, ink), a credit money in (positive, green). With no direction the
 * figure prints plain. `value` is null when the amount wasn't read; paise
 * show only when the SMS had them.
 */
export function memoAmount(memo) {
  const n = memo?.amount == null || memo.amount === '' ? NaN : Number(memo.amount);
  if (!Number.isFinite(n)) return { value: null, sign: 'never', tone: 'muted', decimals: 0 };
  const abs = Math.abs(n);
  const decimals = Number.isInteger(abs) ? 0 : 2;
  if (memo.direction === 'debit') return { value: -abs, sign: 'always', tone: 'out', decimals };
  if (memo.direction === 'credit') return { value: abs, sign: 'always', tone: 'in', decimals };
  return { value: abs, sign: 'never', tone: 'inherit', decimals };
}

/**
 * The Amount column's order, as on Transactions: spend first when descending
 * (money out counts positive, money in negative, an amount with no direction
 * in between). Blank when the amount wasn't read.
 */
export function memoAmountSortValue(memo) {
  const signed = memoSigned(memo);
  if (signed == null) return null;
  return memo.direction === 'debit' || memo.direction === 'credit' ? -signed : 0;
}

/** The memo as the API stores it: trimmed, and null when empty. */
export function normaliseMemo(value) {
  const t = text(value);
  return t ? t.slice(0, MEMO_MAX_LENGTH) : null;
}

/**
 * Google Maps at the SMS's location (opened in a new tab), built only from
 * finite numbers in range; null otherwise. Nothing else from the API goes into
 * the URL.
 */
export function mapLink(location) {
  if (!location) return null;
  const lat = typeof location.latitude === 'number' ? location.latitude : NaN;
  const lon = typeof location.longitude === 'number' ? location.longitude : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/**
 * What the record page can show of the stored SMS text:
 *   'loading'   — the record hasn't loaded yet
 *   'text'      — `rawMessage` is readable
 *   'encrypted' — stored, but sealed with a key this server doesn't hold
 *   'none'      — nothing was stored
 */
export function memoMessageState(detail) {
  if (!detail) return 'loading';
  if (typeof detail.rawMessage === 'string' && detail.rawMessage !== '') return 'text';
  return detail.hasMessage ? 'encrypted' : 'none';
}

/**
 * The location the same way: `{ kind: 'map', href }` for a readable point,
 * `{ kind: 'encrypted' }` when it is stored but this server can't open it,
 * `{ kind: 'none' }` when none was recorded, `{ kind: 'loading' }` before the
 * record loads.
 */
export function memoLocationState(detail) {
  if (!detail) return { kind: 'loading' };
  const href = mapLink(detail.location);
  if (href) return { kind: 'map', href };
  if (detail.hasLocation) return { kind: 'encrypted' };
  return { kind: 'none' };
}

export const ENCRYPTED_TEXT = 'Stored encrypted — this server can’t read it';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "29 Oct 14:32" this year, "29 Oct 2025 14:32" before; "—" when unknown. Local time. */
export function fmtMemoTime(iso, now = new Date()) {
  const d = toDate(iso);
  if (!d) return '—';
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "29 Oct" for a `YYYY-MM-DD` day this year, "29 Oct 2025" before; "—" otherwise. */
export function fmtMemoDay(day, now = new Date()) {
  const m = ISO_DAY.exec(day || '');
  if (!m) return '—';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return '—';
  const year = Number(m[1]) === now.getFullYear() ? '' : ` ${m[1]}`;
  return `${Number(m[3])} ${month}${year}`;
}

/** "29 Oct 2026" for a `YYYY-MM-DD` date as the bank printed it. */
export function fmtTxnDate(value) {
  const m = ISO_DAY.exec(value || '');
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : null;
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then the date. */
export function fmtRelative(iso, now = new Date()) {
  const d = toDate(iso);
  if (!d) return null;
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

/** "9:41" for the time left on a pairing code; "0:00" once it has run out. */
export function fmtCountdown(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** How the money moved, as the Method column names it. */
export const CHANNELS = {
  upi: 'UPI',
  card: 'Card',
  imps: 'IMPS',
  neft: 'NEFT',
  rtgs: 'RTGS',
  atm: 'ATM',
  netbanking: 'Net banking',
  charge: 'Bank charge',
  mandate: 'AutoPay',
};

/** "UPI", "Net banking", …; the raw value for one this app doesn't know; null when unknown. */
export function memoMethod(memo) {
  const channel = text(memo?.channel);
  if (!channel) return null;
  return CHANNELS[channel] || channel;
}

/** "Debit (money out)", "Credit (money in)", or null. */
export function memoDirection(memo) {
  if (memo?.direction === 'debit') return 'Debit (money out)';
  if (memo?.direction === 'credit') return 'Credit (money in)';
  return null;
}

export const PARSE_STATUS = {
  parsed: { label: 'Parsed', theme: 'green' },
  partial: { label: 'Partly read', theme: 'amber' },
  unreadable: { label: 'Unreadable', theme: 'red' },
};
export const parseStatusOf = (status) => PARSE_STATUS[status] || { label: 'Not parsed', theme: 'gray' };

export const DEVICE_STATUS = {
  pairing: { label: 'Waiting to pair', theme: 'amber' },
  active: { label: 'Active', theme: 'green' },
  revoked: { label: 'Revoked', theme: 'gray' },
  expired: { label: 'Code expired', theme: 'gray' },
};
export const deviceStatusOf = (status) => DEVICE_STATUS[status] || { label: status || 'Unknown', theme: 'gray' };

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── The list: search, segments, totals ─────────────────────────────────────

/**
 * Whether the search `q` finds the memo: payee, UPI id, memo, sender, bank,
 * last four digits, reference or the account as shown (a holder's name, with
 * `accountNames`) contain it (any case), or — for a number — the amount's
 * digits do ("1234", "1,234" and "₹1,234" all find ₹1,234).
 */
export function memoMatches(memo, q, accountNames) {
  const needle = text(q).toLowerCase();
  if (!needle) return true;
  const fields = [
    memoPayee(memo), memo?.merchant, memo?.vpa, memo?.memo, memo?.sender, memo?.bank, memo?.last4, memo?.reference,
    memoAccount(memo, accountNames),
  ];
  if (fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(needle))) return true;
  const digits = needle.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(digits)) return false;
  const amount = memo?.amount == null || memo.amount === '' ? NaN : Number(memo.amount);
  if (!Number.isFinite(amount)) return false;
  if (Number(digits) === Math.abs(amount)) return true;
  return String(Math.abs(amount)).includes(digits);
}

/** The memos a segment (`tab`) and search (`q`) leave, in the given order. */
export function filterMemos(rows, { tab = 'all', q = '', accountNames } = {}) {
  let list = rows || [];
  if (tab === 'no-memo') list = list.filter((m) => !text(m.memo));
  else if (tab === 'debit' || tab === 'credit') list = list.filter((m) => m.direction === tab);
  if (text(q)) list = list.filter((m) => memoMatches(m, q, accountNames));
  return list;
}

/** `{ count, withoutMemo, out, in }` for the summary line: money out and in, in rupees. */
export function memoTotals(rows) {
  const totals = { count: 0, withoutMemo: 0, out: 0, in: 0 };
  for (const m of rows || []) {
    totals.count += 1;
    if (!text(m.memo)) totals.withoutMemo += 1;
    const signed = memoSigned(m);
    if (signed == null) continue;
    if (m.direction === 'debit') totals.out += -signed;
    else if (m.direction === 'credit') totals.in += signed;
  }
  return totals;
}

// ── URL params ─────────────────────────────────────────────────────────────

/**
 * `tab`, `q` and the period (`start`, `end`) from the URL; anything unknown
 * reads as All, no search, and the `defaults` period (`{ startIso, endIso }`).
 */
export function parseMemosParams(searchParams, defaults = {}) {
  const tab = searchParams.get('tab');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  return {
    tab: TAB_IDS.has(tab) ? tab : 'all',
    q: (searchParams.get('q') || '').trim(),
    start: isIsoDay(start) ? start : defaults.startIso || '',
    end: isIsoDay(end) ? end : defaults.endIso || '',
  };
}

/** The URL params with `patch` (`{ tab?, q?, start?, end? }`) applied; defaults are left out. */
export function patchMemosParams(prev, patch) {
  const next = new URLSearchParams(prev);
  if ('tab' in patch) {
    if (patch.tab && patch.tab !== 'all' && TAB_IDS.has(patch.tab)) next.set('tab', patch.tab);
    else next.delete('tab');
  }
  if ('q' in patch) {
    const q = (patch.q || '').trim();
    if (q) next.set('q', q);
    else next.delete('q');
  }
  for (const key of ['start', 'end']) {
    if (!(key in patch)) continue;
    if (isIsoDay(patch[key])) next.set(key, patch[key]);
    else next.delete(key);
  }
  return next;
}

/** The list's path with the search it was left at (`?tab=…`), for breadcrumbs and Back. */
export function memosListPath(listSearch) {
  const raw = typeof listSearch === 'string' ? listSearch.trim() : '';
  if (!raw || raw === '?') return '/memos';
  return raw.startsWith('?') ? `/memos${raw}` : `/memos?${raw}`;
}
