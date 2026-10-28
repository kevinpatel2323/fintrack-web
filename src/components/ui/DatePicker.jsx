import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Portal from '../Portal.jsx';
import Sheet from './Sheet.jsx';
import { useDismiss, useFloating, useStableId } from './internal/floating.js';
import { usePresence } from './internal/dialogUtils.js';
import { fieldName } from './internal/fieldName.js';
import TextInput from './TextInput.jsx';
import { useIsCompact } from '../../styles/breakpoints.js';
import './DatePicker.css';

// Port of frappe-ui 1.0.2 DatePicker.vue + CalendarPanel.vue: a typeable
// TextInput with a chevron that opens a 224px calendar (month/year header,
// prev / Today / next, a 6-week grid starting on Sunday as Frappe's default
// dayjs locale does). Values are 'YYYY-MM-DD' strings built from date parts —
// never toISOString(), so no timezone can shift the day.
//
// This module also exports the pure date helpers and the CalendarPanel that
// DateRangePicker builds on.
//
// Phones (< 768px): the calendar opens in a bottom sheet titled after the
// field, with 44px day cells; the field is read-only there (no keyboard), so
// a tap only opens the calendar.

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* ======================================================================
 * Date helpers — pure, exported for DateRangePicker and the unit tests.
 * Calendar maths runs on UTC dates (no DST or offset jumps); only "today"
 * reads the local clock.
 * ==================================================================== */

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** First day of the week: Sunday, frappe-ui's default (dayjs `en` locale). */
export const WEEK_START = 0;

/** Default display format: "28 Oct 2026". */
export const DEFAULT_DATE_FORMAT = 'D MMM YYYY';

const pad = (n, width = 2) => String(n).padStart(width, '0');

