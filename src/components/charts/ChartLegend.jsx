// ChartLegend — colour dots and series names, as a centred wrapping row (the
// frappe-ui default under a plot) or a vertical list with values beside a
// donut. With `onToggle` each entry is a button that shows/hides its series; a
// hidden entry keeps its place and dims, so it can be switched back on.

import { cx } from './parts.jsx';

/**
 * @param {object} props
 * @param {{key:string,label:string,color:string,value?:number|string,hint?:string,hidden?:boolean,active?:boolean}[]} props.items
 * @param {'horizontal'|'vertical'} [props.layout]
 * @param {(key:string) => void} [props.onToggle]   Makes entries toggle buttons.
 * @param {(key:string|null) => void} [props.onHighlight]  Hover/focus in, null on leave.
 * @param {(n:number) => string} [props.formatValue]  Applied to numeric `value`s.
 */
export default function ChartLegend({
  items = [],
  layout = 'horizontal',
  onToggle,
  onHighlight,
  formatValue,
  className,
  ariaLabel = 'Legend',
}) {
  if (!items.length) return null;

  return (
    <ul className={cx('ui-chart-legend', `ui-chart-legend--${layout}`, className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const value =
          item.value === undefined || item.value === null
            ? null
            : typeof item.value === 'number' && formatValue
              ? formatValue(item.value)
              : String(item.value);

        const content = (
          <>
            <svg className="ui-chart-legend-dot" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
              <circle cx="4" cy="4" r="4" fill={item.color} />
            </svg>
            <span className="ui-chart-legend-label">{item.label}</span>
            {value !== null || item.hint ? (
              <span className="ui-chart-legend-meta">
                {value !== null ? <span className="ui-chart-legend-value">{value}</span> : null}
                {item.hint ? <span className="ui-chart-legend-hint">{item.hint}</span> : null}
              </span>
            ) : null}
          </>
        );

        const highlight = onHighlight
          ? {
              onMouseEnter: () => onHighlight(item.key),
              onMouseLeave: () => onHighlight(null),
              onFocus: () => onHighlight(item.key),
              onBlur: () => onHighlight(null),
            }
          : {};

        return (
          <li
            key={item.key}
            className={cx('ui-chart-legend-item', item.hidden && 'is-hidden', item.active && 'is-active')}
          >
            {onToggle ? (
              <button
                type="button"
                className="ui-chart-legend-button"
                aria-pressed={!item.hidden}
                aria-label={`${item.hidden ? 'Show' : 'Hide'} ${item.label}${value !== null ? `, ${value}` : ''}`}
                onClick={() => onToggle(item.key)}
                {...highlight}
              >
                {content}
              </button>
            ) : (
              <span className="ui-chart-legend-button" {...highlight}>
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
