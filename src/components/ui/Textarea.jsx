import { forwardRef } from 'react';
import './TextInput.css';
import './Textarea.css';

// Port of frappe-ui 1.0.2 Textarea.vue. Same field look as TextInput; `size`
// moves padding, radius and minimum height only — the text is a flat 13px
// paragraph style at every size.

const SIZES = new Set(['xs', 'sm', 'md', 'lg']);
const VARIANTS = new Set(['subtle', 'outline', 'ghost']);

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const Textarea = forwardRef(function Textarea(
  {
    size = 'sm',
    variant = 'subtle',
    rows = 3,
    disabled = false,
    invalid = false,
    className,
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  // `xl` (dropped in frappe-ui 1.0) renders as `lg`.
  const s = size === 'xl' ? 'lg' : SIZES.has(size) ? size : 'sm';
  const v = VARIANTS.has(variant) ? variant : 'subtle';
  return (
    <textarea
      ref={ref}
      rows={rows}
      disabled={disabled}
      aria-invalid={invalid || ariaInvalid || undefined}
      data-variant={v}
      data-size={s}
      className={cx('ui-input', 'ui-textarea', `ui-textarea--${s}`, className)}
      {...rest}
    />
  );
});

export default Textarea;
