import { createContext, useContext, useState } from 'react';
import { useStableId } from './internal/floating.js';
import FormLabel from './FormLabel.jsx';
import './Radio.css';

// Port of frappe-ui 1.0.2 Radio.vue / RadioGroup.vue. The whole row is the
// option: circle, label and description. Underneath is a native radio input
// (visually hidden), so arrow keys, Tab-to-selected and form submission come
// from the browser; the row shows the focus ring.
//
// <RadioGroup options={[{label, value, description?, disabled?}]} value onChange={(value) => …} />
// or compose: <RadioGroup value onChange><Radio value="a" label="A" /></RadioGroup>

const SIZES = new Set(['xs', 'sm', 'md']);

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const RadioGroupContext = createContext(null);

export function Radio({ value, label, description, disabled = false, id: idProp, className, children }) {
  const group = useContext(RadioGroupContext);
  if (!group) {
    throw new Error('[ui] <Radio> must be used inside a <RadioGroup>.');
  }
  const autoId = useStableId('ui-radio');
  const id = idProp ?? autoId;
  const isDisabled = group.disabled || disabled;
  const checked = group.value !== undefined && group.value !== null && Object.is(group.value, value);
  const text = children ?? label;
  const hasDescription = Boolean(description);

  return (
    <label
      htmlFor={id}
      className={cx(
        'ui-radio',
        `ui-radio--${group.size}`,
        group.padded && 'ui-radio--padded',
        hasDescription && 'has-description',
        isDisabled && 'is-disabled',
        className,
      )}
      data-state={checked ? 'checked' : 'unchecked'}
    >
      <input
        id={id}
        type="radio"
        className="ui-radio__input"
        name={group.name}
        value={String(value)}
        checked={checked}
        disabled={isDisabled}
        required={group.required}
        aria-describedby={hasDescription ? `${id}-description` : undefined}
        onChange={() => group.onSelect(value)}
      />
      <span className="ui-radio__circle" aria-hidden="true" />
      {(text != null || hasDescription) && (
        <span className="ui-radio__text">
          {text != null && <span className="ui-radio__label">{text}</span>}
          {hasDescription && (
            <span id={`${id}-description`} className="ui-radio__description">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

export function RadioGroup({
  options,
  value: valueProp,
  defaultValue,
  onChange,
  name,
  orientation = 'vertical',
  size = 'sm',
  padded = false,
  disabled = false,
  required = false,
  label,
  description,
  error,
  id: idProp,
  className,
  style,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...rest
}) {
  const autoId = useStableId('ui-radio-group');
  const id = idProp ?? autoId;
  // Controlled through `value`; `defaultValue` gives an uncontrolled group.
  const [innerValue, setInnerValue] = useState(defaultValue);
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : innerValue;
  const groupName = name ?? id;
  const s = SIZES.has(size) ? size : size === 'lg' ? 'md' : 'sm';
  const vertical = orientation !== 'horizontal';

  const errorText = Array.isArray(error) ? error.filter(Boolean).join('\n') : error;
  const hasError = Boolean(errorText);
  const showDescription = Boolean(description) && !hasError;
  const hasLabel = label != null && label !== false;
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy =
    [ariaDescribedBy, showDescription && descriptionId, hasError && errorId].filter(Boolean).join(' ') || undefined;

  const ctx = {
    name: groupName,
    value,
    size: s,
    padded,
    disabled,
    required,
    onSelect: (next) => {
      if (Object.is(next, value)) return;
      if (!controlled) setInnerValue(next);
      onChange?.(next);
    },
  };

  return (
    <div className={cx('ui-radio-group', className)} style={style}>
      {hasLabel && (
        <FormLabel as="div" labelId={labelId} color="gray-7" required={required} disabled={disabled}>
          {label}
        </FormLabel>
      )}
      <div
        id={id}
        role="radiogroup"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy ?? (hasLabel ? labelId : undefined)}
        aria-describedby={describedBy}
        aria-invalid={hasError || undefined}
        aria-errormessage={hasError ? errorId : undefined}
        aria-required={required || undefined}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        aria-disabled={disabled || undefined}
        data-orientation={vertical ? 'vertical' : 'horizontal'}
        className={cx(
          'ui-radio-group__options',
          vertical ? 'is-vertical' : 'is-horizontal',
          padded && 'is-padded',
          hasLabel && 'has-label',
        )}
        {...rest}
      >
        <RadioGroupContext.Provider value={ctx}>
          {options
            ? options.map((option, i) => {
                const o = option && typeof option === 'object' ? option : { label: String(option), value: option };
                return (
                  <Radio
                    key={`${String(o.value)}-${i}`}
                    value={o.value}
                    label={o.label}
                    description={o.description}
                    disabled={o.disabled}
                  />
                );
              })
            : children}
        </RadioGroupContext.Provider>
      </div>
      {(showDescription || hasError) && (
        <div className="ui-radio-group__detail">
          {showDescription && (
            <p id={descriptionId} className="ui-radio-group__description">
              {description}
            </p>
          )}
          {hasError && (
            <div id={errorId} role="alert" className="ui-radio-group__error">
              {errorText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RadioGroup;
