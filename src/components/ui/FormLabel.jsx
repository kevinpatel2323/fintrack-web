import './FormLabel.css';

// Port of frappe-ui 1.0.2 FormLabel.vue / InputLabel.vue: a fixed 13px label
// in `ink-gray-6` (or `ink-gray-7` beside a checkbox/switch), with a red
// asterisk and a screen-reader "(required)" when `required`.

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

// `id` is the id of the control the label is for (Frappe's FormLabel prop);
// `htmlFor` is accepted as an alias. `labelId` sets the label's own id, for
// `aria-labelledby` wiring.
export default function FormLabel({
  label,
  children,
  id,
  htmlFor,
  labelId,
  required = false,
  disabled = false,
  color = 'gray-6',
  as: Tag = 'label',
  className,
  ...rest
}) {
  const forId = htmlFor ?? id;
  return (
    <Tag
      id={labelId}
      htmlFor={Tag === 'label' ? forId : undefined}
      className={cx(
        'ui-form-label',
        color === 'gray-7' && 'ui-form-label--strong',
        disabled && 'is-disabled',
        className,
      )}
      data-slot="label"
      {...rest}
    >
      {children ?? label}
      {required && (
        <>
          {' '}
          <span className="ui-form-label__required" aria-hidden="true">
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      )}
    </Tag>
  );
}
