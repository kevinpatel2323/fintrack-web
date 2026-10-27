// ChartTooltip — the hover card BarChart, LineChart and DonutChart use. It is
// positioned absolutely inside the chart's `position: relative` wrapper, 12px
// past the pointer, and flips to the other side of it near the right or bottom
// edge. Content mirrors frappe-ui's ChartTooltip: an optional x label, then one
// row per series with a colour dot, the series name and its formatted value.

import { useLayoutEffect, useRef } from 'react';
import { clamp, formatPercent } from './scale.js';

const OFFSET = 12;

/**
 * @param {object}  props
 * @param {boolean} props.open
 * @param {number}  props.x  Pointer position relative to the wrapper.
 * @param {number}  props.y
 * @param {string}  [props.label]  Heads the rows (the category or date).
 * @param {{key:string,label:string,color:string,value:string,percent?:number}[]} props.items
 * @param {number}  [props.containerWidth]  Defaults to the wrapper's size.
 * @param {number}  [props.containerHeight]
 */
export default function ChartTooltip({ open, x = 0, y = 0, label, items = [], containerWidth, containerHeight }) {
  const ref = useRef(null);
  const visible = open && items.length > 0;

  // Measured after render (its size depends on the rows), placed before paint.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!visible || !el) return;
    const parent = el.offsetParent;
    const width = containerWidth ?? parent?.clientWidth ?? window.innerWidth;
    const height = containerHeight ?? parent?.clientHeight ?? window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    const left = x + OFFSET + w > width ? x - OFFSET - w : x + OFFSET;
    const top = y + OFFSET + h > height ? y - OFFSET - h : y + OFFSET;
    el.style.transform = `translate(${Math.round(clamp(left, 0, width - w))}px, ${Math.round(clamp(top, 0, height - h))}px)`;
  });

  if (!visible) return null;

  // Hidden from assistive tech: keyboard readers get the same reading from the
  // chart's live region, and everyone gets the data table.
  return (
    <div ref={ref} className="ui-chart-tooltip" aria-hidden="true">
      {label ? <div className="ui-chart-tooltip-label">{label}</div> : null}
      <div className="ui-chart-tooltip-rows">
        {items.map((item) => (
          <div key={item.key} className="ui-chart-tooltip-row">
            <span className="ui-chart-tooltip-key">
              <svg className="ui-chart-tooltip-dot" width="8" height="8" viewBox="0 0 8 8" focusable="false">
                <circle cx="4" cy="4" r="4" fill={item.color} />
              </svg>
              <span className="ui-chart-tooltip-name">{item.label}</span>
            </span>
            <span className="ui-chart-tooltip-value">
              {item.value}
              {item.percent !== undefined ? (
                <span className="ui-chart-tooltip-pct">{formatPercent(item.percent)}</span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
