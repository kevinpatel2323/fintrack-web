import { forwardRef, isValidElement } from 'react';
import { useStableId } from './internal/floating.js';
import FormLabel from './FormLabel.jsx';
import './Switch.css';

// Port of frappe-ui 1.0.2 Switch.vue. A `role="switch"` button: gray-4 track
// when off, gray-10 when on, white thumb with the base elevation. With a
// label it trails the label (`controlPosition="start"` puts it first); with a
// description it becomes a settings row. `onChange(checked)` gets a boolean.

const SIZES = new Set(['xs', 'sm', 'md']);

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function isComponentType(value) {
  if (!value || isValidElement(value)) return false;
  return typeof value === 'function' || (typeof value === 'object' && '$$typeof' in value);
}

const Switch = forwardRef(function Switch(
  {
    checked = false,
    onChange,
    label,
    description,
    error,
    size = 'sm',
    disabled = false,
    required = false,
    padded = false,
    controlPosition = 'end',
    icon,
    id: idProp,
    className,
    style,
    onClick,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const s = SIZES.has(size) ? size : size === 'lg' ? 'md' : 'sm';
  const autoId = useStableId('ui-switch');
  const id = idProp ?? autoId;
  const on = Boolean(checked);

  const errorText = Array.isArray(error) ? error.filter(Boolean).join('\n') : error;
  const hasError = Boolean(errorText);
  const showDescription = Boolean(description) && !hasError;
  const hasLabel = label != null && label !== false;
  const hasDescription = Boolean(description);
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy =
    [ariaDescribedBy, showDescription && descriptionId, hasError && errorId].filter(Boolean).join(' ') || undefined;
  const start = controlPosition === 'start';

  const toggle = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    onChange?.(!on);
  };

  // Padded rows are one click target. The switch toggles itself and the label
  // clicks it through `for`, so only clicks on the padding are handled here.
  const onContainerClick = (event) => {
    if (!padded || disabled) return;
    const target = event.target;
    if (target.closest('[data-slot="control"]') || target.closest('[data-slot="label"]')) return;
    onChange?.(!on);
  };

  const Icon = isComponentType(icon) ? icon : null;

  let groupLayout = 'bare';
  if (hasDescription) groupLayout = 'settings';
  else if (hasLabel) groupLayout = 'inline';

  return (
    <div
      className={cx(
        'ui-switch',
        `ui-switch--${s}`,
        padded && 'ui-switch--padded',
        start && 'ui-switch--start',
        hasDescription && 'ui-switch--settings',
        (showDescription || hasError) && 'has-detail',
        disabled && 'is-disabled',
        className,
      )}
      style={style}
      onClick={padded ? onContainerClick : undefined}
    >
      <div className={cx('ui-switch__group', `ui-switch__group--${groupLayout}`)}>
        {(hasLabel || Icon || icon) && (
          <div className="ui-switch__text">
            {Icon ? (
              <Icon className="ui-switch__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              icon && <span className="ui-switch__icon">{icon}</span>
            )}
            {hasLabel && (
              <FormLabel
                id={id}
                color="gray-7"
                required={required}
                disabled={disabled}
                className="ui-switch__label"
              >
                {label}
              </FormLabel>
            )}
          </div>
        )}
        <button
          ref={ref}
          id={id}
          type="button"
          role="switch"
          aria-checked={on}
          aria-required={required || undefined}
          aria-invalid={hasError || undefined}
          aria-errormessage={hasError ? errorId : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          data-slot="control"
          data-state={on ? 'checked' : 'unchecked'}
          className="ui-switch__track"
          onClick={toggle}
          {...rest}
        >
          <span className="ui-switch__thumb" aria-hidden="true" />
        </button>
      </div>
      {(showDescription || hasError) && (
        <div className="ui-switch__detail">
          {showDescription && (
            <p id={descriptionId} className="ui-switch__description">
              {description}
            </p>
          )}
          {hasError && (
            <div id={errorId} role="alert" className="ui-switch__error">
              {errorText}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default Switch;
