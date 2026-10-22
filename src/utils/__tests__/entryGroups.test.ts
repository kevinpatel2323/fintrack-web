import { describe, expect, it } from 'vitest';
import { fillGroup, groupLedgerRows, groupOpenMinor, groupTotals, ledgerStatement } from '../entryGroups.js';
import { buildLedgerPdf } from '../ledgerPdf';
import {
  ledgerGroupDirectionText,
  ledgerGroupHeadParts,
  ledgerGroupMemberParts,
  ledgerGroupOpenText,
  ledgerSettledEntryParts,
  ledgerSettlementCheck,
  ledgerSettlementRefLines,
} from '../ledgerParties';
import { checkDraft } from '../settlementAllocation.js';

const tx = (date) => ({ transactionDate: date });
const ketul = { id: '7', title: "Ketul's wedding" };
// Yash's "Ketul's wedding": four entries he owes, the outfit the user owes, a note.
const e230 = { id: '47', direction: 'OWES_ME', amount: 230, pendingAmount: 230, settlementLegacy: false, entryGroup: ketul, transaction: tx('2025-11-30') };
const e159 = { id: '34', direction: 'OWES_ME', amount: 159, pendingAmount: 159, settlementLegacy: false, entryGroup: ketul, transaction: tx('2025-12-06') };
const e8800 = { id: '49', direction: 'I_OWE', amount: 8800, pendingAmount: 8800, settlementLegacy: false, entryGroup: ketul, transaction: tx('2025-12-07') };
const e1900 = { id: '18', direction: 'OWES_ME', amount: 1900, pendingAmount: 1900, settlementLegacy: false, entryGroup: ketul, transaction: tx('2026-01-10') };
const note = { id: '20', direction: 'NOTHING_OUTSTANDING', amount: 0, entryGroup: ketul, transaction: tx('2026-01-13') };
const stock = { id: '87', direction: 'OWES_ME', amount: 25000, pendingAmount: 25000, settlementLegacy: false, transaction: tx('2026-04-01') };
const members = [e230, e159, e8800, e1900, note];

describe('groupLedgerRows', () => {
  it('collapses a group into one row where its first entry was', () => {
    const rows = groupLedgerRows([e230, stock, e159, e8800, e1900, note]);
    expect(rows.map((r) => (r.kind === 'group' ? `group:${r.group.title}:${r.members.length}` : `tag:${r.tag.id}`))).toEqual([
      "group:Ketul's wedding:5",
      'tag:87',
    ]);
  });
});

describe('groupTotals', () => {
  it('adds the entries up as a net amount', () => {
    expect(groupTotals(members)).toEqual({
      count: 5,
      totalAmount: -6511,
      pendingOwesMe: 2289,
      pendingIOwe: 8800,
      pendingNet: -6511,
      clearedAmount: 0,
      status: 'open',
      balanceDelta: -6511,
      dateFrom: '2025-11-30',
      dateTo: '2026-01-13',
    });
  });

  it('reads as settled once nothing is open', () => {
    const paid = members.map((m) => ({ ...m, pendingAmount: 0 }));
    expect(groupTotals(paid)).toMatchObject({ pendingNet: 0, clearedAmount: 11089, status: 'settled' });
  });
});

describe('fillGroup', () => {
  it('settles the whole group with exactly its net, netting the other side in', () => {
    expect(groupOpenMinor(members)).toBe(651_100);
    const draft = fillGroup(651_100, members);
    expect(draft).toEqual({ 47: '230', 34: '159', 18: '1900', 49: '8800' });
    const check = checkDraft({ amountMinor: 651_100, dues: members, draft });
    expect([check.valid, check.side, check.appliedMinor, check.onAccountMinor]).toEqual([true, 'paid', 651_100, 0]);
  });

  it('pays part of the group oldest first', () => {
    const draft = fillGroup(300_000, members);
    expect(draft['49']).toBe('5289');
    expect(checkDraft({ amountMinor: 300_000, dues: members, draft }).valid).toBe(true);
  });

  it('leaves rows outside the group alone, and clears the group at zero', () => {
    expect(fillGroup(100_000, members, { 87: '500' })['87']).toBe('500');
    expect(fillGroup(0, members, { 87: '500', 47: '230' })).toEqual({ 87: '500' });
  });
});

