import { forwardRef } from 'react';
import { FT_MINUS, inr, inrCompact } from '../../utils/inr.js';
import './Amount.css';

// One way to print money everywhere. Rupees, en-IN grouping, tabular figures,
// a true minus sign (U+2212).
//
//   value     number in rupees, signed. Non-numbers print an em dash.
//   sign      'auto'   negatives get '−', positives plain (default)
//             'always' '+' / '−' (zero unsigned)
//             'never'  absolute value
//   tone      'auto'   positive → 'in', otherwise 'out' (default)
//             'in' (--ink-money-in) · 'out' (--ink-money-out) ·
//             'due' (--ink-money-due) · 'muted' (ink-gray-5) · 'inherit'
//   compact   ₹1.2L / ₹3.4Cr / ₹12k (inrCompact); the full figure goes in `title`
//   decimals  fraction digits for the full format (default 0; ignored by compact)

const cx = (...parts) => parts.filter(Boolean).join(' ');
const TONES = new Set(['in', 'out', 'due', 'muted', 'inherit']);

const Amount = forwardRef(function Amount(
  { value, sign = 'auto', tone = 'auto', compact = false, decimals = 0, className, ...rest },
  ref,
) {
  const n = typeof value === 'number' ? value : value === null || value === undefined || value === '' ? NaN : Number(value);
  const valid = Number.isFinite(n);

  let text = '—';
  let full;
  if (valid) {
    const abs = Math.abs(n);
    let prefix = '';
    if (sign === 'always') prefix = n > 0 ? '+' : n < 0 ? FT_MINUS : '';
    else if (sign !== 'never' && n < 0) prefix = FT_MINUS;
    const fullBody = inr(abs, { decimals });
    full = prefix + fullBody;
    text = compact ? prefix + inrCompact(abs) : full;
  }

  const resolvedTone = !valid ? 'muted' : tone === 'auto' ? (n > 0 ? 'in' : 'out') : TONES.has(tone) ? tone : 'out';

  return (
    <span
      ref={ref}
      className={cx('ui-amount', `ui-amount--${resolvedTone}`, className)}
      title={compact && valid && full !== text ? full : undefined}
      {...rest}
    >
      {text}
    </span>
  );
});

export default Amount;
