import { isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStableId } from './internal/floating.js';
import { cx } from './internal/dialogUtils.js';
import './Tabs.css';

/**
 * Underline tab list — frappe-ui Tabs / TabList / TabTrigger (variant
 * `underline`): 24px gap, hairline rail, a 1px `outline-gray-8` indicator that
 * slides to the selected tab (200ms easeOutQuint), muted labels that darken on
 * hover and when selected. Panels are rendered by the caller.
 *
 * Arrow keys move focus and select (automatic activation); Home/End jump.
 * Pass `idPrefix` to get `${idPrefix}-tab-${value}` ids and
 * `aria-controls="${idPrefix}-panel-${value}"` for your panels.
 */

function renderIcon(icon) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const Icon = icon;
  return <Icon className="ui-tabs__icon" size={16} aria-hidden="true" />;
}

export default function Tabs({
  tabs = [],
  value,
  onChange,
  size = 'sm',
  idPrefix,
  className,
  'aria-label': ariaLabel,
  ...rest
}) {
  const fallbackId = useStableId('ui-tabs');
  const prefix = idPrefix || fallbackId;
  const scrollerRef = useRef(null);
  const listRef = useRef(null);
  const tabRefs = useRef([]);
  const [indicator, setIndicator] = useState(null);
  const [animate, setAnimate] = useState(false);

  const selectedIndex = (() => {
    const i = tabs.findIndex((t) => t.value === value && !t.disabled);
    return i !== -1 ? i : tabs.findIndex((t) => !t.disabled);
  })();

  const measure = useCallback(() => {
    const list = listRef.current;
    const el = tabRefs.current[selectedIndex];
    if (!list || !el) {
      setIndicator(null);
      return;
    }
    const l = list.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const next = { x: r.left - l.left, w: r.width };
    setIndicator((prev) => (prev && prev.x === next.x && prev.w === next.w ? prev : next));
  }, [selectedIndex]);

  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(list);
    tabRefs.current.forEach((el) => el && ro.observe(el));
    document.fonts?.ready?.then(() => measure());
    return () => ro.disconnect();
  }, [measure, tabs.length]);

  // No slide on first paint.
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

  // Keep the selected tab in view when the list scrolls (small screens).
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = tabRefs.current[selectedIndex];
    if (!scroller || !el || scroller.scrollWidth <= scroller.clientWidth) return;
    const s = scroller.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pad = 16;
    if (r.left < s.left) scroller.scrollLeft -= s.left - r.left + pad;
    else if (r.right > s.right) scroller.scrollLeft += r.right - s.right + pad;
  }, [selectedIndex]);

  function select(index, focus) {
    const tab = tabs[index];
    if (!tab || tab.disabled) return;
    if (focus) tabRefs.current[index]?.focus();
    if (tab.value !== value) onChange?.(tab.value);
  }

  function onKeyDown(e) {
    const current = tabRefs.current.indexOf(e.target);
    if (current === -1) return;
    const enabled = tabs.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0);
    if (!enabled.length) return;
    const pos = enabled.indexOf(current);
    let next;
    if (e.key === 'ArrowRight') next = enabled[(pos + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    else return;
    e.preventDefault();
    select(next, true);
  }

  return (
    <div {...rest} ref={scrollerRef} className={cx('ui-tabs', className)} data-size={size}>
      <div ref={listRef} role="tablist" aria-label={ariaLabel} aria-orientation="horizontal" className="ui-tabs__list" onKeyDown={onKeyDown}>
        {indicator && (
          <span
            aria-hidden="true"
            className="ui-tabs__indicator"
            data-animate={animate ? '' : undefined}
            style={{ width: indicator.w, transform: `translateX(${indicator.x}px)` }}
          />
        )}
        {tabs.map((tab, i) => {
          const active = i === selectedIndex;
          const key = String(tab.value);
          return (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${prefix}-tab-${key}`}
              aria-selected={active}
              aria-controls={idPrefix ? `${idPrefix}-panel-${key}` : undefined}
              tabIndex={active ? 0 : -1}
              disabled={tab.disabled}
              data-state={active ? 'active' : 'inactive'}
              className="ui-tabs__tab"
              onClick={() => select(i, false)}
            >
              <span className="ui-tabs__pill">
                {renderIcon(tab.icon)}
                <span className="ui-tabs__label">{tab.label}</span>
                {tab.count != null && tab.count !== false && <span className="ui-tabs__count">{tab.count}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
