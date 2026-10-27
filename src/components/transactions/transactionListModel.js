/**
 * Pure helpers behind the transactions list: periods, day groups, nested
 * (card bill) rows, filter counts and the manual-entry form. No React, so the
 * rules are unit-testable in node.
 */

/** Calendar month that contains `now`, as UTC ISO dates. */
export function getCurrentMonthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return { startIso: start.toISOString().slice(0, 10), endIso: end.toISOString().slice(0, 10) };
}

/** Last `count` months, newest first, as `{ value: 'YYYY-MM', label, startIso, endIso }`. */
export function getMonthOptions(count = 24, now = new Date()) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i + 1, 0));
    out.push({
      value: start.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(start),
      startIso: start.toISOString().slice(0, 10),
      endIso: end.toISOString().slice(0, 10),
    });
  }
  return out;
}

/** `YYYY-MM` when the range covers exactly one calendar month, else '' (custom range). */
export function matchMonthValue(startIso, endIso, options) {
  const hit = options.find((m) => m.startIso === startIso && m.endIso === endIso);
  return hit ? hit.value : '';
}

/** Local `YYYY-MM-DD` for today (the manual form's default date). */
export function getTodayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "1 Oct – 15 Oct 2026" for a custom period; the year shows once when shared. */
export function formatRangeLabel(startIso, endIso) {
  const parse = (iso) => {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
  };
  const a = parse(startIso);
  const b = parse(endIso);
  if (!a || !b) return '';
  const dm = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const dmy = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (a.getUTCFullYear() === b.getUTCFullYear()) return `${dm.format(a)} – ${dmy.format(b)}`;
  return `${dmy.format(a)} – ${dmy.format(b)}`;
}

// ── Day groups (phone list) ───────────────────────────────────────────────

/** Day key a row files under. Same rule the ledger always used (UTC day of the date). */
export function dayKeyOf(date) {
  const d = date ? new Date(date) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'unknown';
}

/** Signed ledger effect of a normalized row: money in positive, out negative. */
export function signedAmount(row) {
  const amount = Number(row?.amount) || 0;
  return row?.isIncome ? amount : -amount;
}

/**
 * Rows grouped by day, newest day first, each with its net (in minus out).
 * Row order inside a day is kept as given.
 */
export function groupRowsByDay(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const key = dayKeyOf(r.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      key,
      rows: items,
      net: items.reduce((s, r) => s + signedAmount(r), 0),
    }));
}

/** "Today", "Yesterday", "Wed, 21 Oct", or "Mon, 3 Nov 2025" outside this year. */
export function formatDayLabel(dayKey, now = new Date()) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  if (!y || !m || !d) return 'No date';
  const today = getTodayIso(now);
  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey === today) return 'Today';
  if (dayKey === getTodayIso(yest)) return 'Yesterday';
  const date = new Date(y, m - 1, d);
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (y !== now.getFullYear()) opts.year = 'numeric';
  return new Intl.DateTimeFormat('en-IN', opts).format(date);
}

// ── Nested rows (desktop table) ───────────────────────────────────────────

/**
 * Inserts each expanded row's children straight after it. `expansionRows(row)`
 * returns the child items (nested transactions, notes, a remainder line); it
 * is only called for rows in `expandedIds`.
 */
export function flattenWithExpansion(rows, expandedIds, expansionRows) {
  if (!expandedIds || !expansionRows || expandedIds.size === 0) return rows;
  const out = [];
  for (const row of rows) {
    out.push(row);
    if (expandedIds.has(row.id)) {
      for (const child of expansionRows(row) || []) out.push(child);
    }
  }
  return out;
}

/**
 * Child items for an expanded card bill payment, from its cc-link detail:
 * a loading/error/empty note, the covered card transactions (already mapped
 * to table rows by `toRow`), and the remainder line when one is left.
 */
export function ccExpansionItems(parentId, detail, toRow) {
  const note = (text) => [{ kind: 'note', key: `${parentId}:note`, parentId, text }];
  if (!detail || detail.loading) return note('Loading card transactions…');
  if (detail.error) return note(detail.error);
  if (!detail.linked) return note('Not linked to a card bill.');

  const covered = detail.coveredTransactions || [];
  const remainder = Number(detail.remainder || 0);
  const items = covered.length === 0
    ? note('No card transactions covered.')
    : covered.map((t, i) => ({
      ...toRow(t),
      kind: 'nested',
      key: `${parentId}:${t.id}`,
      parentId,
      last: i === covered.length - 1 && remainder === 0,
    }));
  if (remainder !== 0) {
    items.push({
      kind: 'remainder',
      key: `${parentId}:remainder`,
      parentId,
      text: remainder > 0 ? 'Carried forward / other charges' : 'Not covered by this payment',
      amount: remainder,
    });
  }
  return items;
}

// ── Filters ───────────────────────────────────────────────────────────────

/** Filters the list's phone "Filter" button counts (search stays visible, so it is not one). */
export function countActiveFilters({ filterTab, account, category, rangeStart, rangeEnd, defaultRange }) {
  let n = 0;
  if (filterTab && filterTab !== 'all') n += 1;
  if (account) n += 1;
  if (category) n += 1;
  if (defaultRange && (rangeStart !== defaultRange.startIso || rangeEnd !== defaultRange.endIso)) n += 1;
  return n;
}

// ── Manual transaction form ───────────────────────────────────────────────

export const MANUAL_TYPES = [
  { label: 'Paid', value: 'PAID' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'I owe', value: 'I_OWE' },
  { label: 'Settlement', value: 'SETTLEMENT' },
];

export const SETTLEMENT_DIRECTIONS = [
  { label: 'Withdrawal', value: 'WITHDRAWAL' },
  { label: 'Deposit', value: 'DEPOSIT' },
];

export function emptyManualForm(transactionDate = getTodayIso()) {
  return {
    transactionDate,
    narration: '',
    type: 'PAID',
    settlementDirection: 'WITHDRAWAL',
    amount: '',
    balance: '',
    upiName: '',
    upiDescription: '',
    upiBank: '',
  };
}

/** Field errors for the manual form, keyed by field. Empty object when valid. */
export function validateManualForm(form) {
  const errors = {};
  const amountValue = Number(form.amount);
  const balanceValue = form.balance === '' ? undefined : Number(form.balance);
  if (!form.transactionDate) errors.transactionDate = 'Select a transaction date.';
  if (!String(form.narration || '').trim()) errors.narration = 'Enter a narration.';
  if (!form.amount || Number.isNaN(amountValue) || amountValue <= 0) errors.amount = 'Enter a valid amount.';
  if (form.type === 'SETTLEMENT' && !form.settlementDirection) errors.settlementDirection = 'Select settlement direction.';
  if (balanceValue !== undefined && (Number.isNaN(balanceValue) || balanceValue < 0)) {
    errors.balance = 'Balance must be zero or positive.';
  }
  return errors;
}

/** Request body for POST /transactions/manual — the shape the page always sent. */
export function manualFormToPayload(form) {
  return {
    transactionDate: form.transactionDate,
    narration: form.narration.trim(),
    type: form.type,
    settlementDirection: form.type === 'SETTLEMENT' ? form.settlementDirection : undefined,
    amount: Number(form.amount),
    balance: form.balance === '' ? undefined : Number(form.balance),
    upiName: form.upiName.trim() || undefined,
    upiDescription: form.upiDescription.trim() || undefined,
    upiBank: form.upiBank.trim() || undefined,
  };
}
