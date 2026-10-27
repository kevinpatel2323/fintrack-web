import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  addMonths,
  addYears,
  buildMonthGrid,
  daysInMonth,
  formatDate,
  isOutOfRange,
  isValidISO,
  isoFromParts,
  orderRange,
  parseDateInput,
  parseISO,
  toISODate,
  todayISO,
  weekdayOf,
} from '../DatePicker.jsx';
import { splitRangeText } from '../DateRangePicker.jsx';
import { filterComboboxGroups, normalizeComboboxOptions, rankMatch } from '../Combobox.jsx';
import { fileMatchesAccept } from '../FileUploader.jsx';

describe('ISO helpers', () => {
  it('builds ISO strings from parts, rolling over', () => {
    expect(isoFromParts(2026, 9, 28)).toBe('2026-10-28');
    expect(isoFromParts(2026, 11, 32)).toBe('2027-01-01');
    expect(isoFromParts(2026, 0, 0)).toBe('2025-12-31');
    expect(isoFromParts(99, 0, 1)).toBe('0099-01-01');
  });

  it('reads local calendar parts, not UTC', () => {
    // 23:30 local on 31 Dec must stay 31 Dec whatever the offset.
    expect(toISODate(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
    expect(toISODate(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01');
    expect(toISODate(new Date('invalid'))).toBe('');
  });

  it('today follows the local clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28, 23, 59));
    expect(todayISO()).toBe('2026-10-28');
    vi.useRealTimers();
  });

  it('validates ISO dates', () => {
    expect(parseISO('2026-10-28')).toEqual({ year: 2026, month: 9, day: 28 });
    expect(isValidISO('2024-02-29')).toBe(true);
    expect(isValidISO('2026-02-29')).toBe(false);
    expect(isValidISO('2026-13-01')).toBe(false);
    expect(isValidISO('2026-1-01')).toBe(false);
    expect(isValidISO('')).toBe(false);
    expect(isValidISO(undefined)).toBe(false);
  });

  it('knows month lengths', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2026, 9)).toBe(31);
    expect(daysInMonth(2026, 10)).toBe(30);
  });

  it('adds days across months, years and DST dates', () => {
    expect(addDays('2026-10-28', 4)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09'); // US DST start
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26'); // EU DST end
    expect(addDays('nope', 1)).toBe('');
  });

  it('adds months and years, clamping the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-10-15', 3)).toBe('2027-01-15');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
  });

  it('weekday, ordering and bounds', () => {
    expect(weekdayOf('2026-10-28')).toBe(3); // Wednesday
    expect(orderRange('2026-10-28', '2026-10-01')).toEqual(['2026-10-01', '2026-10-28']);
    expect(orderRange('2026-10-01', '')).toEqual(['2026-10-01', '']);
    expect(isOutOfRange('2026-10-01', '2026-10-02', undefined)).toBe(true);
    expect(isOutOfRange('2026-10-30', undefined, '2026-10-29')).toBe(true);
    expect(isOutOfRange('2026-10-15', '2026-10-01', '2026-10-31')).toBe(false);
  });
});

describe('buildMonthGrid', () => {
  it('is always 6 weeks of 7 days starting on Sunday', () => {
    const weeks = buildMonthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(weeks).toHaveLength(6);
    weeks.forEach((w) => expect(w).toHaveLength(7));
    expect(weeks[0][0]).toMatchObject({ iso: '2026-09-27', weekday: 0, inMonth: false });
    expect(weeks[0][4]).toMatchObject({ iso: '2026-10-01', day: 1, inMonth: true });
    expect(weeks[5][6].iso).toBe('2026-11-07');
  });

  it('starts on the 1st when the month starts on the week start', () => {
    const weeks = buildMonthGrid(2026, 1); // 1 Feb 2026 is a Sunday
    expect(weeks[0][0]).toMatchObject({ iso: '2026-02-01', inMonth: true });
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(28);
  });

  it('supports a Monday week start', () => {
    const weeks = buildMonthGrid(2026, 9, 1);
    expect(weeks[0][0]).toMatchObject({ iso: '2026-09-28', weekday: 1 });
  });

  it('wraps across a year', () => {
    const weeks = buildMonthGrid(2026, 11);
    expect(weeks.flat().filter((c) => c.inMonth).map((c) => c.iso).at(-1)).toBe('2026-12-31');
    expect(weeks[5][6].iso.startsWith('2027-01')).toBe(true);
  });
});

describe('formatDate', () => {
  it('defaults to "28 Oct 2026"', () => {
    expect(formatDate('2026-10-28')).toBe('28 Oct 2026');
    expect(formatDate('2026-01-05')).toBe('5 Jan 2026');
  });

  it('supports dayjs-style tokens and literals', () => {
    expect(formatDate('2026-10-28', 'DD/MM/YYYY')).toBe('28/10/2026');
    expect(formatDate('2026-10-28', 'dddd, D MMMM YY')).toBe('Wednesday, 28 October 26');
    expect(formatDate('2026-10-28', 'ddd [the] D')).toBe('Wed the 28');
    expect(formatDate('2026-03-07', 'M/D')).toBe('3/7');
  });

  it('returns an empty string for invalid input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('2026-02-30')).toBe('');
  });
});

