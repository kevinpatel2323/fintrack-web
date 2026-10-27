// CartesianChart — the one axis chart behind BarChart and LineChart (frappe-ui
// also draws both through a single option builder). It owns measurement, the
// value and category axes, hover and keyboard reading, the tooltip, the legend
// and the accessible data table; `kind` decides whether the marks are bars or
// lines. Internal: import BarChart or LineChart instead.

import { useMemo, useState } from 'react';
import ChartLegend from './ChartLegend.jsx';
import ChartTooltip from './ChartTooltip.jsx';
import {
  ChartDataTable,
  ChartEmpty,
  cx,
  defaultFormatValue,
  defaultFormatX,
  humanize,
  useElementWidth,
  useHiddenKeys,
  useSvgId,
} from './parts.jsx';
import {
  AXIS_LABEL_MARGIN,
  AXIS_LINE_HEIGHT,
  BAR_RADIUS,
  CATEGORY_LABEL_GAP,
  DOT_RADIUS,
  EDGE_PAD,
  PLOT_TOP,
  areaPath,
  bandScale,
  barGroupLayout,
  barPath,
  clamp,
  defaultColors,
  defaultTickFormat,
  hasNumericValue,
  labelStride,
  linePath,
  linearScale,
  measureText,
  splitSegments,
  stackRows,
  strideIndices,
  toNumber,
  truncateMiddle,
  valueAxis,
  valueExtent,
} from './scale.js';
import './charts.css';

/** Room under the plot for one row of category labels. */
const X_AXIS_HEIGHT = AXIS_LABEL_MARGIN + AXIS_LINE_HEIGHT + EDGE_PAD;
/** A row chart's category labels may take this share of the width, at least 56px. */
const CATEGORY_LABEL_WIDTH_RATIO = 0.32;
const MIN_CATEGORY_LABEL_WIDTH = 56;
/** Fill opacity at the top of an area, fading to a tenth of it at the baseline. */
const AREA_OPACITY = 0.16;

const round2 = (v) => Math.round(v * 100) / 100;

