import { forwardRef, isValidElement } from 'react';
import './TextInput.css';

// Port of frappe-ui 1.0.2 TextInput.vue: a fixed-height single-line field
// (24/28/32/40px) in the `subtle`, `outline` or `ghost` look, with optional
// prefix/suffix content laid over the input. Labels, descriptions and errors
// come from FormControl.

const SIZES = new Set(['xs', 'sm', 'md', 'lg', 'xl']);
const VARIANTS = new Set(['subtle', 'outline', 'ghost']);

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** A lucide icon (or any component) passed as a prop, as opposed to a node. */
function isComponentType(value) {
  if (!value || isValidElement(value)) return false;
  return typeof value === 'function' || (typeof value === 'object' && '$$typeof' in value);
}

function Adornment({ content, side }) {
  const icon = isComponentType(content);
  const Icon = icon ? content : null;
  return (
    <span className={cx(`ui-text-input__${side}`, icon && 'is-icon')}>
      {icon ? <Icon className="ui-text-input__icon" size={16} strokeWidth={1.5} aria-hidden="true" /> : content}
    </span>
  );
}

const TextInput = forwardRef(function TextInput(
  {
    type = 'text',
    size = 'sm',
    variant = 'subtle',
    prefix,
    suffix,
    placeholder,
    disabled = false,
    invalid = false,
    className,
    inputClassName,
    style,
    autoComplete = 'off',
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  const s = SIZES.has(size) ? size : 'sm';
  const v = VARIANTS.has(variant) ? variant : 'subtle';
  const hasPrefix = prefix != null && prefix !== false;
  const hasSuffix = suffix != null && suffix !== false;

  return (
    <div
      className={cx(
        'ui-text-input',
        `ui-text-input--${s}`,
        hasPrefix && 'has-prefix',
        hasSuffix && 'has-suffix',
        disabled && 'is-disabled',
        className,
      )}
      style={style}
    >
      {hasPrefix && <Adornment content={prefix} side="prefix" />}
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={invalid || ariaInvalid || undefined}
        data-variant={v}
        data-size={s}
        className={cx('ui-input', 'ui-text-input__control', inputClassName)}
        {...rest}
      />
      {hasSuffix && <Adornment content={suffix} side="suffix" />}
    </div>
  );
});

export default TextInput;
