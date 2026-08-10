import { describe, expect, it } from 'vitest';
import { buildLedgerPdf } from '../ledgerPdf';
import { ledgerSettlementIndex, ledgerSettlementRefLines } from '../ledgerParties';

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
});
