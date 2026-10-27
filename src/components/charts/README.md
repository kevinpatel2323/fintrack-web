# Charts

Hand-written SVG charts that reproduce frappe-ui 1.0.2's chart look on Espresso
tokens. No chart library. Every colour is a CSS variable, so charts follow
light/dark without re-rendering. The live gallery is `/ui-kit` → Charts
(`src/pages/dev/kit/ChartsDemo.jsx`).

```jsx
import { BarChart, LineChart, DonutChart, Sparkline, CategoryBars, ChartLegend, ChartCard } from '../components/charts';
```

Importing any chart loads `charts.css`. Charts fill their container's width
(measured with ResizeObserver, never stretched), and their height comes from
props. Give the parent a width: in a flex row, use `flex: 1; min-width: 0`.

**Defaults that apply everywhere**

- Values are rupees. Tooltips use `inr` (₹42,500) and axis ticks use
  `inrCompact` (₹25k, ₹1.2L). Override them with `formatValue` / `formatTick`.
- `emptyText` (default "No data to show") is shown muted and centred where
  the plot would be. Charts with all-zero data still draw an axis.
- A series with no `color` takes Frappe's default. Bars use the blue
  sequential ramp, two or more lines use separate hues, and donuts walk the
  categorical ramp. Pass `var(--chart-in)`, `var(--chart-out)` or
  `var(--cat-*)` for money and category colours.
- Accessibility: the SVG has `role="img"` and a generated `aria-label`.
  Override it with `ariaLabel`. A visually hidden table carries the data. The
  plot is one tab stop: arrow keys walk the categories or slices, Enter/Space
  clicks, Escape clears, and a live region reads the values.
- Motion: 150ms hover transitions and a short first-draw animation. Both are
  off under `prefers-reduced-motion`.

---

## BarChart

Grouped, stacked or horizontal bars. Bars are at most 32px wide with a 38%
gap between categories, and only the tip is rounded (4px). The hovered column
is shaded and the other columns dim slightly. A legend appears below when
there are 2+ series, and clicking an entry hides that series (the axis
rescales).

| Prop | Type | Default | |
|---|---|---|---|
| `data` | `object[]` | — | One row per category |
| `xKey` | `string` | — | Row key holding the category |
| `series` | `{ key, label?, color? }[]` | — | One bar per series in each group |
| `height` | `number` | `240` | Total SVG height, axis labels included |
| `stacked` | `boolean` | `false` | Positives stack up and negatives down; only the outer segment is rounded |
| `horizontal` | `boolean` | `false` | Categories down the left (labels capped at 32% of width, middle-truncated) |
| `formatValue` | `(n) => string` | `inr` | Tooltip and table values |
| `formatXLabel` | `(x) => string` | `String` | Category labels |
| `formatTick` | `(n) => string` | `inrCompact` | Value-axis ticks |
| `yTicks` | `number \| number[]` | `4` | Target interval count (round steps of 1/2/2.5/5 × 10ⁿ, always including 0), or exact tick values |
| `onBarClick` | `(datum, seriesKey) => void` | — | `seriesKey` is the bar under the pointer, or the first visible series when clicking the column or using the keyboard |
| `legend` | `'auto' \| boolean` | `'auto'` | Shown when there are 2+ series |
| `emptyText`, `ariaLabel`, `className` | | | |

```jsx
<BarChart
  data={months}                       // [{ month: '2026-05-01', spent: 78420, earned: 142000 }, …]
  xKey="month"
  series={[
    { key: 'spent', label: 'Spent', color: 'var(--chart-out)' },
    { key: 'earned', label: 'Earned', color: 'var(--chart-in)' },
  ]}
  formatXLabel={(iso) => MONTHS[new Date(iso).getMonth()]}
  onBarClick={(row) => navigate(`/transactions?month=${row.month}`)}
/>
```

Negative values grow down from a zero line, as in the demo's "Left after
investments" chart.

## LineChart

Uses the same axis model and props as BarChart (`data`, `xKey`, `series`,
`height`, `formatValue`, `formatXLabel`, `formatTick`, `yTicks`, `legend`,
`emptyText`, `ariaLabel`). Lines are 2px. A `null` value breaks the line
instead of dropping it to zero, and a point with no neighbour is drawn as a
dot. Hovering draws a guide rule and a dot on every series.

| Prop | Type | Default | |
|---|---|---|---|
| `area` | `boolean` | `false` | Soft fill that fades from 16% to 1.6% opacity |
| `curve` | `'linear' \| 'monotone'` | `'linear'` | Monotone smoothing never overshoots a value |
| `showDots` | `boolean` | `false` | 6px dot on every point |

```jsx
<LineChart data={months} xKey="month" series={cashflowSeries} area curve="monotone" />
```

## DonutChart

Shows each part's share of a total. The ring runs from 64% to 90% of the
radius, with 1.5° gaps and 4px rounded corners. The largest slice starts at
12 o'clock, and anything past `maxSlices` is grouped into "Others" (shown in
gray). The centre shows the total. Hovering, arrowing to, or pointing at a
legend entry grows that slice by 4px, dims the rest, and shows the slice's
value and share in the centre.

