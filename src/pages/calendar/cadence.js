// Subscriptions store an RFC 5545 RRULE. The form offers the common shapes
// as a "Repeats" choice and writes the rule for you; anything else stays a
// hand-written custom rule. The rule string is still what gets saved.

export const CADENCE_OPTIONS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'Custom rule', value: 'custom' },
];

function body(rrule) {
  return String(rrule || '').trim().replace(/^RRULE:/i, '').trim();
}

function clampDay(day) {
  const n = Math.round(Number(day));
  if (!Number.isFinite(n)) return 1;
  return Math.min(31, Math.max(1, n));
}

/** Which "Repeats" choice a rule matches, and its day of month if monthly. */
export function parseCadence(rrule) {
  const r = body(rrule);
  const monthly = /^FREQ=MONTHLY;BYMONTHDAY=(\d{1,2})$/i.exec(r);
  if (monthly) {
    const day = Number(monthly[1]);
    if (day >= 1 && day <= 31) return { mode: 'monthly', day };
  }
  if (/^FREQ=WEEKLY$/i.test(r)) return { mode: 'weekly', day: null };
  if (/^FREQ=YEARLY$/i.test(r)) return { mode: 'yearly', day: null };
  return { mode: 'custom', day: null };
}

/**
 * The rule for a "Repeats" choice. Weekly and yearly rules repeat on the
 * start date's weekday / date, as RRULE does when BYDAY/BYMONTH are left out.
 * `custom` keeps the current text.
 */
export function buildRRule(mode, { day, current = '' } = {}) {
  if (mode === 'monthly') return `FREQ=MONTHLY;BYMONTHDAY=${clampDay(day)}`;
  if (mode === 'weekly') return 'FREQ=WEEKLY';
  if (mode === 'yearly') return 'FREQ=YEARLY';
  return current;
}

const WEEKDAY_NAMES = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };
const UNITS = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' };
const ADVERBS = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' };

function parts(rrule) {
  const out = {};
  for (const piece of body(rrule).split(';')) {
    const [k, v] = piece.split('=');
    if (k && v) out[k.trim().toUpperCase()] = v.trim().toUpperCase();
  }
  return out;
}

/** A short, plain reading of a rule: "Monthly on day 15", "Every 2 weeks on Mon". */
export function describeRRule(rrule) {
  const p = parts(rrule);
  const freq = p.FREQ;
  if (!freq) return 'Recurring';
  const interval = Number(p.INTERVAL) > 1 ? Number(p.INTERVAL) : 1;
  const unit = UNITS[freq];
  let text = unit
    ? interval > 1 ? `Every ${interval} ${unit}s` : ADVERBS[freq]
    : freq[0] + freq.slice(1).toLowerCase();

  if (p.BYMONTHDAY && (freq === 'MONTHLY' || freq === 'YEARLY')) {
    const days = p.BYMONTHDAY.split(',');
    text += days.length > 1 ? ` on days ${days.join(', ')}` : ` on day ${days[0]}`;
  } else if (p.BYDAY && freq === 'WEEKLY') {
    const days = p.BYDAY.split(',').map((d) => WEEKDAY_NAMES[d.replace(/^[+-]?\d+/, '')] || d);
    text += ` on ${days.join(', ')}`;
  }
  return text;
}
