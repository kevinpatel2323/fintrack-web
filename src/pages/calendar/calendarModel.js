// Pure helpers behind the Calendar page: month cells, what each day shows,
// card-bill naming and the month's category split. No React here, so the
// maths is tested on its own (see __tests__/calendarModel.test.js).

import { categoryColor } from '../../utils/categoryColors.js';
import { inr } from '../../utils/inr.js';

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toLocalIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` plus `n` calendar days, in local time. */
export function addDaysIso(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toLocalIso(d);
}

export function monthBounds(year, month) {
  return {
    startIso: toLocalIso(new Date(year, month, 1)),
    endIso: toLocalIso(new Date(year, month + 1, 0)),
  };
}

/** True when `iso` falls in the given month. */
export function isInMonth(iso, year, month) {
  const { startIso, endIso } = monthBounds(year, month);
  return typeof iso === 'string' && iso >= startIso && iso <= endIso;
}

/**
 * The day to select after moving to another month: today when the month
 * holds it, otherwise the 1st — so the day panel never describes a day the
 * grid isn't showing.
 */
export function defaultDayForMonth(year, month, todayIso) {
  if (isInMonth(todayIso, year, month)) return todayIso;
  return monthBounds(year, month).startIso;
}

export function buildCells(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Only the weeks the month touches (4–6); a trailing week of nothing but
  // next month's days is just a dimmed row of noise.
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const cur = new Date(year, month, 1 - first.getDay() + i);
    cells.push({
      iso: toLocalIso(cur),
      label: cur.getDate(),
      inMonth: cur.getMonth() === month && cur.getFullYear() === year,
    });
  }
  return cells;
}

export function parseExdatesText(text) {
  if (!text || !String(text).trim()) return [];
  return String(text).split(/[\s,]+/).map((s) => s.trim()).filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
}

/** Transactions keyed by their `YYYY-MM-DD` date. */
export function groupTransactionsByDay(transactions) {
  const m = new Map();
  for (const t of transactions) {
    const key = t.transactionDate ? t.transactionDate.slice(0, 10) : 'unknown';
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(t);
  }
  return m;
}

/** Subscription occurrences keyed by their date. */
export function groupOccurrencesByDay(occurrences) {
  const m = new Map();
  for (const o of occurrences) {
    if (!m.has(o.date)) m.set(o.date, []);
    m.get(o.date).push(o);
  }
  return m;
}

export function sumSpent(txs) {
  return txs.reduce((s, t) => s + Number(t.withdrawal || 0), 0);
}

export function sumEarned(txs) {
  return txs.reduce((s, t) => s + Number(t.deposit || 0), 0);
}

export function sumAmounts(occurrences) {
  return occurrences.reduce((s, o) => s + Number(o.amount || 0), 0);
}

/** Matches Transactions page: uncategorized when categoryId is null/empty. */
export function isTransactionCategorized(tx) {
  return tx.categoryId != null && tx.categoryId !== '';
}

/**
 * CC bill payments only count as fully categorized when every nested card
 * transaction under them has a category. Prefer a loaded cc-link detail
 * (reflects in-session edits); fall back to the range payload annotation.
 * Empty nested lists are vacuously complete. Unknown state → not complete
 * (do not show green).
 */
export function ccNestedAllCategorized(tx, ccDetail) {
  if (!tx.ccBillPayment) return true;
  if (ccDetail && !ccDetail.loading && !ccDetail.error && Array.isArray(ccDetail.coveredTransactions)) {
    return ccDetail.coveredTransactions.every(isTransactionCategorized);
  }
  if (typeof tx.ccBillPayment.allCoveredCategorized === 'boolean') {
    return tx.ccBillPayment.allCoveredCategorized;
  }
  return false;
}

export function dayCategorizationState(txs, ccDetailByTransaction = {}) {
  if (txs.length === 0) return null;
  const complete = txs.every(
    (tx) =>
      isTransactionCategorized(tx) &&
      ccNestedAllCategorized(tx, ccDetailByTransaction[tx.id]),
  );
  return complete ? 'categorized' : 'needs-category';
}

/**
 * How many transactions on a day still need a category. A card bill payment
 * counts its uncategorised covered card transactions when they are loaded,
 * else one when the range payload says some are missing.
 */
export function dayUncategorizedCount(txs, ccDetailByTransaction = {}) {
  let count = 0;
  for (const tx of txs) {
    if (!isTransactionCategorized(tx)) count += 1;
    if (!tx.ccBillPayment) continue;
    const detail = ccDetailByTransaction[tx.id];
    if (detail && !detail.loading && !detail.error && Array.isArray(detail.coveredTransactions)) {
      count += detail.coveredTransactions.filter((t) => !isTransactionCategorized(t)).length;
    } else if (tx.ccBillPayment.allCoveredCategorized === false) {
      count += 1;
    }
  }
  return count;
}

/**
 * The month's categorising to-do: the days with something to categorise (in
 * date order), how many transactions that is, and how many the month has.
 */
export function monthPending(isoDays, txByDay, ccDetailByTransaction = {}) {
  const days = [];
  let pending = 0;
  let total = 0;
  for (const iso of isoDays) {
    const txs = txByDay.get(iso) || [];
    total += txs.length;
    const n = dayUncategorizedCount(txs, ccDetailByTransaction);
    if (n > 0) {
      days.push(iso);
      pending += n;
    }
  }
  return { days, pending, total };
}

/** The first pending day after `fromIso`, wrapping to the month's first. */
export function nextPendingDay(pendingDays, fromIso) {
  if (!pendingDays.length) return null;
  return pendingDays.find((iso) => iso > fromIso) ?? pendingDays[0];
}

/**
 * Aggregate the month's withdrawals into category-wise slices.
 * Uses the already-loaded transactions, so the total matches the month's
 * "spent". Every category is kept, sorted largest-first, no "Other" bucket.
 */
export function buildCategorySpend(transactions) {
  const byCat = new Map();
  let total = 0;
  for (const t of transactions) {
    const amount = Number(t.withdrawal || 0);
    if (!(amount > 0)) continue;
    total += amount;
    const cat = t.category || null;
    const key = cat?.id != null ? `c${cat.id}` : 'uncategorized';
    let entry = byCat.get(key);
    if (!entry) {
      entry = {
        key,
        name: cat?.name || 'Uncategorised',
        color: cat ? categoryColor(cat) : 'var(--ink-gray-4)',
        amount: 0,
      };
      byCat.set(key, entry);
    }
    entry.amount += amount;
  }

  const list = [...byCat.values()].sort((a, b) => b.amount - a.amount);
  const segments = list.map((x) => ({ ...x, fraction: total > 0 ? x.amount / total : 0 }));
  return { segments, total };
}

// ── Card bills ────────────────────────────────────────────────────────────

/** "MINAL PATEL" → "Minal Patel"; names already in mixed case are left alone. */
export function displayName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed || trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
}

/** Who a card bill was paid for: the cardholder, else the card's nickname. */
export function ccOwnerLabel(ccBillPayment, cardsById) {
  const card = cardsById[String(ccBillPayment.cardId)];
  return displayName(card?.holder) || card?.nickname || 'Card bill';
}

/** Which card: its product name ("BizGrow"), else its last four digits. */
export function ccCardLabel(ccBillPayment, cardsById) {
  const card = cardsById[String(ccBillPayment.cardId)];
  return card?.name || (ccBillPayment.cardLast4 ? `••${ccBillPayment.cardLast4}` : 'Card');
}

/**
 * The card bills paid on one day, named for the grid: one owner keeps their
 * name even across two of their cards; several owners collapse to a count.
 * `title` is the full per-bill breakdown for the hover text.
 */
export function dayCardBills(txs, cardsById = {}) {
  const bills = txs.filter((t) => t.ccBillPayment);
  if (bills.length === 0) return null;
  const total = bills.reduce((sum, t) => sum + Number(t.withdrawal || 0), 0);
  const owners = [...new Set(bills.map((t) => ccOwnerLabel(t.ccBillPayment, cardsById)))];
  const cards = [...new Set(bills.map((t) => ccCardLabel(t.ccBillPayment, cardsById)))];
  const title = bills
    .map((t) => {
      const known = Boolean(cardsById[String(t.ccBillPayment.cardId)]);
      const last4 = known && t.ccBillPayment.cardLast4 ? ` •• ${t.ccBillPayment.cardLast4}` : '';
      const who = known ? ` for ${ccOwnerLabel(t.ccBillPayment, cardsById)}` : '';
      return `Card bill paid${who} · ${ccCardLabel(t.ccBillPayment, cardsById)}${last4} · ${inr(Number(t.withdrawal || 0))}`;
    })
    .join('\n');
  return {
    count: bills.length,
    total,
    owner: owners.length === 1 ? owners[0] : `${bills.length} card bills`,
    card: cards.length === 1 ? cards[0] : `${cards.length} cards`,
    title,
  };
}

/** Everything one grid cell shows. */
export function dayModel(txs = [], subs = [], ccDetailByTransaction = {}, cardsById = {}) {
  return {
    spent: sumSpent(txs),
    earned: sumEarned(txs),
    txCount: txs.length,
    billCount: subs.length,
    catState: dayCategorizationState(txs, ccDetailByTransaction),
    pendingCount: dayUncategorizedCount(txs, ccDetailByTransaction),
    cardBills: dayCardBills(txs, cardsById),
  };
}

// ── Transactions in the day list ──────────────────────────────────────────

export function txTitle(tx) {
  return tx.upiName || tx.narration || '—';
}

export function txDescription(tx) {
  return tx.upiDescription || tx.narration || tx.upiBank || (tx.isManual ? 'Manual entry' : 'Bank transaction');
}

export function txMethod(tx) {
  if (tx.upiBank) return `UPI · ${tx.upiBank}`;
  return tx.isManual ? 'Manual' : 'Bank';
}

export function accountSuffix(accountNumber) {
  if (!accountNumber) return null;
  return `•• ${String(accountNumber).slice(-4)}`;
}

/** Signed amount of a bank transaction: deposits positive, withdrawals negative. */
export function txSignedAmount(tx) {
  const deposit = Number(tx.deposit || 0);
  if (deposit > 0) return deposit;
  return -Number(tx.withdrawal || 0);
}

// ── Subscriptions ─────────────────────────────────────────────────────────

/** Bills from today on, soonest first. */
export function upcomingOccurrences(occurrences, todayIso, limit = 8) {
  return occurrences
    .filter((o) => o.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

/** First occurrence on or after `fromIso` for each subscription id. */
export function nextDateBySubscription(occurrences, fromIso) {
  const next = new Map();
  for (const o of occurrences) {
    if (!o?.date || o.date < fromIso) continue;
    const id = String(o.subscriptionId);
    const cur = next.get(id);
    if (!cur || o.date < cur) next.set(id, o.date);
  }
  return next;
}

const STATUS = {
  active: { label: 'Active', theme: 'green' },
  paused: { label: 'Paused', theme: 'amber' },
  cancelled: { label: 'Cancelled', theme: 'gray' },
};

/** The one status badge a subscription shows; an active trial reads "Trial". */
export function subscriptionStatus(sub) {
  const status = sub?.status || 'active';
  if (status === 'active' && sub?.isTrial) return { label: 'Trial', theme: 'violet' };
  return STATUS[status] || { label: status, theme: 'gray' };
}

// ── Dates for display ─────────────────────────────────────────────────────

function isoToDate(iso) {
  return new Date(`${String(iso).slice(0, 10)}T12:00:00`);
}

/** "Wednesday, 28 October" */
export function formatDayLong(iso) {
  return isoToDate(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "28 Oct" */
export function formatDayShort(iso) {
  if (!iso) return '—';
  return isoToDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** "October 2026" */
export function formatMonthTitle(year, month) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
}

/** "October" */
export function formatMonthName(year, month) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(year, month, 1));
}
