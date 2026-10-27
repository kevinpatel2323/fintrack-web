import { isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from './internal/dialogUtils.js';
import './TabButtons.css';

/**
 * Segmented control — frappe-ui TabButtons (variant `subtle`): gray-2 track,
 * an elevated pill (surface-elevation-3 + shadow-base) that slides to the
 * selected option, 13px labels. Radio-group semantics: one tab stop, arrow
 * keys move and select.
 *
 * Options: `{ label, value, icon?, hideLabel?, disabled? }`. With `hideLabel`
 * the option is icon-only and `label` becomes its accessible name.
 */

function renderIcon(icon) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const Icon = icon;
  return <Icon className="ui-tab-buttons__icon" aria-hidden="true" />;
}

export default function TabButtons({
  options = [],
  value,
  onChange,
  size = 'sm',
  fluid = false,
  className,
  'aria-label': ariaLabel,
  ...rest
}) {
  const trackRef = useRef(null);
  const btnRefs = useRef([]);
  const [rect, setRect] = useState(null);
  const [animate, setAnimate] = useState(false);
  const selectedIndex = options.findIndex((o) => o.value === value);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const el = btnRefs.current[selectedIndex];
    if (!track || !el) {
      setRect(null);
      return;
    }
    const t = track.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const next = { x: r.left - t.left, y: r.top - t.top, w: r.width, h: r.height };
    setRect((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next,
    );
  }, [selectedIndex]);

  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(track);
    btnRefs.current.forEach((el) => el && ro.observe(el));
    document.fonts?.ready?.then(() => measure());
    return () => ro.disconnect();
  }, [measure, options.length]);

  useEffect(() => {
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setAnimate(true));
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, []);

  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const tabStop = selectedIndex !== -1 && !options[selectedIndex]?.disabled ? selectedIndex : enabled[0];

  function choose(index, focus) {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    if (focus) btnRefs.current[index]?.focus();
    if (opt.value !== value) onChange?.(opt.value);
  }

  function onKeyDown(e) {
    const current = btnRefs.current.indexOf(e.target);
    if (current === -1 || !enabled.length) return;
    const pos = enabled.indexOf(current);
    let next;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = enabled[(pos + 1) % enabled.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    else return;
    e.preventDefault();
    choose(next, true);
  }

  return (
    <div
      {...rest}
      ref={trackRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx('ui-tab-buttons', fluid && 'ui-tab-buttons--fluid', className)}
      data-size={size}
      onKeyDown={onKeyDown}
    >
      <div className="ui-tab-buttons__clip" aria-hidden="true">
        {rect && (
          <div
            className="ui-tab-buttons__indicator"
            data-animate={animate ? '' : undefined}
            style={{ width: rect.w, height: rect.h, transform: `translate(${rect.x}px, ${rect.y}px)` }}
          />
        )}
      </div>
      {options.map((opt, i) => {
        const active = i === selectedIndex;
        const iconOnly = Boolean(opt.icon && opt.hideLabel);
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly ? opt.label : undefined}
            title={iconOnly ? opt.label : undefined}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={opt.disabled}
            data-state={active ? 'active' : 'inactive'}
            data-icon-only={iconOnly ? '' : undefined}
            className="ui-tab-buttons__button"
            onClick={() => choose(i, false)}
          >
            <span className="ui-tab-buttons__pill">
              {renderIcon(opt.icon)}
              {!iconOnly && <span className="ui-tab-buttons__label">{opt.label}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
