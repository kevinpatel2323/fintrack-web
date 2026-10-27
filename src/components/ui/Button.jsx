import { forwardRef, isValidElement } from 'react';
import { Link } from 'react-router-dom';
import Spinner from './Spinner.jsx';
import Tooltip from './Tooltip.jsx';
import './Button.css';

// Port of frappe-ui Button.vue.
//
// Colour comes from one of three state maps that replace each other outright
// (as in Frappe): `disabled` → the disabled map, pressed (`active` prop, or
// data-state="open"|"active" as a menu trigger stamps it) → the active map,
// otherwise the variant map with its hover and :active steps. See Button.css.
//
// `icon` makes an icon-only button; `label` then becomes its aria-label.
// `loading` shows a spinner and makes the button non-interactive without
// dimming it. `to` renders a router Link, `href` an <a> that opens in a new tab
// (pass target/rel to change that). Both fall back to a <button> while
// disabled or loading, as in Frappe.

const VARIANTS = new Set(['solid', 'subtle', 'outline', 'ghost']);
const THEMES = new Set(['gray', 'blue', 'green', 'red']);
const SIZES = new Set(['xs', 'sm', 'md', 'lg']);

// Frappe: icon slots are size-3.5 / 4 / 4.5 / 5; lucide at stroke 1.5.
const ICON_PX = { xs: 14, sm: 16, md: 18, lg: 20 };

const cx = (...parts) => parts.filter(Boolean).join(' ');

// A lucide component (function or forwardRef object) is rendered at the
// button's icon size; an element is used as given.
function renderIcon(icon, px) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  if (typeof icon !== 'function' && !(typeof icon === 'object' && '$$typeof' in icon)) return null;
  const Icon = icon;
  return <Icon className="ui-button__icon" size={px} strokeWidth={1.5} aria-hidden="true" />;
}

const Button = forwardRef(function Button(
  {
    variant = 'subtle',
    theme = 'gray',
    size = 'sm',
    label,
    children,
    icon,
    iconLeft,
    iconRight,
    loading = false,
    loadingText,
    disabled = false,
    active = false,
    to,
    href,
    type = 'button',
    tooltip,
    className,
    ...rest
  },
  ref,
) {
  const v = VARIANTS.has(variant) ? variant : 'subtle';
  const t = THEMES.has(theme) ? theme : 'gray';
  const s = SIZES.has(size) ? size : 'sm';
  const px = ICON_PX[s];

  const isIconButton = Boolean(icon);
  const isDisabled = disabled || loading;
  const dataState = rest['data-state'];
  const isActive = active || dataState === 'open' || dataState === 'active';

  const classes = cx(
    'ui-button',
    `ui-button--${v}`,
    `ui-button--${t}`,
    `ui-button--${s}`,
    isIconButton && 'ui-button--icon',
    // Only an explicit `disabled` dims; a loading button keeps its look.
    disabled ? 'ui-button--disabled' : isActive && 'ui-button--active',
    loading && !disabled && 'ui-button--loading',
    className,
  );

  const content = children ?? label;

  let prefix = null;
  if (loading) prefix = <Spinner className="ui-button__spinner" />;
  else prefix = renderIcon(iconLeft, px);

  let main;
  if (loading && loadingText) {
    main = <span className="ui-button__label">{loadingText}</span>;
  } else if (isIconButton && !loading) {
    main = renderIcon(icon, px);
  } else if (content !== undefined && content !== null && content !== false) {
    main = <span className={cx('ui-button__label', isIconButton && 'sr-only')}>{content}</span>;
  } else {
    main = null;
  }

  const suffix = renderIcon(iconRight, px);

  const ariaLabel =
    rest['aria-label'] ??
    (isIconButton ? label ?? (typeof tooltip === 'string' ? tooltip : undefined) : undefined);

  const common = {
    ...rest,
    ref,
    className: classes,
    'aria-label': ariaLabel,
    'aria-busy': loading || undefined,
  };

  let element;
  if (!isDisabled && to !== undefined && to !== null) {
    element = (
      <Link to={to} {...common}>
        {prefix}
        {main}
        {suffix}
      </Link>
    );
  } else if (!isDisabled && href) {
    element = (
      <a href={href} target="_blank" rel="noreferrer noopener" {...common}>
        {prefix}
        {main}
        {suffix}
      </a>
    );
  } else {
    element = (
      <button type={type} disabled={isDisabled} {...common}>
        {prefix}
        {main}
        {suffix}
      </button>
    );
  }

  if (tooltip) return <Tooltip text={tooltip}>{element}</Tooltip>;
  return element;
});

export default Button;
