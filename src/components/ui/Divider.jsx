import { forwardRef } from 'react';
import Button from './Button.jsx';
import './Divider.css';

// Port of frappe-ui Divider.vue. A 1px outline-gray-2 rule.
//   orientation: 'horizontal' | 'vertical'
//   flexItem:    stretch to the flex parent's cross size (vertical rule between
//                items of different heights)
//   action:      Button props + onClick, drawn on the rule (default sm outline);
//                `align` places it: 'start' | 'center' | 'end'

const cx = (...parts) => parts.filter(Boolean).join(' ');

const Divider = forwardRef(function Divider(
  { orientation = 'horizontal', align = 'center', flexItem = false, action, className, ...rest },
  ref,
) {
  const o = orientation === 'vertical' ? 'vertical' : 'horizontal';
  const a = ['start', 'center', 'end'].includes(align) ? align : 'center';

  if (action) {
    const { onClick, ...buttonProps } = action;
    return (
      <div
        ref={ref}
        className={cx('ui-divider-action', `ui-divider-action--${o}`, `ui-divider-action--${a}`, flexItem && 'ui-divider--flex-item', className)}
        {...rest}
      >
        <div role="separator" aria-orientation={o} className={cx('ui-divider-action__line', `ui-divider-action__line--${o}`)} />
        <Button size="sm" variant="outline" {...buttonProps} className={cx('ui-divider-action__button', buttonProps.className)} onClick={onClick} />
      </div>
    );
  }

  return (
    <hr
      ref={ref}
      aria-orientation={o === 'vertical' ? 'vertical' : undefined}
      className={cx('ui-divider', `ui-divider--${o}`, flexItem && 'ui-divider--flex-item', className)}
      {...rest}
    />
  );
});

export default Divider;
