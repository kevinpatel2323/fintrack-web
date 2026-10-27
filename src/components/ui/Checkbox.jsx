import { forwardRef, useCallback, useEffect, useRef } from 'react';
import { useStableId } from './internal/floating.js';
import FormLabel from './FormLabel.jsx';
import './Checkbox.css';

// Port of frappe-ui 1.0.2 Checkbox.vue. A native checkbox drawn as Frappe's
// box: outline ring when empty, a `surface-gray-10` fill with the forms
// plugin's check (or dash, when indeterminate) when set. `padded` wraps the
// box and label in a clickable row surface for lists and menus.

const SIZES = new Set(['xs', 'sm', 'md']);

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

// The @tailwindcss/forms glyphs, drawn in `ink-base` over the fill.
const CHECK_PATH =
  'M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z';

const Checkbox = forwardRef(function Checkbox(
  {
    label,
    description,
    error,
    checked,
    defaultChecked,
    onChange,
    indeterminate = false,
    disabled = false,
    required = false,
    size = 'sm',
    padded,
    padding,
    id: idProp,
    className,
    style,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const s = SIZES.has(size) ? size : size === 'lg' ? 'md' : 'sm';
  const isPadded = Boolean(padded ?? padding);
  const autoId = useStableId('ui-checkbox');
  const id = idProp ?? autoId;
  const inputRef = useRef(null);

  const setRefs = useCallback(
    (node) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // `indeterminate` only exists as a DOM property.
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  const errorText = Array.isArray(error) ? error.filter(Boolean).join('\n') : error;
  const hasError = Boolean(errorText);
  const showDescription = Boolean(description) && !hasError;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy =
    [ariaDescribedBy, showDescription && descriptionId, hasError && errorId].filter(Boolean).join(' ') || undefined;

  // Padded rows are one click target: a click on the padding toggles the box.
  // The input toggles itself and the label toggles it through `for`.
  const onContainerClick = (event) => {
    if (!isPadded || disabled) return;
    const target = event.target;
    if (target.closest('[data-slot="control"]') || target.closest('[data-slot="label"]')) return;
    inputRef.current?.click();
  };

  return (
    <div
      className={cx(
        'ui-checkbox',
        `ui-checkbox--${s}`,
        isPadded && 'ui-checkbox--padded',
        (showDescription || hasError) && 'has-detail',
        disabled && 'is-disabled',
        className,
      )}
      style={style}
      onClick={isPadded ? onContainerClick : undefined}
    >
      <div className="ui-checkbox__row">
        <span className="ui-checkbox__box">
          <input
            ref={setRefs}
            id={id}
            type="checkbox"
            className="ui-checkbox__input"
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={onChange}
            disabled={disabled}
            required={required}
            aria-required={required || undefined}
            aria-invalid={hasError || undefined}
            aria-errormessage={hasError ? errorId : undefined}
            aria-describedby={describedBy}
            data-slot="control"
            data-state={indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
            {...rest}
          />
          <svg className="ui-checkbox__glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            {indeterminate ? (
              <path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d={CHECK_PATH} fill="currentColor" />
            )}
          </svg>
        </span>
        {label != null && label !== false && (
          <FormLabel
            id={id}
            color="gray-7"
            required={required}
            disabled={disabled}
            className="ui-checkbox__label"
          >
            {label}
          </FormLabel>
        )}
      </div>
      {(showDescription || hasError) && (
        <div className="ui-checkbox__detail">
          {showDescription && (
            <p id={descriptionId} className="ui-checkbox__description">
              {description}
            </p>
          )}
          {hasError && (
            <div id={errorId} role="alert" className="ui-checkbox__error">
              {errorText}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default Checkbox;
