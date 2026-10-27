// BarChart — grouped, stacked or horizontal bars in frappe-ui's style: slim
// bars (max 32px, 38% category gap) with only the tip rounded, dotted
// gridlines, compact ₹ ticks, a shaded column under the pointer and the shared
// tooltip. A legend appears below when there is more than one series.

import CartesianChart from './CartesianChart.jsx';

/**
 * @param {object}   props
 * @param {object[]} props.data      Rows, one per category.
 * @param {string}   props.xKey      Row key holding the category.
 * @param {{key:string,label?:string,color?:string}[]} props.series  One per bar in a group.
 * @param {number}   [props.height=240]
 * @param {boolean}  [props.stacked]
 * @param {boolean}  [props.horizontal]
 * @param {(n:number) => string} [props.formatValue]   Tooltip values. Default ₹42,500.
 * @param {(x:any) => string}    [props.formatXLabel]  Category labels.
 * @param {(n:number) => string} [props.formatTick]    Value-axis ticks. Default ₹25k.
 * @param {number|number[]}      [props.yTicks=4]      Target interval count, or exact ticks.
 * @param {(datum:object, seriesKey:string) => void} [props.onBarClick]
 * @param {string}  [props.emptyText]
 * @param {'auto'|boolean} [props.legend='auto']
 * @param {string}  [props.ariaLabel]
 */
export default function BarChart(props) {
  return <CartesianChart {...props} kind="bar" />;
}
