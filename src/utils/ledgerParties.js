/** Static account holder for ledgers (Kevin Patel). */
export const LEDGER_OWNER_NAME = 'Kevin Patel';
export const LEDGER_OWNER_FIRST = 'Kevin';

export function friendFirstName(friendFullName) {
  const s = String(friendFullName || '').trim();
  if (!s) return 'Friend';
  return s.split(/\s+/)[0];
}

/** Direction column: "Kevin owes Yash" / "Yash owes Kevin" style. */
export function ledgerDirectionPhrase(direction, friendFullName) {
  const f = friendFirstName(friendFullName);
  if (direction === 'I_OWE') return `${LEDGER_OWNER_FIRST} owes ${f}`;
  if (direction === 'OWES_ME') return `${f} owes ${LEDGER_OWNER_FIRST}`;
  if (direction === 'SETTLEMENT') return 'Settlement';
  return 'Nothing outstanding';
}

/**
 * Amount column for a ledger row. NOTHING_OUTSTANDING tags always store amount 0
 * (it doesn't affect any balance), so show the underlying transaction's amount instead.
 */
export function ledgerRowAmount(tag) {
  if (tag.direction !== 'NOTHING_OUTSTANDING') return tag.amount;
  const t = tag.transaction || {};
  const withdrawal = Number(t.withdrawal || 0);
  const deposit = Number(t.deposit || 0);
  return withdrawal > 0 ? withdrawal : deposit;
}

/**
 * Signed effect of a tag on the friend's net balance, matching the same
 * OWES_ME / I_OWE / SETTLEMENT logic used to compute the ledger summary's net total.
 */
export function ledgerBalanceDelta(tag) {
  const amt = Number(tag.amount) || 0;
  if (tag.direction === 'OWES_ME') return amt;
  if (tag.direction === 'I_OWE') return -amt;
  if (tag.direction === 'SETTLEMENT') return -amt;
  return 0;
}

/** Running balance after each tag, in array order (oldest first). */
export function ledgerRunningBalances(tags) {
  let running = 0;
  return tags.map((tag) => {
    running += ledgerBalanceDelta(tag);
    return running;
  });
}
