import { describe, expect, it } from 'vitest';
import {
  calculateAdjustmentSplit,
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  minorToMajorString,
  normalizeMoneyMinor,
  parsePercentStringToBps,
  parseShareStringToWeight,
  parseSplitPayload,
  roundCurrencyToMinor,
  serializeSplitPayload,
} from '../splitEngine';

describe('roundCurrencyToMinor', () => {
  it('parses major units without float drift', () => {
    expect(roundCurrencyToMinor('10.00')).toBe(1000);
    expect(roundCurrencyToMinor('0.01')).toBe(1);
    expect(roundCurrencyToMinor('99.99')).toBe(9999);
  });

  it('rejects invalid strings', () => {
    expect(roundCurrencyToMinor('')).toBeNull();
    expect(roundCurrencyToMinor('abc')).toBeNull();
  });

  it('handles negatives', () => {
    expect(roundCurrencyToMinor('-5.50')).toBe(-550);
  });
});

describe('normalizeMoneyMinor', () => {
  it('truncates toward zero', () => {
    expect(normalizeMoneyMinor(3.7)).toBe(3);
    expect(normalizeMoneyMinor(-3.7)).toBe(-3);
  });
});

describe('calculateEqualSplit', () => {
  it('splits 100 minor across 3 with deterministic remainder to first participants', () => {
    const r = calculateEqualSplit(100, ['a', 'b', 'c']);
    expect(r.map((x) => x.amountMinor)).toEqual([34, 33, 33]);
    expect(r.reduce((s, x) => s + x.amountMinor, 0)).toBe(100);
  });

  it('handles one participant', () => {
    expect(calculateEqualSplit(42, ['x'])).toEqual([{ participantId: 'x', amountMinor: 42 }]);
  });

  it('handles zero total', () => {
    expect(calculateEqualSplit(0, ['a', 'b'])).toEqual([
      { participantId: 'a', amountMinor: 0 },
      { participantId: 'b', amountMinor: 0 },
    ]);
  });

  it('handles very small total across several people', () => {
    const r = calculateEqualSplit(2, ['a', 'b', 'c']);
    expect(r.map((x) => x.amountMinor)).toEqual([1, 1, 0]);
    expect(r.reduce((s, x) => s + x.amountMinor, 0)).toBe(2);
  });
});

describe('calculateExactSplit', () => {
  it('returns normalized entry amounts', () => {
    const r = calculateExactSplit(
      100,
      [
        { participantId: 'a', amountMinor: 40 },
        { participantId: 'b', amountMinor: 60 },
      ],
    );
    expect(r).toEqual([
      { participantId: 'a', amountMinor: 40 },
      { participantId: 'b', amountMinor: 60 },
    ]);
  });
});

describe('calculatePercentageSplit', () => {
  it('reconciles rounding remainder in participant order', () => {
    const r = calculatePercentageSplit(100, [
      { participantId: 'a', percentBps: 3333 },
      { participantId: 'b', percentBps: 3333 },
      { participantId: 'c', percentBps: 3334 },
    ]);
    expect(r.reduce((s, x) => s + x.amountMinor, 0)).toBe(100);
  });

  it('handles zero total', () => {
    const r = calculatePercentageSplit(0, [
      { participantId: 'a', percentBps: 5000 },
      { participantId: 'b', percentBps: 5000 },
    ]);
    expect(r.every((x) => x.amountMinor === 0)).toBe(true);
  });
});

describe('calculateSharesSplit', () => {
  it('splits by integer weights', () => {
    const r = calculateSharesSplit(100, [
      { participantId: 'a', shareWeight: 1 },
      { participantId: 'b', shareWeight: 2 },
      { participantId: 'c', shareWeight: 3 },
    ]);
    expect(r.reduce((s, x) => s + x.amountMinor, 0)).toBe(100);
    expect(r.map((x) => x.amountMinor)).toEqual([17, 33, 50]);
  });

  it('handles decimal-derived scaled weights from parser', () => {
    const w1 = parseShareStringToWeight('1.5')!;
    const w2 = parseShareStringToWeight('1')!;
    const r = calculateSharesSplit(100, [
      { participantId: 'a', shareWeight: w1 },
      { participantId: 'b', shareWeight: w2 },
    ]);
    expect(r.reduce((s, x) => s + x.amountMinor, 0)).toBe(100);
  });

  it('returns zeros when sum of weights is zero', () => {
    const r = calculateSharesSplit(50, [
      { participantId: 'a', shareWeight: 0 },
      { participantId: 'b', shareWeight: 0 },
    ]);
    expect(r.map((x) => x.amountMinor)).toEqual([0, 0]);
  });
});

describe('calculateAdjustmentSplit', () => {
  it('splits remainder equally among unfixed participants', () => {
    const r = calculateAdjustmentSplit(
      100,
      ['a', 'b', 'c'],
      [{ participantId: 'a', amountMinor: 10 }],
    );
    expect(r.find((x) => x.participantId === 'a')!.amountMinor).toBe(10);
    expect(r.filter((x) => x.participantId !== 'a').every((x) => x.amountMinor === 45)).toBe(true);
    expect(r.reduce((s, x) => s + x.amountMinor, 0)).toBe(100);
  });

  it('when all pinned and sum matches total, returns pinned amounts', () => {
    const r = calculateAdjustmentSplit(
      100,
      ['a', 'b'],
      [
        { participantId: 'a', amountMinor: 60 },
        { participantId: 'b', amountMinor: 40 },
      ],
    );
    expect(r).toEqual([
      { participantId: 'a', amountMinor: 60 },
      { participantId: 'b', amountMinor: 40 },
    ]);
  });

  it('distributes remainder across unfixed with deterministic +1s', () => {
    const r = calculateAdjustmentSplit(
      101,
      ['a', 'b', 'c'],
      [{ participantId: 'a', amountMinor: 1 }],
    );
    expect(r.reduce((s, x) => s + x.amountMinor, 0)).toBe(101);
    const rest = r.filter((x) => x.participantId !== 'a').map((x) => x.amountMinor);
    expect(rest.reduce((s, x) => s + x, 0)).toBe(100);
  });
});

describe('parsePercentStringToBps', () => {
  it('converts common percents', () => {
    expect(parsePercentStringToBps('100')).toBe(10_000);
    expect(parsePercentStringToBps('33.33')).toBe(3333);
    expect(parsePercentStringToBps('0.01')).toBe(1);
  });
});

describe('serializeSplitPayload / parseSplitPayload', () => {
  it('round-trips v1 payload', () => {
    const payload = {
      v: 1 as const,
      method: 'EQUAL' as const,
      payerId: 'me',
      participantIds: ['1', '2'],
      totalMinor: 100,
      results: [
        { participantId: '1', amountMinor: 50 },
        { participantId: '2', amountMinor: 50 },
      ],
    };
    const s = serializeSplitPayload(payload);
    expect(parseSplitPayload(s)).toEqual(payload);
  });

  it('returns null for non-prefixed strings', () => {
    expect(parseSplitPayload('hello')).toBeNull();
  });
});

describe('minorToMajorString', () => {
  it('formats minor units', () => {
    expect(minorToMajorString(1000)).toBe('10.00');
    expect(minorToMajorString(1)).toBe('0.01');
  });
});
