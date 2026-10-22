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
 * The API sends `balanceDelta` from the friend ledger, which also counts
 * write-offs; without it, a settlement applied to what the owner owes
 * (`settlementSide: 'paid'`) is the owner paying the friend back and every
 * other settlement reduces what they owe.
 */
export function ledgerBalanceDelta(tag) {
  if (tag.balanceDelta !== undefined && tag.balanceDelta !== null) return Number(tag.balanceDelta);
  const amt = Number(tag.amount) || 0;
  if (tag.direction === 'OWES_ME') return amt;
  if (tag.direction === 'I_OWE') return -amt;
  if (tag.direction === 'SETTLEMENT') return tag.settlementSide === 'paid' ? amt : -amt;
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
 *
 * When the statement prints entry groups as one row each, `rowOf` (built by
 * `ledgerStatement` in entryGroups.js) gives every tag its printed row and its group's
 * title, so a link to a grouped entry points at the group's row.
 */
export function ledgerSettlementIndex(tags, rowOf = null) {
  const placeOf = rowOf ?? new Map(tags.map((tag, i) => [String(tag.id), { row: i + 1, group: null }]));
  const resolve = (linked) =>
    (linked || []).map((entry) => {
      const place = placeOf.get(String(entry?.id));
      return { tag: entry, row: place?.row ?? null, group: place?.group ?? null };
    });

  // An offset nets entries of the two sides with no money moving. Each entry
  // in one points at the other-side entries it was netted with. Only exported
  // tags are known here, so partners outside the export are not counted.
  const offsetMembers = new Map();
  for (const tag of tags) {
    for (const { offsetId } of tag.offsets || []) {
      if (!offsetMembers.has(offsetId)) offsetMembers.set(offsetId, []);
      offsetMembers.get(offsetId).push(tag);
    }
  }
  const nettedWith = (tag) => {
    const seen = new Map();
    for (const { offsetId } of tag.offsets || []) {
      for (const other of offsetMembers.get(offsetId) || []) {
        if (other.direction !== tag.direction) seen.set(String(other.id), other);
      }
    }
    return resolve([...seen.values()]);
  };

  const rows = tags.map((tag) => ({
    settles: resolve(tag.settlesTransactions),
    settledBy: resolve(tag.settledBy),
    nettedWith: nettedWith(tag),
  }));

  return {
    rows,
    groups: rows
      .map((row, i) => ({ tag: tags[i], row: placeOf.get(String(tags[i].id))?.row ?? i + 1, settles: row.settles }))
      .filter((group) => group.settles.length > 0),
  };
}

// ── Shared ledger text ─────────────────────────────────────────────────────
// The export preview and the PDF render every amount, date and settlement
// line from these, so the two cannot drift apart again — they did once: the
// preview listed each settled entry's full amount and never the settlement's
// share of it, so ₹10,000 looked like it settled ₹25,000. Plain ASCII
// ("Rs.", "-") so the PDF's built-in font can draw all of it.

const DUES = new Set(['OWES_ME', 'I_OWE']);
const paise = (value) => Math.round(Number(value || 0) * 100);

/** "6,286" / "81.25" — Indian grouping, paise only when there are any. */
export function ledgerNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
}

/** "Rs.6,286", "-Rs.150". */
export function ledgerRs(value) {
  const num = Number(value || 0);
  return `${num < 0 ? '-' : ''}Rs.${ledgerNumber(Math.abs(num))}`;
}

/** "01 Apr 2026". */
export function ledgerDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

/** Signed balance impact, "+Rs.25,000" / "-Rs.10,000"; "-" for rows that move nothing. */
export function ledgerImpactText(tag) {
  if (!DUES.has(tag?.direction) && tag?.direction !== 'SETTLEMENT') return '-';
  const delta = ledgerBalanceDelta(tag);
  return `${delta >= 0 ? '+' : '-'}Rs.${ledgerNumber(Math.abs(delta))}`;
}

/**
 * What is still open on a row today: an entry's unpaid remainder, or a
 * settlement's money not applied to anything. Entries settled by links from
 * before amounts were recorded read as settled.
 */
