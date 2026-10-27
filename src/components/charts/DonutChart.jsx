// DonutChart — share of a total as a ring, drawn the way frappe-ui draws it: a
// ring from 64% to 90% of the radius, 1.5° gaps, 4px rounded slice corners,
// biggest slice first from 12 o'clock, and the tail past `maxSlices` grouped
// into "Others". The centre shows the total; hovering (or arrowing to) a slice
// grows it 4px, dims the rest and swaps the centre to that slice.

import { useMemo, useRef, useState } from 'react';
import ChartLegend from './ChartLegend.jsx';
import ChartTooltip from './ChartTooltip.jsx';
import { ChartDataTable, ChartEmpty, cx, defaultFormatValue, useHiddenKeys } from './parts.jsx';
import {
  DONUT_HOVER_GROW,
  DONUT_OUTER_RATIO,
  DONUT_THICKNESS_RATIO,
  arcPath,
  clamp,
  defaultColors,
  donutLayout,
  formatPercent,
  ringPath,
  toNumber,
} from './scale.js';
import './charts.css';

const OTHERS_KEY = '__others__';
/** Below this size the centre readout steps down a type size. */
const COMPACT_SIZE = 128;

/** Sorted, coloured slices with the tail grouped. Negative values have no arc and are dropped. */
function buildSlices(data, maxSlices, othersLabel = 'Others') {
  const entries = data
    .map((datum) => ({ datum, value: toNumber(datum?.value) }))
    .filter((e) => e.value !== null && e.value >= 0)
    .sort((a, b) => b.value - a.value);

  const max = Math.max(2, Math.floor(maxSlices) || 9);
  const keep = entries.length > max ? max - 1 : entries.length;
  const colors = defaultColors('categorical', keep);
  const seen = new Set();

  const slices = entries.slice(0, keep).map((e, i) => {
    const label = String(e.datum?.label ?? '(Blank)');
    const base = String(e.datum?.key ?? label);
    let key = base;
    for (let n = 2; seen.has(key); n++) key = `${base} (${n})`;
    seen.add(key);
    return { key, label, value: e.value, color: e.datum?.color || colors[i], datum: e.datum };
  });

  const overflow = entries.slice(keep);
  if (overflow.length) {
    const value = overflow.reduce((sum, e) => sum + e.value, 0);
    const label = typeof othersLabel === 'function' ? othersLabel(overflow.length) : othersLabel;
    slices.push({
      key: OTHERS_KEY,
      label,
      value,
      color: 'var(--ui-chart-others)',
      datum: { key: OTHERS_KEY, label, value, items: overflow.map((e) => e.datum) },
    });
  }
  return slices;
}

/**
 * @param {object} props
 * @param {{label:string,value:number,color?:string,key?:string}[]} props.data
 * @param {number} [props.size=160]       Width and height of the ring, px.
 * @param {number} [props.thickness]      Ring thickness, px. Default 13% of size.
 * @param {string} [props.centerLabel='Total']
 * @param {number|string} [props.centerValue]  Replaces the total in the centre.
 * @param {(n:number) => string} [props.formatValue]
 * @param {(datum:object, index:number) => void} [props.onSliceClick]
 * @param {string} [props.emptyText]
 * @param {false|true|'bottom'|'right'} [props.legend=false]
 * @param {number} [props.maxSlices=9]    "Others" counts as one of them.
 * @param {string|((count:number) => string)} [props.othersLabel='Others']  Name of the folded slice.
 * @param {string} [props.ariaLabel]
 */
