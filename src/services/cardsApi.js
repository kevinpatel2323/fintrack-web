import { API_BASE, apiFetch } from './http.js';

async function handle(response) {
  if (!response.ok) {
    let detail;
    try {
      detail = await response.json();
    } catch {
      detail = {};
    }
    const message = detail.message || `Request failed: ${response.status} ${response.statusText}`;
    const err = new Error(Array.isArray(message) ? message.join(', ') : message);
    err.status = response.status;
    err.detail = detail;
    throw err;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function request(path, options = {}) {
  const response = await apiFetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  return handle(response);
}

// Multipart upload — must NOT set Content-Type so the browser adds the
// multipart boundary itself.
async function upload(path, file) {
  const form = new FormData();
  form.append('statement', file);
  const response = await apiFetch(`${API_BASE}${path}`, { method: 'POST', body: form });
  return handle(response);
}

// ── Wallet & Dues ──────────────────────────────────────────────────────
export const fetchWallet = () => request('/cards/wallet');
export const fetchDues = () => request('/cards/dues');

// ── Cards ──────────────────────────────────────────────────────────────
export const listCards = () => request('/cards');
export const getCard = (id) => request(`/cards/${id}`);
export const createCard = (data) =>
  request('/cards', { method: 'POST', body: JSON.stringify(data) });
export const updateCard = (id, data) =>
  request(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteCard = (id) => request(`/cards/${id}`, { method: 'DELETE' });

export const setCardFreeze = (id, frozen) =>
  request(`/cards/${id}/freeze`, { method: 'PATCH', body: JSON.stringify({ frozen }) });
export const setCardControls = (id, controls) =>
  request(`/cards/${id}/controls`, { method: 'PATCH', body: JSON.stringify(controls) });
export const setCardPrimary = (id) =>
  request(`/cards/${id}/primary`, { method: 'PATCH' });

// ── Transactions ───────────────────────────────────────────────────────
export const listCardTransactions = (id, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.start) params.set('start', opts.start);
  if (opts.end) params.set('end', opts.end);
  if (opts.statementId) params.set('statementId', opts.statementId);
  if (opts.unpaid) params.set('unpaid', 'true');
  const qs = params.toString();
  return request(`/cards/${id}/transactions${qs ? `?${qs}` : ''}`);
};
export const listUnpaidCardTransactions = (id) =>
  listCardTransactions(id, { unpaid: true });
export const createCardTransaction = (id, data) =>
  request(`/cards/${id}/transactions`, { method: 'POST', body: JSON.stringify(data) });
export const updateCardTransaction = (txnId, data) =>
  request(`/cards/transactions/${txnId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteCardTransaction = (txnId) =>
  request(`/cards/transactions/${txnId}`, { method: 'DELETE' });

// ── Friend tags on card transactions ───────────────────────────────────
// Mirrors /transactions/:id/friends for bank transactions.
export const listCardTransactionFriends = (txnId) =>
  request(`/cards/transactions/${txnId}/friends`);
export const addCardTransactionFriend = (txnId, data) =>
  request(`/cards/transactions/${txnId}/friends`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const updateCardTransactionFriend = (txnId, tagId, data) =>
  request(`/cards/transactions/${txnId}/friends/${tagId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
export const deleteCardTransactionFriend = (txnId, tagId) =>
  request(`/cards/transactions/${txnId}/friends/${tagId}`, { method: 'DELETE' });

// ── Payments ───────────────────────────────────────────────────────────
export const listCardPayments = (id) => request(`/cards/${id}/payments`);
export const createCardPayment = (id, data) =>
  request(`/cards/${id}/payments`, { method: 'POST', body: JSON.stringify(data) });
export const deleteCardPayment = (paymentId) =>
  request(`/cards/payments/${paymentId}`, { method: 'DELETE' });

// ── Statements ─────────────────────────────────────────────────────────
export const listCardStatements = (id) => request(`/cards/${id}/statements`);
export const createCardStatement = (id, data) =>
  request(`/cards/${id}/statements`, { method: 'POST', body: JSON.stringify(data) });
export const updateCardStatement = (statementId, data) =>
  request(`/cards/statements/${statementId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteCardStatement = (statementId) =>
  request(`/cards/statements/${statementId}`, { method: 'DELETE' });
export const fetchStatementBreakdown = (statementId) =>
  request(`/cards/statements/${statementId}/breakdown`);

// ── CC statement imports ───────────────────────────────────────────────
export const previewCcStatement = (cardId, file) =>
  upload(`/cards/${cardId}/imports/hdfc-cc/preview`, file);
export const importCcStatement = (cardId, file) =>
  upload(`/cards/${cardId}/imports/hdfc-cc`, file);
export const listCardImports = (cardId) => request(`/cards/${cardId}/imports`);
export const revertCardImport = (importId) =>
  request(`/cards/imports/${importId}/revert`, { method: 'POST' });

// ── CC bill-payment linking (bank transaction ↔ card transactions) ──────
export const getCcLink = (txId) => request(`/transactions/${txId}/cc-link`);
// Pass either `statementId` (cover a whole statement) or `cardTransactionIds`
// (hand-picked rows) — the API rejects both together.
export const linkCcBillPayment = (txId, { cardId, statementId, cardTransactionIds }) =>
  request(`/transactions/${txId}/cc-link`, {
    method: 'POST',
    body: JSON.stringify(
      statementId != null
        ? { cardId, statementId }
        : { cardId, cardTransactionIds },
    ),
  });
export const unlinkCcBillPayment = (txId) =>
  request(`/transactions/${txId}/cc-link`, { method: 'DELETE' });

// ── Card palettes (visual themes shared with the UI) ───────────────────
export const CARD_PALETTES = {
  obsidian: { from: '#1a1d24', to: '#0A0B0E', accent: '#D7FF3D', text: '#F1F2F4', label: 'Obsidian' },
  midnight: { from: '#1e2a4a', to: '#0a1228', accent: '#7DB9FF', text: '#F1F2F4', label: 'Midnight' },
  plum:     { from: '#3a1a3e', to: '#1a0820', accent: '#FF7AB6', text: '#F1F2F4', label: 'Plum' },
  sage:     { from: '#1a3a2e', to: '#0a1d18', accent: '#6EE7B7', text: '#F1F2F4', label: 'Sage' },
  rose:     { from: '#3a1f1c', to: '#1e0c0a', accent: '#FF8B6B', text: '#F1F2F4', label: 'Rose' },
  sand:     { from: '#3a2f1a', to: '#1d180a', accent: '#FFB454', text: '#F1F2F4', label: 'Sand' },
  ivory:    { from: '#e8e6e0', to: '#cfcdc4', accent: '#0A0B0E', text: '#0A0B0E', label: 'Ivory' },
};

export const NETWORKS = [
  { key: 'visa',  label: 'VISA' },
  { key: 'mc',    label: 'Mastercard' },
  { key: 'rupay', label: 'RuPay' },
  { key: 'amex',  label: 'American Express' },
];

export const BANK_TINTS = {
  hdfc:  { name: 'HDFC Bank',  tint: '#7DB9FF' },
  icici: { name: 'ICICI Bank', tint: '#FF8B6B' },
  axis:  { name: 'Axis Bank',  tint: '#B79CFF' },
  sbi:   { name: 'SBI',        tint: '#6EE7B7' },
  kotak: { name: 'Kotak',      tint: '#FFB454' },
  yes:   { name: 'YES Bank',   tint: '#FF7AB6' },
  amex:  { name: 'AMEX Bank',  tint: '#7DB9FF' },
};