export function ledgerOpenText(tag) {
  if (DUES.has(tag?.direction)) {
    if (tag.settlementLegacy === true) return 'Settled';
    if (tag.pendingAmount === undefined || tag.pendingAmount === null) return '-';
    return paise(tag.pendingAmount) > 0 ? ledgerRs(tag.pendingAmount) : 'Settled';
  }
  if (tag?.direction === 'SETTLEMENT' && tag.settlementLegacy === false) {
    return paise(tag.unallocatedAmount) > 0 ? `${ledgerRs(tag.unallocatedAmount)} on account` : '-';
  }
  return '-';
}

/** Today's open amounts across the exported rows, for the summary. */
export function ledgerOpenTotals(tags) {
  let theyOwe = 0;
  let youOwe = 0;
  let onAccount = 0;
  for (const tag of tags) {
    if (tag.settlementLegacy !== false) continue;
    if (tag.direction === 'OWES_ME') theyOwe += paise(tag.pendingAmount);
    else if (tag.direction === 'I_OWE') youOwe += paise(tag.pendingAmount);
    else if (tag.direction === 'SETTLEMENT') onAccount += paise(tag.unallocatedAmount);
  }
  return { theyOwe: theyOwe / 100, youOwe: youOwe / 100, onAccount: onAccount / 100 };
}

/** The side a settlement pays off; entries on the other side are netted in. */
function clearedSide(settlement) {
  return settlement?.settlementSide === 'paid' ? 'I_OWE' : 'OWES_ME';
}

/** How a settlement treated one linked row — what both renderers branch on. */
function linkKind(settlement, linked) {
  if (linked?.linkAmount === null || linked?.linkAmount === undefined) return 'legacy';
  if (linked.direction === 'SETTLEMENT') return 'refund';
  if (linked.direction !== clearedSide(settlement)) return 'netted';
  return paise(linked.linkAmount) >= paise(linked.amount) ? 'full' : 'part';
}

function refList(refs, describe) {
  const listed = [];
  let missing = 0;
  for (const ref of refs) {
    if (ref.row === null) {
      missing += 1;
      continue;
    }
    const extra = describe ? describe(ref) : '';
    const label = extra ? `#${ref.row} ${extra}` : `#${ref.row}`;
    // Entries of one group share a row number; name the row once.
    if (!listed.includes(label)) listed.push(label);
  }
  if (missing > 0) listed.push(`+${missing} not listed`);
  return listed.join(', ');
}

/**
 * The "Settlement link" column for one row, amounts included:
 * "Settles #12, #13 in full · #11 Rs.2,842 (part) · #14 Rs.6,286 (part)",
 * "Settled by #55 Rs.6,286". Links from before amounts were recorded have
 * nothing to add and read as before ("Settles #3, #4").
 */
export function ledgerSettlementRefLines(links, tag) {
  if (!links) return [];
  const lines = [];

  if (links.settles.length > 0) {
    const loose = links.settles.filter((ref) => !ref.group);
    const by = (kind) => loose.filter((ref) => linkKind(tag, ref.tag) === kind);
    const amountOf = (ref) => ledgerRs(ref.tag.linkAmount);
    const settles = [
      by('full').length ? `${refList(by('full'))} in full` : null,
      ...by('part').map((ref) => refList([ref], () => `${amountOf(ref)} (part)`)),
      by('legacy').length ? refList(by('legacy')) : null,
      ...groupedSettles(links.settles, tag),
    ].filter(Boolean);
    if (settles.length) lines.push(`Settles ${settles.join(' · ')}`);
    if (by('netted').length) lines.push(`Nets off ${refList(by('netted'), amountOf)}`);
    if (by('refund').length) lines.push(`Refunds ${refList(by('refund'), amountOf)}`);
  }
  if (links.settledBy.length > 0) {
    lines.push(
      `Settled by ${refList(links.settledBy, (ref) =>
        ref.tag?.linkAmount != null ? ledgerRs(ref.tag.linkAmount) : '')}`,
    );
  }
  if (links.nettedWith?.length > 0) lines.push(`Netted with ${refList(links.nettedWith)}`);
  return lines;
}

/**
 * A settlement's grouped entries, one item per group with what the settlement
 * did to the group as a whole: "#3 Ketul's wedding Rs.6,511" — what it
 * cleared less what it netted in.
 */
