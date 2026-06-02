import { describe, expect, it } from 'vitest';
import {
  calendarPath,
  parseCalendarParams,
  parseMonthParam,
  patchCalendarParams,
} from '../calendarParams.js';

describe('calendarParams', () => {
  const defaults = { viewYear: 2026, viewMonth: 5, selectedIso: '2026-06-03' };

  it('parses month and day from URL', () => {
    const params = new URLSearchParams('month=2026-01&day=2026-01-15&view=subscriptions');
    expect(parseCalendarParams(params, defaults)).toEqual({
      viewYear: 2026,
      viewMonth: 0,
      selectedIso: '2026-01-15',
    });
  });

  it('derives view month from day when month param is missing', () => {
    const params = new URLSearchParams('day=2025-12-25');
    expect(parseCalendarParams(params, defaults)).toEqual({
      viewYear: 2025,
      viewMonth: 11,
      selectedIso: '2025-12-25',
    });
  });

  it('falls back to defaults for invalid params', () => {
    const params = new URLSearchParams('month=bad&day=not-a-date');
    expect(parseCalendarParams(params, defaults)).toEqual(defaults);
  });

  it('parseMonthParam accepts YYYY-MM only', () => {
    expect(parseMonthParam('2026-06')).toEqual({ viewYear: 2026, viewMonth: 5 });
    expect(parseMonthParam('2026-13')).toBeNull();
    expect(parseMonthParam('06-2026')).toBeNull();
  });

  it('patches month and day while preserving other params', () => {
    const next = patchCalendarParams(new URLSearchParams('view=subscriptions&q=1'), {
      viewYear: 2026,
      viewMonth: 2,
      selectedIso: '2026-03-10',
    });
    expect(next.toString()).toBe('view=subscriptions&q=1&month=2026-03&day=2026-03-10');
  });

  it('builds calendar path with or without leading question mark', () => {
    expect(calendarPath('month=2026-06&day=2026-06-03')).toBe('/calendar?month=2026-06&day=2026-06-03');
    expect(calendarPath('?month=2026-06')).toBe('/calendar?month=2026-06');
    expect(calendarPath('')).toBe('/calendar');
  });
});
