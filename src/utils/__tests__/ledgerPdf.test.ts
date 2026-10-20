import { describe, expect, it } from 'vitest';
import { buildLedgerPdf } from '../ledgerPdf';
import {
  ledgerBalanceDelta,
  ledgerOpenText,
  ledgerOpenTotals,
  ledgerRunningBalances,
  ledgerSettledEntryParts,
  ledgerSettlementCheck,
  ledgerSettlementHeadParts,
  ledgerSettlementIndex,
  ledgerSettlementRefLines,
} from '../ledgerParties';

const tx = (id, date, desc) => ({
  id,
  transactionDate: date,
  upiName: `Name ${id}`,
  upiDescription: desc,
  upiBank: 'HDFC',
});

const lunch = {
  id: '1',
  direction: 'OWES_ME',
  amount: 300,
  transaction: tx('t1', '2026-06-03', 'Lunch at cafe'),
};

const cab = {
  id: '2',
  direction: 'I_OWE',
  amount: 200,
  transaction: tx('t2', '2026-06-09', 'Cab fare'),
};

const settlement = {
  id: '3',
  direction: 'SETTLEMENT',
  amount: 500,
  transaction: tx('t3', '2026-06-12', 'UPI settle'),
  settlesTransactions: [lunch, cab],
};

/** The ledger endpoint stamps `settledBy` onto each tag a settlement cleared. */
const settledTags = [
  { ...lunch, settledBy: [settlement] },
  { ...cab, settledBy: [settlement] },
  settlement,
];

/** Raw PDF source — with compression off, drawn text appears verbatim. */
function pdfText(pdf) {
  return pdf.output();
}

describe('ledgerSettlementIndex', () => {
  it('cross-references a settlement with the rows it settles', () => {
    const { rows, groups } = ledgerSettlementIndex(settledTags);

    expect(ledgerSettlementRefLines(rows[0])).toEqual(['Settled by #3']);
    expect(ledgerSettlementRefLines(rows[1])).toEqual(['Settled by #3']);
    expect(ledgerSettlementRefLines(rows[2])).toEqual(['Settles #1, #2']);

    expect(groups).toHaveLength(1);
    expect(groups[0].row).toBe(3);
    expect(groups[0].settles.map((ref) => ref.row)).toEqual([1, 2]);
  });

  it('counts linked entries that fall outside the export instead of dropping them', () => {
    const { rows, groups } = ledgerSettlementIndex([settlement]);

    expect(ledgerSettlementRefLines(rows[0])).toEqual(['Settles +2 not listed']);
    expect(groups[0].settles.every((ref) => ref.row === null)).toBe(true);
  });

  it('leaves untagged rows without cross-references', () => {
    const { rows, groups } = ledgerSettlementIndex([lunch]);
    expect(ledgerSettlementRefLines(rows[0])).toEqual([]);
    expect(groups).toEqual([]);
  });

  it('points netted entries at the other side of their offset', () => {
    const owesA = { id: 1, direction: 'OWES_ME', offsets: [{ offsetId: '7', amount: 300 }] };
    const owesB = { id: 2, direction: 'OWES_ME', offsets: [{ offsetId: '7', amount: 200 }, { offsetId: '8', amount: 100 }] };
    const iOweA = { id: 3, direction: 'I_OWE', offsets: [{ offsetId: '7', amount: 500 }] };
    const iOweB = { id: 4, direction: 'I_OWE', offsets: [{ offsetId: '8', amount: 100 }] };
    const { rows, groups } = ledgerSettlementIndex([owesA, owesB, iOweA, iOweB]);

    expect(ledgerSettlementRefLines(rows[0])).toEqual(['Netted with #3']);
    expect(ledgerSettlementRefLines(rows[1])).toEqual(['Netted with #3, #4']);
    expect(ledgerSettlementRefLines(rows[2])).toEqual(['Netted with #1, #2']);
    expect(ledgerSettlementRefLines(rows[3])).toEqual(['Netted with #2']);
    expect(groups).toEqual([]);
  });
});

