import { describe, expect, it } from 'vitest';
import {
  matchState,
  selectedTotalPaise,
  signedPaise,
  toPaise,
} from '../ccMatch.js';

describe('toPaise', () => {
  it('converts rupees to integer paise', () => {
    expect(toPaise(42318)).toBe(4231800);
    expect(toPaise(0.01)).toBe(1);
  });

  it('treats null, undefined and empty string as zero', () => {
    expect(toPaise(null)).toBe(0);
    expect(toPaise(undefined)).toBe(0);
    expect(toPaise('')).toBe(0);
  });

  it('accepts numeric strings, as the API returns for NUMERIC columns', () => {
    expect(toPaise('486.00')).toBe(48600);
  });

  // The reason the whole module exists: 0.1 + 0.2 !== 0.3 in binary floating
  // point, and a selection that is exactly right must never look off by a paisa.
  it('does not drift on values inexact in floating point', () => {
    expect(toPaise(0.1) + toPaise(0.2)).toBe(toPaise(0.3));
  });
});

describe('signedPaise', () => {
  it('adds purchases and subtracts refunds', () => {
    expect(signedPaise({ amount: 486, isRefund: false })).toBe(48600);
    expect(signedPaise({ amount: 486, isRefund: true })).toBe(-48600);
  });
});

describe('selectedTotalPaise', () => {
  const txns = [
    { id: 1, amount: 486, isRefund: false },
    { id: 2, amount: 3240, isRefund: false },
    { id: 3, amount: 200, isRefund: true },
  ];

  it('sums only the selected rows', () => {
    expect(selectedTotalPaise(txns, new Set(['1', '2']))).toBe(372600);
  });

  it('accepts an array as well as a Set', () => {
    expect(selectedTotalPaise(txns, ['1'])).toBe(48600);
  });

  it('nets refunds out of the total', () => {
    expect(selectedTotalPaise(txns, ['1', '3'])).toBe(28600);
  });

  it('returns zero when nothing is selected', () => {
    expect(selectedTotalPaise(txns, [])).toBe(0);
  });

  it('ignores ids that are not in the list', () => {
    expect(selectedTotalPaise(txns, ['99'])).toBe(0);
  });
});

describe('matchState', () => {
  const txns = [
    { id: 1, amount: 40000, isRefund: false },
    { id: 2, amount: 438, isRefund: false },
  ];

  it('reports an exact match', () => {
    const state = matchState(txns, new Set(['1', '2']), 40438);
    expect(state).toMatchObject({ delta: 0, matches: true });
  });

  it('reports a shortfall as a negative delta', () => {
    // Paid ₹42,318 but only ₹40,438 of rows selected — the gap is the balance
    // carried forward from the previous cycle.
    const state = matchState(txns, new Set(['1', '2']), 42318);
    expect(state.delta).toBe(-188000);
    expect(state.matches).toBe(false);
  });

  it('reports an overshoot as a positive delta', () => {
    const state = matchState(txns, new Set(['1', '2']), 40000);
    expect(state.delta).toBe(43800);
    expect(state.matches).toBe(false);
  });

  it('never matches on an empty selection, even against a zero target', () => {
    expect(matchState(txns, [], 0).matches).toBe(false);
  });

  it('exposes both sides of the comparison in paise', () => {
    expect(matchState(txns, ['1'], 400)).toMatchObject({
      selectedPaise: 4000000,
      targetPaise: 40000,
    });
  });
});
