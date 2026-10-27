// Pure geometry shared by every chart: nice ticks, linear and band scales, bar
// and stack layout, line/area paths, donut arcs, default series colours and
// label fitting. No React and no required DOM, so it is unit-tested directly
// (see __tests__/scale.test.ts). The constants mirror frappe-ui's chart
// options (axisChartOptions.ts, axisChartCommon.ts, donutChartOptions.ts).

import { inrCompact } from '../../utils/inr.js';

/* ── Constants ─────────────────────────────────────────────────────────── */

/** frappe AXIS_LABEL_FONT_SIZE. Keep in sync with --ui-chart-axis-font-size. */
export const AXIS_FONT_SIZE = 11;
/** Line box of one axis label (11px × 1.2). */
export const AXIS_LINE_HEIGHT = 13;
/** Gap between a tick label and the plot. */
export const AXIS_LABEL_MARGIN = 8;
/** Clear air kept between the outermost label and the SVG edge. */
export const EDGE_PAD = 2;
/** Room above the plot so the top tick label is not clipped. */
export const PLOT_TOP = 8;
/** Clear air either side of a category label before labels start thinning. */
export const CATEGORY_LABEL_GAP = 8;

export const BAR_MAX_WIDTH = 32;
/** Share of each category slot left empty around its bars. */
export const BAR_CATEGORY_GAP = 0.38;
/** Gap between grouped bars, as a share of one bar's width (echarts default). */
export const BAR_GAP = 0.3;
export const BAR_RADIUS = 4;

export const LINE_WIDTH = 2;
export const DOT_RADIUS = 3;

/** Thin gap between slices, so neighbouring hues don't bleed into each other. */
export const DONUT_PAD_ANGLE = (1.5 * Math.PI) / 180;
export const DONUT_CORNER_RADIUS = 4;
/** How far the hovered slice grows out of the ring, in px. */
export const DONUT_HOVER_GROW = 4;
/** frappe draws the ring from 64% to 90% of the half-size. */
export const DONUT_OUTER_RATIO = 0.9;
export const DONUT_THICKNESS_RATIO = 0.26;

const NICE_STEPS = [1, 2, 2.5, 5, 10];
const TAU = Math.PI * 2;

/* ── Numbers ───────────────────────────────────────────────────────────── */