describe('buildLedgerPdf', () => {
  const args = {
    friendName: 'Yash Shah',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    tags: settledTags,
    summary: { totalTheyOwe: 300, totalYouOwe: 200, totalSettlements: 500, net: -400 },
    generatedStamp: '12 Jun 2026, 10:00 am',
  };

  it('renders settlements as a negative balance impact', () => {
    expect(pdfText(buildLedgerPdf(args))).toContain('-Rs.500');
  });

  it('prints the settlement cross-references and breakdown', () => {
    const out = pdfText(buildLedgerPdf(args));

    expect(out).toContain('Settlement link');
    expect(out).toContain('Settles #1, #2');
    expect(out).toContain('Settled by #3');
    expect(out).toContain('Settlement details');
    expect(out).toContain('Entries it settles');
    expect(out).toContain('Lunch at cafe');
  });

  it('omits the breakdown when nothing was settled', () => {
    const out = pdfText(buildLedgerPdf({ ...args, tags: [lunch] }));
    expect(out).not.toContain('Settlement details');
  });

  it('prints each entry\'s share and the money left on account', () => {
    // Bill-wise: ₹500 paid ₹300 off lunch and left ₹200 unapplied.
    const partLunch = { ...lunch, linkAmount: 300 };
    const billWise = {
      ...settlement,
      settlesTransactions: [partLunch],
      allocatedAmount: 300,
      unallocatedAmount: 200,
      settlementSide: 'received',
    };
    const out = pdfText(buildLedgerPdf({ ...args, tags: [{ ...lunch, settledBy: [billWise] }, billWise] }));
    expect(out).toContain('Rs.300 in full');
    expect(out).toContain('Rs.200 on account');
    expect(out).toContain('Check: Rs.500 = Rs.300 + Rs.200 on account');
  });

  it('renders a settlement paid back to the friend as a positive impact', () => {
    const repay = { ...settlement, id: '9', amount: 200, settlementSide: 'paid', settlesTransactions: [] };
    expect(pdfText(buildLedgerPdf({ ...args, tags: [cab, repay] }))).toContain('+Rs.200');
  });
});

describe('ledgerBalanceDelta', () => {
  it('reads a settlement by which way the money went', () => {
    expect(ledgerBalanceDelta({ direction: 'SETTLEMENT', amount: 500 })).toBe(-500);
    expect(ledgerBalanceDelta({ direction: 'SETTLEMENT', amount: 500, settlementSide: 'received' })).toBe(-500);
    expect(ledgerBalanceDelta({ direction: 'SETTLEMENT', amount: 340, settlementSide: 'paid' })).toBe(340);
  });

  it('nets an owed entry and its repayment to zero', () => {
    const tags = [
      { direction: 'I_OWE', amount: 340 },
      { direction: 'SETTLEMENT', amount: 340, settlementSide: 'paid' },
    ];
    expect(ledgerRunningBalances(tags)).toEqual([-340, 0]);
  });
});

