import { describe, expect, it } from 'vitest';
import {
  arcPath,
  areaPath,
  bandScale,
  barGroupLayout,
  barPath,
  defaultColors,
  donutLayout,
  formatPercent,
  linePath,
  linearScale,
  niceStep,
  niceTicks,
  ringPath,
  sequentialStops,
  sparklinePoints,
  splitSegments,
  stackRows,
  strideIndices,
  labelStride,
  truncateMiddle,
  valueAxis,
  valueExtent,
  DONUT_PAD_ANGLE,
} from '../scale.js';

describe('niceStep', () => {
  it('rounds up to 1, 2, 2.5, 5 or 10 times a power of ten', () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.3)).toBe(2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(21750)).toBe(25000);
    expect(niceStep(6)).toBe(10);
  });

  it('keeps exact nice values', () => {
    expect(niceStep(25)).toBe(25);
    expect(niceStep(100)).toBe(100);
  });

  it('falls back to 1 for nonsense input', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
    expect(niceStep(NaN)).toBe(1);
  });
});

describe('niceTicks', () => {
  it('produces round ticks from zero to past the max', () => {
    expect(niceTicks(0, 87000, 4)).toEqual([0, 25000, 50000, 75000, 100000]);
    expect(niceTicks(0, 100, 4)).toEqual([0, 25, 50, 75, 100]);
  });

  it('always includes zero, even when the data sits far from it', () => {
    const ticks = niceTicks(40000, 52000, 4);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(52000);
  });

  it('never exceeds the requested interval count', () => {
    for (const max of [1, 7, 13, 99, 1234, 98765, 4.2e6]) {
      for (const count of [2, 3, 4, 5, 6]) {
        expect(niceTicks(0, max, count).length - 1).toBeLessThanOrEqual(count);
      }
    }
  });

  it('spans negative values with zero landing on a tick', () => {
    const ticks = niceTicks(-3000, 9000, 4);
    expect(ticks).toContain(0);
    expect(ticks[0]).toBeLessThanOrEqual(-3000);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(9000);
  });

  it('handles all-negative data', () => {
    expect(niceTicks(-80, -10, 4)).toEqual([-80, -60, -40, -20, 0]);
    expect(niceTicks(-87, -10, 4)).toEqual([-100, -75, -50, -25, 0]);
  });

  it('returns just the baseline for all-zero data', () => {
    expect(niceTicks(0, 0)).toEqual([0]);
  });

  it('does not leave float dust behind', () => {
    for (const t of niceTicks(0, 0.7, 4)) expect(String(t).length).toBeLessThan(6);
  });
});

describe('valueAxis', () => {
  it('gives the domain the ticks span', () => {
    expect(valueAxis(0, 87000)).toEqual({ ticks: [0, 25000, 50000, 75000, 100000], domain: [0, 100000] });
  });

  it('keeps a usable domain for all-zero data', () => {
    expect(valueAxis(0, 0)).toEqual({ ticks: [0], domain: [0, 1] });
  });

  it('accepts explicit ticks and stretches to the data', () => {
    const { ticks, domain } = valueAxis(0, 130, [100, 0, 50]);
    expect(ticks).toEqual([0, 50, 100]);
    expect(domain).toEqual([0, 130]);
  });
});

