// Pure helpers for the Dashboard: date ranges and presets, comparison deltas,
// the "Needs attention" items and small list shapes. No React, so they are
// unit-tested in node (see __tests__/dashboardModel.test.ts).

import { formatLocalIsoDate, getLast30DayRange } from '../../utils/dateUtils.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function isoToLocalDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ── Date range ─────────────────────────────────────────────────────────── */

/** The dashboard's opening range: the last 30 days, as it always was. */
export function defaultDateRange(referenceDate = new Date()) {
  const { startIso, endIso } = getLast30DayRange(referenceDate);
  return { startDate: startIso, endDate: endIso };
}

/**
 * Presets for the range picker. "Last N days" keeps the app's existing
 * convention (today minus N, as the default range and the old picker did), so
 * the default range lights up "Last 30 days".
 */
export function rangePresets(referenceDate = new Date()) {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const iso = (d) => formatLocalIsoDate(d);
  const daysBack = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  const end = iso(today);
  // Clamp the day so 31 May − 3 months is 28/29 Feb, not 3 Mar.
  const threeMonthsBack = (() => {
    const first = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return new Date(first.getFullYear(), first.getMonth(), Math.min(today.getDate(), last));
  })();
  return [
    { key: 'this-month', label: 'This month', value: { start: iso(new Date(today.getFullYear(), today.getMonth(), 1)), end } },
    {
      key: 'last-month',
      label: 'Last month',
      value: {
        start: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        end: iso(new Date(today.getFullYear(), today.getMonth(), 0)),
      },
    },
    { key: 'last-7', label: 'Last 7 days', value: { start: iso(daysBack(7)), end } },
    { key: 'last-30', label: 'Last 30 days', value: { start: iso(daysBack(30)), end } },
    { key: 'last-3-months', label: 'Last 3 months', value: { start: iso(threeMonthsBack), end } },
    { key: 'this-year', label: 'This year', value: { start: iso(new Date(today.getFullYear(), 0, 1)), end } },
  ];
}

/** The preset matching a `{ startDate, endDate }` range, or null for a custom one. */
export function matchPreset(presets, range) {
  return presets.find((p) => p.value.start === range?.startDate && p.value.end === range?.endDate) ?? null;
}

/** Days in a range, both ends included. */
export function rangeDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const diff = Math.round((isoToLocalDate(endDate) - isoToLocalDate(startDate)) / DAY_MS);
  return Math.max(0, diff) + 1;
}

/**
 * What the deltas compare against. The API compares with the same number of
 * days just before the range (not "last month"), so the label says exactly that.
 */
export function comparisonLabel(range, { short = false } = {}) {
  if (short) return 'vs previous';
  const days = rangeDays(range?.startDate, range?.endDate);
  if (days <= 1) return 'vs previous day';
  return `vs previous ${days} days`;
}

/** "1 Oct – 28 Oct 2026", "28 Sep – 28 Oct 2026", "1 Dec 2025 – 3 Jan 2026". */
export function formatRangeLabel(range) {
  if (!range?.startDate || !range?.endDate) return '';
  const a = isoToLocalDate(range.startDate);
  const b = isoToLocalDate(range.endDate);
  const day = (d) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  if (range.startDate === range.endDate) return `${day(b)} ${b.getFullYear()}`;
  const startYear = a.getFullYear() === b.getFullYear() ? '' : ` ${a.getFullYear()}`;
  return `${day(a)}${startYear} – ${day(b)} ${b.getFullYear()}`;
}

