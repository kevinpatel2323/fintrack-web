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