describe('linearScale', () => {
  it('maps the domain to the range, including a flipped (SVG y) range', () => {
    const y = linearScale([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(100)).toBe(0);
    expect(y(25)).toBe(150);
  });

  it('survives a zero-width domain', () => {
    const x = linearScale([5, 5], [0, 10]);
    expect(Number.isFinite(x(5))).toBe(true);
  });
});

describe('bandScale', () => {
  const band = bandScale(4, [0, 400]);

  it('splits the range into equal slots', () => {
    expect(band.step).toBe(100);
    expect(band.start(2)).toBe(200);
    expect(band.center(0)).toBe(50);
  });

  it('finds the slot under a position', () => {
    expect(band.indexAt(0)).toBe(0);
    expect(band.indexAt(399)).toBe(3);
    expect(band.indexAt(400)).toBe(3);
    expect(band.indexAt(-1)).toBe(-1);
    expect(band.indexAt(401)).toBe(-1);
  });
});

describe('barGroupLayout', () => {
  it('caps bar width at 32px', () => {
    expect(barGroupLayout(200, 1).width).toBe(32);
  });

  it('leaves 38% of the slot as category gap and 30% of a bar between bars', () => {
    const { width, gap, offsets } = barGroupLayout(100, 2);
    expect(width * 2 + gap).toBeCloseTo(62, 5);
    expect(gap).toBeCloseTo(width * 0.3, 5);
    // Centred on the slot.
    expect(offsets[0]).toBeCloseTo(-31, 5);
    expect(offsets[1] + width).toBeCloseTo(31, 5);
  });

  it('returns nothing for no series', () => {
    expect(barGroupLayout(100, 0).offsets).toEqual([]);
  });
});

describe('barPath', () => {
  it('rounds only the tip', () => {
    const top = barPath(0, 0, 20, 50, 4, 'top');
    expect(top.startsWith('M0,50V4A4,4')).toBe(true);
    const square = barPath(0, 0, 20, 50, 4, null);
    expect(square).toBe('M0,0H20V50H0Z');
  });

  it('shrinks the radius on a short bar', () => {
    expect(barPath(0, 0, 20, 2, 4, 'top')).toContain('A2,2');
  });

  it('draws nothing for an empty bar', () => {
    expect(barPath(0, 0, 20, 0)).toBe('');
    expect(barPath(0, 0, 0, 10)).toBe('');
  });

  it('rounds the far end of horizontal and negative bars', () => {
    expect(barPath(0, 0, 50, 20, 4, 'right')).toContain('H46A4,4');
    expect(barPath(0, 0, 20, 50, 4, 'bottom')).toContain('V46A4,4');
  });
});

describe('stackRows / valueExtent', () => {
  const rows = [
    { a: 10, b: 5, c: -4 },
    { a: 0, b: 7, c: null },
  ];

  it('stacks positives up and negatives down from zero', () => {
    const [first, second] = stackRows(rows, ['a', 'b', 'c']);
    expect(first.segments).toEqual({ a: [0, 10], b: [10, 15], c: [0, -4] });
    expect(first.tips).toEqual({ pos: 'b', neg: 'c' });
    expect(second.segments).toEqual({ b: [0, 7] });
    expect(second.tips).toEqual({ pos: 'b', neg: null });
  });

  it('reaches the stack sums when stacked, single values otherwise', () => {
    expect(valueExtent(rows, ['a', 'b', 'c'], true)).toEqual([-4, 15]);
    expect(valueExtent(rows, ['a', 'b', 'c'], false)).toEqual([-4, 10]);
  });

  it('includes zero in the extent', () => {
    expect(valueExtent([{ a: 40 }, { a: 50 }], ['a'])).toEqual([0, 50]);
  });
});

describe('line and area paths', () => {
  const pts = [
    { x: 0, y: 10 },
    { x: 10, y: 0 },
    { x: 20, y: 10 },
  ];

  it('draws straight segments for a linear curve', () => {
    expect(linePath(pts)).toBe('M0,10L10,0L20,10');
  });

  it('draws cubic segments for a monotone curve without overshooting', () => {
    const d = linePath(pts, 'monotone');
    expect(d.match(/C/g)).toHaveLength(2);
    // The peak is a local extreme, so its tangent is flat: both control points
    // around it sit at the peak's own height.
    expect(d).toContain('6.67,0 10,0');
    expect(d).toContain('C13.33,0');
  });

  it('closes an area down to the baseline', () => {
    expect(areaPath(pts, 20)).toBe('M0,10L10,0L20,10L20,20L0,20Z');
    expect(areaPath([pts[0]], 20)).toBe('');
  });

  it('splits at nulls', () => {
    expect(splitSegments([pts[0], null, pts[1], pts[2], null])).toEqual([[pts[0]], [pts[1], pts[2]]]);
  });
});

describe('donutLayout', () => {
  it('covers the full circle minus pads, clockwise from 12 o’clock', () => {
    const slices = donutLayout([1, 1, 2]);
    expect(slices[0].startAngle).toBeCloseTo(-Math.PI / 2 + DONUT_PAD_ANGLE / 2, 9);
    expect(slices[2].endAngle).toBeCloseTo((3 * Math.PI) / 2 - DONUT_PAD_ANGLE / 2, 9);
    expect(slices.map((s) => s.percent)).toEqual([25, 25, 50]);
    const swept = slices.reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    expect(swept).toBeCloseTo(Math.PI * 2 - 3 * DONUT_PAD_ANGLE, 9);
  });

  it('skips the pad when only one slice is drawn', () => {
    const [only] = donutLayout([5, 0]);
    expect(only.endAngle - only.startAngle).toBeCloseTo(Math.PI * 2, 9);
  });

  it('treats negatives as zero and returns nothing for a zero total', () => {
    expect(donutLayout([0, 0])).toEqual([]);
    expect(donutLayout([-5, 5])[0].percent).toBe(0);
  });
});

describe('arcPath', () => {
  it('draws a closed ring segment with rounded corners', () => {
    const d = arcPath(80, 80, 72, 51, -Math.PI / 2, 0, 4);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    // Two corner arcs on each edge plus the two ring arcs.
    expect(d.match(/A/g)).toHaveLength(6);
    expect(d).toContain('A72,72 0 0 1');
    expect(d).toContain('A51,51 0 0 0');
  });

  it('sets the large-arc flag past half a turn', () => {
    expect(arcPath(80, 80, 72, 51, -Math.PI / 2, Math.PI, 4)).toContain('A72,72 0 1 1');
  });

  it('falls back to a ring for a full turn and to nothing for no angle', () => {
    expect(arcPath(80, 80, 72, 51, 0, Math.PI * 2)).toBe(ringPath(80, 80, 72, 51));
    expect(arcPath(80, 80, 72, 51, 1, 1)).toBe('');
  });

  it('keeps corner radii inside a thin slice', () => {
    const d = arcPath(80, 80, 72, 51, 0, 0.02, 4);
    const radii = [...d.matchAll(/A([\d.]+),/g)].map((m) => Number(m[1]));
    const corners = radii.filter((r) => r !== 72 && r !== 51);
    for (const r of corners) expect(r).toBeLessThan(1);
  });
});

describe('formatPercent', () => {
  it('never rounds a visible slice to 0%', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.4)).toBe('<1%');
    expect(formatPercent(33.6)).toBe('34%');
  });
});

