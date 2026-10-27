import { forwardRef } from 'react';
import './Progress.css';

// Port of frappe-ui Progress.vue.
//   value      0–100 (clamped)
//   size       'sm' 2px | 'md' 4px | 'lg' 8px | 'xl' 12px  (default 'sm')
//   label      left of the header; also the bar's accessible name
//   hint       true → "{value}%" on the right; a node replaces that text
//   intervals  number of segments; fills whole segments only

const cx = (...parts) => parts.filter(Boolean).join(' ');
const SIZES = new Set(['sm', 'md', 'lg', 'xl']);

const Progress = forwardRef(function Progress(
  { value = 0, size = 'sm', label = '', hint = false, intervals, className, ...rest },
  ref,
) {
  const s = SIZES.has(size) ? size : 'sm';
  const n = Number(value);
  const clamped = Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), 100);
  const showHint = hint !== false && hint !== null && hint !== undefined;
  const hintNode = hint === true ? <span className="ui-progress__hint-text">{value}%</span> : hint;
  const segments = intervals > 0 ? Math.floor(intervals) : 0;
  const filled = Math.round((clamped / 100) * segments);

  return (
    <div ref={ref} className={cx('ui-progress', className)} {...rest}>
      {(label || showHint) && (
        <div className="ui-progress__header">
          {label ? <span className="ui-progress__label">{label}</span> : <span />}
          {showHint && <span className="ui-progress__hint">{hintNode}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label || 'Progress'}
        className={cx('ui-progress__track', `ui-progress__track--${s}`, segments ? 'ui-progress__track--intervals' : null)}
      >
        {segments ? (
          Array.from({ length: segments }, (_, i) => (
            <div key={i} className={cx('ui-progress__segment', i < filled && 'ui-progress__segment--filled')} />
          ))
        ) : (
          // Full-width fill slid left: transform animates on the compositor.
          <div className="ui-progress__fill" style={{ transform: `translateX(${clamped - 100}%)` }} />
        )}
      </div>
    </div>
  );
});

export default Progress;
