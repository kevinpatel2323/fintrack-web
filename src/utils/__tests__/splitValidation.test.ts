import { describe, expect, it } from 'vitest';
import {
  validateAdjustmentSplit,
  validateEntriesMatchParticipants,
  validatePercentTotal,
  validateSelectedParticipants,
  validateShares,
  validateSplitTotal,
} from '../splitValidation';

describe('validateSelectedParticipants', () => {
  it('requires at least one participant', () => {
    const r = validateSelectedParticipants([]);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/at least one/i);
  });

  it('rejects duplicates', () => {
    const r = validateSelectedParticipants(['a', 'b', 'a']);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /duplicate/i.test(e))).toBe(true);
  });

  it('accepts a single participant', () => {
    expect(validateSelectedParticipants(['x']).valid).toBe(true);
  });
});

describe('validateSplitTotal', () => {
  it('requires sum to match total', () => {
    expect(
      validateSplitTotal(
        [
          { participantId: 'a', amountMinor: 40 },
          { participantId: 'b', amountMinor: 50 },
        ],
        100,
      ).valid,
    ).toBe(false);
  });

  it('accepts exact match', () => {
    expect(
      validateSplitTotal(
        [
          { participantId: 'a', amountMinor: 40 },
          { participantId: 'b', amountMinor: 60 },
        ],
        100,
      ).valid,
    ).toBe(true);
  });

  it('handles zero total', () => {
    expect(validateSplitTotal([{ participantId: 'a', amountMinor: 0 }], 0).valid).toBe(true);
  });
});

describe('validatePercentTotal', () => {
  it('requires exactly 100% with default tolerance', () => {
    expect(
      validatePercentTotal([
        { participantId: 'a', percentBps: 3333 },
        { participantId: 'b', percentBps: 3333 },
        { participantId: 'c', percentBps: 3333 },
      ]).valid,
    ).toBe(false);
  });

  it('accepts perfect 100%', () => {
    expect(
      validatePercentTotal([
        { participantId: 'a', percentBps: 5000 },
        { participantId: 'b', percentBps: 5000 },
      ]).valid,
    ).toBe(true);
  });

  it('allows 100.01% when tolerance covers it', () => {
    expect(
      validatePercentTotal(
        [
          { participantId: 'a', percentBps: 5000 },
          { participantId: 'b', percentBps: 5001 },
        ],
        2,
      ).valid,
    ).toBe(true);
  });

  it('allows 99.99% when tolerance covers it', () => {
    expect(
      validatePercentTotal(
        [
          { participantId: 'a', percentBps: 4999 },
          { participantId: 'b', percentBps: 5000 },
        ],
        2,
      ).valid,
    ).toBe(true);
  });

  it('rejects negative percent entries', () => {
    expect(
      validatePercentTotal([
        { participantId: 'a', percentBps: -1 },
        { participantId: 'b', percentBps: 10001 },
      ]).valid,
    ).toBe(false);
  });
});

describe('validateShares', () => {
  it('rejects non-positive shares', () => {
    expect(
      validateShares([
        { participantId: 'a', shareWeight: 0 },
        { participantId: 'b', shareWeight: 1 },
      ]).valid,
    ).toBe(false);
  });

  it('accepts positive shares', () => {
    expect(
      validateShares([
        { participantId: 'a', shareWeight: 1 },
        { participantId: 'b', shareWeight: 2 },
      ]).valid,
    ).toBe(true);
  });
});

describe('validateAdjustmentSplit', () => {
  it('errors when all participants are pinned but sum does not match total', () => {
    const r = validateAdjustmentSplit(100, [
      { participantId: 'a', pinnedMinor: 40 },
      { participantId: 'b', pinnedMinor: 50 },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /fixed/i.test(e))).toBe(true);
  });

  it('accepts when all pinned and sum matches', () => {
    expect(
      validateAdjustmentSplit(100, [
        { participantId: 'a', pinnedMinor: 60 },
        { participantId: 'b', pinnedMinor: 40 },
      ]).valid,
    ).toBe(true);
  });

  it('errors when pinned amounts exceed total', () => {
    const r = validateAdjustmentSplit(100, [
      { participantId: 'a', pinnedMinor: 110 },
      { participantId: 'b', pinnedMinor: null },
    ]);
    expect(r.valid).toBe(false);
  });

  it('errors on duplicate roster ids', () => {
    const r = validateAdjustmentSplit(100, [
      { participantId: 'a', pinnedMinor: 10 },
      { participantId: 'a', pinnedMinor: null },
    ]);
    expect(r.valid).toBe(false);
  });

  it('rejects negative pinned amounts', () => {
    const r = validateAdjustmentSplit(100, [
      { participantId: 'a', pinnedMinor: -1 },
      { participantId: 'b', pinnedMinor: null },
    ]);
    expect(r.valid).toBe(false);
  });
});

describe('validateEntriesMatchParticipants', () => {
  it('detects orphan participant ids', () => {
    const r = validateEntriesMatchParticipants(
      [{ participantId: 'gone' }, { participantId: 'ok' }],
      ['ok'],
    );
    expect(r.valid).toBe(false);
  });
});
