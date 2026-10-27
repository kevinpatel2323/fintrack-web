import { isValidElement, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ellipsis } from 'lucide-react';
import Dropdown from './Dropdown.jsx';
import { cx } from './internal/dialogUtils.js';
import './Breadcrumbs.css';

/**
 * Breadcrumb trail — frappe-ui Breadcrumbs: 16px medium crumbs (muted,
 * darker on hover), `/` separators, the last item is the current page and
 * truncates. Items: `{ label, to?, onClick?, icon? }`.
 *
 * Collapsing: with more than 3 items the middle ones fold into a "…" menu
 * (first, …, last two). When even that does not fit, everything but the last
 * two folds in — frappe-ui's own overflow rule.
 */

function renderIcon(icon) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const Icon = icon;
  return <Icon className="ui-breadcrumbs__icon" size={16} aria-hidden="true" />;
}

function layout(items, mode) {
  const n = items.length;
  if (mode === 'middle' && n > 3) {
    return { lead: [items[0]], hidden: items.slice(1, n - 2), tail: items.slice(n - 2) };
  }
  if (mode === 'tail' && n > 2) {
    return { lead: [], hidden: items.slice(0, n - 2), tail: items.slice(n - 2) };
  }
  return { lead: [], hidden: [], tail: items };
}

function CrumbContent({ item }) {
  return (
    <>
      {renderIcon(item.icon)}
      <span className="ui-breadcrumbs__label">{item.label}</span>
    </>
  );
}

function Crumb({ item, current, measure }) {
  const className = cx('ui-breadcrumbs__crumb', current && 'ui-breadcrumbs__crumb--current');
  const title = current && typeof item.label === 'string' ? item.label : undefined;
  if (measure) {
    return (
      <span className={className}>
        <CrumbContent item={item} />
      </span>
    );
  }
  if (item.to) {
    return (
      <Link
        to={item.to}
        className={className}
        title={title}
        aria-current={current ? 'page' : undefined}
        onClick={(e) => item.onClick?.(e)}
      >
        <CrumbContent item={item} />
      </Link>
    );
  }
  if (item.onClick) {
    return (
      <button
        type="button"
        className={className}
        title={title}
        aria-current={current ? 'page' : undefined}
        onClick={(e) => item.onClick(e)}
      >
        <CrumbContent item={item} />
      </button>
    );
  }
  return (
    <span className={className} title={title} aria-current={current ? 'page' : undefined}>
      <CrumbContent item={item} />
    </span>
  );
}

function Trail({ items, mode, measure }) {
  const { lead, hidden, tail } = layout(items, mode);
  const visible = [...lead, ...tail];
  const lastIndex = visible.length - 1;

  const menu = hidden.length > 0 && (
    <li className="ui-breadcrumbs__item ui-breadcrumbs__item--menu">
      {measure ? (
        <span className="ui-breadcrumbs__more" />
      ) : (
        <Dropdown
          label="Hidden breadcrumbs"
          options={hidden.map((item, i) => ({
            key: `${i}-${typeof item.label === 'string' ? item.label : i}`,
            label: item.label,
            to: item.to,
            onClick: item.onClick,
          }))}
        >
          <button type="button" className="ui-breadcrumbs__more" aria-label="Show hidden breadcrumbs">
            <Ellipsis size={16} aria-hidden="true" />
          </button>
        </Dropdown>
      )}
      <span className="ui-breadcrumbs__sep ui-breadcrumbs__sep--menu" aria-hidden="true">
        /
      </span>
    </li>
  );

  const renderItem = (item, i) => (
    <li
      key={`${i}-${typeof item.label === 'string' ? item.label : ''}`}
      className={cx('ui-breadcrumbs__item', i === lastIndex && 'ui-breadcrumbs__item--current')}
    >
      <Crumb item={item} current={i === lastIndex} measure={measure} />
      {i !== lastIndex && (
        <span className="ui-breadcrumbs__sep" aria-hidden="true">
          /
        </span>
      )}
    </li>
  );

  return (
    <ol className="ui-breadcrumbs__list">
      {lead.map((item, i) => renderItem(item, i))}
      {menu}
      {tail.map((item, i) => renderItem(item, lead.length + i))}
    </ol>
  );
}

export default function Breadcrumbs({ items = [], className, 'aria-label': ariaLabel = 'Breadcrumb', ...rest }) {
  const list = items.filter(Boolean);
  const rootRef = useRef(null);
  const measureRef = useRef(null);
  const [overflowed, setOverflowed] = useState(false);

  const preferred = list.length > 3 ? 'middle' : 'full';

  // Measure a hidden, un-truncated copy of the preferred trail against the
  // space we have — no flash of the full trail before it folds.
  const check = useCallback(() => {
    const root = rootRef.current;
    const probe = measureRef.current;
    if (!root || !probe) return;
    const available = root.clientWidth;
    if (available === 0) return;
    const next = probe.getBoundingClientRect().width > available + 0.5;
    setOverflowed((prev) => (prev === next ? prev : next));
  }, []);

  useLayoutEffect(() => {
    check();
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => check());
    ro.observe(root);
    document.fonts?.ready?.then(() => check());
    return () => ro.disconnect();
  }, [check]);

  const mode = overflowed && list.length > 2 ? 'tail' : preferred;

  return (
    <nav {...rest} ref={rootRef} aria-label={ariaLabel} className={cx('ui-breadcrumbs', className)}>
      <Trail items={list} mode={mode} />
      <div className="ui-breadcrumbs__measure" aria-hidden="true" inert="">
        <div ref={measureRef} className="ui-breadcrumbs__measure-inner">
          <Trail items={list} mode={preferred} measure />
        </div>
      </div>
    </nav>
  );
}
