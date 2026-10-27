import { forwardRef, isValidElement } from 'react';
import './Badge.css';

// Port of frappe-ui Badge.vue. A pill label: `label` (string | number) or
// children, with optional `prefix` / `suffix` (an icon, a dot). Pass either an
// element (`prefix={<Check />}`) or a lucide component (`prefix={Check}`);
// either way it is sized to the badge (10px, 12px at lg).
//
// Unknown theme / variant / size values fall back to gray / subtle / md.

const THEMES = new Set(['gray', 'blue', 'green', 'amber', 'red', 'violet']);
const VARIANTS = new Set(['solid', 'subtle', 'outline', 'ghost']);
const SIZES = new Set(['sm', 'md', 'lg']);

const cx = (...parts) => parts.filter(Boolean).join(' ');

// A component type (function, or forwardRef/memo object like lucide's icons)
// is rendered; anything else (element, string, array) is passed through.
function isComponentType(x) {
  if (typeof x === 'function') return true;
  return typeof x === 'object' && x !== null && !isValidElement(x) && !Array.isArray(x) && '$$typeof' in x;
}

function renderAffix(node) {
  if (node === undefined || node === null || node === false) return null;
  if (!isComponentType(node)) return node;
  const Icon = node;
  return <Icon strokeWidth={1.5} aria-hidden="true" />;
}

const Badge = forwardRef(function Badge(
  { theme = 'gray', variant = 'subtle', size = 'md', label, prefix, suffix, children, className, ...rest },
  ref,
) {
  const t = THEMES.has(theme) ? theme : 'gray';
  const v = VARIANTS.has(variant) ? variant : 'subtle';
  const s = SIZES.has(size) ? size : 'md';
  const content = children ?? (label !== undefined && label !== null ? String(label) : null);
  const pre = renderAffix(prefix);
  const suf = renderAffix(suffix);

  return (
    <span
      ref={ref}
      className={cx('ui-badge', `ui-badge--${v}`, `ui-badge--${t}`, `ui-badge--${s}`, className)}
      {...rest}
    >
      {pre && <span className="ui-badge__affix">{pre}</span>}
      {content}
      {suf && <span className="ui-badge__affix">{suf}</span>}
    </span>
  );
});

export default Badge;
