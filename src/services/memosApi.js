import { API_BASE, apiErrorMessage, apiFetch } from './http.js';

// Memos: bank, UPI and card SMS captured on the user's iPhone (a Shortcut
// sends them to the API), parsed into rows the user writes a short memo on,
// plus the iPhones paired to send them.

async function request(path, options = {}) {
  const response = await apiFetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) throw new Error(apiErrorMessage(data, `Request failed: ${response.status}`));
  return data;
}

/** The most memos one period request returns (the API's cap). */
export const PERIOD_PAGE_SIZE = 5000;

/** `?start=…&end=…&pageSize=5000` for one period; a missing end of the range is left out. */
export function memosPeriodQuery({ start, end } = {}) {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  params.set('pageSize', String(PERIOD_PAGE_SIZE));
  return `?${params.toString()}`;
}

/**
 * Every memo in a period (`start`/`end`, inclusive `YYYY-MM-DD`, by the
 * memo's own day), newest first: `{ count, data: Memo[] }`. The list
 * searches, filters, sorts and pages them itself, as Transactions does.
 */
export const fetchMemosInPeriod = (period, { signal } = {}) =>
  request(`/transaction-memos${memosPeriodQuery(period)}`, { signal });

/** `{ withoutMemo, total, lastReceivedAt }` */
export const fetchMemoSummary = () => request('/transaction-memos/summary');

/** The row plus `{ rawMessage, location, locationStatus, parseError, parserVersion, shortcutVersion }`. */
export const fetchMemo = (id, { signal } = {}) =>
  request(`/transaction-memos/${encodeURIComponent(id)}`, { signal });

/** `memo`: the text, or `null` to clear it (500 characters at most). */
export const updateMemo = (id, memo) =>
  request(`/transaction-memos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ memo }),
  });

export const deleteMemo = (id) =>
  request(`/transaction-memos/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Parses the stored SMS again; returns the same shape as `fetchMemo`. */
export const reparseMemo = (id) =>
  request(`/transaction-memos/${encodeURIComponent(id)}/reparse`, { method: 'POST' });

/** `{ updated }` */
export const reparseAllMemos = () => request('/transaction-memos/reparse-all', { method: 'POST' });

// ── Paired iPhones ─────────────────────────────────────────────────────
/** `{ deviceId, code, setupText, expiresAt }` — the code the Shortcut is given once. */
export const createPairCode = (name) =>
  request('/transaction-memos/devices/pair-code', {
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  });

/** `{ count, data: Device[] }` */
export const fetchMemoDevices = () => request('/transaction-memos/devices');

/** Revokes the device: it can no longer send messages. */
export const revokeMemoDevice = (id) =>
  request(`/transaction-memos/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