/** A finite number, or null for anything that should read as a gap. */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Clears float dust a multiple of 2.5 leaves behind (0.30000000000000004). */
export function clean(value) {
  return Number(value.toPrecision(12));
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Two decimals is well past what a screen shows, and keeps paths short. */
function r2(value) {
  return Math.round(value * 100) / 100;
}

/* ── Ticks and scales ──────────────────────────────────────────────────── */

/** The smallest round interval (1, 2, 2.5, 5 × 10ⁿ) at least as big as `rough`. */
export function niceStep(rough) {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const factor = NICE_STEPS.find((s) => rough <= s * magnitude * (1 + 1e-9)) ?? 10;
  return clean(factor * magnitude);
}

/**
 * Round ticks covering [min, max]. Zero is always included, so a bar always
 * grows from a real baseline. `count` is the target number of intervals; the
 * result never has more. All-zero data returns just the baseline.
 */
export function niceTicks(min, max, count = 4) {
  const lo = Math.min(0, toNumber(min) ?? 0);
  const hi = Math.max(0, toNumber(max) ?? 0);
  if (lo === hi) return [0];

  const step = niceStep((hi - lo) / Math.max(1, Math.round(count)));
  const first = Math.floor(lo / step + 1e-9);
  const last = Math.ceil(hi / step - 1e-9);
  const ticks = [];
  for (let i = first; i <= last; i++) ticks.push(clean(i * step));
  return ticks;
}

/**
 * Ticks and the domain they span. `yTicks` is a target interval count, or an
 * explicit list of tick values.
 */
export function valueAxis(lo, hi, yTicks = 4) {
  const explicit = Array.isArray(yTicks)
    ? [...new Set(yTicks.map(toNumber).filter((n) => n !== null))].sort((a, b) => a - b)
    : [];
  const ticks = explicit.length ? explicit : niceTicks(lo, hi, typeof yTicks === 'number' ? yTicks : 4);

  let d0 = Math.min(ticks[0], toNumber(lo) ?? 0, 0);
  let d1 = Math.max(ticks[ticks.length - 1], toNumber(hi) ?? 0, 0);
  // Nothing to span (all zero): keep the baseline at the bottom of the plot.
  if (d0 === d1) d1 = d0 + 1;
  return { ticks, domain: [d0, d1] };
}

/** Maps the domain onto a pixel range. Either range may run backwards. */
export function linearScale([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1;
  const k = (r1 - r0) / span;
  return (value) => r0 + (value - d0) * k;
}

/** `count` equal slots across a pixel range: one per category. */
export function bandScale(count, [r0, r1]) {
  const step = count > 0 ? (r1 - r0) / count : 0;
  return {
    step,
    start: (i) => r0 + step * i,
    center: (i) => r0 + step * (i + 0.5),
    /** The slot under a pixel position, or -1 outside the range. */
    indexAt(pos) {
      if (!step || pos < Math.min(r0, r1) || pos > Math.max(r0, r1)) return -1;
      return clamp(Math.floor((pos - r0) / step), 0, count - 1);
    },
  };
}

/**
 * Bars inside one category slot, laid out the way echarts does it: the slot
 * keeps `categoryGap` of itself empty, bars split the rest with `barGap` of a
 * bar between neighbours, capped at `maxWidth` and centred. `offsets` are each
 * bar's left edge relative to the slot centre.
 */
export function barGroupLayout(step, count, opts = {}) {
  const { categoryGap = BAR_CATEGORY_GAP, barGap = BAR_GAP, maxWidth = BAR_MAX_WIDTH } = opts;
  if (!(count > 0) || !(step > 0)) return { width: 0, gap: 0, offsets: [] };
  const available = step * (1 - categoryGap);
  const width = clamp(available / (count + (count - 1) * barGap), Math.min(1, step), maxWidth);
  const gap = width * barGap;
  const total = count * width + (count - 1) * gap;
  const offsets = Array.from({ length: count }, (_, i) => -total / 2 + i * (width + gap));
  return { width, gap, offsets };
}

/**
 * A bar as a path with only its tip rounded — the end that grows away from the
 * baseline. `tip` is 'top' | 'bottom' | 'left' | 'right', or null for a square
 * segment inside a stack.
 */
export function barPath(x, y, w, h, radius = BAR_RADIUS, tip = 'top') {
  if (!(w > 0) || !(h > 0)) return '';
  const across = tip === 'left' || tip === 'right' ? h : w;
  const along = tip === 'left' || tip === 'right' ? w : h;
  const r = tip ? r2(Math.min(radius, across / 2, along)) : 0;
  const [x0, y0, x1, y1] = [r2(x), r2(y), r2(x + w), r2(y + h)];
  if (!r) return `M${x0},${y0}H${x1}V${y1}H${x0}Z`;

  const arc = (tx, ty) => `A${r},${r} 0 0 1 ${r2(tx)},${r2(ty)}`;
  switch (tip) {
    case 'bottom':
      return `M${x0},${y0}H${x1}V${r2(y1 - r)}${arc(x1 - r, y1)}H${r2(x0 + r)}${arc(x0, y1 - r)}Z`;
    case 'right':
      return `M${x0},${y0}H${r2(x1 - r)}${arc(x1, y0 + r)}V${r2(y1 - r)}${arc(x1 - r, y1)}H${x0}Z`;
    case 'left':
      return `M${x1},${y0}V${y1}H${r2(x0 + r)}${arc(x0, y1 - r)}V${r2(y0 + r)}${arc(x0 + r, y0)}Z`;
    default:
      return `M${x0},${y1}V${r2(y0 + r)}${arc(x0 + r, y0)}H${r2(x1 - r)}${arc(x1, y0 + r)}V${y1}Z`;
  }
}

/**
 * Per row, where each series sits in a stack: positives build up from zero,
 * negatives down from it. `tips` names the outermost series in each direction,
 * the only segment whose end is rounded.
 */
export function stackRows(rows, keys) {
  return rows.map((row) => {
    let pos = 0;
    let neg = 0;
    const segments = {};
    const tips = { pos: null, neg: null };
    for (const key of keys) {
      const v = toNumber(row?.[key]);
      if (v === null || v === 0) continue;
      if (v > 0) {
        segments[key] = [pos, pos + v];
        pos += v;
        tips.pos = key;
      } else {
        segments[key] = [neg, neg + v];
        neg += v;
        tips.neg = key;
      }
    }
    return { segments, tips, pos, neg };
  });
}

/** Lowest and highest value the plot has to reach. Stacks reach their sums. */
export function valueExtent(rows, keys, stacked = false) {
  let lo = 0;
  let hi = 0;
  if (stacked) {
    for (const s of stackRows(rows, keys)) {
      lo = Math.min(lo, s.neg);
      hi = Math.max(hi, s.pos);
    }
    return [lo, hi];
  }
  for (const row of rows) {
    for (const key of keys) {
      const v = toNumber(row?.[key]);
      if (v === null) continue;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  return [lo, hi];
}

/** Whether any row holds a number for any of the keys. */
export function hasNumericValue(rows, keys) {
  return rows.some((row) => keys.some((key) => toNumber(row?.[key]) !== null));
}

/* ── Lines and areas ───────────────────────────────────────────────────── */

/** Splits points at nulls: a missing reading is a gap, never a zero. */
export function splitSegments(points) {
  const segments = [];
  let current = [];
  for (const p of points) {
    if (p) current.push(p);
    else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

/**
 * Tangents for a monotone cubic through the points (Fritsch–Carlson, as d3's
 * curveMonotoneX): the curve never overshoots a reading, so a smoothed month
 * never dips below zero or peaks above its real high.
 */
function monotoneTangents(pts) {
  const n = pts.length;
  const sign = (v) => (v < 0 ? -1 : 1);
  const h = [];
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(pts[i + 1].x - pts[i].x);
    d.push(h[i] ? (pts[i + 1].y - pts[i].y) / h[i] : 0);
  }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const p = (d[i - 1] * h[i] + d[i] * h[i - 1]) / (h[i - 1] + h[i] || 1);
    m[i] = (sign(d[i - 1]) + sign(d[i])) * Math.min(Math.abs(d[i - 1]), Math.abs(d[i]), 0.5 * Math.abs(p)) || 0;
  }
  m[0] = n > 2 ? (3 * d[0] - m[1]) / 2 : d[0];
  m[n - 1] = n > 2 ? (3 * d[n - 2] - m[n - 2]) / 2 : d[n - 2];
  return m;
}

/** The commands after the first point, so an area can continue one path. */
function curveBody(pts, curve) {
  if (pts.length < 2) return '';
  if (curve !== 'monotone' || pts.length < 3) {
    return pts.slice(1).map((p) => `L${r2(p.x)},${r2(p.y)}`).join('');
  }
  const m = monotoneTangents(pts);
  let out = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = (b.x - a.x) / 3;
    out += `C${r2(a.x + dx)},${r2(a.y + dx * m[i])} ${r2(b.x - dx)},${r2(b.y - dx * m[i + 1])} ${r2(b.x)},${r2(b.y)}`;
  }
  return out;
}

/** A polyline (or monotone curve) through points with no gaps. */
export function linePath(pts, curve = 'linear') {
  if (!pts.length) return '';
  return `M${r2(pts[0].x)},${r2(pts[0].y)}${curveBody(pts, curve)}`;
}

/** The same line closed down to `baseline`, for the soft area fill. */
export function areaPath(pts, baseline, curve = 'linear') {
  if (pts.length < 2) return '';
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${linePath(pts, curve)}L${r2(last.x)},${r2(baseline)}L${r2(first.x)},${r2(baseline)}Z`;
}

/* ── Donut ─────────────────────────────────────────────────────────────── */

/**
 * Angles for each value around a ring, clockwise from 12 o'clock. Each slice
 * gives up `padAngle` to the gap after it (none when only one slice is drawn).
 * Zero and negative values keep their index but get no arc.
 */
export function donutLayout(values, { padAngle = DONUT_PAD_ANGLE, startAngle = -Math.PI / 2 } = {}) {
  const positive = values.map((v) => Math.max(0, toNumber(v) ?? 0));
  const total = positive.reduce((sum, v) => sum + v, 0);
  if (!total) return [];
  const drawn = positive.filter((v) => v > 0).length;
  const pad = drawn > 1 ? padAngle : 0;

  let angle = startAngle;
  return positive.map((value, index) => {
    const sweep = (value / total) * TAU;
    const a0 = angle;
    angle += sweep;
    return {
      index,
      value,
      percent: (value / total) * 100,
      startAngle: a0 + pad / 2,
      endAngle: a0 + sweep - pad / 2,
      midAngle: a0 + sweep / 2,
    };
  });
}

function polar(cx, cy, r, a) {
  return `${r2(cx + r * Math.cos(a))},${r2(cy + r * Math.sin(a))}`;
}

/** A whole ring: outer circle clockwise, inner one back, so nonzero fill leaves the hole. */
export function ringPath(cx, cy, outer, inner) {
  const o = `M${r2(cx + outer)},${r2(cy)}A${outer},${outer} 0 1 1 ${r2(cx - outer)},${r2(cy)}A${outer},${outer} 0 1 1 ${r2(cx + outer)},${r2(cy)}Z`;
  if (!(inner > 0)) return o;
  return `${o}M${r2(cx + inner)},${r2(cy)}A${inner},${inner} 0 1 0 ${r2(cx - inner)},${r2(cy)}A${inner},${inner} 0 1 0 ${r2(cx + inner)},${r2(cy)}Z`;
}

/**
 * One slice of a ring between angles a0 and a1 (radians, clockwise on screen),
 * with its four corners rounded by `cornerRadius`. The radius shrinks on thin
 * slices so the corner circles never overlap.
 */
export function arcPath(cx, cy, outer, inner, a0, a1, cornerRadius = DONUT_CORNER_RADIUS) {
  const theta = a1 - a0;
  if (!(theta > 1e-6) || !(outer > 0)) return '';
  if (theta >= TAU - 1e-6) return ringPath(cx, cy, outer, inner);

  const s = Math.sin(Math.min(theta, Math.PI) / 2);
  const band = (outer - Math.max(inner, 0)) / 2;
  const rco = Math.max(0, Math.min(cornerRadius, band, (outer * s) / (1 + s)));
  const rci = inner > 0 ? Math.max(0, Math.min(cornerRadius, band, s < 1 ? (inner * s) / (1 - s) : cornerRadius)) : 0;

  const parts = [];
  // Outer edge, clockwise.
  if (rco > 0.01) {
    const da = Math.asin(rco / (outer - rco));
    const edge = Math.sqrt((outer - rco) ** 2 - rco ** 2);
    const large = theta - 2 * da > Math.PI ? 1 : 0;
    parts.push(
      `M${polar(cx, cy, edge, a0)}`,
      `A${r2(rco)},${r2(rco)} 0 0 1 ${polar(cx, cy, outer, a0 + da)}`,
      `A${outer},${outer} 0 ${large} 1 ${polar(cx, cy, outer, a1 - da)}`,
      `A${r2(rco)},${r2(rco)} 0 0 1 ${polar(cx, cy, edge, a1)}`,
    );
  } else {
    const large = theta > Math.PI ? 1 : 0;
    parts.push(`M${polar(cx, cy, outer, a0)}`, `A${outer},${outer} 0 ${large} 1 ${polar(cx, cy, outer, a1)}`);
  }

  // Inner edge, counter-clockwise back to the start.
  if (!(inner > 0)) {
    parts.push(`L${r2(cx)},${r2(cy)}Z`);
  } else if (rci > 0.01) {
    const da = Math.asin(rci / (inner + rci));
    const edge = Math.sqrt((inner + rci) ** 2 - rci ** 2);
    const large = theta - 2 * da > Math.PI ? 1 : 0;
    parts.push(
      `L${polar(cx, cy, edge, a1)}`,
      `A${r2(rci)},${r2(rci)} 0 0 1 ${polar(cx, cy, inner, a1 - da)}`,
      `A${inner},${inner} 0 ${large} 0 ${polar(cx, cy, inner, a0 + da)}`,
      `A${r2(rci)},${r2(rci)} 0 0 1 ${polar(cx, cy, edge, a0)}Z`,
    );
  } else {
    const large = theta > Math.PI ? 1 : 0;
    parts.push(`L${polar(cx, cy, inner, a1)}`, `A${inner},${inner} 0 ${large} 0 ${polar(cx, cy, inner, a0)}Z`);
  }
  return parts.join('');
}

/** `0.4` → `<1%`: a rounded `0%` on a slice that is visibly there reads as a bug. */
export function formatPercent(percent) {
  if (!percent) return '0%';
  if (percent < 1) return '<1%';
  return `${Math.round(percent)}%`;
}

/* ── Colours ───────────────────────────────────────────────────────────── */

export const CATEGORICAL_LENGTH = 10;
export const SEQUENTIAL_LENGTH = 7;
/** Lines take the categorical families shifted, so neighbouring lines never share a hue. */
const LINE_ORDER = [1, 4, 5, 8, 9, 2, 3, 6, 7, 10];

/**
 * `count` stops from the deep end of the sequential ramp, spread evenly but
 * never more than 3 apart, so 1, 2 and 3 series are prefixes of each other
 * (frappe's sequentialStops). 1-based.
 */
export function sequentialStops(count, length = SEQUENTIAL_LENGTH) {
  if (count <= 0) return [];
  if (count === 1) return [1];
  if (count > length) return Array.from({ length: count }, (_, i) => (i % length) + 1);
  const lastIndex = length - 1;
  return Array.from({ length: count }, (_, i) => Math.min(Math.round((i * lastIndex) / (count - 1)), i * 3) + 1);
}

/**
 * Default series colours as CSS variables, chosen the way frappe-ui does: bars
 * spend the sequential (blue) ramp, two or more lines take separate categorical
 * hues, a donut walks the categorical ramp in order.
 */
export function defaultColors(kind, count) {
  if (count <= 0) return [];
  if (kind === 'categorical') {
    return Array.from({ length: count }, (_, i) => `var(--chart-series-${(i % CATEGORICAL_LENGTH) + 1})`);
  }
  if (kind === 'line' && count > 1) {
    return Array.from({ length: count }, (_, i) => `var(--chart-series-${LINE_ORDER[i % LINE_ORDER.length]})`);
  }
  return sequentialStops(count).map((n) => `var(--chart-seq-${n})`);
}

/* ── Labels ────────────────────────────────────────────────────────────── */

/**
 * Advance of a character in Inter at 1em. Only used where there is no DOM to
 * measure in (tests, SSR); rounded up so a label never under-reads.
 */
function charWidthRatio(char) {
  if (char === ' ') return 0.29;
  if (/[ijltfI|!.,;:'`]/.test(char)) return 0.3;
  if (char === 'r') return 0.38;
  if (/[()[\]]/.test(char)) return 0.37;
  if (/[mMW%@]/.test(char)) return 0.95;
  if (char === 'w') return 0.83;
  if (/[A-Z0-9$&₹–−]/.test(char)) return 0.68;
  if (/[a-z]/.test(char)) return 0.6;
  return 1;
}

export function estimateTextWidth(text, fontSize = AXIS_FONT_SIZE) {
  let ems = 0;
  for (const char of String(text ?? '')) ems += charWidthRatio(char);
  return ems * fontSize;
}

let measureCtx;
let measureFamily;

/**
 * Width of `text` as the SVG will draw it: measured on a canvas in the page's
 * own font where there is a DOM, estimated otherwise. Letter spacing (0.01em on
 * axis labels) is added on top.
 */
export function measureText(text, fontSize = AXIS_FONT_SIZE) {
  const str = String(text ?? '');
  if (!str) return 0;
  const spacing = str.length * fontSize * 0.01;
  if (typeof document === 'undefined') return estimateTextWidth(str, fontSize) + spacing;
  try {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d');
      measureFamily =
        getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() ||
        'Inter, system-ui, sans-serif';
    }
    if (!measureCtx) return estimateTextWidth(str, fontSize) + spacing;
    measureCtx.font = `420 ${fontSize}px ${measureFamily}`;
    return measureCtx.measureText(str).width + spacing;
  } catch {
    return estimateTextWidth(str, fontSize) + spacing;
  }
}

