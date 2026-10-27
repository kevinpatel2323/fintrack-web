import { describe, expect, it } from 'vitest';
import { buildRRule, describeRRule, parseCadence } from '../cadence.js';

describe('cadence', () => {
  it('recognises the rules the form writes', () => {
    expect(parseCadence('FREQ=MONTHLY;BYMONTHDAY=15')).toEqual({ mode: 'monthly', day: 15 });
    expect(parseCadence('RRULE:FREQ=WEEKLY')).toEqual({ mode: 'weekly', day: null });
    expect(parseCadence('FREQ=YEARLY')).toEqual({ mode: 'yearly', day: null });
  });

  it('treats anything else as a custom rule', () => {
    expect(parseCadence('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=1').mode).toBe('custom');
    expect(parseCadence('FREQ=MONTHLY;BYMONTHDAY=40').mode).toBe('custom');
    expect(parseCadence('').mode).toBe('custom');
  });

  it('writes rules for each choice and keeps custom text', () => {
    expect(buildRRule('monthly', { day: 1 })).toBe('FREQ=MONTHLY;BYMONTHDAY=1');
    expect(buildRRule('monthly', { day: 45 })).toBe('FREQ=MONTHLY;BYMONTHDAY=31');
    expect(buildRRule('weekly')).toBe('FREQ=WEEKLY');
    expect(buildRRule('yearly')).toBe('FREQ=YEARLY');
    expect(buildRRule('custom', { current: 'FREQ=DAILY;INTERVAL=3' })).toBe('FREQ=DAILY;INTERVAL=3');
  });

  it('describes rules in plain words', () => {
    expect(describeRRule('FREQ=MONTHLY;BYMONTHDAY=1')).toBe('Monthly on day 1');
    expect(describeRRule('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1,15')).toBe('Every 3 months on days 1, 15');
    expect(describeRRule('FREQ=WEEKLY;BYDAY=MO,TH')).toBe('Weekly on Mon, Thu');
    expect(describeRRule('FREQ=YEARLY')).toBe('Yearly');
    expect(describeRRule('FREQ=DAILY;INTERVAL=2')).toBe('Every 2 days');
    expect(describeRRule('')).toBe('Recurring');
  });
});