// Yash's settlement #274: ₹10,000 split as ₹2,842 + ₹372 + ₹500 + ₹6,286 over
// entries of ₹7,000, ₹372, ₹500 and ₹25,000. The export used to list the full
// ₹25,000 under it, so ₹10,000 read as settling ₹32,872.
describe('a ₹10,000 settlement that pays part of a ₹25,000 entry', () => {
  const entry = (id, date, amount, pendingAmount, desc) => ({
    id,
    direction: 'OWES_ME',
    amount,
    pendingAmount,
    settlementLegacy: false,
    transaction: tx(`t${id}`, date, desc),
  });
  const e7000 = entry('29', '2026-01-30', 7000, 0, 'UPI SEND MONEY');
  const e372 = entry('26', '2026-02-03', 372, 0, 'SURESH TEA');
  const e500 = entry('51', '2026-02-17', 500, 0, 'SENT TO YASH');
  const e25000 = entry('87', '2026-04-01', 25000, 18714, 'UPI');
  const pay = {
    id: '274',
    direction: 'SETTLEMENT',
    amount: 10000,
    settlementSide: 'received',
    settlementLegacy: false,
    allocatedAmount: 10000,
    unallocatedAmount: 0,
    transaction: tx('t274', '2026-08-27', 'PATEL JAYRAJ'),
    settlesTransactions: [
      { ...e7000, linkAmount: 2842 },
      { ...e372, linkAmount: 372 },
      { ...e500, linkAmount: 500 },
      { ...e25000, linkAmount: 6286 },
    ],
  };
  const tags = [e7000, e372, e500, e25000, pay];
  const index = ledgerSettlementIndex(tags);
  const group = index.groups[0];

  it('lists each entry by the share it got, not by its full amount', () => {
    expect(group.settles.map((ref) => ledgerSettledEntryParts(group, ref).slice(0, 4))).toEqual([
      ['#1', '30 Jan 2026', 'Rs.2,842 of Rs.7,000', 'now settled'],
      ['#2', '03 Feb 2026', 'Rs.372 in full', 'SURESH TEA'],
      ['#3', '17 Feb 2026', 'Rs.500 in full', 'SENT TO YASH'],
      ['#4', '01 Apr 2026', 'Rs.6,286 of Rs.25,000', 'Rs.18,714 still open'],
    ]);
  });

  it('adds the shares back up to the settlement', () => {
    expect(ledgerSettlementHeadParts(group)).toEqual(['#5', '27 Aug 2026', 'Rs.10,000']);
    expect(ledgerSettlementCheck(group)).toBe('Rs.10,000 = Rs.2,842 + Rs.372 + Rs.500 + Rs.6,286');
  });

  it('says which entries were paid in full and which only in part', () => {
    expect(ledgerSettlementRefLines(index.rows[4], pay)).toEqual([
      'Settles #2, #3 in full · #1 Rs.2,842 (part) · #4 Rs.6,286 (part)',
    ]);
  });

  it('shows what each row still has open today', () => {
    expect(tags.map(ledgerOpenText)).toEqual(['Settled', 'Settled', 'Settled', 'Rs.18,714', '-']);
    expect(ledgerOpenTotals(tags)).toEqual({ theyOwe: 18714, youOwe: 0, onAccount: 0 });
  });

  it('prints all of it in the PDF', () => {
    const out = pdfText(
      buildLedgerPdf({
        friendName: 'Yash Patel',
        startDate: '2026-01-01',
        endDate: '2026-09-30',
        tags,
        summary: { totalTheyOwe: 32872, totalYouOwe: 0, totalSettlements: 10000, net: 22872 },
        generatedStamp: '20 Oct 2026, 10:00 am',
      }),
    );
    expect(out).toContain('Rs.6,286 of Rs.25,000');
    expect(out).toContain('Rs.18,714 still open');
    expect(out).toContain('Check: Rs.10,000 = Rs.2,842 + Rs.372 + Rs.500 + Rs.6,286');
    // The column header wraps in its narrow column, so only its first words.
    expect(out).toContain('Still open');
  });

  it('keeps the old wording for links saved before amounts', () => {
    const legacy = { ...pay, settlementLegacy: true, settlesTransactions: [{ ...e25000, linkAmount: null }] };
    const legacyIndex = ledgerSettlementIndex([e25000, legacy]);
    expect(ledgerSettlementRefLines(legacyIndex.rows[1], legacy)).toEqual(['Settles #1']);
    expect(ledgerSettlementCheck(legacyIndex.groups[0])).toBeNull();
    expect(ledgerSettledEntryParts(legacyIndex.groups[0], legacyIndex.groups[0].settles[0])[2]).toBe(
      'Rs.25,000 entry (amount settled not recorded)',
    );
  });
});