/** "28 Oct" (or "28 Oct 2026" with `withYear`) from an ISO date or timestamp; '' when unreadable. */
export function shortDate(value, { withYear = false } = {}) {
  const iso = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const d = isoToLocalDate(iso);
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

/** First and last day of a `YYYY-MM` month. */
export function monthBounds(month) {
  const [y, m] = String(month).split('-').map(Number);
  const start = formatLocalIsoDate(new Date(y, m - 1, 1));
  const end = formatLocalIsoDate(new Date(y, m, 0));
  return { startDate: start, endDate: end };
}

/** `YYYY-MM` → "Oct". */
export function monthShort(month) {
  const m = Number(String(month).slice(5, 7));
  return MONTHS_SHORT[m - 1] ?? String(month);
}

/** `/transactions` for a range, using the list page's own URL params. */
export function transactionsLink(range, { tab, extra } = {}) {
  const params = new URLSearchParams();
  if (range?.startDate) params.set('start', range.startDate);
  if (range?.endDate) params.set('end', range.endDate);
  if (tab === 'spent' || tab === 'earned') params.set('tab', tab);
  if (extra) Object.entries(extra).forEach(([k, v]) => params.set(k, v));
  const qs = params.toString();
  return qs ? `/transactions?${qs}` : '/transactions';
}

/* ── Stat deltas ────────────────────────────────────────────────────────── */

/**
 * Percent change from `previous` to `current`, over |previous| so the sign
 * always says which way the figure moved. Null when there is nothing to
 * compare with (no previous value), so no made-up 0% or ∞%.
 */
export function percentChange(current, previous) {
  const cur = Number(current);
  const prev = Number(previous);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Savings rate the way the API computes it; null without income. */
export function savingsRate(income, spent) {
  const inc = num(income);
  if (inc <= 0) return null;
  return ((inc - num(spent)) / inc) * 100;
}

/**
 * The four headline figures and their change against the comparison period.
 * Spending uses the API's own percentage (it is the API's comparison); the
 * others are worked out from the comparison totals the API returns.
 * `savings.delta` is in percentage points.
 */
export function summaryStats(data) {
  const overview = data?.spendingOverview ?? {};
  const comp = overview.comparisonPeriod ?? null;
  const spent = num(overview.totalSpent);
  const earned = num(overview.totalIncome);
  const net = num(overview.netChange ?? earned - spent);
  // The API's own rate when it has income to divide by; it reports 0 without
  // any, which would read as "saved nothing", so that case shows no figure.
  const ive = data?.incomeVsExpenses;
  const rate = ive && num(ive.totalIncome) > 0 ? num(ive.savingsRate) : savingsRate(earned, spent);

  if (!comp) {
    return {
      spent: { value: spent, delta: null },
      earned: { value: earned, delta: null },
      net: { value: net, delta: null },
      savings: { value: rate, delta: null },
    };
  }

  const prevSpent = num(comp.totalSpent);
  const prevEarned = num(comp.totalIncome);
  const prevRate = savingsRate(prevEarned, prevSpent);

  return {
    // The API reports 0 when there was no previous spend; treat that as "no comparison".
    spent: { value: spent, delta: prevSpent > 0 ? num(comp.percentageChange) : null },
    earned: { value: earned, delta: percentChange(earned, prevEarned) },
    net: { value: net, delta: percentChange(net, prevEarned - prevSpent) },
    savings: { value: rate, delta: rate !== null && prevRate !== null ? rate - prevRate : null },
  };
}

/* ── Lists ──────────────────────────────────────────────────────────────── */

export const OTHERS_KEY = '__others__';
export const UNCATEGORISED_KEY = '__none__';

/**
 * Spending by category for CategoryBars: the top `limit` categories, then the
 * rest as one "Other categories" row so shares still add up to the total.
 */
export function categoryRows(breakdown, limit = 5) {
  const cats = (breakdown?.categories ?? []).filter((c) => num(c.totalAmount) > 0);
  const sorted = [...cats].sort((a, b) => num(b.totalAmount) - num(a.totalAmount));
  const toRow = (c) => ({
    key: c.categoryId == null ? UNCATEGORISED_KEY : String(c.categoryId),
    label: c.categoryId == null ? 'Uncategorised' : c.categoryName,
    value: num(c.totalAmount),
    count: num(c.transactionCount),
    category: c.categoryId == null ? null : { id: c.categoryId, name: c.categoryName, color: c.categoryColor },
  });
  if (sorted.length <= limit + 1) return sorted.map(toRow);
  const head = sorted.slice(0, limit).map(toRow);
  const tail = sorted.slice(limit);
  head.push({
    key: OTHERS_KEY,
    label: `${tail.length} other categories`,
    value: tail.reduce((s, c) => s + num(c.totalAmount), 0),
    count: tail.reduce((s, c) => s + num(c.transactionCount), 0),
    category: null,
  });
  return head;
}

/** Recent transactions for the All / Spent / Earned tabs. */
export function filterRecent(items, filter) {
  const list = Array.isArray(items) ? items : [];
  if (filter === 'spent') return list.filter((t) => num(t.withdrawal) > 0);
  if (filter === 'earned') return list.filter((t) => num(t.deposit) > 0);
  return list;
}

/** Signed amount of a bank transaction: deposits positive, withdrawals negative. */
export function signedAmount(tx) {
  const deposit = num(tx?.deposit);
  return deposit > 0 ? deposit : -num(tx?.withdrawal);
}

/** Totals for the People card: what friends owe the user and what the user owes. */
export function balanceTotals(balances) {
  let owedToYou = 0;
  let youOwe = 0;
  for (const b of balances ?? []) {
    const n = num(b.netBalance);
    if (n > 0) owedToYou += n;
    else youOwe += -n;
  }
  return { owedToYou, youOwe };
}

/* ── Needs attention ────────────────────────────────────────────────────── */

const DUE_SOON_DAYS = 7;

function dueText(d) {
  if (d.status === 'overdue') return `Overdue by ${plural(Math.abs(d.daysAway), 'day')}`;
  if (d.status === 'due-today') return 'Due today';
  if (d.status === 'due-tomorrow') return 'Due tomorrow';
  return `Due in ${plural(d.daysAway, 'day')}`;
}

/**
 * Everything on the dashboard that wants the user to act, each with the page
 * where they act on it. Only real data: card bills due soon, card statements
 * out but not imported, older settlements to review, and spending without a
 * category in the selected range.
 *
 * Item: { key, kind, title, detail, action, to, amount?, tone? }
 */
export function attentionItems({ dues, schedule, review, breakdown, range }) {
  const items = [];

  // Card bills: overdue, or due within a week.
  for (const d of dues ?? []) {
    const amount = num(d.amount);
    if (d.status === 'no-due' || amount <= 0) continue;
    if (d.status === 'upcoming' && !(num(d.daysAway) <= DUE_SOON_DAYS)) continue;
    items.push({
      key: `due-${d.cardId}`,
      kind: 'bill',
      title: `${d.cardName} bill`,
      detail: `${dueText(d)}${d.last4 ? ` · •• ${d.last4}` : ''}`,
      amount,
      tone: d.status === 'overdue' ? 'due' : undefined,
      action: 'Open card',
      to: `/cards/${d.cardId}`,
    });
  }

  // Card statements out but not imported, oldest card first (API order).
  for (const row of schedule?.cards ?? []) {
    const pending = row.pending ?? [];
    if (row.status !== 'ready' || pending.length === 0) continue;
    const label = row.next?.label ?? pending[0]?.label;
    const card = row.card ?? {};
    const cardName = card.nickname || card.name || 'Card';
    items.push({
      key: `import-${card.id ?? cardName}`,
      kind: 'import',
      title: label ? `Import the ${label} statement` : 'Import a statement',
      detail: `${cardName}${card.last4 ? ` •• ${card.last4}` : ''}${pending.length > 1 ? ` · ${pending.length} statements waiting` : ''}`,
      action: 'Import',
      to: '/import',
    });
  }

  // Older settlements whose amounts don't match their entries.
  const toReview = (review?.friends ?? []).filter((f) => num(f.needingReview) > 0);
  if (toReview.length > 2) {
    const total = toReview.reduce((s, f) => s + num(f.needingReview), 0);
    items.push({
      key: 'review',
      kind: 'review',
      title: `Review ${plural(total, 'older settlement')}`,
      detail: `${plural(toReview.length, 'person', 'people')} · saved before amounts were recorded`,
      action: 'Review',
      to: '/friends',
    });
  } else {
    for (const f of toReview) {
      items.push({
        key: `review-${f.friendId}`,
        kind: 'review',
        title: `Review older settlements with ${f.friendName}`,
        detail: `${plural(num(f.needingReview), 'settlement')} saved before amounts were recorded`,
        action: 'Review',
        to: `/friends/${f.friendId}?review=1`,
      });
    }
  }

  // Spending in the range that has no category.
  const uncategorised = (breakdown?.categories ?? []).find((c) => c.categoryId == null);
  const count = num(uncategorised?.transactionCount);
  if (count > 0) {
    items.push({
      key: 'uncategorised',
      kind: 'uncategorised',
      title: `Categorise ${plural(count, 'transaction')}`,
      detail: `Spent without a category · ${formatRangeLabel(range)}`,
      amount: num(uncategorised.totalAmount),
      action: 'Categorise',
      to: transactionsLink(range, { tab: 'spent', extra: { category: 'none' } }),
    });
  }

  return items;
}