/** Axis geometry for the measured width. Pure apart from text measurement. */
function computeLayout({ width, height, rows, keys, categories, stacked, horizontal, yTicks, formatTick }) {
  const [lo, hi] = valueExtent(rows, keys, stacked);
  const { ticks, domain } = valueAxis(lo, hi, yTicks);
  const tickTexts = ticks.map((t) => String(formatTick(t)));
  const tickWidths = tickTexts.map((t) => measureText(t));
  const catWidths = categories.map((c) => measureText(c));
  const plotBottom = Math.max(PLOT_TOP + 1, height - X_AXIS_HEIGHT);

  if (horizontal) {
    const cap = Math.max(MIN_CATEGORY_LABEL_WIDTH, Math.round(width * CATEGORY_LABEL_WIDTH_RATIO));
    const labelWidth = Math.min(Math.ceil(Math.max(0, ...catWidths)), cap);
    const plotTop = EDGE_PAD;
    const plotLeft = EDGE_PAD + labelWidth + AXIS_LABEL_MARGIN;
    const lastTick = tickWidths[tickWidths.length - 1] ?? 0;
    const plotRight = Math.max(plotLeft + 1, width - EDGE_PAD - Math.ceil(lastTick / 2));
    const value = linearScale(domain, [plotLeft, plotRight]);
    const band = bandScale(rows.length, [plotTop, plotBottom]);

    const spacing = ticks.length > 1 ? Math.abs(value(ticks[1]) - value(ticks[0])) : Infinity;
    const shownTicks = strideIndices(ticks.length, labelStride(tickWidths, spacing));
    const shownCats = strideIndices(rows.length, labelStride([AXIS_LINE_HEIGHT], band.step, 2));

    return {
      horizontal,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      value,
      band,
      ticks,
      zero: value(0),
      tickLabels: shownTicks.map((i) => ({
        key: ticks[i],
        text: tickTexts[i],
        x: value(ticks[i]),
        y: plotBottom + AXIS_LABEL_MARGIN,
        anchor: 'middle',
      })),
      categoryLabels: shownCats.map((i) => ({
        key: i,
        text: catWidths[i] > labelWidth ? truncateMiddle(categories[i], labelWidth) : categories[i],
        x: plotLeft - AXIS_LABEL_MARGIN,
        y: band.center(i),
        anchor: 'end',
      })),
    };
  }

  const plotTop = PLOT_TOP;
  const plotLeft = EDGE_PAD + Math.ceil(Math.max(0, ...tickWidths)) + AXIS_LABEL_MARGIN;
  const plotRight = Math.max(plotLeft + 1, width - EDGE_PAD);
  const value = linearScale(domain, [plotBottom, plotTop]);
  const band = bandScale(rows.length, [plotLeft, plotRight]);

  const spacing = ticks.length > 1 ? Math.abs(value(ticks[1]) - value(ticks[0])) : Infinity;
  const shownTicks = strideIndices(ticks.length, labelStride([AXIS_LINE_HEIGHT], spacing, 2));
  const shownCats = strideIndices(rows.length, labelStride(catWidths, band.step));

  return {
    horizontal,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    value,
    band,
    ticks,
    zero: value(0),
    tickLabels: shownTicks.map((i) => ({
      key: ticks[i],
      text: tickTexts[i],
      x: plotLeft - AXIS_LABEL_MARGIN,
      y: value(ticks[i]),
      anchor: 'end',
    })),
    categoryLabels: shownCats.map((i, k) => {
      // Room between this label and its drawn neighbours; shorten only past it.
      const prev = k > 0 ? shownCats[k - 1] : null;
      const next = k < shownCats.length - 1 ? shownCats[k + 1] : null;
      const room =
        Math.min(
          prev === null ? Infinity : (i - prev) * band.step,
          next === null ? Infinity : (next - i) * band.step,
        ) - CATEGORY_LABEL_GAP;
      const fits = !Number.isFinite(room) || catWidths[i] <= room;
      const text = fits ? categories[i] : truncateMiddle(categories[i], Math.max(room, 12));
      const w = fits ? catWidths[i] : measureText(text);
      return {
        key: i,
        text,
        // The end labels slide inward rather than overhang the SVG edge.
        x: clamp(band.center(i), EDGE_PAD + w / 2, width - EDGE_PAD - w / 2),
        y: plotBottom + AXIS_LABEL_MARGIN,
        anchor: 'middle',
      };
    }),
  };
}

/** One group of bars per category; only each bar's (or stack's) far end is rounded. */
function computeBars(layout, rows, series, stacked) {
  const { band, value, zero, horizontal } = layout;
  const shape = (start, end, at, size, tip) => {
    const a = Math.min(start, end);
    const length = Math.abs(end - start);
    return horizontal ? barPath(a, at, length, size, BAR_RADIUS, tip) : barPath(at, a, size, length, BAR_RADIUS, tip);
  };
  const tipFor = (negative) => (horizontal ? (negative ? 'left' : 'right') : negative ? 'bottom' : 'top');

  if (stacked) {
    const stacks = stackRows(rows, series.map((s) => s.key));
    const { width, offsets } = barGroupLayout(band.step, 1);
    return rows.map((_, i) => {
      const { segments, tips } = stacks[i];
      const at = band.center(i) + (offsets[0] ?? 0);
      const bars = [];
      for (const s of series) {
        const seg = segments[s.key];
        if (!seg) continue;
        const negative = seg[1] < 0;
        const outermost = (negative ? tips.neg : tips.pos) === s.key;
        const d = shape(value(seg[0]), value(seg[1]), at, width, outermost ? tipFor(negative) : null);
        if (d) bars.push({ key: s.key, color: s.color, d });
      }
      return { index: i, bars };
    });
  }

  const { width, offsets } = barGroupLayout(band.step, series.length);
  return rows.map((row, i) => {
    const bars = [];
    series.forEach((s, j) => {
      const v = toNumber(row?.[s.key]);
      if (v === null || v === 0) return;
      const d = shape(zero, value(v), band.center(i) + offsets[j], width, tipFor(v < 0));
      if (d) bars.push({ key: s.key, color: s.color, d });
    });
    return { index: i, bars };
  });
}

