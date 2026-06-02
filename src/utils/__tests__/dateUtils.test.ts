import { describe, expect, it } from 'vitest';
import { getLast30DayRange } from '../dateUtils.js';

describe('getLast30DayRange', () => {
  it('returns local start 30 days before end (today)', () => {
    const ref = new Date(2026, 5, 3, 15, 30); // 3 Jun 2026 local
    const { startIso, endIso } = getLast30DayRange(ref);
    expect(endIso).toBe('2026-06-03');
    expect(startIso).toBe('2026-05-04');
  });

  it('handles month boundary', () => {
    const ref = new Date(2026, 2, 5); // 5 Mar 2026
    const { startIso, endIso } = getLast30DayRange(ref);
    expect(endIso).toBe('2026-03-05');
    expect(startIso).toBe('2026-02-03');
  });
});
