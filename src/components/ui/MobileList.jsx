import { Link } from 'react-router-dom';
import { ChevronRight, Ellipsis } from 'lucide-react';
import Button from './Button.jsx';
import Dropdown from './Dropdown.jsx';
import { cx } from './internal/dialogUtils.js';
import './MobileList.css';

/**
 * Phone lists that aren't tables of records — an overview's short lists, a
 * settings hub, a record's fields (frappe-ui mobile recipes, Gameplan's
 * MobileListRow and MobileMoreMenu). Records (transactions, people, …) stay
 * in ListView, which has its own phone layout.
 *
 *   <MobileSection title="Recent activity" action={{ label: 'View all', to: '/transactions' }}>
 *     <MobileList>
 *       <MobileListItem leading={<CategoryIcon … />} title="Swiggy" subtitle="Food · 29 Oct"
 *         value={<Amount … />} to="/transactions/12" />
 *     </MobileList>
 *   </MobileSection>
 *
 * `MobileList` runs edge to edge with rows padded by the page gutter;
 * `variant="inset"` is a rounded grouped block (iOS Settings). Rows are 48px
 * minimum, title 16px over a 13px subtitle, a value (and a line under it) on
 * the right, inset hairlines between rows, a pressed state and no hover.
 */
export function MobileList({ variant = 'plain', className, children, ...rest }) {
  return (
    <div role="list" {...rest} className={cx('ui-mlist', className)} data-variant={variant}>
      {children}
    </div>
  );
}

/**
 * One row. Becomes a link (`to`, `href`) or a button (`onClick`); `chevron`
 * adds the drill-in arrow. `actions` (Dropdown options) adds a trailing `…`
 * that opens them as an action sheet.
 */
export function MobileListItem({
  leading,
  title,
  subtitle,
  value,
  valueSub,
  chevron = false,
  to,
  href,
  state,
  replace,
  onClick,
  actions,
  actionsLabel = 'Actions',
  disabled = false,
  tone,
  className,
  children,
  'aria-label': ariaLabel,
  ...rest
}) {
  // `role` and other ARIA props (aria-current, aria-checked, …) go to the
  // row's interactive element, so a list of rows can act as a picker.
  const a11y = {};
  Object.keys(rest).forEach((k) => {
    if (k === 'role' || k.startsWith('aria-')) a11y[k] = rest[k];
  });
  const body = (
    <span className="ui-mrow__inner">
      {leading && <span className="ui-mrow__leading">{leading}</span>}
      <span className="ui-mrow__text">
        {title != null && <span className="ui-mrow__title">{title}</span>}
        {subtitle != null && subtitle !== false && <span className="ui-mrow__subtitle">{subtitle}</span>}
        {children}
      </span>
      {(value != null || valueSub != null) && (
        <span className="ui-mrow__end">
          {value != null && <span className="ui-mrow__value">{value}</span>}
          {valueSub != null && <span className="ui-mrow__value-sub">{valueSub}</span>}
        </span>
      )}
      {chevron && <ChevronRight className="ui-mrow__chevron" size={16} strokeWidth={1.5} aria-hidden="true" />}
    </span>
  );

  let main;
  if (to && !disabled) {
    main = (
      <Link {...a11y} className="ui-mrow__main" to={to} state={state} replace={replace} aria-label={ariaLabel} onClick={onClick}>
        {body}
      </Link>
    );
  } else if (href && !disabled) {
    main = (
      <a {...a11y} className="ui-mrow__main" href={href} aria-label={ariaLabel} onClick={onClick}>
        {body}
      </a>
    );
  } else if (onClick) {
    main = (
      <button {...a11y} type="button" className="ui-mrow__main" aria-label={ariaLabel} onClick={onClick} disabled={disabled}>
        {body}
      </button>
    );
  } else {
    main = <div {...a11y} className="ui-mrow__main">{body}</div>;
  }

  return (
    <div
      role="listitem"
      className={cx('ui-mrow', className)}
      data-interactive={(to || href || onClick) && !disabled ? '' : undefined}
      data-leading={leading ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-tone={tone}
    >
      {main}
      {actions && (
        <span className="ui-mrow__more">
          <Dropdown options={actions} label={typeof title === 'string' ? title : actionsLabel}>
            <Button variant="ghost" size="md" icon={Ellipsis} label={actionsLabel} />
          </Dropdown>
        </span>
      )}
    </div>
  );
}

/** A label/value row for a record's fields (the desktop side panel on phones). */
export function MobileField({ label, children, className }) {
  return (
    <div role="listitem" className={cx('ui-mfield', className)}>
      <span className="ui-mfield__label">{label}</span>
      <span className="ui-mfield__value">{children}</span>
    </div>
  );
}

/**
 * A titled block on a phone page: heading (and a muted line under it), an
 * optional control on the right (`aside`) or a "View all" style link
 * (`action: { label, to }` or `{ label, onClick }`), then the content.
 */
export function MobileSection({ title, description, aside, action, className, children, ...rest }) {
  const hasHead = title || description || aside || action;
  return (
    <section {...rest} className={cx('ui-msection', className)}>
      {hasHead && (
        <div className="ui-msection__head">
          <div className="ui-msection__titles">
            {title && <h2 className="ui-msection__title">{title}</h2>}
            {description && <p className="ui-msection__description">{description}</p>}
          </div>
          {aside}
          {action &&
            (action.to ? (
              <Link className="ui-msection__action" to={action.to}>
                {action.label}
                <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
              </Link>
            ) : (
              <button type="button" className="ui-msection__action" onClick={action.onClick}>
                {action.label}
              </button>
            ))}
        </div>
      )}
      {children}
    </section>
  );
}
