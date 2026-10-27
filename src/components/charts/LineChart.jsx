// LineChart — trends on the same axis model as BarChart: 2px lines (straight or
// monotone-smoothed, never overshooting a reading), an optional soft gradient
// fill, gaps where a value is missing, and a guide rule plus dots under the
// pointer. Two or more lines take separate hues, as in frappe-ui.

import CartesianChart from './CartesianChart.jsx';

/**
 * @param {object}   props
 * @param {object[]} props.data
 * @param {string}   props.xKey
 * @param {{key:string,label?:string,color?:string}[]} props.series
 * @param {boolean}  [props.area]        Soft gradient fill under each line.
 * @param {'linear'|'monotone'} [props.curve='linear']
 * @param {boolean}  [props.showDots]    Dot on every point (isolated points always get one).
 * @param {number}   [props.height=240]
 * @param {(n:number) => string} [props.formatValue]
 * @param {(x:any) => string}    [props.formatXLabel]
 * @param {(n:number) => string} [props.formatTick]
 * @param {number|number[]}      [props.yTicks=4]
 * @param {string}  [props.emptyText]
 * @param {'auto'|boolean} [props.legend='auto']
 * @param {string}  [props.ariaLabel]
 */
export default function LineChart(props) {
  // Bar-only props have no meaning on a line, so they are dropped here.
  const { stacked: _stacked, horizontal: _horizontal, onBarClick: _onBarClick, ...rest } = props;
  return <CartesianChart {...rest} kind="line" />;
}
