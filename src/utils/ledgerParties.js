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

/**
 * Cross-references SETTLEMENT tags with the tags they settle, expressed in the
 * row numbers a ledger prints (1-based, in the order the tags are passed).
 *
 * A linked tag can sit outside the export — a narrower date range, or a row the
 * user unticked — and so has no row number. Those stay in the list with
 * `row: null` instead of being dropped, so a settlement never reads as smaller
 * than it actually was.
 *
 * Returns `rows[i]` aligned with `tags[i]`, plus `groups` for the settlements
 * that actually settle something.
 */
export function ledgerSettlementIndex(tags) {
  const rowByTagId = new Map(tags.map((tag, i) => [String(tag.id), i + 1]));
  const resolve = (linked) =>
    (linked || []).map((entry) => ({
      tag: entry,
      row: rowByTagId.get(String(entry?.id)) ?? null,
    }));

  const rows = tags.map((tag) => ({
    settles: resolve(tag.settlesTransactions),
    settledBy: resolve(tag.settledBy),
  }));

  return {
    rows,
    groups: rows
      .map((row, i) => ({ tag: tags[i], row: i + 1, settles: row.settles }))
      .filter((group) => group.settles.length > 0),
  };
}

function settlementRefPhrase(label, refs) {
  const listed = refs.filter((ref) => ref.row !== null).map((ref) => `#${ref.row}`);
  const missing = refs.length - listed.length;
  if (missing > 0) listed.push(`+${missing} not listed`);
  return `${label} ${listed.join(', ')}`;
}

/** Cross-reference text for one ledger row, e.g. ["Settles #2, #5"]. */
export function ledgerSettlementRefLines(links) {
  if (!links) return [];
  const lines = [];
  if (links.settles.length > 0) lines.push(settlementRefPhrase('Settles', links.settles));
  if (links.settledBy.length > 0) lines.push(settlementRefPhrase('Settled by', links.settledBy));
  return lines;
}

/** Row pointer for a single linked entry, for use inside a settlement breakdown. */
export function ledgerSettlementEntryLabel(ref) {
  return ref.row !== null ? `#${ref.row}` : 'Not in this statement';
}
