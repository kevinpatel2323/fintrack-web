import { roundCurrencyToMinor } from './splitEngine.ts';

/**
 * Bill-wise settlement on the client: spread a payment over a friend's open
 * entries oldest first (Tally's Ctrl+A), net what the user owes them into it,
 * refund money left on account, and check a draft before it is sent.
 * Everything is in paise. The API (friends/friend-ledger.ts) re-checks every
 * rule; this is so the form can say what is wrong before you press the button.
 *
 * A draft is `{ [tagId]: string }` — a row is selected when its id is a key,
 * and the string is the amount as typed. Rows are entries (`dues`, either
 * side) or other settlements' money on account (`refundable`).
 *
 * Which way a settlement's money went follows from the draft, as on the
 * server: refunding money that came in makes it money paid out (and the other
 * way round); otherwise the side with more applied wins, and the other side
 * is netted in.
 */

export const DUE_SIDES = ['OWES_ME', 'I_OWE'];

export const toMinor = (amount) => Math.round(Number(amount || 0) * 100);

/** "₹1,418.75" — paise shown only when there are any. */
export function rupees(minor) {
  const value = Math.abs(minor) / 100;
  const text = value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${minor < 0 ? '−' : ''}₹${text}`;
}

/** A paise amount as it should appear in an input box: "81.25", "8800". */
export function minorToInput(minor) {
  const whole = Math.floor(minor / 100);
  const frac = minor % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
}

/** What an entry can still take from this settlement. */
export function availableMinor(row) {
  return row.direction === 'SETTLEMENT' ? toMinor(row.unallocatedAmount) : toMinor(row.pendingAmount);
}

const parse = (raw) => roundCurrencyToMinor(String(raw ?? ''), 100);
const otherSide = (side) => (side === 'OWES_ME' ? 'I_OWE' : 'OWES_ME');

/** Sum of the drafted amounts on rows matching `test`. Unparseable rows count as 0. */
function draftedMinor(draft, rows, test) {
  let total = 0;
  for (const row of rows) {
    const id = String(row.id);
    if (!(id in draft) || !test(row)) continue;
    const minor = parse(draft[id]);
    if (minor && minor > 0) total += minor;
  }
  return total;
}

/**
 * Applies the payment to the entries on one side, oldest first, until it runs
 * out. Anything already drafted on the other side is netted in — it adds to
 * what this side can clear — and drafted refunds take their share first.
 * `dues` must already be oldest first, as the API returns them.
 */
export function fillOldestFirst(amountMinor, dues, side, draft = {}, refundable = []) {
  const next = {};
  for (const row of [...dues, ...refundable]) {
    const id = String(row.id);
    if (id in draft && row.direction !== side) next[id] = draft[id];
  }
  let left =
    amountMinor +
    draftedMinor(draft, dues, (d) => d.direction === otherSide(side)) -
    draftedMinor(draft, refundable, () => true);
  for (const due of dues) {
    if (left <= 0) break;
    if (due.direction !== side) continue;
    const take = Math.min(availableMinor(due), left);
    if (take <= 0) continue;
    next[String(due.id)] = minorToInput(take);
    left -= take;
  }
  return next;
}

/** Nets every open entry on `side` in full, then refills the other side with the payment plus that. */
export function netAllOff(amountMinor, dues, side, draft = {}, refundable = []) {
  const netted = { ...draft };
  for (const due of dues) {
    if (due.direction === side && availableMinor(due) > 0) {
      netted[String(due.id)] = minorToInput(availableMinor(due));
    }
  }
  return fillOldestFirst(amountMinor, dues, otherSide(side), netted, refundable);
}

/** Starts an edit from what the settlement already covers. */
export function draftFromCurrent(dues, refundable = []) {
  const draft = {};
  for (const row of [...dues, ...refundable]) {
    if (row.currentAllocation) draft[String(row.id)] = minorToInput(toMinor(row.currentAllocation));
  }
  return draft;
}

/**
 * Checks a draft. `rowErrors` is keyed by tag id for messages next to a row;
 * `errors` collects everything for the summary line. `side` is which way the
 * settlement's money went ('received' / 'paid').
 */
export function checkDraft({ amountMinor, dues, refundable = [], draft }) {
  const byId = new Map([...dues, ...refundable].map((d) => [String(d.id), d]));
  const rowErrors = {};
  let owesMe = 0;
  let iOwe = 0;
  let refunds = 0;
  const refundSides = new Set();

  for (const [id, raw] of Object.entries(draft)) {
    const row = byId.get(id);
    if (!row) continue;
    const minor = parse(raw);
    if (minor === null || minor <= 0) {
      rowErrors[id] = 'Enter an amount';
      continue;
    }
    if (minor > availableMinor(row)) {
      rowErrors[id] = row.direction === 'SETTLEMENT'
        ? `Only ${rupees(availableMinor(row))} on account`
        : `Only ${rupees(availableMinor(row))} pending`;
      continue;
    }
    if (row.direction === 'OWES_ME') owesMe += minor;
    else if (row.direction === 'I_OWE') iOwe += minor;
    else {
      refunds += minor;
      refundSides.add(row.settlementSide || 'received');
    }
  }

  const errors = Object.values(rowErrors).length ? ['Fix the highlighted amounts.'] : [];
  if (refundSides.size > 1) {
    errors.push('A settlement can refund money that came in or money that went out, not both.');
  }
  const side = refundSides.size > 0
    ? ([...refundSides][0] === 'received' ? 'paid' : 'received')
    : iOwe > owesMe ? 'paid' : 'received';
  const settledMinor = side === 'received' ? owesMe : iOwe;
  const nettedMinor = side === 'received' ? iOwe : owesMe;
  const dueApplied = settledMinor - nettedMinor;
  if (dueApplied < 0) {
    errors.push(`Nets off ${rupees(-dueApplied)} more than this settlement clears.`);
  }
  const appliedMinor = Math.max(dueApplied, 0) + refunds;
  if (appliedMinor > amountMinor) {
    errors.push(`Applied ${rupees(appliedMinor)} is more than the ${rupees(amountMinor)} settlement.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    rowErrors,
    side,
    settledMinor,
    nettedMinor,
    refundMinor: refunds,
    appliedMinor,
    onAccountMinor: Math.max(amountMinor - appliedMinor, 0),
  };
}

/** The draft in the shape the API takes. Assumes `checkDraft` passed. */
export function draftToAllocations(draft) {
  return Object.entries(draft).map(([id, raw]) => ({
    tagId: Number(id),
    amount: parse(raw) / 100,
  }));
}