function utcDate(y, m, d) {
  const dt = new Date(0);
  dt.setUTCFullYear(y, m, d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

function isoOfUtc(dt) {
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 'YYYY-MM-DD' for year, 0-based month and day; overflow rolls over. */
export function isoFromParts(year, month, day) {
  return isoOfUtc(utcDate(year, month, day));
}

/** 'YYYY-MM-DD' from a Date's local calendar parts. */
export function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today in the user's timezone. */
export function todayISO() {
  return toISODate(new Date());
}

export function daysInMonth(year, month) {
  return utcDate(year, month + 1, 0).getUTCDate();
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** { year, month (0-based), day } for a valid 'YYYY-MM-DD', else null. */
export function parseISO(iso) {
  if (typeof iso !== 'string') return null;
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isValidISO(iso) {
  return parseISO(iso) !== null;
}

/** Local-midnight Date for an ISO string (for callers that need a Date). */
export function isoToDate(iso) {
  const p = parseISO(iso);
  return p ? new Date(p.year, p.month, p.day) : null;
}

export function addDays(iso, n) {
  const p = parseISO(iso);
  return p ? isoFromParts(p.year, p.month, p.day + n) : '';
}

/** Adds months, clamping the day to the target month (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso, n) {
  const p = parseISO(iso);
  if (!p) return '';
  const first = utcDate(p.year, p.month + n, 1);
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  return isoFromParts(year, month, Math.min(p.day, daysInMonth(year, month)));
}

export function addYears(iso, n) {
  return addMonths(iso, n * 12);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso) {
  const p = parseISO(iso);
  return p ? utcDate(p.year, p.month, p.day).getUTCDay() : -1;
}

/** Valid ISO dates compare as strings; this is that, named. */
export function compareISO(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Puts a range's ends in order, so picking the end first gives the same range. */
export function orderRange(a, b) {
  return a && b && a > b ? [b, a] : [a, b];
}

/** Outside `[min, max]` (either bound optional, both 'YYYY-MM-DD'). */
export function isOutOfRange(iso, min, max) {
  if (min && isValidISO(min) && iso < min) return true;
  if (max && isValidISO(max) && iso > max) return true;
  return false;
}

/**
 * Six weeks × seven days for a month, so the grid height never changes.
 * Each cell: { iso, year, month, day, weekday, inMonth }.
 */
export function buildMonthGrid(year, month, weekStart = WEEK_START) {
  const offset = (utcDate(year, month, 1).getUTCDay() - weekStart + 7) % 7;
  const weeks = [];
  for (let w = 0; w < 6; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      const dt = utcDate(year, month, 1 - offset + w * 7 + d);
      week.push({
        iso: isoOfUtc(dt),
        year: dt.getUTCFullYear(),
        month: dt.getUTCMonth(),
        day: dt.getUTCDate(),
        weekday: dt.getUTCDay(),
        inMonth: dt.getUTCMonth() === month && dt.getUTCFullYear() === year,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

const FORMAT_TOKEN_RE = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D/g;

/**
 * Formats 'YYYY-MM-DD' with dayjs-style tokens: YYYY YY MMMM MMM MM M DD D
 * dddd ddd, and [literal text]. Invalid input returns ''.
 */
export function formatDate(iso, format = DEFAULT_DATE_FORMAT) {
  const p = parseISO(iso);
  if (!p) return '';
  const weekday = utcDate(p.year, p.month, p.day).getUTCDay();
  return format.replace(FORMAT_TOKEN_RE, (token, literal) => {
    if (literal !== undefined) return literal;
    switch (token) {
      case 'YYYY':
        return pad(p.year, 4);
      case 'YY':
        return pad(p.year % 100);
      case 'MMMM':
        return MONTHS_LONG[p.month];
      case 'MMM':
        return MONTHS_SHORT[p.month];
      case 'MM':
        return pad(p.month + 1);
      case 'M':
        return String(p.month + 1);
      case 'dddd':
        return WEEKDAYS_LONG[weekday];
      case 'ddd':
        return WEEKDAYS_SHORT[weekday];
      case 'DD':
        return pad(p.day);
      default:
        return String(p.day);
    }
  });
}

function monthFromWord(word) {
  if (word.length < 3) return -1;
  return MONTHS_LONG.findIndex((name) => name.toLowerCase().startsWith(word));
}

function toYear(text) {
  const n = Number(text);
  return text.length <= 2 ? 2000 + n : n;
}

function buildIso(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 0 || month > 11 || day < 1 || day > daysInMonth(year, month)) return null;
  return isoFromParts(year, month, day);
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** Strict parse against a display format ("D MMM YYYY", "DD/MM/YYYY" …). */
function parseWithFormat(text, format) {
  const parts = [];
  let pattern = '';
  let last = 0;
  format.replace(FORMAT_TOKEN_RE, (token, literal, offset) => {
    pattern += escapeRe(format.slice(last, offset));
    last = offset + token.length;
    if (literal !== undefined) {
      pattern += escapeRe(literal);
    } else if (token === 'YYYY') {
      parts.push('Y');
      pattern += '(\\d{4})';
    } else if (token === 'YY') {
      parts.push('Y');
      pattern += '(\\d{2})';
    } else if (token === 'MMMM' || token === 'MMM') {
      parts.push('N');
      pattern += '([a-z]+)';
    } else if (token === 'MM' || token === 'M') {
      parts.push('M');
      pattern += '(\\d{1,2})';
    } else if (token === 'DD' || token === 'D') {
      parts.push('D');
      pattern += '(\\d{1,2})';
    } else {
      pattern += '[a-z]+';
    }
    return token;
  });
  pattern += escapeRe(format.slice(last));
  const match = new RegExp(`^${pattern.replace(/\s+/g, '\\s*')}$`, 'i').exec(text);
  if (!match) return null;
  let year;
  let month;
  let day;
  parts.forEach((kind, i) => {
    const value = match[i + 1];
    if (kind === 'Y') year = toYear(value);
    else if (kind === 'M') month = Number(value) - 1;
    else if (kind === 'N') month = monthFromWord(value.toLowerCase());
    else day = Number(value);
  });
  return buildIso(year, month, day);
}

/**
 * Reads a typed date. Tries, in order: the display `format`, ISO
 * (2026-10-28, 2026/10/28), numeric day-first like an Indian date
 * (28/10/2026, 28-10-26, 28.10 — month-first only when `format` puts the
 * month first), and month names ("28 Oct 2026", "Oct 28, 2026", "28 oct").
 * Also "today", "yesterday", "tomorrow". A missing year means this year.
 * Returns 'YYYY-MM-DD' or null.
 */
export function parseDateInput(input, { format = DEFAULT_DATE_FORMAT, today = todayISO() } = {}) {
  const raw = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!raw) return null;
  if (raw === 'today' || raw === 'now') return today;
  if (raw === 'yesterday') return addDays(today, -1);
  if (raw === 'tomorrow') return addDays(today, 1);

  const fromFormat = format ? parseWithFormat(raw, format) : null;
  if (fromFormat) return fromFormat;

  const t = parseISO(today);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(raw);
  if (m) return buildIso(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/.exec(raw);
  if (m) {
    const monthFirst = /M/.test(format) && /D/.test(format) && format.search(/M/) < format.search(/D/);
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = m[3] ? toYear(m[3]) : t.year;
    return monthFirst ? buildIso(year, a - 1, b) : buildIso(year, b - 1, a);
  }

  const words = raw
    .replace(/,/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
    .split(/[\s\-/.]+/)
    .filter(Boolean);
  let month = -1;
  const numbers = [];
  for (const word of words) {
    if (/^\d+$/.test(word)) {
      numbers.push(word);
    } else {
      const idx = monthFromWord(word);
      if (idx === -1 || month !== -1) return null;
      month = idx;
    }
  }
  if (month === -1 || numbers.length === 0 || numbers.length > 2) return null;
  if (numbers.length === 1) {
    if (numbers[0].length > 2) return null;
    return buildIso(t.year, month, Number(numbers[0]));
  }
  const [a, b] = numbers;
  if (a.length > 2 || Number(a) > 31) return buildIso(toYear(a), month, Number(b));
  return buildIso(toYear(b), month, Number(a));
}

/* ======================================================================
 * CalendarPanel — CalendarPanel.vue: header, day grid, month/year view.
 * Mounted when the popover opens, so it starts on the anchor's month.
 * ==================================================================== */

const MAX_SKIP_STEPS = 366;

export const CalendarPanel = forwardRef(function CalendarPanel(
  {
    anchor,
    getCellState,
    isUnavailable = () => false,
    min,
    max,
    onSelect,
    onToday,
    onHoverDate,
    onFocusDate,
    todayLabel = 'Today',
    className,
  },
  ref,
) {
  const today = todayISO();
  const start = isValidISO(anchor) ? anchor : today;
  const [view, setView] = useState('date');
  const [cursor, setCursor] = useState(() => {
    const p = parseISO(start);
    return { year: p.year, month: p.month };
  });
  const [focused, setFocused] = useState(start);
  const gridRef = useRef(null);
  const yearListRef = useRef(null);
  const monthListRef = useRef(null);
  const pendingFocus = useRef(false);

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor.year, cursor.month]);

  const cells = useMemo(
    () =>
      weeks.map((week) =>
        week.map((cell) => ({
          ...cell,
          ...(getCellState ? getCellState(cell.iso) : null),
          unavailable: isUnavailable(cell.iso),
          isToday: cell.iso === today,
        })),
      ),
    [weeks, getCellState, isUnavailable, today],
  );

  // The one cell in the tab order: the focused day if it is on screen, else
  // the selection, today, or the first available day of the month.
  const tabbable = useMemo(() => {
    const flat = cells.flat().filter((c) => c.inMonth && !c.unavailable);
    if (flat.some((c) => c.iso === focused)) return focused;
    const pick =
      flat.find((c) => c.selected || c.rangeStart || c.rangeEnd) ?? flat.find((c) => c.isToday) ?? flat[0];
    return pick ? pick.iso : null;
  }, [cells, focused]);

  const focusCell = useCallback((iso) => {
    const el = gridRef.current?.querySelector(`[data-iso="${iso}"]:not([data-outside])`);
    el?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!pendingFocus.current || view !== 'date') return;
    pendingFocus.current = false;
    focusCell(focused);
  }, [focused, cursor, view, focusCell]);

  useImperativeHandle(
    ref,
    () => ({
      /** Moves keyboard focus into the day grid. */
      focusGrid() {
        const el = view === 'date' ? gridRef.current?.querySelector('[tabindex="0"]') : null;
        if (el) {
          el.focus({ preventScroll: true });
          return;
        }
        setView('date');
        if (tabbable) {
          pendingFocus.current = true;
          setFocused(tabbable);
        }
      },
    }),
    [view, tabbable],
  );

  // Centre the current year and month when the month/year view opens.
  useLayoutEffect(() => {
    if (view !== 'monthYear') return;
    for (const list of [yearListRef.current, monthListRef.current]) {
      const el = list?.querySelector('[data-selected]');
      if (list && el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
    }
  }, [view]);

  const showMonth = (year, month) => setCursor({ year, month });

  const step = (n) => {
    const iso = addMonths(isoFromParts(cursor.year, cursor.month, 1), n);
    const p = parseISO(iso);
    showMonth(p.year, p.month);
  };

  const moveFocus = (target, dir) => {
    let next = target;
    for (let i = 0; i <= MAX_SKIP_STEPS; i += 1) {
      if (!next || isOutOfRange(next, min, max)) return;
      if (!isUnavailable(next)) break;
      if (i === MAX_SKIP_STEPS) return;
      next = addDays(next, dir);
    }
    const p = parseISO(next);
    if (p.year !== cursor.year || p.month !== cursor.month) showMonth(p.year, p.month);
    pendingFocus.current = true;
    setFocused(next);
    onFocusDate?.(next);
  };

  const onCellKeyDown = (event, iso) => {
    const fromWeekStart = (weekdayOf(iso) - WEEK_START + 7) % 7;
    let target = null;
    let dir = 1;
    switch (event.key) {
      case 'ArrowLeft':
        target = addDays(iso, -1);
        dir = -1;
        break;
      case 'ArrowRight':
        target = addDays(iso, 1);
        break;
      case 'ArrowUp':
        target = addDays(iso, -7);
        dir = -1;
        break;
      case 'ArrowDown':
        target = addDays(iso, 7);
        break;
      case 'Home':
        target = addDays(iso, -fromWeekStart);
        dir = -1;
        break;
      case 'End':
        target = addDays(iso, 6 - fromWeekStart);
        break;
      case 'PageUp':
        target = event.shiftKey ? addYears(iso, -1) : addMonths(iso, -1);
        dir = -1;
        break;
      case 'PageDown':
        target = event.shiftKey ? addYears(iso, 1) : addMonths(iso, 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isUnavailable(iso)) onSelect?.(iso);
        return;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(target, dir);
  };

  const years = useMemo(() => {
    const minYear = min && isValidISO(min) ? Number(min.slice(0, 4)) : cursor.year - 100;
    const maxYear = max && isValidISO(max) ? Number(max.slice(0, 4)) : cursor.year + 10;
    const first = Math.min(minYear, cursor.year);
    const last = Math.max(maxYear, cursor.year);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [min, max, cursor.year]);

  const title = `${MONTHS_SHORT[cursor.month]} ${cursor.year}`;
  const todayDisabled = isUnavailable(today);

  return (
    <div className={cx('ui-calendar', className)}>
      <div className="ui-calendar__header">
        <button
          type="button"
          className="ui-calendar__button ui-calendar__title"
          aria-pressed={view === 'monthYear'}
          aria-label={`${MONTHS_LONG[cursor.month]} ${cursor.year}, choose month and year`}
          onClick={() => setView(view === 'date' ? 'monthYear' : 'date')}
        >
          {title}
        </button>
        <span className="sr-only" aria-live="polite">
          {`${MONTHS_LONG[cursor.month]} ${cursor.year}`}
        </span>
        {view === 'date' && (
          <div className="ui-calendar__nav">
            <button
              type="button"
              className="ui-calendar__button ui-calendar__icon-button"
              aria-label="Previous month"
              onClick={() => step(-1)}
            >
              <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            {todayLabel && (
              <button
                type="button"
                className="ui-calendar__button ui-calendar__today"
                disabled={todayDisabled}
                onClick={() => onToday?.(today)}
              >
                {todayLabel}
              </button>
            )}
            <button
              type="button"
              className="ui-calendar__button ui-calendar__icon-button"
              aria-label="Next month"
              onClick={() => step(1)}
            >
              <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="ui-calendar__body">
        {view === 'date' ? (
          <div
            ref={gridRef}
            role="grid"
            aria-label={`${MONTHS_LONG[cursor.month]} ${cursor.year}`}
            className="ui-calendar__grid"
            onMouseLeave={() => onHoverDate?.(null)}
          >
            <div role="row" className="ui-calendar__weekdays">
              {WEEKDAY_LETTERS.map((_, i) => {
                const wd = (WEEK_START + i) % 7;
                return (
                  <div key={wd} role="columnheader" aria-label={WEEKDAYS_LONG[wd]} className="ui-calendar__weekday">
                    {WEEKDAY_LETTERS[wd]}
                  </div>
                );
              })}
            </div>
            <div role="rowgroup" className="ui-calendar__weeks">
              {cells.map((week) => (
                <div key={week[0].iso} role="row" className="ui-calendar__week">
                  {week.map((cell) => {
                    const selected = Boolean(cell.selected || cell.rangeStart || cell.rangeEnd);
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        role="gridcell"
                        data-iso={cell.iso}
                        data-outside={cell.inMonth ? undefined : ''}
                        className={cx(
                          'ui-calendar__day',
                          !cell.inMonth && 'is-outside',
                          cell.isToday && 'is-today',
                          cell.unavailable && 'is-unavailable',
                          selected && 'is-selected',
                          !selected && cell.inRange && 'is-in-range',
                        )}
                        tabIndex={cell.iso === tabbable ? 0 : -1}
                        disabled={cell.unavailable}
                        aria-selected={selected}
                        aria-disabled={cell.unavailable || undefined}
                        aria-current={cell.isToday ? 'date' : undefined}
                        aria-label={`${formatDate(cell.iso, 'dddd, D MMMM YYYY')}${cell.isToday ? ' (today)' : ''}`}
                        onClick={() => {
                          if (!cell.unavailable) onSelect?.(cell.iso);
                        }}
                        onMouseEnter={() => onHoverDate?.(cell.iso)}
                        onFocus={() => {
                          if (cell.inMonth) setFocused(cell.iso);
                          onFocusDate?.(cell.iso);
                        }}
                        onKeyDown={(e) => onCellKeyDown(e, cell.iso)}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="ui-calendar__month-year">
            <div ref={yearListRef} className="ui-calendar__list" role="group" aria-label="Year">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  className={cx('ui-calendar__option', y === cursor.year && 'is-selected')}
                  data-selected={y === cursor.year ? '' : undefined}
                  aria-pressed={y === cursor.year}
                  onClick={() => showMonth(y, cursor.month)}
                >
                  {y}
                </button>
              ))}
            </div>
            <div ref={monthListRef} className="ui-calendar__list" role="group" aria-label="Month">
              {MONTHS_SHORT.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={cx('ui-calendar__option', i === cursor.month && 'is-selected')}
                  data-selected={i === cursor.month ? '' : undefined}
                  aria-pressed={i === cursor.month}
                  aria-label={MONTHS_LONG[i]}
                  onClick={() => {
                    showMonth(cursor.year, i);
                    setView('date');
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/* ======================================================================
 * Shared picker plumbing (DatePicker + DateRangePicker)
 * ==================================================================== */

/**
 * Popover state for a typeable picker: anchored to the input, closes on an
 * outside press or Escape (refocusing the input for Escape), keeps the input
 * focused while the panel is clicked, and lets Tab leave the panel through
 * the input. Exported for DateRangePicker.
 */
export function usePickerPopover({ disabled, onCommit, sheetTitle, sheetFallback }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const calendarRef = useRef(null);
  const wantGridFocus = useRef(false);
  const panelPointer = useRef(false);
  // Phones: a bottom sheet instead of the floating panel.
  const asSheet = useIsCompact();
  const floatingOpen = open && !asSheet;
  const sheet = usePresence(open && asSheet, 200);
  const [title, setTitle] = useState('');
  const { anchorRef, floatingRef, style } = useFloating({ open: floatingOpen, placement: 'bottom-start', offset: 4 });

  const close = useCallback(
    (refocus) => {
      setOpen(false);
      if (refocus) anchorRef.current?.focus({ preventScroll: true });
    },
    [anchorRef],
  );

  useDismiss({
    active: floatingOpen,
    refs: [rootRef, floatingRef],
    onDismiss: (event) => {
      onCommit?.();
      close(event?.type === 'keydown');
    },
  });

  useEffect(() => {
    if (open && wantGridFocus.current) {
      wantGridFocus.current = false;
      calendarRef.current?.focusGrid();
    }
  }, [open]);

  const openPanel = useCallback(
    (focusGrid = false) => {
      if (disabled) return;
      if (open) {
        if (focusGrid) calendarRef.current?.focusGrid();
        return;
      }
      wantGridFocus.current = focusGrid;
      if (asSheet) {
        const input = anchorRef.current;
        setTitle(
          fieldName(input, {
            title: sheetTitle,
            ariaLabel: input?.getAttribute('aria-label'),
            titleAttr: input?.getAttribute('title'),
            placeholder: input?.getAttribute('placeholder'),
            fallback: sheetFallback,
          }),
        );
      }
      setOpen(true);
    },
    [disabled, open, asSheet, anchorRef, sheetTitle, sheetFallback],
  );

  const panelProps = {
    ref: floatingRef,
    style,
    // A press inside the panel is not a blur of the field.
    onPointerDown: () => {
      panelPointer.current = true;
      window.setTimeout(() => {
        panelPointer.current = false;
      }, 0);
    },
    // Presses on the panel's non-interactive parts keep focus in the input.
    onMouseDown: (event) => {
      if (!event.target.closest('button')) event.preventDefault();
    },
    // Tab past either end of the panel goes back through the input.
    onKeyDown: (event) => {
      if (event.key !== 'Tab' || !floatingRef.current) return;
      const tabbables = [...floatingRef.current.querySelectorAll('button:not([disabled])')].filter(
        (el) => el.tabIndex >= 0,
      );
      if (!tabbables.length) return;
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        close(true);
      } else if (!event.shiftKey && document.activeElement === last) {
        // Focus the input; the browser's Tab then continues from there.
        close(true);
      }
    },
  };

  /** Blur from the input: commit and close unless focus went into the panel. */
  const handleInputBlur = (event) => {
    // The phone sheet takes focus as it opens; that is not a blur of the field.
    if (asSheet || panelPointer.current) return;
    const next = event.relatedTarget;
    if (next && floatingRef.current?.contains(next)) return;
    onCommit?.();
    setOpen(false);
  };

  return {
    open,
    setOpen,
    openPanel,
    close,
    asSheet,
    floatingOpen,
    sheetPresent: asSheet && sheet.present,
    sheetTitle: title,
    rootRef,
    anchorRef,
    calendarRef,
    panelProps,
    handleInputBlur,
  };
}

/** The input's suffix: an optional clear button and the chevron. */
export function PickerSuffix({ showClear, clearLabel, onClear, onToggle, disabled }) {
  return (
    <span className="ui-datepicker__suffix">
      {showClear && (
        <button
          type="button"
          className="ui-datepicker__clear"
          aria-label={clearLabel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
        >
          <X size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
      <span
        className="ui-datepicker__chevron"
        aria-hidden="true"
        data-slot="chevron"
        onMouseDown={(e) => {
          e.preventDefault();
          if (!disabled) onToggle();
        }}
      >
        <ChevronDown size={16} strokeWidth={1.5} />
      </span>
    </span>
  );
}

/* ======================================================================
 * DatePicker
 * ==================================================================== */

const DatePicker = forwardRef(function DatePicker(
  {
    value = '',
    onChange,
    placeholder = 'Select date',
    size = 'sm',
    variant = 'subtle',
    clearable = false,
    min,
    max,
    format = DEFAULT_DATE_FORMAT,
    isDateUnavailable,
    disabled = false,
    invalid = false,
    sheetTitle,
    id: idProp,
    className,
    style,
    inputClassName,
    onBlur,
    onKeyDown,
    onClick,
    ...rest
  },
  ref,
) {
  const autoId = useStableId('ui-datepicker');
  const id = idProp ?? autoId;
  const panelId = `${id}-panel`;
  const iso = isValidISO(value) ? value : '';
  const [draft, setDraft] = useState(null);

  const unavailable = useCallback(
    (d) => isOutOfRange(d, min, max) || Boolean(isDateUnavailable?.(d)),
    [min, max, isDateUnavailable],
  );

  // Typed text is committed on Enter, on blur and when the panel closes.
  const commit = () => {
    if (draft === null) return;
    const raw = draft.trim();
    setDraft(null);
    if (!raw) {
      if (clearable && iso) onChange?.('');
      return;
    }
    const parsed = parseDateInput(raw, { format });
    if (parsed && !unavailable(parsed) && parsed !== iso) onChange?.(parsed);
  };

  const picker = usePickerPopover({ disabled, onCommit: commit, sheetTitle, sheetFallback: 'Choose date' });
  const { open, openPanel, close, rootRef, anchorRef, calendarRef, panelProps } = picker;

  const setInputRef = useCallback(
    (node) => {
      anchorRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [anchorRef, ref],
  );

  const selectDate = (d) => {
    setDraft(null);
    if (d !== iso) onChange?.(d);
    close(true);
  };

  const getCellState = useCallback((d) => (d === iso ? { selected: true } : null), [iso]);

  const showClear = clearable && !disabled && Boolean(iso);

  const calendar = (
    <CalendarPanel
      ref={calendarRef}
      className="ui-datepicker__calendar"
      anchor={iso}
      getCellState={getCellState}
      isUnavailable={unavailable}
      min={min}
      max={max}
      onSelect={selectDate}
      onToday={(today) => {
        if (!unavailable(today)) selectDate(today);
      }}
    />
  );

  return (
    <div
      ref={rootRef}
      className={cx('ui-datepicker', showClear && 'has-clear', disabled && 'is-disabled', className)}
      style={style}
    >
      <TextInput
        ref={setInputRef}
        id={id}
        type="text"
        size={size}
        variant={variant}
        placeholder={placeholder}
        disabled={disabled}
        invalid={invalid}
        inputClassName={cx('ui-datepicker__input', inputClassName)}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-autocomplete="none"
        readOnly={picker.asSheet || undefined}
        value={draft ?? (iso ? formatDate(iso, format) : '')}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => {
          onClick?.(e);
          openPanel();
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            openPanel(true);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            if (open) close(false);
          } else if (e.key === 'Escape' && !open && draft !== null) {
            setDraft(null);
          }
        }}
        onBlur={(e) => {
          onBlur?.(e);
          picker.handleInputBlur(e);
        }}
        suffix={
          <PickerSuffix
            showClear={showClear}
            clearLabel="Clear date"
            disabled={disabled}
            onClear={() => {
              setDraft(null);
              onChange?.('');
              anchorRef.current?.focus();
            }}
            onToggle={() => {
              anchorRef.current?.focus();
              if (open) close(false);
              else openPanel();
            }}
          />
        }
        {...rest}
      />
      {picker.floatingOpen && (
        <Portal>
          <div
            {...panelProps}
            id={panelId}
            role="dialog"
            aria-label="Choose date"
            className="ui-datepicker__panel"
          >
            {calendar}
          </div>
        </Portal>
      )}
      {picker.sheetPresent && (
        <Sheet
          open={open}
          onClose={() => close(true)}
          side="bottom"
          id={panelId}
          title={picker.sheetTitle}
          className="ui-datepicker-sheet"
        >
          {calendar}
        </Sheet>
      )}
    </div>
  );
});

export default DatePicker;
