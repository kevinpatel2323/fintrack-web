// What one entry on a person's ledger says: its date, which way it moves the
// balance, where it stands bill-wise and what can be done with it. Pure, so
// the table (PersonLedgerTable) only lays it out.

import { groupIdOf } from '../../utils/entryGroups.js';
import { friendFirstName, ledgerBalanceDelta, ledgerRowAmount } from '../../utils/ledgerParties.js';
import { rupees, toMinor } from '../../utils/settlementAllocation.js';

// What can be bundled into a group; settlements are paid against entries and
// stay outside. Mirrors the API's rule.
const GROUPABLE = new Set(['OWES_ME', 'I_OWE', 'NOTHING_OUTSTANDING']);
export const isGroupable = (t) => GROUPABLE.has(t.direction) && !groupIdOf(t);

export function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Where a row stands bill-wise: an entry's pending, netted or written-off
 * amounts, or a settlement's money still on account. Empty for rows settled
 * by a link from before amounts were recorded — there is nothing to add.
 */
export function rowSettlementNotes(tag) {
  if (tag.settlementLegacy !== false) return [];
  const notes = [];
  const writtenOff = toMinor(tag.writtenOffAmount);
  if (tag.direction === 'SETTLEMENT') {
    if (toMinor(tag.refundedAmount) > 0) notes.push({ text: `${rupees(toMinor(tag.refundedAmount))} refund` });
    if (writtenOff > 0) notes.push({ text: `${rupees(writtenOff)} written off` });
    const onAccount = toMinor(tag.unallocatedAmount);
    if (onAccount > 0) notes.push({ text: `${rupees(onAccount)} on account`, tone: 'warn' });
    return notes;
  }
  if (toMinor(tag.nettedAmount) > 0) notes.push({ text: `${rupees(toMinor(tag.nettedAmount))} netted off` });
  if (writtenOff > 0) notes.push({ text: `${rupees(writtenOff)} written off` });
  if (tag.settlementStatus === 'partial') notes.push({ text: `${rupees(toMinor(tag.pendingAmount))} pending`, tone: 'warn' });
  if (tag.settlementStatus === 'settled') notes.push({ text: 'Settled', tone: 'ok' });
  return notes;
}

/** Which way the row moves the balance, in words: "Yash owes you", "You paid Yash". */
export function impactWords(tag, first) {
  if (tag.direction === 'OWES_ME') return `${first} owes you`;
  if (tag.direction === 'I_OWE') return `You owe ${first}`;
  if (tag.direction === 'SETTLEMENT') return tag.settlementSide === 'paid' ? `You paid ${first}` : `${first} paid you`;
  return 'Nothing outstanding';
}

export const hasPaise = (n) => Math.round(Math.abs(Number(n) || 0) * 100) % 100 !== 0;

/**
 * Everything the table shows for one entry. `signed` is the entry's own
 * amount, signed the way it moves the balance (write-offs are in the notes).
 * `leftover` is money worth closing: on account, or an entry's open remainder.
 */
export function entryFacts(tag, friendName) {
  const first = friendFirstName(friendName);
  const isSettlement = tag.direction === 'SETTLEMENT';
  const tx = tag.transaction || {};
  const leftover = tag.settlementLegacy === false
    ? isSettlement
      ? toMinor(tag.unallocatedAmount)
      : tag.settlementStatus === 'partial' ? toMinor(tag.pendingAmount) : 0
    : 0;
  return {
    first,
    isSettlement,
    date: tx.transactionDate ? formatDay(tx.transactionDate) : '—',
    title: tx.upiName || tx.narration || tag.note || 'Transaction',
    words: impactWords(tag, first),
    notes: rowSettlementNotes(tag),
    signed: ledgerBalanceDelta({ ...tag, balanceDelta: null }),
    nothing: tag.direction === 'NOTHING_OUTSTANDING',
    plainAmount: Number(ledgerRowAmount(tag)) || 0,
    leftover,
    applyLabel: tag.settlementLegacy === false && toMinor(tag.allocatedAmount) === 0
      ? 'Apply to entries'
      : 'Change what it settles',
    // Money sitting on account is the thing to act on, so it gets a button.
    applyInline: isSettlement && tag.settlementLegacy === false && toMinor(tag.unallocatedAmount) > 0,
  };
}
