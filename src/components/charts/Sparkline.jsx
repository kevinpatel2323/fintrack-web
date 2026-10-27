// Sparkline — a tiny trend line for stat cards, as frappe-ui's NumberCard draws
// it: a 1.5px stroke scaled between the series' own min and max, over a fill
// that fades from 24% to nothing. Fills its container's width unless `width`
// is given; no axes, no tooltip.

import { cx, useElementWidth, useSvgId } from './parts.jsx';
import { areaPath, linePath, sparklinePoints, toNumber } from './scale.js';
import './charts.css';

/**
 * @param {object} props
 * @param {(number|object)[]} props.data   Numbers, or objects read through `valueKey`.
 * @param {string} [props.valueKey='value']
 * @param {number} [props.width]           Fixed width in px. Default: fill the container.
 * @param {number} [props.height=32]
 * @param {string} [props.color]           Any CSS colour. Default var(--chart-seq-1).
 * @param {boolean} [props.area=true]      Gradient fill under the line.
 * @param {string} [props.ariaLabel]
 */
export default function Sparkline({
  data,
  valueKey = 'value',
  width,
  height = 32,
  color = 'var(--chart-seq-1)',
  area = true,
  ariaLabel,
  className,
}) {
  const [ref, measured] = useElementWidth();
  const gradientId = useSvgId('ui-chart-spark');
  const w = width ?? measured;

  const values = (Array.isArray(data) ? data : [])
    .map((d) => (d !== null && typeof d === 'object' ? d[valueKey] : d))
    .map(toNumber)
    .filter((v) => v !== null);
  const points = sparklinePoints(values, w, height);

  const label =
    ariaLabel ??
    (values.length
      ? `Trend of ${values.length} ${values.length === 1 ? 'value' : 'values'}, from ${values[0].toLocaleString('en-IN')} to ${values[values.length - 1].toLocaleString('en-IN')}`
      : 'No trend data');

  return (
    <span
      ref={ref}
      className={cx('ui-chart-spark', width !== undefined && 'ui-chart-spark--fixed', className)}
      style={width !== undefined ? { width, height } : { height }}
    >
      {w > 0 ? (
        <svg width={w} height={height} role="img" aria-label={label}>
          {area && points.length > 1 ? (
            <>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={color} stopOpacity="0.24" />
                  <stop offset="1" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath(points, height)} fill={`url(#${gradientId})`} />
            </>
          ) : null}
          {points.length > 1 ? <path d={linePath(points)} className="ui-chart-spark-line" stroke={color} /> : null}
        </svg>
      ) : null}
    </span>
  );
}
