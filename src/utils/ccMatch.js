// Strict-match math for linking a bank bill-payment debit to the credit-card
// transactions it covers. Mirrors the backend (card-link.service.ts): all
// arithmetic is in integer paise so floating-point drift can never make an
// exact match look off (or vice versa).

export const toPaise = (value) => Math.round(Number(value || 0) * 100);

// Signed paise for one card transaction: refunds subtract, purchases add.
export const signedPaise = (txn) =>
  toPaise(txn.amount) * (txn.isRefund ? -1 : 1);

// Sum of the selected card transactions, in paise.
export function selectedTotalPaise(transactions, selectedIds) {
  const set = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  return transactions
    .filter((t) => set.has(String(t.id)))
    .reduce((sum, t) => sum + signedPaise(t), 0);
}

// Compare the selection against the bank withdrawal. `delta` is
// selected − target in paise; `matches` is true only when it is exactly zero.
export function matchState(transactions, selectedIds, targetAmount) {
  const selected = selectedTotalPaise(transactions, selectedIds);
  const target = toPaise(targetAmount);
  const delta = selected - target;
  return {
    selectedPaise: selected,
    targetPaise: target,
    delta,
    matches: delta === 0 && selectedIds && [...selectedIds].length > 0,
  };
}
