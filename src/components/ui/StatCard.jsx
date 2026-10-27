import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Skeleton from './Skeleton.jsx';
import './Card.css';
import './StatCard.css';

// A single figure on the Card surface — frappe-ui's NumberCard (Insights'
// number widget): label text-sm ink-gray-5, value text-3xl-semibold
// tabular-nums ink-gray-9, delta row with an arrow and the unsigned percent in
// green-7 / red-7 and a muted caption.
//
//   value           node | string | number (numbers get en-IN grouping);
//                   null/undefined shows a muted em dash
//   delta           percent change (number); the arrow carries the sign
//   deltaLabel      caption after the percent, e.g. "vs last month"
//   deltaUnit       suffix after the number (default "%"; e.g. " pts")
//   positiveIsGood  default true; false makes a rise red (spend, dues)
//   hint            muted line under the figure
//   loading         skeletons the figure and delta, keeping the card's height
//   to / onClick    the whole card becomes a Link / button with a hover state

const cx = (...parts) => parts.filter(Boolean).join(' ');
const isPresent = (n) => typeof n === 'number' && Number.isFinite(n);

function formatValue(value) {
  if (typeof value !== 'number') return value;
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-IN', { maximumFractionDigits: Number.isInteger(value) ? 0 : 2 });
}

function formatDelta(delta, unit) {
  return `${Math.abs(delta).toLocaleString('en-IN', { maximumFractionDigits: 1 })}${unit}`;
}

const StatCard = forwardRef(function StatCard(
  {
    label,
    value,
    delta,
    deltaLabel,
    deltaUnit = '%',
    positiveIsGood = true,
    hint,
    loading = false,
    to,
    onClick,
    className,
    ...rest
  },
  ref,
) {
  const interactive = Boolean(to) || Boolean(onClick);
  const isEmpty = value === null || value === undefined;

  const direction = !isPresent(delta) || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
  let tone = 'neutral';
  if (direction !== 'flat') tone = (direction === 'up') === positiveIsGood ? 'positive' : 'negative';
  const showDelta = isPresent(delta) || Boolean(deltaLabel);

  const classes = cx('ui-card', 'ui-card--pad-md', 'ui-stat-card', interactive && 'ui-stat-card--interactive', className);

  const body = (
    <>
      <span className="ui-stat-card__label">{label}</span>
      {loading ? (
        <>
          {/* The ghost dash holds the line open so the card doesn't resettle. */}
          <span className="ui-stat-card__value">
            <Skeleton as="span" className="ui-stat-card__value-skeleton" />
            <span className="ui-stat-card__ghost">—</span>
          </span>
          <Skeleton as="span" className="ui-stat-card__delta-skeleton" />
        </>
      ) : (
        <>
          <span className={cx('ui-stat-card__value', isEmpty && 'ui-stat-card__value--empty')}>
            {isEmpty ? '—' : formatValue(value)}
          </span>
          {isEmpty ? (
            <span className="ui-stat-card__caption">No data</span>
          ) : (
            showDelta && (
              <span className="ui-stat-card__delta">
                {direction !== 'flat' && (
                  <>
                    {direction === 'up' ? (
                      <ArrowUpRight className={`ui-stat-card__arrow ui-stat-card__tone--${tone}`} size={16} strokeWidth={1.5} aria-hidden="true" />
                    ) : (
                      <ArrowDownLeft className={`ui-stat-card__arrow ui-stat-card__tone--${tone}`} size={16} strokeWidth={1.5} aria-hidden="true" />
                    )}
                    <span className="sr-only">{direction === 'up' ? 'Up' : 'Down'}</span>
                  </>
                )}
                {isPresent(delta) && (
                  <span className={`ui-stat-card__delta-value ui-stat-card__tone--${tone}`}>{formatDelta(delta, deltaUnit)}</span>
                )}
                {deltaLabel && (
                  <span className="ui-stat-card__caption" title={typeof deltaLabel === 'string' ? deltaLabel : undefined}>
                    {deltaLabel}
                  </span>
                )}
              </span>
            )
          )}
          {/* A div can hold block content (e.g. a Progress) except inside a
              <button>, where only phrasing content is allowed. */}
          {hint && (!to && onClick ? <span className="ui-stat-card__hint">{hint}</span> : <div className="ui-stat-card__hint">{hint}</div>)}
        </>
      )}
    </>
  );

  const shared = { ref, className: classes, 'aria-busy': loading || undefined, ...rest };

  if (to) {
    return (
      <Link to={to} onClick={onClick} {...shared}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} {...shared}>
        {body}
      </button>
    );
  }
  return <div {...shared}>{body}</div>;
});

export default StatCard;
