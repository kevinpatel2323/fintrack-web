import { API_BASE, apiErrorMessage, apiFetch } from './http.js';

// Bank accounts (one per account number a statement was imported for, plus
// the Wallet for manual entries) and the holder name each one is shown by.

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

/** `[{ id, accountNumber, holderName, transactionCount, lastTransactionDate }]`, by account number. */
export const fetchAccounts = () => request('/accounts').then((res) => (Array.isArray(res?.data) ? res.data : []));

/** `holderName`: the name, or `null` to clear it (100 characters at most). */
export const updateAccountHolder = (id, holderName) =>
  request(`/accounts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ holderName }),
  });
