import { useEffect, useRef } from 'react';
import { Check, CreditCard, Tag } from 'lucide-react';
import { Amount } from '../../components/ui';
import { inr } from '../../utils/inr.js';
import { WEEKDAYS, addDaysIso, dayModel, formatDayLong, swipeDirection } from './calendarModel.js';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/** Screen-reader text for one day: the same facts the cell shows. */
function dayLabel(iso, day, isToday) {
  const parts = [formatDayLong(iso)];
  if (isToday) parts.push('today');
  if (day.spent > 0) parts.push(`${inr(day.spent)} spent`);
  if (day.earned > 0) parts.push(`${inr(day.earned)} earned`);
  if (day.pendingCount > 0) {
    parts.push(`${day.pendingCount} transaction${day.pendingCount === 1 ? '' : 's'} need${day.pendingCount === 1 ? 's' : ''} a category`);
  }
  if (day.catState === 'categorized') parts.push('all categorised');
  if (day.billCount > 0) parts.push(`${day.billCount} bill${day.billCount > 1 ? 's' : ''} due`);
  if (day.cardBills) parts.push(`card bill paid for ${day.cardBills.owner}`);
  return parts.join(', ');
}

/**
 * What a day needs, at a glance. A day with transactions to categorise gets a
 * count pill (and the whole cell is tinted, see .has-pending); a finished day
 * a quiet check; bills due and card bills paid stay small.
 */
function Marks({ day, compact }) {
  return (
    <span className="cal-day__marks" aria-hidden="true">
      {day.pendingCount > 0 && (
        <span className="cal-pending-pill">
          {!compact && <Tag size={11} strokeWidth={2} />}
          {day.pendingCount}
        </span>
      )}
      {day.catState === 'categorized' && !compact && (
        <Check className="cal-day__done" size={13} strokeWidth={2} />
      )}
      {day.billCount > 0 && <span className="cal-dot cal-dot--bill" />}
      {compact && day.cardBills && <span className="cal-dot cal-dot--card" />}
    </span>
  );
}

/**
 * The month as a Frappe-style grid: hairline cells, the day number top-left
 * (today in a filled circle), status marks top-right, and on desktop the day's
 * spent / earned and any card bill paid that day. Days with transactions to
 * categorise are tinted and carry a count, so they stand out from across the
 * month; `focusPending` fades every other day. Phones get the compact variant:
 * rounded day tiles with the number and marks only, and `onSwipe(step)`
 * (phones only) changes month on a sideways swipe, sliding the new month in.
 *
 * Days are buttons with a roving tab stop; the arrow keys move the selection.
 * With `onOpen` (desktop), clicking a day (or Enter/Space) opens it instead
 * of only selecting it; the arrow keys still just move the selection.
 */
