// ChartCard — frappe-ui's chart card: 1px outline, 8px radius, 12×16 padding,
// a 14px title with an optional 13px muted subtitle and a right-aligned actions
// slot, then the chart. Optional: charts render fine without it.

import { cx } from './parts.jsx';
import './charts.css';

/**
 * @param {object} props
 * @param {React.ReactNode} [props.title]
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.actions]  Buttons/dropdowns beside the title.
 * @param {React.ReactNode} props.children
 */
export default function ChartCard({ title, subtitle, actions, children, className }) {
  return (
    <section className={cx('ui-chart-card', className)}>
      {title || subtitle || actions ? (
        <div className="ui-chart-card-header">
          <div className="ui-chart-card-heading">
            {title ? <div className="ui-chart-card-title">{title}</div> : null}
            {subtitle ? <div className="ui-chart-card-subtitle">{subtitle}</div> : null}
          </div>
          {actions ? <div className="ui-chart-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