function groupedSettles(refs, settlement) {
  const byRow = new Map();
  for (const ref of refs) {
    if (!ref.group || ref.row === null) continue;
    const kind = linkKind(settlement, ref.tag);
    const item = byRow.get(ref.row) ?? { title: ref.group, minor: 0, legacy: false };
    if (kind === 'legacy') item.legacy = true;
    else item.minor += (kind === 'netted' ? -1 : 1) * paise(ref.tag.linkAmount);
    byRow.set(ref.row, item);
  }
  return [...byRow].map(([row, item]) =>
    item.legacy ? `#${row} ${item.title}` : `#${row} ${item.title} ${ledgerRs(Math.abs(item.minor) / 100)}`);
}

/** Row pointer for a single linked entry, for use inside a settlement breakdown. */
export function ledgerSettlementEntryLabel(ref) {
  if (ref.row === null) return 'Not in this statement';
  return ref.group ? `#${ref.row} ${ref.group}` : `#${ref.row}`;
}

/** A settlement's own line in the breakdown: "#55 | 27 Aug 2026 | Rs.10,000". */
export function ledgerSettlementHeadParts(group) {
  const t = group.tag.transaction || {};
  const parts = [`#${group.row}`, ledgerDate(t.transactionDate), ledgerRs(group.tag.amount)];
  if (paise(group.tag.unallocatedAmount) > 0) parts.push(`${ledgerRs(group.tag.unallocatedAmount)} on account`);
  return parts;
}

/**
 * One row a settlement settled, share first, then what that entry still has
 * open today: "#14 | 01 Apr 2026 | Rs.6,286 of Rs.25,000 | Rs.18,714 still open | UPI".
 */
export function ledgerSettledEntryParts(group, ref) {
  const linked = ref.tag || {};
  const t = linked.transaction || {};
  const kind = linkKind(group.tag, linked);
  const share = {
    full: () => `${ledgerRs(linked.linkAmount)} in full`,
    part: () => `${ledgerRs(linked.linkAmount)} of ${ledgerRs(linked.amount)}`,
    netted: () => `${ledgerRs(linked.linkAmount)} netted off (of ${ledgerRs(linked.amount)})`,
    refund: () => `${ledgerRs(linked.linkAmount)} refunded`,
    legacy: () => `${ledgerRs(linked.amount)} entry (amount settled not recorded)`,
  }[kind]();
  const parts = [ledgerSettlementEntryLabel(ref), ledgerDate(t.transactionDate), share];
  if (kind === 'part' || kind === 'netted') {
    const open = ledgerOpenText(linked);
    if (open === 'Settled') parts.push('now settled');
    else if (open !== '-') parts.push(`${open} still open`);
  }
  parts.push(t.upiDescription || t.narration || t.upiName || '-');
  return parts;
}

/**
 * The arithmetic that shows how a settlement splits, e.g.
 * "Rs.10,000 = Rs.2,842 + Rs.372 + Rs.500 + Rs.6,286". Netted entries come
 * off, money on account and write-offs complete it. Null for a settlement
 * linked before amounts were recorded — there is nothing to add up.
 */
export function ledgerSettlementCheck(group) {
  const refs = group.settles.map((ref) => ref.tag || {});
  if (refs.some((linked) => linkKind(group.tag, linked) === 'legacy')) return null;
  const terms = [];
  for (const linked of refs) {
    const kind = linkKind(group.tag, linked);
    terms.push(kind === 'netted' ? `- ${ledgerRs(linked.linkAmount)} netted` : `+ ${ledgerRs(linked.linkAmount)}`);
  }
  if (paise(group.tag.unallocatedAmount) > 0) terms.push(`+ ${ledgerRs(group.tag.unallocatedAmount)} on account`);
  if (paise(group.tag.writtenOffAmount) > 0) terms.push(`+ ${ledgerRs(group.tag.writtenOffAmount)} written off`);
  if (terms.length === 0) return null;
  return `${ledgerRs(group.tag.amount)} = ${terms.join(' ').replace(/^\+ /, '')}`;
}

// ── Entry groups in a statement ────────────────────────────────────────────
// A group ("Ketul's wedding") prints as one row with its entries' totals
// (`groupTotals` in entryGroups.js), and its entries are listed under
// "Group details".