/**
 * Shortens to fit `maxWidth` by dropping the middle: category names often share
 * a prefix, and keeping both ends keeps the part that tells them apart.
 */
export function truncateMiddle(text, maxWidth, measure = measureText) {
  const str = String(text ?? '');
  if (!str || measure(str) <= maxWidth) return str;
  for (let chars = str.length - 1; chars >= 2; chars--) {
    const keep = chars - 1;
    const head = Math.ceil(keep / 2);
    const tail = keep - head;
    const candidate = str.slice(0, head) + '…' + (tail ? str.slice(-tail) : '');
    if (measure(candidate) <= maxWidth) return candidate;
  }
  return '…';
}

/** Every how-many-th category label fits, given the widest label and the slot width. */
export function labelStride(widths, slot, gap = CATEGORY_LABEL_GAP) {
  if (!(slot > 0) || !widths.length) return 1;
  const widest = Math.max(...widths);
  return Math.max(1, Math.ceil((widest + gap) / slot));
}

/**
 * Indices of the labels to draw at a stride. The last category is always
 * labelled (an unlabelled end reads as a clipped axis), dropping the neighbour
 * that would collide with it.
 */
export function strideIndices(count, stride) {
  if (count <= 0) return [];
  const step = Math.max(1, Math.floor(stride));
  const picked = [];
  for (let i = 0; i < count; i += step) picked.push(i);
  const last = count - 1;
  if (picked[picked.length - 1] !== last) {
    if (picked.length > 1 && last - picked[picked.length - 1] < step) picked.pop();
    picked.push(last);
  }
  return picked;
}

/* ── Sparkline ─────────────────────────────────────────────────────────── */

/**
 * The series as points across a width×height box, oldest at the left, scaled
 * between its own min and max. A flat or single-value series draws flat down
 * the middle: pinning it to an edge would invent a trend. Gaps are dropped.
 */
export function sparklinePoints(values, width, height, { insetX = 1, insetY = 3 } = {}) {
  const readings = (values ?? []).map(toNumber).filter((v) => v !== null);
  if (!readings.length || !(width > 0) || !(height > 0)) return [];
  const top = insetY;
  const bottom = height - insetY;
  const middle = (top + bottom) / 2;
  const left = insetX;
  const right = width - insetX;

  if (readings.length === 1) return [{ x: left, y: middle }, { x: right, y: middle }];

  const min = Math.min(...readings);
  const max = Math.max(...readings);
  const span = max - min;
  return readings.map((v, i) => ({
    x: left + (i * (right - left)) / (readings.length - 1),
    y: span === 0 ? middle : bottom - ((v - min) / span) * (bottom - top),
  }));
}

/* ── Formatting defaults ───────────────────────────────────────────────── */

/** Axis ticks: compact rupees (₹25k, ₹1.2L). */
export const defaultTickFormat = (n) => inrCompact(n);