describe('ledgerStatement', () => {
  // The user pays Yash the group's ₹6,511: the outfit cleared, Yash's three entries netted in.
  const pay = {
    id: '90', direction: 'SETTLEMENT', amount: 6511, settlementSide: 'paid', settlementLegacy: false,
    allocatedAmount: 6511, unallocatedAmount: 0, transaction: tx('2026-02-01'),
    // The API sends linked entries with today's figures: all paid off.
    settlesTransactions: [
      { ...e8800, pendingAmount: 0, linkAmount: 8800 },
      { ...e230, pendingAmount: 0, linkAmount: 230 },
      { ...e159, pendingAmount: 0, linkAmount: 159 },
      { ...e1900, pendingAmount: 0, linkAmount: 1900 },
    ],
  };
  const paid = (entry, linkAmount) => ({ ...entry, pendingAmount: 0, settledBy: [{ ...pay, linkAmount }] });
  const tags = [paid(e230, 230), paid(e159, 159), paid(e8800, 8800), paid(e1900, 1900), note, pay, stock];
  const statement = ledgerStatement(tags);
  const [group, payment, loan] = statement.rows;

  it('prints a group as one row, numbered with the rest', () => {
    expect(statement.rows.map((r) => [r.kind, r.no])).toEqual([['group', 1], ['tag', 2], ['tag', 3]]);
    expect(group.members).toHaveLength(5);
    expect(statement.rows.map((r) => r.running)).toEqual([-6511, 0, 25000]);
  });

  it('reads the group as a whole: direction, amount, what is open', () => {
    expect(ledgerGroupDirectionText(group.totals, 'Yash Patel')).toBe('Kevin owes Yash');
    expect(ledgerGroupOpenText(group.totals, 'Yash Patel')).toBe('Settled');
    expect(ledgerGroupHeadParts(group, 'Yash Patel')).toEqual(['#1', "Ketul's wedding", '5 entries', 'Kevin owes Yash Rs.6,511']);
  });

  it('merges the settlement links: one payment settled the group by its net', () => {
    expect(ledgerSettlementRefLines(group.links, null)).toEqual(['Settled by #2 Rs.6,511']);
    expect(ledgerSettlementRefLines(payment.links, pay)).toEqual(["Settles #1 Ketul's wedding Rs.6,511"]);
    expect(ledgerSettlementRefLines(loan.links, stock)).toEqual([]);
  });

  it("names the group where the settlement's breakdown points at its entries", () => {
    const [details] = statement.settlements;
    expect(details.row).toBe(2);
    expect(ledgerSettledEntryParts(details, details.settles[0]).slice(0, 3)).toEqual([
      "#1 Ketul's wedding", '07 Dec 2025', 'Rs.8,800 in full',
    ]);
    expect(ledgerSettlementCheck(details)).toBe('Rs.6,511 = Rs.8,800 - Rs.230 netted - Rs.159 netted - Rs.1,900 netted');
  });

  it('lists every entry of the group under Group details', () => {
    expect(ledgerGroupMemberParts(group.members[2], group.memberLinks[2], 'Yash Patel')).toEqual([
      '07 Dec 2025', 'Kevin owes Yash', 'Rs.8,800', 'Settled', 'Settled by #2 Rs.8,800', '-',
    ]);
  });

  it('prints the group row and its details in the PDF', () => {
    const out = buildLedgerPdf({
      friendName: 'Yash Patel',
      startDate: '2025-11-01',
      endDate: '2026-04-30',
      tags,
      summary: { totalTheyOwe: 27289, totalYouOwe: 8800, totalSettlements: 6511, net: 25000 },
      generatedStamp: '22 Oct 2026, 10:00 am',
    }).output();
    expect(out).toContain('Group details');
    expect(out).toContain("#1 | Ketul's wedding | 5 entries | Kevin owes Yash Rs.6,511");
    expect(out).toContain('07 Dec 2025 | Kevin owes Yash | Rs.8,800 | Settled | Settled by #2 Rs.8,800');
    // PDF text escapes parentheses, so match either side of "(of Rs.230)".
    expect(out).toContain("#1 Ketul's wedding | 30 Nov 2025 | Rs.230 netted off");
    expect(out).toContain('Rs.230\\) | now settled');
  });
});
