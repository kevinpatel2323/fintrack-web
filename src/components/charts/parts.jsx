// Internal building blocks shared by the chart components: container
// measurement, legend-driven series hiding, the visually hidden data table and
// the default formatters. Not exported from index.js.

import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { inr } from '../../utils/inr.js';

export function cx(...names) {
  return names.filter(Boolean).join(' ');
}

/** Tooltip values: full rupees (₹42,500). Callers pass their own for other units. */
export const defaultFormatValue = (n) => inr(n);

/** Category labels as given. */
export const defaultFormatX = (x) => (x === null || x === undefined ? '' : String(x));

/** `month_total` → `Month total`, for table headers built from a key. */
export function humanize(key) {
  const text = String(key ?? '').replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/** A DOM-safe id for SVG gradients and clip paths (React ids carry colons). */
export function useSvgId(prefix) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * Width of an element, kept current with ResizeObserver. The chart renders its
 * SVG at exactly this width, so text is never stretched by a viewBox. The
 * element must stay mounted for the life of the component.
 */
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.width ?? el.getBoundingClientRect().width;
      setWidth(Math.floor(next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/**
 * Keys the legend has switched off. Refuses to hide the last visible one (an
 * empty plot reads as a bug) and forgets keys the data no longer has.
 */
export function useHiddenKeys(keys) {
  const [hidden, setHidden] = useState([]);
  const signature = keys.join('\u0000');
  const live = hidden.filter((key) => keys.includes(key));

  const toggle = useCallback(
    (key) => {
      const all = signature ? signature.split('\u0000') : [];
      setHidden((prev) => {
        const current = prev.filter((k) => all.includes(k));
        if (current.includes(key)) return current.filter((k) => k !== key);
        if (current.length >= all.length - 1) return current;
        return [...current, key];
      });
    },
    [signature],
  );

  return [live, toggle];
}

/** The chart's data as a table for screen readers; the SVG carries only a summary. */
export function ChartDataTable({ caption, columns, rows }) {
  if (!rows.length) return null;
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i} scope="col">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, r) => (
          <tr key={r}>
            {cells.map((cell, c) =>
              c === 0 ? (
                <th key={c} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={c}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Muted, centred message in the space the plot would take. */
export function ChartEmpty({ children }) {
  return <div className="ui-chart-empty">{children}</div>;
}
