import { describe, expect, it } from 'vitest';
import {
  checkDraft,
  draftFromCurrent,
  draftToAllocations,
  fillOldestFirst,
  minorToInput,
  netAllOff,
  rupees,
} from '../settlementAllocation.js';

// Jayraj's open entries, oldest first, as the open-dues endpoint returns them.
const dues = [
  { id: '41', direction: 'OWES_ME', pendingAmount: 8800 },
  { id: '68', direction: 'I_OWE', pendingAmount: 340 },
  { id: '124', direction: 'OWES_ME', pendingAmount: 45.46 },
  { id: '112', direction: 'OWES_ME', pendingAmount: 230.91 },
  { id: '136', direction: 'OWES_ME', pendingAmount: 190 },
  { id: '188', direction: 'OWES_ME', pendingAmount: 652.38 },
  { id: '246', direction: 'OWES_ME', pendingAmount: 1500 },
];

describe('fillOldestFirst', () => {
  it('spreads ₹10,000 over his entries and stops part-way into the loan', () => {
    expect(fillOldestFirst(1_000_000, dues, 'OWES_ME')).toEqual({
      41: '8800',
      124: '45.46',
      112: '230.91',
      136: '190',
      188: '652.38',
      246: '81.25',
    });
  });

  it('only touches the side asked for', () => {
    expect(fillOldestFirst(1_000_000, dues, 'I_OWE')).toEqual({ 68: '340' });
  });

  it('counts what is netted from the other side as extra to clear', () => {
    const draft = fillOldestFirst(1_000_000, dues, 'OWES_ME', { 68: '340' });
    expect(draft['68']).toBe('340');
    expect(draft['246']).toBe('421.25');
  });

  it('fills everything and leaves the rest when the payment is larger', () => {
    const draft = fillOldestFirst(2_000_000, dues, 'OWES_ME');
    expect(draft['246']).toBe('1500');
    expect(checkDraft({ amountMinor: 2_000_000, dues, draft }).onAccountMinor).toBe(858_125);
  });
});

describe('netAllOff', () => {
  it('nets all of what you owe and clears that much more of his entries', () => {
    const draft = netAllOff(1_000_000, dues, 'I_OWE');
    expect(draft['68']).toBe('340');
    expect(draft['246']).toBe('421.25');
    const result = checkDraft({ amountMinor: 1_000_000, dues, draft });
    expect([result.valid, result.side, result.settledMinor, result.nettedMinor, result.onAccountMinor]).toEqual([
      true,
      'received',
      1_034_000,
      34_000,
      0,
    ]);
  });
});

describe('checkDraft', () => {
  it('passes the oldest-first fill with nothing on account', () => {
    const draft = fillOldestFirst(1_000_000, dues, 'OWES_ME');
    expect(checkDraft({ amountMinor: 1_000_000, dues, draft })).toMatchObject({
      valid: true,
      errors: [],
      rowErrors: {},
      side: 'received',
      appliedMinor: 1_000_000,
      onAccountMinor: 0,
    });
  });

  it('flags a row asking for more than is pending', () => {
    const result = checkDraft({ amountMinor: 1_000_000, dues, draft: { 246: '1600' } });
    expect(result.valid).toBe(false);
    expect(result.rowErrors).toEqual({ 246: 'Only ₹1,500 pending' });
  });

  it('flags an empty or zero amount', () => {
    expect(checkDraft({ amountMinor: 100, dues, draft: { 246: '' } }).rowErrors).toEqual({
      246: 'Enter an amount',
    });
    expect(checkDraft({ amountMinor: 100, dues, draft: { 246: '0' } }).valid).toBe(false);
  });

  it('flags more than the settlement', () => {
    const result = checkDraft({ amountMinor: 50_000, dues, draft: { 246: '600' } });
    expect(result.errors).toEqual(['Applied ₹600 is more than the ₹500 settlement.']);
  });

  it('reads money as paid when it clears more of what the user owes', () => {
    const result = checkDraft({ amountMinor: 30_000, dues, draft: { 68: '340', 246: '40' } });
    expect([result.valid, result.side, result.appliedMinor]).toEqual([true, 'paid', 30_000]);
  });

  it('keeps an unapplied remainder on account', () => {
    const result = checkDraft({ amountMinor: 50_000, dues, draft: { 136: '190' } });
    expect([result.valid, result.onAccountMinor]).toEqual([true, 31_000]);
  });
});

describe('refunds', () => {
  // Vraj overpaid ₹150 (money that came in, on account); the user sends it back.
  const refundable = [{ id: '64', direction: 'SETTLEMENT', unallocatedAmount: 150, settlementSide: 'received' }];

  it('makes the settlement money paid out', () => {
    const result = checkDraft({ amountMinor: 15_000, dues: [], refundable, draft: { 64: '150' } });
    expect([result.valid, result.side, result.refundMinor, result.onAccountMinor]).toEqual([true, 'paid', 15_000, 0]);
  });

  it('cannot refund more than is on account', () => {
    expect(checkDraft({ amountMinor: 20_000, dues: [], refundable, draft: { 64: '200' } }).rowErrors).toEqual({
      64: 'Only ₹150 on account',
    });
  });
});

describe('draft helpers', () => {
  it('starts an edit from what the settlement already covers', () => {
    expect(
      draftFromCurrent(
        [
          { id: '1', currentAllocation: 81.25 },
          { id: '2', currentAllocation: null },
        ],
        [{ id: '3', currentAllocation: 150 }],
      ),
    ).toEqual({ 1: '81.25', 3: '150' });
  });

  it('converts the draft for the API', () => {
    expect(draftToAllocations({ 246: '81.25', 41: '8800' })).toEqual([
      { tagId: 41, amount: 8800 },
      { tagId: 246, amount: 81.25 },
    ]);
  });

  it('formats paise only when present', () => {
    expect([rupees(141_875), rupees(150_000), minorToInput(8_125), minorToInput(880_000)]).toEqual([
      '₹1,418.75',
      '₹1,500',
      '81.25',
      '8800',
    ]);
  });
});