export default function DonutChart({
  data,
  size = 160,
  thickness,
  centerLabel = 'Total',
  centerValue,
  formatValue = defaultFormatValue,
  onSliceClick,
  emptyText = 'No data to show',
  legend = false,
  maxSlices = 9,
  othersLabel = 'Others',
  ariaLabel,
  className,
}) {
  const items = Array.isArray(data) ? data : [];
  const slices = useMemo(() => buildSlices(items, maxSlices, othersLabel), [items, maxSlices, othersLabel]);
  const [hidden, toggleSlice] = useHiddenKeys(slices.map((s) => s.key));
  const visible = slices.filter((s) => !hidden.includes(s.key));
  const arcs = donutLayout(visible.map((s) => s.value));
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  const share = (s) => (total ? (s.value / total) * 100 : 0);

  /** { key, x, y, via: 'pointer' | 'keyboard' | 'legend' } */
  const [active, setActive] = useState(null);
  const wrapRef = useRef(null);
  const boxRef = useRef(null);

  const c = size / 2;
  const outer = c * DONUT_OUTER_RATIO;
  const ring = clamp(thickness ?? c * DONUT_THICKNESS_RATIO, 2, outer);
  const inner = Math.max(0, outer - ring);
  const grow = (outer + DONUT_HOVER_GROW) / outer;

  const clickable = typeof onSliceClick === 'function';
  const drawn = visible.map((s, i) => ({ ...s, arc: arcs[i] })).filter((s) => s.arc && s.arc.endAngle > s.arc.startAngle);
  const activeSlice = active ? visible.find((s) => s.key === active.key) : null;
  const legendPlacement = legend === 'right' ? 'right' : legend ? 'bottom' : null;

  /* ── Interaction ── */

  const pointerIn = (event) => {
    const target = event.target.closest?.('[data-key]');
    if (!target) {
      setActive(null);
      return;
    }
    const rect = wrapRef.current.getBoundingClientRect();
    setActive({ key: target.getAttribute('data-key'), x: event.clientX - rect.left, y: event.clientY - rect.top, via: 'pointer' });
  };

  const keyboardActive = (slice) => {
    const box = boxRef.current;
    const mid = slice.arc.midAngle;
    return {
      key: slice.key,
      x: (box?.offsetLeft ?? 0) + c + outer * Math.cos(mid),
      y: (box?.offsetTop ?? 0) + c + outer * Math.sin(mid),
      via: 'keyboard',
    };
  };

  const select = (key) => {
    if (!clickable) return;
    const index = visible.findIndex((s) => s.key === key);
    if (index >= 0) onSliceClick(visible[index].datum, index);
  };

  const handleKeyDown = (event) => {
    if (!drawn.length) return;
    const current = drawn.findIndex((s) => s.key === active?.key);
    let next;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = Math.min(drawn.length - 1, current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = drawn.length - 1;
        break;
      case 'Enter':
      case ' ':
        if (clickable && current >= 0) {
          event.preventDefault();
          select(drawn[current].key);
        }
        return;
      case 'Escape':
        setActive(null);
        return;
      default:
        return;
    }
    event.preventDefault();
    setActive(keyboardActive(drawn[next]));
  };

  const handleFocus = (event) => {
    let keyboard = true;
    try {
      keyboard = event.currentTarget.matches(':focus-visible');
    } catch {
      /* older engines: assume keyboard */
    }
    if (keyboard && !active && drawn.length) setActive(keyboardActive(drawn[0]));
  };

  /* ── Text ── */

  const readout = activeSlice
    ? { value: formatValue(activeSlice.value), label: activeSlice.label, percent: formatPercent(share(activeSlice)) }
    : {
        value: centerValue === undefined || centerValue === null ? formatValue(total) : typeof centerValue === 'number' ? formatValue(centerValue) : centerValue,
        label: centerLabel,
      };

  const largest = visible.find((s) => s.value > 0);
  const summary =
    ariaLabel ??
    `Donut chart of ${visible.length} ${visible.length === 1 ? 'category' : 'categories'}, total ${formatValue(total)}` +
      (largest && total ? `; largest ${largest.label} at ${formatPercent(share(largest))}` : '');

  const reading =
    active?.via === 'keyboard' && activeSlice
      ? `${activeSlice.label}: ${formatValue(activeSlice.value)}, ${formatPercent(share(activeSlice))}`
      : '';

  /* ── Render ── */

  if (!slices.length) {
    return (
      <div className={cx('ui-chart', 'ui-chart-donut', className)}>
        <div className="ui-chart-donut-box" style={{ width: size, height: size }}>
          <ChartEmpty>{emptyText}</ChartEmpty>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={cx(
        'ui-chart',
        'ui-chart-donut',
        legendPlacement === 'right' && 'ui-chart-donut--right',
        size < COMPACT_SIZE && 'is-compact',
        className,
      )}
    >
      <div ref={boxRef} className="ui-chart-donut-box" style={{ width: size, height: size }}>
        <svg
          className={cx('ui-chart-svg', clickable && 'is-clickable')}
          width={size}
          height={size}
          role="img"
          aria-label={summary}
          tabIndex={drawn.length ? 0 : undefined}
          onPointerMove={pointerIn}
          onPointerDown={pointerIn}
          onPointerLeave={() => setActive(null)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => setActive(null)}
          onClick={(event) => {
            const target = event.target.closest?.('[data-key]');
            if (target) select(target.getAttribute('data-key'));
          }}
        >
          {total > 0 ? (
            <g className="ui-chart-donut-ring">
              <g className={cx('ui-chart-donut-slices', activeSlice && 'is-hovering')}>
                {drawn.map((s) => {
                  const isActive = activeSlice?.key === s.key;
                  return (
                    <path
                      key={s.key}
                      d={arcPath(c, c, outer, inner, s.arc.startAngle, s.arc.endAngle)}
                      fill={s.color}
                      data-key={s.key}
                      className={cx('ui-chart-donut-slice', isActive && 'is-active')}
                      style={isActive ? { transform: `scale(${grow})` } : undefined}
                    />
                  );
                })}
              </g>
            </g>
          ) : (
            <path className="ui-chart-donut-track" d={ringPath(c, c, outer, inner)} />
          )}
        </svg>

        {inner >= 24 ? (
          <div className="ui-chart-donut-center" aria-hidden="true">
            <div className="ui-chart-donut-readout" style={{ width: Math.round(inner * 2 * 0.86) }}>
              <div className="ui-chart-donut-value">{readout.value}</div>
              <div className="ui-chart-donut-caption">
                <span>{readout.label}</span>
                {readout.percent ? <span>{readout.percent}</span> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {legendPlacement ? (
        <ChartLegend
          layout={legendPlacement === 'right' ? 'vertical' : 'horizontal'}
          items={slices.map((s) => ({
            key: s.key,
            label: s.label,
            color: s.color,
            hidden: hidden.includes(s.key),
            active: activeSlice?.key === s.key,
            value: legendPlacement === 'right' ? s.value : undefined,
            hint: hidden.includes(s.key) ? undefined : formatPercent(share(s)),
          }))}
          formatValue={formatValue}
          onToggle={slices.length > 1 ? toggleSlice : undefined}
          onHighlight={(key) => setActive(key ? { key, via: 'legend' } : null)}
        />
      ) : null}

      {activeSlice && active.via !== 'legend' ? (
        <ChartTooltip
          open
          x={active.x}
          y={active.y}
          items={[
            {
              key: activeSlice.key,
              label: activeSlice.label,
              color: activeSlice.color,
              value: formatValue(activeSlice.value),
              percent: share(activeSlice),
            },
          ]}
        />
      ) : null}

      <ChartDataTable
        caption={summary}
        columns={['Category', 'Amount', 'Share']}
        rows={visible.map((s) => [s.label, formatValue(s.value), formatPercent(share(s))])}
      />
      <div className="sr-only" aria-live="polite">
        {reading}
      </div>
    </div>
  );
}