/** "30 Nov 2025 - 13 Jan 2026", or one date. */
export function ledgerGroupDateText(totals) {
  if (!totals.dateFrom || totals.dateFrom === totals.dateTo) return ledgerDate(totals.dateFrom);
  return `${ledgerDate(totals.dateFrom)} - ${ledgerDate(totals.dateTo)}`;
}

/** Which way the group's entries net: "Kevin owes Yash", or "Nets to nothing". */
export function ledgerGroupDirectionText(totals, friendFullName) {
  const net = paise(totals.totalAmount);
  if (net > 0) return ledgerDirectionPhrase('OWES_ME', friendFullName);
  if (net < 0) return ledgerDirectionPhrase('I_OWE', friendFullName);
  return 'Nets to nothing';
}

/** The group's balance impact, "+Rs.2,289" / "-Rs.6,511". */
export function ledgerGroupImpactText(totals) {
  const delta = Number(totals.balanceDelta) || 0;
  return `${delta >= 0 ? '+' : '-'}Rs.${ledgerNumber(Math.abs(delta))}`;
}

/** What the group still has open today, net: "Rs.450 (Yash owes)", "Settled". */
export function ledgerGroupOpenText(totals, friendFullName) {
  if (paise(totals.pendingOwesMe) + paise(totals.pendingIOwe) === 0) return 'Settled';
  const net = paise(totals.pendingNet);
  if (net === 0) return 'Rs.0 net';
  const who = net > 0 ? friendFirstName(friendFullName) : LEDGER_OWNER_FIRST;
  return `${ledgerRs(Math.abs(net) / 100)} (${who} owes)`;
}

/**
 * The "Settlement link" column for a group row: its entries' links merged,
 * one per settlement, with what that settlement did to the group as a whole
 * ("Settled by #55 Rs.6,511"). Offsets between the group's own entries are
 * left out.
 */
export function ledgerGroupLinks(members, memberLinks, ownRow) {
  const settledBy = new Map();
  const nettedWith = new Map();
  members.forEach((member, i) => {
    const links = memberLinks[i];
    for (const ref of links?.settledBy || []) {
      const key = String(ref.tag?.id);
      const item = settledBy.get(key) ?? { ref, minor: 0, legacy: false };
      if (ref.tag?.linkAmount === null || ref.tag?.linkAmount === undefined) item.legacy = true;
      else item.minor += (member.direction === clearedSide(ref.tag) ? 1 : -1) * paise(ref.tag.linkAmount);
      settledBy.set(key, item);
    }
    for (const ref of links?.nettedWith || []) {
      if (ref.row !== ownRow) nettedWith.set(String(ref.tag?.id), ref);
    }
  });
  return {
    settles: [],
    settledBy: [...settledBy.values()].map(({ ref, minor, legacy }) => ({
      ...ref,
      tag: { ...ref.tag, linkAmount: legacy ? null : Math.abs(minor) / 100 },
    })),
    nettedWith: [...nettedWith.values()],
  };
}

/** A group's line in "Group details": "#3 | Ketul's wedding | 5 entries | Kevin owes Yash Rs.6,511". */
export function ledgerGroupHeadParts(row, friendFullName) {
  const { totals } = row;
  const net = paise(totals.totalAmount);
  return [
    `#${row.no}`,
    row.group.title,
    `${totals.count} ${totals.count === 1 ? 'entry' : 'entries'}`,
    net === 0 ? 'Nets to nothing' : `${ledgerGroupDirectionText(totals, friendFullName)} ${ledgerRs(Math.abs(net) / 100)}`,
  ];
}

/**
 * One entry of a group in "Group details":
 * "07 Dec 2025 | Kevin owes Yash | Rs.8,800 | Settled | Settled by #55 Rs.8,800 | Ketul wedding outfit".
 */
export function ledgerGroupMemberParts(tag, links, friendFullName) {
  const t = tag.transaction || {};
  const parts = [ledgerDate(t.transactionDate), ledgerDirectionPhrase(tag.direction, friendFullName), ledgerRs(ledgerRowAmount(tag))];
  const open = ledgerOpenText(tag);
  if (open !== '-') parts.push(open === 'Settled' ? 'Settled' : `${open} still open`);
  parts.push(...ledgerSettlementRefLines(links, tag));
  parts.push(t.upiDescription || t.narration || t.upiName || tag.note || '-');
  return parts;
}
