import { API_BASE, apiFetch } from './http.js';

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
  if (!response.ok) {
    const message = data?.message || `Request failed: ${response.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return data;
}

/**
 * Entries with something still pending, oldest first — what a settlement can
 * be applied to. Pass the settlement's own tag id when editing it, so the
 * entries it already covers come back with `currentAllocation`.
 */
export const fetchOpenDues = (friendId, settlementTagId) =>
  request(
    `/friends/${friendId}/open-dues${settlementTagId ? `?settlementTagId=${settlementTagId}` : ''}`,
  );

export const fetchFriendSummary = (friendId) => request(`/friends/${friendId}/summary`);

// ── Netting without money ──────────────────────────────────────────────
export const fetchOffsets = (friendId) => request(`/friends/${friendId}/offsets`);
export const createOffset = (friendId, lines, note) =>
  request(`/friends/${friendId}/offsets`, {
    method: 'POST',
    body: JSON.stringify({ lines, ...(note ? { note } : {}) }),
  });
export const deleteOffset = (friendId, offsetId) =>
  request(`/friends/${friendId}/offsets/${offsetId}`, { method: 'DELETE' });

// ── Write-offs (round-off) ──────────────────────────────────────────────
export const createWriteOff = (friendId, { tagId, amount, reason }) =>
  request(`/friends/${friendId}/write-offs`, {
    method: 'POST',
    body: JSON.stringify({ tagId: Number(tagId), amount, ...(reason ? { reason } : {}) }),
  });
export const deleteWriteOff = (friendId, writeOffId) =>
  request(`/friends/${friendId}/write-offs/${writeOffId}`, { method: 'DELETE' });

// ── Settlements saved before amounts existed ───────────────────────────
export const fetchReviewSummary = () => request('/friends/review-summary');
export const fetchLegacyReview = (friendId) => request(`/friends/${friendId}/legacy-review`);
export const applyLegacyReview = (friendId, settlements) =>
  request(`/friends/${friendId}/legacy-review`, {
    method: 'POST',
    body: JSON.stringify({ settlements }),
  });

/**
 * Replaces a settlement's allocations. The tag can hang off a bank or a card
 * transaction; `tag.subject` says which, and each has its own route.
 */
export function saveSettlementAllocations(tag, allocations) {
  const isCard = tag.subject?.kind === 'card';
  const subjectId = isCard ? tag.subject.id : tag.transactionId ?? tag.subject?.id;
  const base = isCard ? `/cards/transactions/${subjectId}` : `/transactions/${subjectId}`;
  return request(`${base}/friends/${tag.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ allocations }),
  });
}