describe('colours', () => {
  it('spends the sequential ramp like frappe: 1, 2, 3 series are prefixes', () => {
    expect(sequentialStops(1)).toEqual([1]);
    expect(sequentialStops(2)).toEqual([1, 4]);
    expect(sequentialStops(3)).toEqual([1, 4, 7]);
    expect(sequentialStops(4)).toEqual([1, 3, 5, 7]);
  });

  it('gives lines separate hues and donuts the categorical ramp', () => {
    expect(defaultColors('line', 1)).toEqual(['var(--chart-seq-1)']);
    expect(defaultColors('line', 3)).toEqual(['var(--chart-series-1)', 'var(--chart-series-4)', 'var(--chart-series-5)']);
    expect(defaultColors('categorical', 11)[10]).toBe('var(--chart-series-1)');
    expect(defaultColors('bar', 2)).toEqual(['var(--chart-seq-1)', 'var(--chart-seq-4)']);
  });
});

describe('labels', () => {
  const measure = (s: string) => s.length * 6;

  it('truncates in the middle to fit', () => {
    expect(truncateMiddle('Short', 100, measure)).toBe('Short');
    const cut = truncateMiddle('Entertainment and leisure', 60, measure);
    expect(measure(cut)).toBeLessThanOrEqual(60);
    expect(cut).toContain('…');
    expect(cut.startsWith('Ente')).toBe(true);
  });

  it('thins labels that would collide', () => {
    expect(labelStride([20, 22, 24], 40)).toBe(1);
    expect(labelStride([20, 22, 40], 30)).toBe(2);
  });

  it('always labels the last category', () => {
    expect(strideIndices(6, 1)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(strideIndices(7, 2)).toEqual([0, 2, 4, 6]);
    expect(strideIndices(6, 2)).toEqual([0, 2, 5]);
    expect(strideIndices(0, 2)).toEqual([]);
  });
});

describe('sparklinePoints', () => {
  it('scales between min and max inside the inset', () => {
    const pts = sparklinePoints([1, 3, 2], 100, 30);
    expect(pts[0]).toEqual({ x: 1, y: 27 });
    expect(pts[1]).toEqual({ x: 50, y: 3 });
    expect(pts[2].x).toBe(99);
  });

  it('draws a flat or single series down the middle', () => {
    expect(sparklinePoints([5, 5], 100, 30).every((p) => p.y === 15)).toBe(true);
    expect(sparklinePoints([5], 100, 30)).toEqual([{ x: 1, y: 15 }, { x: 99, y: 15 }]);
  });

  it('drops gaps and returns nothing for no data', () => {
    expect(sparklinePoints([1, null, 3], 100, 30)).toHaveLength(2);
    expect(sparklinePoints([], 100, 30)).toEqual([]);
  });
});
