// Formatting and small pure helpers shared by the import page's pieces.

export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function fmtShortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(d);
}

/** "10 Sep → 18 Oct 2026", the year once when both ends share it. */
export function fmtPeriod(start, end) {
  if (!start || !end) return '—';
  return start.slice(0, 4) === end.slice(0, 4)
    ? `${fmtShortDate(start)} → ${fmtDate(end)}`
    : `${fmtDate(start)} → ${fmtDate(end)}`;
}

/** "Acct •• 6714" for a bank account number; anything else (e.g. "Wallet") as is. */
export function accountLabel(accountNumber) {
  if (!accountNumber) return '—';
  return /^\d{5,}$/.test(accountNumber) ? `Acct •• ${accountNumber.slice(-4)}` : accountNumber;
}

export function isoDateMinusDays(isoDate, days) {
  if (!isoDate) return null;
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** A parsed statement row's signed amount — deposits credit, withdrawals debit. */
export function previewRowAmount(row) {
  const deposit = Number(row.deposit || 0);
  return deposit > 0 ? deposit : -Number(row.withdrawal || 0);
}

/** A proposed merge's identity, as `parsedIndex:existingId`. */
export const matchKey = (m) => `${m.parsedIndex}:${m.existingId}`;

export function fileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
