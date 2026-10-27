// CategoryBars — the ranked "spending by category" list: one compact row per
// item with its label and value (and share) on one line and a 4px track under
// it, filled to value ÷ the largest value in the item's colour. Reads like a
// Frappe list row, not a chunky chart. Long lists collapse behind "Show all".

import { useState } from 'react';
import { ChartEmpty, cx, defaultFormatValue } from './parts.jsx';
import { formatPercent, toNumber } from './scale.js';
import './charts.css';

const TRACK_HEIGHT = 4;

/**
 * @param {object} props
 * @param {{key:string,label:string,value:number,color?:string,hint?:string,onClick?:() => void}[]} props.items
 * @param {(n:number) => string} [props.formatValue]
 * @param {number}  [props.max]          Rows shown before "Show all". Default: all.
 * @param {boolean} [props.showPercent]  Share of the total after each value.
 * @param {boolean} [props.sorted=true]  Rank by value, largest first.
 * @param {string}  [props.emptyText]
 * @param {string}  [props.ariaLabel]
 */
export default function CategoryBars({
  items,
  formatValue = defaultFormatValue,
  max,
  showPercent = false,
  sorted = true,
  emptyText = 'No data to show',
  ariaLabel,
  className,
}) {
  const [expanded, setExpanded] = useState(false);

  const rows = (Array.isArray(items) ? items : []).map((item) => ({ ...item, value: toNumber(item.value) ?? 0 }));
  if (sorted) rows.sort((a, b) => b.value - a.value);

  if (!rows.length) {
    return (
      <div className={cx('ui-chart-catbars', className)}>
        <ChartEmpty>{emptyText}</ChartEmpty>
      </div>
    );
  }

  const largest = Math.max(0, ...rows.map((r) => r.value));
  const total = rows.reduce((sum, r) => sum + Math.max(0, r.value), 0);
  const limit = max > 0 && rows.length > max && !expanded ? max : rows.length;
  const shown = rows.slice(0, limit);
  const collapsible = max > 0 && rows.length > max;

  return (
    <div className={cx('ui-chart-catbars', className)}>
      <ul className="ui-chart-catbars-list" aria-label={ariaLabel}>
        {shown.map((item) => {
          const fill = largest > 0 ? Math.max(0, item.value) / largest : 0;
          const percent = total > 0 ? (Math.max(0, item.value) / total) * 100 : 0;
          const value = formatValue(item.value);
          const pct = showPercent ? formatPercent(percent) : null;

          const body = (
            <>
              <span className="ui-chart-catbar-head">
                <span className="ui-chart-catbar-label">
                  <span className="ui-chart-catbar-name">{item.label}</span>
                  {item.hint ? <span className="ui-chart-catbar-hint">{item.hint}</span> : null}
                </span>
                <span className="ui-chart-catbar-figures">
                  <span className="ui-chart-catbar-value">{value}</span>
                  {pct ? <span className="ui-chart-catbar-pct">{pct}</span> : null}
                </span>
              </span>
              <svg className="ui-chart-catbar-track" height={TRACK_HEIGHT} aria-hidden="true" focusable="false">
                <rect className="ui-chart-catbar-bg" width="100%" height={TRACK_HEIGHT} rx={TRACK_HEIGHT / 2} />
                {fill > 0 ? (
                  <rect
                    className="ui-chart-catbar-fill"
                    width={`${(fill * 100).toFixed(2)}%`}
                    height={TRACK_HEIGHT}
                    rx={TRACK_HEIGHT / 2}
                    fill={item.color || 'var(--chart-seq-1)'}
                  />
                ) : null}
              </svg>
            </>
          );

          return (
            <li key={item.key ?? item.label}>
              {item.onClick ? (
                <button type="button" className="ui-chart-catbar" onClick={item.onClick}>
                  {body}
                </button>
              ) : (
                <div className="ui-chart-catbar">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {collapsible ? (
        <button type="button" className="ui-chart-catbars-more" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </button>
      ) : null}
    </div>
  );
}
