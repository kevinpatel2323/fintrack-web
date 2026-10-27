// Display helpers shared by the Cards list, the card page and the card forms.
// Presentation only: every figure comes from the API as it is.
import { BANK_TINTS, NETWORKS } from '../../services/cardsApi.js';
import { formatDate } from '../ui/DatePicker.jsx';

const NETWORK_NAMES = {
  visa: 'Visa',
  mc: 'Mastercard',
  rupay: 'RuPay',
  amex: 'Amex',
};

/** Networks in the API's order, with readable names (form options). */
export const NETWORK_OPTIONS = NETWORKS.map((n) => ({ value: n.key, label: NETWORK_NAMES[n.key] || n.label }));

/** Banks the API knows, for the form. */
export const BANK_OPTIONS = Object.entries(BANK_TINTS).map(([value, v]) => ({ value, label: v.name }));

export function networkName(network) {
  if (!network) return '';
  return NETWORK_NAMES[network] || NETWORKS.find((n) => n.key === network)?.label || String(network).toUpperCase();
}

export function bankName(bank) {
  if (!bank) return '';
  return BANK_TINTS[bank]?.name || String(bank).toUpperCase();
}

/** What the user calls the card: its nickname, else its product name. */
export function cardTitle(card) {
  return card?.nickname || card?.name || 'Card';
}

/** "Regalia ••2209" */
export function cardLabel(card) {
  if (!card) return 'Card';
  return card.last4 ? `${cardTitle(card)} ••${card.last4}` : cardTitle(card);
}

/** "5 Nov", or "5 Nov 2027" when the date isn't in the current year. */
export function dayLabel(iso, { year } = {}) {
  if (!iso) return '';
  const showYear = year ?? String(iso).slice(0, 4) !== String(new Date().getFullYear());
  return formatDate(iso, showYear ? 'D MMM YYYY' : 'D MMM');
}

/** "17 Aug – 16 Sep 2026" */
export function rangeLabel(start, end) {
  if (!start || !end) return dayLabel(start || end);
  const sameYear = String(start).slice(0, 4) === String(end).slice(0, 4);
  return `${formatDate(start, sameYear ? 'D MMM' : 'D MMM YYYY')} – ${formatDate(end, 'D MMM YYYY')}`;
}

export function ordinal(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  return `${v}${{ 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th'}`;
}

/** Utilisation as a short percentage: "24%", "<1%". */
export function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n > 0 && n < 1) return '<1%';
  return `${Math.round(n)}%`;
}

const SOON_DAYS = 7;

/**
 * Badge for a bill from /cards/dues: red when overdue, amber when due within
 * a week, nothing further out. `null` when there's nothing to flag.
 */
export function dueBadge(due) {
  if (!due) return null;
  switch (due.status) {
    case 'overdue':
      return { theme: 'red', label: 'Overdue' };
    case 'due-today':
      return { theme: 'amber', label: 'Due today' };
    case 'due-tomorrow':
      return { theme: 'amber', label: 'Due tomorrow' };
    case 'upcoming':
      return due.daysAway <= SOON_DAYS ? { theme: 'amber', label: 'Due soon' } : null;
    default:
      return null;
  }
}

/** "in 8 days", "3 days ago", "today". */
export function relativeDays(daysAway) {
  const n = Number(daysAway);
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  if (n > 0) return `in ${n} days`;
  return `${-n} days ago`;
}

export const STATEMENT_STATUS = {
  open: { label: 'Open', theme: 'gray' },
  closed: { label: 'Closed', theme: 'amber' },
  paid: { label: 'Paid', theme: 'green' },
  overdue: { label: 'Overdue', theme: 'red' },
};
