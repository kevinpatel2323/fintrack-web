// What a captured bank SMS row says, in words: who it was paid to or from,
// which account, when it arrived, the amount's sign, the map link, and the
// list's URL params. Every parsed field on a memo can be null, so each helper
// has a fallback. Shared by the desktop page (pages/Memos.jsx), the phone
// list (MemosPhone.jsx) and the detail sheet (MemoSheet.jsx).

export const MEMO_MAX_LENGTH = 500;

export const TABS = [
  { id: 'all', label: 'All' },
  { id: 'no-memo', label: 'No memo' },
  { id: 'debit', label: 'Debit' },
  { id: 'credit', label: 'Credit' },
];
const TAB_IDS = new Set(TABS.map((t) => t.id));

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** Merchant, else the UPI id, else the SMS sender, else "Unknown". */
export function memoPayee(memo) {
  return text(memo?.merchant) || text(memo?.vpa) || text(memo?.sender) || 'Unknown';
}

/** "HDFC ••2209", "HDFC", "••2209", or null when neither is known. */
export function memoAccount(memo) {
  const bank = text(memo?.bank).toUpperCase();
  const last4 = text(memo?.last4);
  if (bank && last4) return `${bank} ••${last4}`;
  if (bank) return bank;
  if (last4) return `••${last4}`;
  return null;
}

/** When the SMS arrived: received, else captured on the phone, else stored. */
export function memoTime(memo) {
  return memo?.receivedAt || memo?.capturedAt || memo?.createdAt || null;
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

function toDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "29 Oct 14:32" this year, "29 Oct 2025 14:32" before; "—" when unknown. Local time. */
export function fmtMemoTime(iso, now = new Date()) {
  const d = toDate(iso);
  if (!d) return '—';
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "29 Oct 2026" for a `YYYY-MM-DD` date as the bank printed it. */
export function fmtTxnDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
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

export const CHANNELS = {
  upi: 'UPI',
  card: 'Card',
  imps: 'IMPS',
  neft: 'NEFT',
  rtgs: 'RTGS',
  atm: 'ATM',
  netbanking: 'Net banking',
  charge: 'Bank charge',
  mandate: 'Mandate',
};

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

/** `tab` and `q` from the URL; anything unknown reads as All and no search. */
export function parseMemosParams(searchParams) {
  const tab = searchParams.get('tab');
  return {
    tab: TAB_IDS.has(tab) ? tab : 'all',
    q: (searchParams.get('q') || '').trim(),
  };
}

/** The URL params with `patch` (`{ tab?, q? }`) applied; defaults are left out. */
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
  return next;
}
