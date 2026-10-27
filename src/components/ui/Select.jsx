import { forwardRef, isValidElement, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './Select.css';

// A native <select> dressed as frappe-ui 1.0.2's Select trigger (the
// selection-family trigger in shared/selection/utils.ts): same heights and
// variants as TextInput, `ink-gray-7` value, `ink-gray-4` placeholder and a
// 16px chevron-down at the end. The menu itself is the browser's.

const SIZES = new Set(['xs', 'sm', 'md', 'lg', 'xl']);
const VARIANTS = new Set(['subtle', 'outline', 'ghost']);

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function isComponentType(value) {
  if (!value || isValidElement(value)) return false;
  return typeof value === 'function' || (typeof value === 'object' && '$$typeof' in value);
}

function normalizeOption(option) {
  if (option == null) return null;
  if (typeof option !== 'object') return { label: String(option), value: option };
  return { ...option, label: option.label ?? String(option.value) };
}

function renderOptions(options) {
  return options.map((option, i) => {
    if (option && typeof option === 'object' && 'group' in option) {
      const children = option.options ?? option.items ?? [];
      return (
        <optgroup key={`g-${option.group}-${i}`} label={option.group}>
          {renderOptions(children)}
        </optgroup>
      );
    }
    const o = normalizeOption(option);
    if (!o) return null;
    return (
      <option key={`${String(o.value)}-${i}`} value={o.value} disabled={o.disabled}>
        {o.label}
      </option>
    );
  });
}

const Select = forwardRef(function Select(
  {
    options = [],
    placeholder,
    value,
    defaultValue,
    onChange,
    size = 'sm',
    variant = 'subtle',
    prefix,
    disabled = false,
    invalid = false,
    className,
    style,
    selectClassName,
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  const s = SIZES.has(size) ? size : 'sm';
  const v = VARIANTS.has(variant) ? variant : 'subtle';
  const controlled = value !== undefined;
  // Uncontrolled selects still need to know when they show the placeholder.
  const [innerValue, setInnerValue] = useState(defaultValue ?? '');
  const current = controlled ? (value ?? '') : innerValue;
  const showsPlaceholder = placeholder != null && (current === '' || current == null);
  const hasPrefix = prefix != null && prefix !== false;
  const PrefixIcon = isComponentType(prefix) ? prefix : null;

  const handleChange = (event) => {
    if (!controlled) setInnerValue(event.target.value);
    onChange?.(event);
  };

  return (
    <div
      className={cx('ui-select', `ui-select--${s}`, hasPrefix && 'has-prefix', disabled && 'is-disabled', className)}
      style={style}
    >
      {hasPrefix && (
        <span className={cx('ui-select__prefix', PrefixIcon && 'is-icon')}>
          {PrefixIcon ? (
            <PrefixIcon className="ui-select__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            prefix
          )}
        </span>
      )}
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || ariaInvalid || undefined}
        data-variant={v}
        data-size={s}
        className={cx('ui-select__trigger', 'ui-select__control', showsPlaceholder && 'is-placeholder', selectClassName)}
        {...(controlled ? { value: current } : { defaultValue: defaultValue ?? (placeholder != null ? '' : undefined) })}
        onChange={handleChange}
        {...rest}
      >
        {placeholder != null && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {renderOptions(options)}
      </select>
      <ChevronDown className="ui-select__chevron" size={16} strokeWidth={1.5} aria-hidden="true" />
    </div>
  );
});

export default Select;