/** Per series: line paths (split at gaps), optional area paths, and isolated points. */
function computeLines(layout, rows, series, curve, area) {
  const { band, value, zero } = layout;
  return series.map((s) => {
    const points = rows.map((row, i) => {
      const v = toNumber(row?.[s.key]);
      return v === null ? null : { x: round2(band.center(i)), y: round2(value(v)), i };
    });
    const segments = splitSegments(points);
    const runs = segments.filter((seg) => seg.length > 1);
    return {
      ...s,
      points,
      lines: runs.map((seg) => linePath(seg, curve)),
      areas: area ? runs.map((seg) => areaPath(seg, zero, curve)) : [],
      singles: segments.filter((seg) => seg.length === 1).map((seg) => seg[0]),
    };
  });
}

export default function CartesianChart({
  kind = 'bar',
  data,
  xKey,
  series = [],
  height = 240,
  stacked = false,
  horizontal = false,
  formatValue = defaultFormatValue,
  formatXLabel = defaultFormatX,
  formatTick = defaultTickFormat,
  yTicks = 4,
  onBarClick,
  emptyText = 'No data to show',
  area = false,
  curve = 'linear',
  showDots = false,
  legend = 'auto',
  ariaLabel,
  className,
}) {
  const isBar = kind === 'bar';
  const isStacked = isBar && Boolean(stacked);
  const isHorizontal = isBar && Boolean(horizontal);
  const clickable = isBar && typeof onBarClick === 'function';

  const [wrapRef, width] = useElementWidth();
  const gradientId = useSvgId('ui-chart-area');
  const [hover, setHover] = useState(null);

  const rows = Array.isArray(data) ? data : [];
  const allSeries = useMemo(() => {
    const colors = defaultColors(isBar ? 'bar' : 'line', series.length);
    return series.map((s, i) => ({ key: s.key, label: s.label ?? humanize(s.key), color: s.color || colors[i] }));
  }, [series, isBar]);
  const allKeys = allSeries.map((s) => s.key);
  const [hidden, toggleSeries] = useHiddenKeys(allKeys);
  const visible = allSeries.filter((s) => !hidden.includes(s.key));
  const visibleKeys = visible.map((s) => s.key).join('\u0000');

  const categories = useMemo(() => rows.map((row) => String(formatXLabel(row?.[xKey]) ?? '')), [rows, xKey, formatXLabel]);
  const isEmpty = !rows.length || !allSeries.length || !hasNumericValue(rows, allKeys);

  const layout = useMemo(() => {
    if (isEmpty || width <= 0) return null;
    return computeLayout({
      width,
      height,
      rows,
      keys: visibleKeys.split('\u0000'),
      categories,
      stacked: isStacked,
      horizontal: isHorizontal,
      yTicks,
      formatTick,
    });
    // `yTicks` may be an array literal, so it is compared by value.
  }, [isEmpty, width, height, rows, visibleKeys, categories, isStacked, isHorizontal, JSON.stringify(yTicks), formatTick]);

  const marks = useMemo(() => {
    if (!layout) return null;
    return isBar ? computeBars(layout, rows, visible, isStacked) : computeLines(layout, rows, visible, curve, area);
  }, [layout, rows, visibleKeys, allSeries, isBar, isStacked, curve, area]);

  // A hover can outlive a data change that removed its row.
  const activeIndex = hover && hover.index < rows.length ? hover.index : null;

  /* ── Interaction ── */

  const indexAt = (event) => {
    if (!layout) return -1;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    if (isHorizontal) return px >= 0 && px <= layout.plotRight ? layout.band.indexAt(py) : -1;
    return px >= layout.plotLeft && px <= layout.plotRight ? layout.band.indexAt(px) : -1;
  };

  const handlePointer = (event) => {
    const index = indexAt(event);
    if (index < 0) {
      setHover(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setHover({ index, x: event.clientX - rect.left, y: event.clientY - rect.top, keyboard: false });
  };

  // Where the tooltip hangs for a keyboard reader: the top of that column.
  const keyboardHover = (index) => {
    const row = rows[index];
    const values = visible.map((s) => toNumber(row?.[s.key])).filter((v) => v !== null);
    const peak = isStacked
      ? values.filter((v) => v > 0).reduce((sum, v) => sum + v, 0)
      : Math.max(0, ...values);
    const along = layout.band.center(index);
    const across = layout.value(peak);
    return isHorizontal
      ? { index, x: across, y: along, keyboard: true }
      : { index, x: along, y: Math.max(layout.plotTop, across - 8), keyboard: true };
  };

  const activate = (index, seriesKey) => {
    if (!clickable || index === null || index < 0) return;
    onBarClick(rows[index], seriesKey ?? visible[0]?.key ?? null);
  };

  const handleKeyDown = (event) => {
    if (!layout || !rows.length) return;
    const last = rows.length - 1;
    const current = activeIndex ?? -1;
    let next;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = Math.min(last, current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      case 'Enter':
      case ' ':
        if (clickable && current >= 0) {
          event.preventDefault();
          activate(current);
        }
        return;
      case 'Escape':
        setHover(null);
        return;
      default:
        return;
    }
    event.preventDefault();
    setHover(keyboardHover(next));
  };

  const handleFocus = (event) => {
    let keyboard = true;
    try {
      keyboard = event.currentTarget.matches(':focus-visible');
    } catch {
      /* older engines: assume keyboard */
    }
    if (keyboard && layout && !hover) setHover(keyboardHover(0));
  };

  const handleClick = (event) => {
    if (!clickable) return;
    const index = indexAt(event);
    const bar = event.target.closest?.('[data-series]');
    activate(index, bar?.getAttribute('data-series'));
  };

  /* ── Reading ── */

  const readingItems =
    activeIndex !== null
      ? visible.map((s) => {
          const v = toNumber(rows[activeIndex]?.[s.key]);
          return { key: s.key, label: s.label, color: s.color, value: v === null ? '—' : formatValue(v) };
        })
      : [];
  const reading =
    hover?.keyboard && activeIndex !== null
      ? `${categories[activeIndex]}: ${readingItems.map((it) => `${it.label} ${it.value}`).join(', ')}`
      : '';

  const n = rows.length;
  const summary =
    ariaLabel ??
    `${isBar ? 'Bar' : 'Line'} chart of ${allSeries.map((s) => s.label).join(', ') || 'no series'}` +
      (n ? ` across ${n} ${n === 1 ? 'point' : 'points'}, ${categories[0]}${n > 1 ? ` to ${categories[n - 1]}` : ''}` : '');

  const showLegend = legend === true || legend === 'bottom' || (legend === 'auto' && allSeries.length > 1);

  /* ── Marks (memoised so pointer moves only redraw the pointer aids) ── */

  const marksNode = useMemo(() => {
    if (!layout || !marks) return null;
    if (isBar) {
      return (
        <g
          className={isHorizontal ? 'ui-chart-grow-x' : 'ui-chart-grow-y'}
          style={{ transformOrigin: isHorizontal ? `${layout.zero}px 0px` : `0px ${layout.zero}px` }}
        >
          {marks.map((col) => (
            <g key={col.index} className={cx('ui-chart-col', col.index === activeIndex && 'is-active')}>
              {col.bars.map((bar) => (
                <path key={bar.key} d={bar.d} fill={bar.color} className="ui-chart-bar" data-series={bar.key} />
              ))}
            </g>
          ))}
        </g>
      );
    }
    return (
      <g>
        {area ? (
          <defs>
            {marks.map((s, i) => (
              <linearGradient key={s.key} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity={AREA_OPACITY} />
                <stop offset="1" stopColor={s.color} stopOpacity={AREA_OPACITY / 10} />
              </linearGradient>
            ))}
          </defs>
        ) : null}
        {marks.map((s, i) =>
          s.areas.map((d, k) => <path key={`${s.key}-a${k}`} d={d} className="ui-chart-area ui-chart-fade" fill={`url(#${gradientId}-${i})`} />),
        )}
        {marks.map((s) =>
          s.lines.map((d, k) => (
            <path key={`${s.key}-l${k}`} d={d} className="ui-chart-line" stroke={s.color} pathLength="1" />
          )),
        )}
        {marks.map((s) =>
          (showDots ? s.points.filter(Boolean) : s.singles).map((p) => (
            <circle key={`${s.key}-d${p.i}`} cx={p.x} cy={p.y} r={DOT_RADIUS} fill={s.color} className="ui-chart-dot ui-chart-fade" />
          )),
        )}
      </g>
    );
  }, [layout, marks, isBar, isHorizontal, activeIndex, area, showDots, gradientId]);

  /* ── Render ── */

  const plotClass = cx('ui-chart-plot', isBar && activeIndex !== null && 'is-hovering');
  let plot = null;
  if (isEmpty) {
    plot = <ChartEmpty>{emptyText}</ChartEmpty>;
  } else if (layout) {
    const { plotLeft, plotRight, plotTop, plotBottom, band, value, ticks } = layout;
    const snap = (v) => Math.round(v) + 0.5;
    plot = (
      <svg
        className={cx('ui-chart-svg', clickable && 'is-clickable')}
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setHover(null)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={() => setHover(null)}
        onClick={handleClick}
      >
        <g aria-hidden="true">
          {ticks.map((t) =>
            isHorizontal ? (
              <line key={t} className="ui-chart-grid" x1={snap(value(t))} x2={snap(value(t))} y1={plotTop} y2={plotBottom} />
            ) : (
              <line key={t} className="ui-chart-grid" x1={plotLeft} x2={plotRight} y1={snap(value(t))} y2={snap(value(t))} />
            ),
          )}
        </g>

        {activeIndex !== null && isBar ? (
          isHorizontal ? (
            <rect className="ui-chart-pointer-band" x={plotLeft} y={band.start(activeIndex)} width={plotRight - plotLeft} height={band.step} />
          ) : (
            <rect className="ui-chart-pointer-band" x={band.start(activeIndex)} y={plotTop} width={band.step} height={plotBottom - plotTop} />
          )
        ) : null}
        {activeIndex !== null && !isBar ? (
          <line className="ui-chart-guide" x1={snap(band.center(activeIndex))} x2={snap(band.center(activeIndex))} y1={plotTop} y2={plotBottom} />
        ) : null}

        {marksNode}

        {activeIndex !== null && !isBar
          ? marks.map((s) => {
              const p = s.points[activeIndex];
              return p ? <circle key={s.key} cx={p.x} cy={p.y} r={DOT_RADIUS} fill={s.color} className="ui-chart-dot" /> : null;
            })
          : null}

        <g aria-hidden="true">
          {layout.tickLabels.map((l) => (
            <text key={`t${l.key}`} className="ui-chart-tick" x={l.x} y={l.y} textAnchor={l.anchor} dy={isHorizontal ? '0.9em' : '0.32em'}>
              {l.text}
            </text>
          ))}
          {layout.categoryLabels.map((l) => (
            <text key={`c${l.key}`} className="ui-chart-tick" x={l.x} y={l.y} textAnchor={l.anchor} dy={isHorizontal ? '0.32em' : '0.9em'}>
              {l.text}
            </text>
          ))}
        </g>
      </svg>
    );
  }

  return (
    <div ref={wrapRef} className={cx('ui-chart', `ui-chart--${kind}`, className)}>
      <div className={plotClass} style={{ height }}>
        {plot}
        {layout && activeIndex !== null ? (
          <ChartTooltip
            open
            x={hover.x}
            y={hover.y}
            label={categories[activeIndex]}
            items={readingItems}
            containerWidth={width}
            containerHeight={height}
          />
        ) : null}
      </div>
      {showLegend && !isEmpty ? (
        <ChartLegend
          items={allSeries.map((s) => ({ ...s, hidden: hidden.includes(s.key) }))}
          onToggle={allSeries.length > 1 ? toggleSeries : undefined}
        />
      ) : null}
      {!isEmpty ? (
        <ChartDataTable
          caption={summary}
          columns={[humanize(xKey) || 'Category', ...allSeries.map((s) => s.label)]}
          rows={rows.map((row, i) => [
            categories[i],
            ...allSeries.map((s) => {
              const v = toNumber(row?.[s.key]);
              return v === null ? '—' : formatValue(v);
            }),
          ])}
        />
      ) : null}
      <div className="sr-only" aria-live="polite">
        {reading}
      </div>
    </div>
  );
}