| Prop | Type | Default | |
|---|---|---|---|
| `data` | `{ label, value, color?, key? }[]` | — | Negative values are dropped |
| `size` | `number` | `160` | Width and height in px |
| `thickness` | `number` | `size × 0.13` | Ring thickness in px |
| `centerLabel` | `string` | `'Total'` | Caption under the centre value |
| `centerValue` | `number \| string` | total | Numbers go through `formatValue` |
| `formatValue` | `(n) => string` | `inr` | Centre, tooltip, legend values |
| `onSliceClick` | `(datum, index) => void` | — | For "Others", `datum` is `{ label: 'Others', value, items }` |
| `legend` | `false \| true \| 'bottom' \| 'right'` | `false` | `'right'` is a vertical list with values and shares. Entries toggle slices |
| `maxSlices` | `number` | `9` | "Others" counts as one of them |
| `othersLabel` | `string \| (count) => string` | `'Others'` | Name of the folded slice, e.g. `(n) => \`${n} more\`` |
| `emptyText`, `ariaLabel`, `className` | | | All-zero data draws an empty gray ring |

```jsx
<DonutChart
  data={categories.map((c) => ({ key: c.id, label: c.name, value: c.spent, color: categoryColor(c) }))}
  centerLabel="Spent"
  legend="right"
  onSliceClick={(c) => openCategory(c.key)}
/>
```

## Sparkline

A small trend line for stat cards. It has no axes and no tooltip, and is
scaled between the series' own min and max.

| Prop | Type | Default | |
|---|---|---|---|
| `data` | `number[] \| object[]` | — | Objects are read through `valueKey` |
| `valueKey` | `string` | `'value'` | |
| `width` | `number` | container width | Pass a number for inline use |
| `height` | `number` | `32` | |
| `color` | CSS colour | `var(--chart-seq-1)` | |
| `area` | `boolean` | `true` | Gradient fill (Frappe's NumberCard default) |
| `ariaLabel` | `string` | generated | |

```jsx
<Sparkline data={dailySpend} height={40} />
<Sparkline data={last14} width={96} height={20} area={false} color="var(--cat-food)" />
```

## CategoryBars

The ranked "spending by category" list. Each row puts the label and value
(and share) on one line, with a 4px track under it filled to value ÷ the
largest value. It reads like a list, not a chart.

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ key, label, value, color?, hint?, onClick? }[]` | — | `hint` is muted text after the label (e.g. "12 txns"). `onClick` makes the row a button |
| `formatValue` | `(n) => string` | `inr` | |
| `max` | `number` | all | Rows shown before "Show all N" |
| `showPercent` | `boolean` | `false` | Share of the total after the value |
| `sorted` | `boolean` | `true` | Largest first |
| `emptyText`, `ariaLabel`, `className` | | | |

```jsx
<CategoryBars
  items={categories.map((c) => ({ key: c.id, label: c.name, value: c.spent, color: categoryColor(c),
    hint: `${c.count} txns`, onClick: () => openCategory(c.id) }))}
  max={5}
  showPercent
/>
```

## ChartLegend

A colour dot and label per series, with an optional value or hint. Bar and
line charts render one automatically. Use it directly to build your own
layouts.

| Prop | Type | Default | |
|---|---|---|---|
| `items` | `{ key, label, color, value?, hint?, hidden?, active? }[]` | — | A `hidden` item keeps its place and dims |
| `layout` | `'horizontal' \| 'vertical'` | `'horizontal'` | Centred wrapping row, or a full-width list with right-aligned values |
| `onToggle` | `(key) => void` | — | Makes entries `aria-pressed` toggle buttons |
| `onHighlight` | `(key \| null) => void` | — | Fires on hover and focus |
| `formatValue` | `(n) => string` | — | Applied to numeric `value`s |

## ChartTooltip

The hover card the charts use internally, exported for custom plots. Render
it inside a `position: relative` wrapper. It sits 12px past `x, y` and flips
near the right and bottom edges.

`open`, `x`, `y` (relative to the wrapper), `label?`,
`items: { key, label, color, value: string, percent? }[]`,
`containerWidth?`, `containerHeight?` (both default to the wrapper's size).

## ChartCard

Frappe's chart card: 1px outline, 8px radius, 12×16 padding, a 14px title
with an optional muted subtitle, and an actions slot on the right. Its
content is not clipped, so tooltips can cross the edge.

```jsx
<ChartCard title="Spent vs earned" subtitle="Last 6 months" actions={<PeriodSelect />}>
  <BarChart … />
</ChartCard>
```

For a page of cards, wrap them in `<div className="ui-chart-deck">`. This is
an auto-fill grid of 320px+ columns. Add `ui-chart-deck-wide` to a card to
make it span the full row.

## Tokens (`charts.css`)

| Variable | Use |
|---|---|
| `--chart-series-1…10` | Frappe's categorical "Jewel" ramp (blue, emerald, violet, amber, red; each a dark then a light member) mapped to the nearest Espresso inks, with dark-theme overrides |
| `--chart-seq-1…7` | Frappe's blue sequential ramp (default bars, single lines, sparklines) |
| `--ui-chart-gridline` | Dotted gridlines and the hover band (`--outline-gray-1`, or `-2` in dark) |
| `--ui-chart-axis-line` | Line-chart guide rule |
| `--ui-chart-axis-font-size` | 11px, Frappe's axis label size |
| `--ui-chart-dim-opacity` | How far the rest of the plot dims on hover (0.75) |
| `--ui-chart-duration`, `--ui-chart-enter-duration` | 150ms / 300ms |

Pure helpers (`niceTicks`, `valueAxis`, `linearScale`, `bandScale`,
`barGroupLayout`, `barPath`, `stackRows`, `linePath`, `areaPath`,
`donutLayout`, `arcPath`, …) are in `scale.js`. Their tests are in
`__tests__/scale.test.ts`: `npx vitest run src/components/charts`.
