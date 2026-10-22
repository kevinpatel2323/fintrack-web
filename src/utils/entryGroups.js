import {
  ledgerBalanceDelta,
  ledgerGroupLinks,
  ledgerRunningBalances,
  ledgerSettlementIndex,
} from './ledgerParties.js';
import { availableMinor, fillOldestFirst, minorToInput } from './settlementAllocation.js';

/**
 * Entry groups on the client: several of a friend's entries bundled under one
 * title ("Ketul's wedding"). The API sends each entry's group as
 * `entryGroup: { id, title }`; everything about a group is derived from its
 * entries, so these helpers only arrange and add up what is already there.
 */

const paise = (value) => Math.round(Number(value || 0) * 100);

/** The group id an entry belongs to, or null. */
export const groupIdOf = (tag) =>
  tag?.entryGroupId ? String(tag.entryGroupId) : tag?.entryGroup?.id ? String(tag.entryGroup.id) : null;

/**
 * A friend's tags as ledger rows, each group collapsed into one row at the
 * position of its first entry: `{ kind: 'tag', tag }` or
 * `{ kind: 'group', group: { id, title }, members: [tag, …] }`. Order is
 * otherwise kept, so a sorted list stays sorted.
 */
export function groupLedgerRows(tags) {
  const rows = [];
  const byGroup = new Map();
  for (const tag of tags) {
    const id = groupIdOf(tag);
    if (!id) {
      rows.push({ kind: 'tag', tag });
      continue;
    }
    if (!byGroup.has(id)) {
      const row = { kind: 'group', group: { id, title: tag.entryGroup?.title ?? 'Group' }, members: [] };
      byGroup.set(id, row);
      rows.push(row);
    }
    byGroup.get(id).members.push(tag);
  }
  return rows;
}

/**
 * A group's totals from its entries — the same sums the API's
 * `groupFigures` makes. Amounts are signed: positive when the friend owes.
 */
export function groupTotals(members) {
  let owesMe = 0;
  let iOwe = 0;
  let pendingOwesMe = 0;
  let pendingIOwe = 0;
  let delta = 0;
  const dates = [];
  for (const tag of members) {
    delta += paise(ledgerBalanceDelta(tag));
    const date = tag.transaction?.transactionDate;
    if (date) dates.push(String(date).slice(0, 10));
    if (tag.direction === 'OWES_ME') {
      owesMe += paise(tag.amount);
      pendingOwesMe += tag.settlementLegacy ? 0 : paise(tag.pendingAmount ?? tag.amount);
    } else if (tag.direction === 'I_OWE') {
      iOwe += paise(tag.amount);
      pendingIOwe += tag.settlementLegacy ? 0 : paise(tag.pendingAmount ?? tag.amount);
    }
  }
  dates.sort();
  const pending = pendingOwesMe + pendingIOwe;
  const cleared = owesMe + iOwe - pending;
  return {
    count: members.length,
    totalAmount: (owesMe - iOwe) / 100,
    pendingOwesMe: pendingOwesMe / 100,
    pendingIOwe: pendingIOwe / 100,
    pendingNet: (pendingOwesMe - pendingIOwe) / 100,
    clearedAmount: cleared / 100,
    status: pending === 0 ? 'settled' : cleared <= 0 ? 'open' : 'partial',
    balanceDelta: delta / 100,
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
  };
}

/**
 * Applies `amountMinor` of a payment to a group, as one entry: everything the
 * group holds on its smaller side is netted in in full, and the larger side is
 * cleared oldest first with the payment plus that. A mixed group of "you owe
 * ₹8,800" and "they owe ₹2,289" is therefore settled by exactly ₹6,511. Rows
 * outside the group keep whatever the draft already had.
 */
export function fillGroup(amountMinor, members, draft = {}) {
  const memberIds = new Set(members.map((m) => String(m.id)));
  const outside = Object.fromEntries(Object.entries(draft).filter(([id]) => !memberIds.has(id)));
  const sideTotal = (side) =>
    members.filter((m) => m.direction === side).reduce((sum, m) => sum + availableMinor(m), 0);
  const main = sideTotal('I_OWE') > sideTotal('OWES_ME') ? 'I_OWE' : 'OWES_ME';
  const other = main === 'I_OWE' ? 'OWES_ME' : 'I_OWE';

  const netted = {};
  for (const m of members) {
    if (m.direction === other && availableMinor(m) > 0) netted[String(m.id)] = minorToInput(availableMinor(m));
  }
  // fillOldestFirst counts what is netted on the other side as extra to clear,
  // so it needs every member, not just the side it fills.
  const groupDraft = amountMinor > 0 ? fillOldestFirst(amountMinor, members, main, netted) : {};
  // Nothing to pay means nothing to net either.
  return Object.keys(groupDraft).length > 0 ? { ...outside, ...netted, ...groupDraft } : outside;
}

/** What a group needs to be fully settled, as a positive amount in paise. */
export function groupOpenMinor(members) {
  const sideTotal = (side) =>
    members.filter((m) => m.direction === side).reduce((sum, m) => sum + availableMinor(m), 0);
  return Math.abs(sideTotal('OWES_ME') - sideTotal('I_OWE'));
}

/**
 * What a ledger statement prints, numbered: each group is one row where its
 * first entry falls, with its totals, its running balance and its entries'
 * settlement links merged; every other tag is a row of its own. Settlement
 * links to a grouped entry point at the group's row. The export preview and
 * the PDF both render from this.
 */
export function ledgerStatement(tags) {
  const rows = groupLedgerRows(tags).map((r, i) =>
    r.kind === 'group' ? { ...r, no: i + 1, totals: groupTotals(r.members) } : { ...r, no: i + 1 });
  const rowOf = new Map();
  for (const r of rows) {
    if (r.kind === 'tag') rowOf.set(String(r.tag.id), { row: r.no, group: null });
    else for (const m of r.members) rowOf.set(String(m.id), { row: r.no, group: r.group.title });
  }
  const index = ledgerSettlementIndex(tags, rowOf);
  const linksOf = new Map(tags.map((t, i) => [String(t.id), index.rows[i]]));
  const running = ledgerRunningBalances(
    rows.map((r) => (r.kind === 'group' ? { balanceDelta: r.totals.balanceDelta } : r.tag)),
  );
  return {
    rows: rows.map((r, i) => {
      if (r.kind === 'tag') return { ...r, running: running[i], links: linksOf.get(String(r.tag.id)) };
      const memberLinks = r.members.map((m) => linksOf.get(String(m.id)));
      return { ...r, running: running[i], memberLinks, links: ledgerGroupLinks(r.members, memberLinks, r.no) };
    }),
    settlements: index.groups,
  };
}