describe('parseDateInput', () => {
  const today = '2026-10-28';

  it('reads the display format back', () => {
    expect(parseDateInput('28 Oct 2026', { today })).toBe('2026-10-28');
    expect(parseDateInput('5 jan 2027', { today })).toBe('2027-01-05');
    expect(parseDateInput('28/10/2026', { format: 'DD/MM/YYYY', today })).toBe('2026-10-28');
    expect(parseDateInput('Wed, 28/10/2026', { format: 'ddd, DD/MM/YYYY', today })).toBe('2026-10-28');
  });

  it('reads ISO and year-first dates', () => {
    expect(parseDateInput('2026-10-28', { today })).toBe('2026-10-28');
    expect(parseDateInput('2026/1/5', { today })).toBe('2026-01-05');
  });

  it('reads numeric dates day-first, month-first only when the format says so', () => {
    expect(parseDateInput('3/4/2026', { today })).toBe('2026-04-03');
    expect(parseDateInput('3/4/26', { today })).toBe('2026-04-03');
    expect(parseDateInput('28.10', { today })).toBe('2026-10-28');
    expect(parseDateInput('3/4/2026', { format: 'MM/DD/YYYY', today })).toBe('2026-03-04');
  });

  it('reads month names in either order, with or without a year', () => {
    expect(parseDateInput('Oct 28, 2026', { today })).toBe('2026-10-28');
    expect(parseDateInput('28th October', { today })).toBe('2026-10-28');
    expect(parseDateInput('sept 3', { today })).toBe('2026-09-03');
    expect(parseDateInput('2027 feb 1', { today })).toBe('2027-02-01');
  });

  it('understands relative words', () => {
    expect(parseDateInput('today', { today })).toBe('2026-10-28');
    expect(parseDateInput('Yesterday', { today })).toBe('2026-10-27');
    expect(parseDateInput('tomorrow', { today })).toBe('2026-10-29');
  });

  it('rejects impossible or unreadable dates', () => {
    expect(parseDateInput('31 Feb 2026', { today })).toBeNull();
    expect(parseDateInput('32/10/2026', { today })).toBeNull();
    expect(parseDateInput('ma 3', { today })).toBeNull();
    expect(parseDateInput('hello', { today })).toBeNull();
    expect(parseDateInput('', { today })).toBeNull();
  });
});

describe('splitRangeText', () => {
  it('splits on "to", spaced dashes, en dashes and commas', () => {
    expect(splitRangeText('1 Oct 2026 to 28 Oct 2026')).toEqual(['1 Oct 2026', '28 Oct 2026']);
    expect(splitRangeText('2026-10-01 - 2026-10-28')).toEqual(['2026-10-01', '2026-10-28']);
    expect(splitRangeText('1 Oct–5 Oct')).toEqual(['1 Oct', '5 Oct']);
    expect(splitRangeText('1/10/2026, 5/10/2026')).toEqual(['1/10/2026', '5/10/2026']);
  });

  it('keeps ISO dates whole', () => {
    expect(splitRangeText('2026-10-01')).toEqual(['2026-10-01']);
    expect(splitRangeText('  ')).toEqual([]);
  });
});

describe('Combobox helpers', () => {
  const options = [
    'Plain',
    { label: 'Food & dining', value: 'food' },
    { group: 'Cards', items: [{ label: 'HDFC Regalia', value: 'hdfc' }, { label: 'Amex', value: 'amex' }] },
    { group: 'Legacy key', options: [{ label: 'Paytm', value: 'paytm' }] },
    { group: 'Empty', items: [] },
    { label: 'No value' },
  ];

  it('normalizes strings, objects and groups ({group, items} or {group, options})', () => {
    const groups = normalizeComboboxOptions(options);
    expect(groups.map((g) => g.label)).toEqual([null, 'Cards', 'Legacy key']);
    expect(groups[0].items.map((i) => i.value)).toEqual(['Plain', 'food']);
    expect(groups[1].items.map((i) => i.value)).toEqual(['hdfc', 'amex']);
  });

  it('ranks exact, prefix, word-prefix, then anywhere', () => {
    expect(rankMatch('Food', 'food')).toBe(0);
    expect(rankMatch('Food & dining', 'foo')).toBe(1);
    expect(rankMatch('Food & dining', 'din')).toBe(2);
    expect(rankMatch('Food & dining', 'ini')).toBe(3);
  });

  it('filters by label or value and orders by rank', () => {
    const groups = normalizeComboboxOptions([
      { label: 'Dining out', value: 'a' },
      { label: 'Food & dining', value: 'b' },
      { label: 'Groceries', value: 'dine' },
    ]);
    const [g] = filterComboboxGroups(groups, 'din');
    expect(g.items.map((i) => i.label)).toEqual(['Dining out', 'Food & dining', 'Groceries']);
    expect(filterComboboxGroups(groups, 'zzz')).toEqual([]);
    expect(filterComboboxGroups(groups, '  ')).toBe(groups);
  });
});

describe('fileMatchesAccept', () => {
  const file = (name: string, type: string) => ({ name, type }) as File;

  it('matches extensions, wildcards and exact types', () => {
    expect(fileMatchesAccept(file('Statement.PDF', 'application/pdf'), '.pdf')).toBe(true);
    expect(fileMatchesAccept(file('r.png', 'image/png'), 'image/*')).toBe(true);
    expect(fileMatchesAccept(file('a.csv', 'text/csv'), '.pdf, text/csv')).toBe(true);
    expect(fileMatchesAccept(file('a.txt', 'text/plain'), '.pdf,image/*')).toBe(false);
    expect(fileMatchesAccept(file('anything', ''), undefined)).toBe(true);
  });
});

afterEach(() => {
  vi.useRealTimers();
});