export default function MonthGrid({
  cells,
  txByDay,
  subByDay,
  cardsById,
  ccDetailByTransaction,
  todayIso,
  selectedIso,
  onSelect,
  onOpen,
  compact = false,
  loading = false,
  focusPending = false,
  label,
  onSwipe,
}) {
  const buttons = useRef(new Map());
  const pendingFocus = useRef(null);

  const inMonth = cells.filter((c) => c.inMonth);
  const firstIso = inMonth[0]?.iso;
  const lastIso = inMonth[inMonth.length - 1]?.iso;

  // Phone: which way the month just moved, so the new one slides in from
  // that side (set on render; idempotent, so a double render is harmless).
  const shownMonth = useRef(firstIso);
  const enterFrom = useRef(null);
  if (compact && shownMonth.current !== firstIso) {
    enterFrom.current = firstIso > shownMonth.current ? 'next' : 'prev';
    shownMonth.current = firstIso;
  }

  // Phone: a sideways swipe changes month. `touch-action: pan-y` (CSS) leaves
  // vertical scrolling to the browser, which cancels the pointer when it
  // takes over, so a scroll never reads as a swipe.
  const swipe = useRef(null);
  const swiped = useRef(false);
  const swipeHandlers = onSwipe ? {
    onPointerDown: (e) => {
      swiped.current = false;
      swipe.current = e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
    },
    onPointerUp: (e) => {
      const start = swipe.current;
      swipe.current = null;
      if (!start || start.id !== e.pointerId) return;
      const step = swipeDirection(e.clientX - start.x, e.clientY - start.y);
      if (!step) return;
      swiped.current = true;
      onSwipe(step);
    },
    onPointerCancel: () => { swipe.current = null; },
    // The release that ends a swipe is not a tap on the day under it.
    onClickCapture: (e) => {
      if (!swiped.current) return;
      swiped.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  } : null;
  const tabStop = inMonth.some((c) => c.iso === selectedIso)
    ? selectedIso
    : inMonth.some((c) => c.iso === todayIso) ? todayIso : firstIso;

  useEffect(() => {
    if (!pendingFocus.current) return;
    buttons.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [selectedIso]);

  function onKeyDown(event, iso) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = addDaysIso(iso, step);
    if (next < firstIso || next > lastIso) return;
    pendingFocus.current = next;
    onSelect(next);
  }

  return (
    <div
      className={cx('cal-grid', compact && 'cal-grid--compact', focusPending && 'cal-grid--focus', loading && 'is-loading')}
      role="group"
      aria-label={label}
      aria-busy={loading || undefined}
      {...swipeHandlers}
    >
      <div className="cal-grid__weekdays" aria-hidden="true">
        {WEEKDAYS.map((wd) => (
          <span key={wd} className="cal-grid__weekday">{compact ? wd[0] : wd}</span>
        ))}
      </div>
      <div
        className="cal-grid__days"
        key={compact ? firstIso : undefined}
        data-enter={(compact && enterFrom.current) || undefined}
      >
        {cells.map((cell) => {
          const isToday = cell.iso === todayIso;
          if (!cell.inMonth) {
            return (
              <div key={cell.iso} className="cal-day is-outside" aria-hidden="true">
                <span className="cal-day__head">
                  <span className="cal-day__num">{cell.label}</span>
                </span>
              </div>
            );
          }
          const day = dayModel(
            txByDay.get(cell.iso) || [],
            subByDay.get(cell.iso) || [],
            ccDetailByTransaction,
            cardsById,
          );
          const isSelected = cell.iso === selectedIso;
          return (
            <button
              key={cell.iso}
              ref={(el) => {
                if (el) buttons.current.set(cell.iso, el);
                else buttons.current.delete(cell.iso);
              }}
              type="button"
              className={cx(
                'cal-day',
                isToday && 'is-today',
                isSelected && 'is-selected',
                day.pendingCount > 0 && 'has-pending',
              )}
              aria-pressed={onOpen ? undefined : isSelected}
              aria-current={onOpen && isSelected ? 'date' : undefined}
              aria-haspopup={onOpen ? 'dialog' : undefined}
              aria-label={dayLabel(cell.iso, day, isToday)}
              tabIndex={cell.iso === tabStop ? 0 : -1}
              onClick={() => (onOpen ? onOpen(cell.iso) : onSelect(cell.iso))}
              onKeyDown={(e) => onKeyDown(e, cell.iso)}
            >
              <span className="cal-day__head">
                <span className="cal-day__num">{cell.label}</span>
                <Marks day={day} compact={compact} />
              </span>
              {!compact && (day.spent > 0 || day.earned > 0) && (
                <span className="cal-day__amounts">
                  {day.spent > 0 && (
                    <Amount value={day.spent} sign="never" tone="inherit" compact className="cal-day__spent" />
                  )}
                  {day.earned > 0 && <Amount value={day.earned} sign="always" tone="in" compact />}
                </span>
              )}
              {/* A card bill paid this day — named because it is usually most
                  of the day's "spent" and is not new spending. Owner on top,
                  card and amount under it. */}
              {!compact && day.cardBills && (
                <span className="cal-day__bill" title={day.cardBills.title}>
                  <span className="cal-day__bill-line">
                    <CreditCard size={12} strokeWidth={1.5} aria-hidden="true" />
                    <span className="truncate">{day.cardBills.owner}</span>
                  </span>
                  <span className="cal-day__bill-line cal-day__bill-line--sub">
                    <span className="truncate">{day.cardBills.card}</span>
                    <Amount value={day.cardBills.total} sign="never" tone="inherit" compact />
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What the marks on a day mean. */
export function CalendarLegend({ compact = false }) {
  return (
    <ul className="cal-legend" aria-label="Legend">
      <li>
        <span className="cal-legend__pending" aria-hidden="true">
          <span className="cal-pending-pill">{!compact && <Tag size={11} strokeWidth={2} />}2</span>
        </span>
        {compact ? 'To categorise' : 'Transactions to categorise'}
      </li>
      {!compact && (
        <li><Check className="cal-day__done" size={13} strokeWidth={2} aria-hidden="true" />All categorised</li>
      )}
      <li><span className="cal-dot cal-dot--bill" aria-hidden="true" />Bill due</li>
      <li>
        {compact ? (
          <span className="cal-dot cal-dot--card" aria-hidden="true" />
        ) : (
          <CreditCard className="cal-legend__icon" size={12} strokeWidth={1.5} aria-hidden="true" />
        )}
        Card bill paid
      </li>
    </ul>
  );
}
