import { forwardRef, useCallback, useState } from 'react';
import Portal from '../Portal.jsx';
import Sheet from './Sheet.jsx';
import { useStableId } from './internal/floating.js';
import TextInput from './TextInput.jsx';
import {
  CalendarPanel,
  DEFAULT_DATE_FORMAT,
  PickerSuffix,
  formatDate,
  isOutOfRange,
  isValidISO,
  orderRange,
  parseDateInput,
  usePickerPopover,
} from './DatePicker.jsx';
import './DateRangePicker.css';

// Port of frappe-ui 1.0.2 DateRangePicker.vue + DateRangeCalendar.vue. The
// first click starts a range, the second completes it (in either order) and
// closes; until then the hovered or focused day previews the range.
// `presets` render as the `#actions` column beside the calendar.
//
// Phones (< 768px): a bottom sheet titled after the field, the presets as
// chips above the month grid, a line saying which end to pick next; the
// field is read-only there, so a tap only opens the sheet.
//
// value: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }  ('' for an empty end)
// onChange({ start, end }) — `{ start: '', end: '' }` when cleared.

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** Splits typed range text: "1 Oct 2026 to 5 Oct 2026", "a - b", "a – b", "a, b". */
export function splitRangeText(text) {
  const t = String(text ?? '').trim();
  if (!t) return [];
  let parts = t.split(/\s+(?:to|until|till|[-–—])\s+/i);
  if (parts.length === 1) parts = t.split(/\s*[–—]\s*/);
  if (parts.length === 1 && t.includes(',')) parts = t.split(/\s*,\s*/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function normalizeRange(value) {
  const start = isValidISO(value?.start) ? value.start : '';
  const end = isValidISO(value?.end) ? value.end : '';
  const [a, b] = orderRange(start, end);
  return { start: a, end: b };
}

const DateRangePicker = forwardRef(function DateRangePicker(
  {
    value,
    onChange,
    presets,
    placeholder = 'Select range',
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
  const autoId = useStableId('ui-daterange');
  const id = idProp ?? autoId;
  const panelId = `${id}-panel`;
  const { start, end } = normalizeRange(value);
  const [draft, setDraft] = useState(null);
  // The half-picked range while the panel is open: [from, to].
  const [pending, setPending] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const [focusDate, setFocusDate] = useState(null);

  const unavailable = useCallback(
    (d) => isOutOfRange(d, min, max) || Boolean(isDateUnavailable?.(d)),
    [min, max, isDateUnavailable],
  );

  // Frappe's display: "from to to", or just "from" while the end is empty.
  let display = '';
  if (start && end) display = `${formatDate(start, format)} to ${formatDate(end, format)}`;
  else if (start) display = formatDate(start, format);

  const emit = (next) => {
    const [a, b] = orderRange(next.start, next.end);
    if (a === start && b === end) return;
    onChange?.({ start: a, end: b });
  };

  // Typed text: emptying always clears (as in Frappe); one date is a one-day
  // range; anything unreadable puts the old text back.
  const commit = () => {
    if (draft === null) return;
    const raw = draft.trim();
    setDraft(null);
    if (!raw) {
      if (start || end) emit({ start: '', end: '' });
      return;
    }
    const parts = splitRangeText(raw);
    if (parts.length === 0 || parts.length > 2) return;
    const dates = parts.map((p) => parseDateInput(p, { format }));
    if (dates.some((d) => !d || unavailable(d))) return;
    emit({ start: dates[0], end: dates[1] ?? dates[0] });
  };

  const picker = usePickerPopover({ disabled, onCommit: commit, sheetTitle, sheetFallback: 'Choose dates' });
  const { open, openPanel, close, rootRef, anchorRef, calendarRef, panelProps } = picker;

  const setInputRef = useCallback(
    (node) => {
      anchorRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [anchorRef, ref],
  );

  const show = (focusGrid = false) => {
    if (!open) {
      setPending([start, end]);
      setHoverDate(null);
      setFocusDate(null);
    }
    openPanel(focusGrid);
  };

  const finish = (next) => {
    setDraft(null);
    setPending(null);
    emit(next);
    close(true);
  };

  const [from, to] = pending ?? [start, end];
  const preview = from && !to ? (hoverDate ?? focusDate) : null;

  const getCellState = useCallback(
    (d) => {
      const rangeStart = Boolean(from) && d === from;
      const rangeEnd = Boolean(to) && d === to;
      let inRange = false;
      if (from && to) inRange = d > from && d < to;
      else if (from && preview) {
        if (preview > from) inRange = d > from && d <= preview;
        else if (preview < from) inRange = d >= preview && d < from;
      }
      return { rangeStart, rangeEnd, inRange };
    },
    [from, to, preview],
  );

  const selectDate = (d) => {
    // First click (or a click on a complete range) starts a new range.
    if (!from || to) {
      setPending([d, '']);
      return;
    }
    const [a, b] = orderRange(from, d);
    finish({ start: a, end: b });
  };

  const isPresetActive = (preset) => {
    const p = normalizeRange(preset.value);
    return Boolean(p.start) && p.start === start && p.end === end;
  };

  const showClear = clearable && !disabled && Boolean(start || end);
  const hasPresets = Array.isArray(presets) && presets.length > 0;

  // Phones: say which end of the range the next tap sets.
  const sheetHint = from && !to ? `From ${formatDate(from, format)}. Now pick the last day.` : 'Pick the first day, then the last.';

  const content = (
    <div className={cx('ui-daterange__layout', hasPresets && 'has-presets')}>
      {hasPresets && (
        <div className="ui-daterange__presets" role="group" aria-label="Shortcuts">
          {presets.map((preset, i) => {
            const active = isPresetActive(preset);
            return (
              <button
                key={`${preset.label}-${i}`}
                type="button"
                className={cx('ui-daterange__preset', active && 'is-active')}
                aria-pressed={active}
                onClick={() => {
                  const p = normalizeRange(preset.value);
                  if (p.start) finish({ start: p.start, end: p.end || p.start });
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
      <CalendarPanel
        ref={calendarRef}
        className="ui-datepicker__calendar"
        anchor={from || start}
        getCellState={getCellState}
        isUnavailable={unavailable}
        min={min}
        max={max}
        onSelect={selectDate}
        onToday={(today) => {
          if (!unavailable(today)) finish({ start: today, end: today });
        }}
        onHoverDate={(d) => setHoverDate(d)}
        onFocusDate={(d) => setFocusDate(d)}
      />
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cx('ui-datepicker', 'ui-daterange', showClear && 'has-clear', disabled && 'is-disabled', className)}
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
        value={draft ?? display}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => {
          onClick?.(e);
          show();
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            show(true);
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
            clearLabel="Clear dates"
            disabled={disabled}
            onClear={() => {
              setDraft(null);
              setPending(null);
              emit({ start: '', end: '' });
              anchorRef.current?.focus();
            }}
            onToggle={() => {
              anchorRef.current?.focus();
              if (open) close(false);
              else show();
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
            aria-label="Choose date range"
            className="ui-datepicker__panel ui-daterange__panel"
          >
            {content}
          </div>
        </Portal>
      )}
      {picker.sheetPresent && (
        <Sheet
          open={open}
          onClose={() => {
            setPending(null);
            close(true);
          }}
          side="bottom"
          id={panelId}
          title={picker.sheetTitle}
          description={sheetHint}
          className="ui-datepicker-sheet ui-daterange-sheet"
        >
          {content}
        </Sheet>
      )}
    </div>
  );
});

export default DateRangePicker;
