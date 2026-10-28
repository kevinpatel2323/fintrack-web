import { useId } from 'react';
import { Checkbox, TextInput } from '../ui';
import { useIsCompact } from '../../styles/breakpoints.js';
import './allocation.css';

/**
 * The table the bill-wise pickers share (SettlementAllocator, NetOffModal,
 * LegacyReviewModal): tick an entry, then type how much of it to clear.
 * Presentation only — callers own the draft and every number shown here.
 */
export function AllocTable({ openLabel = 'Open', applyLabel = 'Amount', label, children }) {
  return (
    <div className="alloc-table" role="table" aria-label={label}>
      <div className="alloc-table__head" role="row">
        <span role="columnheader" aria-label="Selected" />
        <span role="columnheader">Entry</span>
        <span role="columnheader">{openLabel}</span>
        <span role="columnheader">{applyLabel}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * One row. `selected` ticks the box; `editing` (default: selected) shows the
 * amount box. `after` is the line under it ("₹200 left", "Cleared") and
 * `tone` is 'done' or 'error' for that line. `extra` (e.g. a group's "Show
 * entries" toggle) spans the row below.
 */
export function AllocRowView({
  name,
  meta,
  open,
  selected,
  editing = selected,
  onToggle,
  value,
  onChange,
  onBlur,
  after,
  tone,
  invalid,
  inputLabel,
  extra,
}) {
  const id = useId();
  // Phones: a 36px amount box (allocation.css makes the whole row the
  // checkbox's label).
  const phone = useIsCompact();
  return (
    <div className="alloc-row" role="row" data-selected={selected ? '' : undefined} data-editing={editing ? '' : undefined}>
      <span className="alloc-row__check" role="cell">
        <Checkbox id={id} checked={selected} onChange={onToggle} aria-label={`Select ${name}`} />
      </span>
      <label className="alloc-row__entry" role="cell" htmlFor={id}>
        <span className="alloc-row__name">{name}</span>
        {meta && <span className="alloc-row__meta">{meta}</span>}
      </label>
      <span className="alloc-row__open" role="cell">
        {open}
      </span>
      <span className="alloc-row__apply" role="cell">
        {editing ? (
          <>
            <TextInput
              className="alloc-row__input"
              size={phone ? 'md' : 'sm'}
              variant="outline"
              inputMode="decimal"
              placeholder="0.00"
              prefix={<span className="text-ink-gray-5">₹</span>}
              aria-label={inputLabel || `Amount for ${name}`}
              invalid={invalid}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
            />
            {after && (
              <span className="alloc-row__after" data-tone={tone || undefined}>
                {after}
              </span>
            )}
          </>
        ) : (
          <span className="alloc-row__empty" aria-hidden>
            —
          </span>
        )}
      </span>
      {extra && (
        <span className="alloc-row__extra" role="cell">
          {extra}
        </span>
      )}
    </div>
  );
}
