import { forwardRef } from 'react';
import { useStableId } from './internal/floating.js';
import FormLabel from './FormLabel.jsx';
import TextInput from './TextInput.jsx';
import Textarea from './Textarea.jsx';
import Select from './Select.jsx';
import Checkbox from './Checkbox.jsx';
import Switch from './Switch.jsx';
import Combobox from './Combobox.jsx';
import DatePicker from './DatePicker.jsx';
import DateRangePicker from './DateRangePicker.jsx';
import './FormControl.css';

// Port of frappe-ui 1.0.2 FormControl.vue + the labeling it delegates to
// (InputLabel / InputDescription / InputError): label above, the control,
// then the description — or, when set, the error in its place. `type` picks
// the control; every other prop goes to it, so `onChange` follows that
// control (event for text/textarea/select/checkbox, value for switch,
// combobox, date, daterange). Checkbox and switch carry their own label
// beside the control, as in Frappe.

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const TOGGLES = new Set(['checkbox', 'switch']);

const FormControl = forwardRef(function FormControl(
  {
    label,
    description,
    error,
    required = false,
    type = 'text',
    id: idProp,
    size = 'sm',
    variant = 'subtle',
    disabled = false,
    className,
    style,
    controlClassName,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const autoId = useStableId('ui-field');
  const id = idProp ?? autoId;

  if (TOGGLES.has(type)) {
    const Toggle = type === 'checkbox' ? Checkbox : Switch;
    return (
      <div className={cx('ui-form-control', 'ui-form-control--toggle', className)} style={style}>
        <Toggle
          ref={ref}
          id={id}
          label={label}
          description={description}
          error={error}
          required={required}
          disabled={disabled}
          size={size === 'lg' || size === 'xl' ? 'md' : size}
          className={controlClassName}
          aria-describedby={ariaDescribedBy}
          {...rest}
        />
      </div>
    );
  }

  const errorText = Array.isArray(error) ? error.filter(Boolean).join('\n') : error;
  const hasError = Boolean(errorText);
  const showDescription = Boolean(description) && !hasError;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy =
    [ariaDescribedBy, showDescription && descriptionId, hasError && errorId].filter(Boolean).join(' ') || undefined;

  const shared = {
    ref,
    id,
    size,
    variant,
    disabled,
    required,
    invalid: hasError || undefined,
    'aria-describedby': describedBy,
    'aria-errormessage': hasError ? errorId : undefined,
    'aria-required': required || undefined,
  };

  let control;
  switch (type) {
    case 'textarea':
      control = <Textarea {...shared} className={controlClassName} {...rest} />;
      break;
    case 'select':
      control = <Select {...shared} className={cx('ui-form-control__fill', controlClassName)} {...rest} />;
      break;
    case 'combobox': {
      const { required: _r, 'aria-required': _ar, ...comboShared } = shared;
      control = <Combobox {...comboShared} className={cx('ui-form-control__fill', controlClassName)} {...rest} />;
      break;
    }
    case 'date':
      control = <DatePicker {...shared} className={controlClassName} {...rest} />;
      break;
    case 'daterange':
      control = <DateRangePicker {...shared} className={controlClassName} {...rest} />;
      break;
    default:
      control = <TextInput {...shared} type={type} className={controlClassName} {...rest} />;
  }

  return (
    <div className={cx('ui-form-control', disabled && 'is-disabled', className)} style={style}>
      {label != null && label !== false && (
        <FormLabel id={id} labelId={`${id}-label`} required={required}>
          {label}
        </FormLabel>
      )}
      {control}
      {showDescription && (
        <p id={descriptionId} className="ui-form-control__description">
          {description}
        </p>
      )}
      {hasError && (
        <div id={errorId} role="alert" className="ui-form-control__error">
          {errorText}
        </div>
      )}
    </div>
  );
});

export default FormControl;
