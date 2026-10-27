import { forwardRef } from 'react';
import './Skeleton.css';

// Port of frappe-ui Skeleton.vue: a gray block that pulses where content will
// land (`animate-pulse bg-surface-gray-3`, aria-hidden).
//
// Frappe takes no props and is sized with classes. Here `width` / `height`
// (number → px, or any CSS length) and `circle` cover the usual cases; a
// className works too. Corners default to rounded-4, which is what every
// Frappe usage adds. Mark the loading region with aria-busy for screen readers.

const cx = (...parts) => parts.filter(Boolean).join(' ');
const len = (v) => (typeof v === 'number' ? `${v}px` : v);

const Skeleton = forwardRef(function Skeleton(
  { width, height, circle = false, as: As = 'div', className, style, ...rest },
  ref,
) {
  const sized =
    width !== undefined || height !== undefined
      ? { width: len(width), height: len(height), ...style }
      : style;
  return (
    <As
      ref={ref}
      className={cx('ui-skeleton', circle && 'ui-skeleton--circle', className)}
      style={sized}
      aria-hidden="true"
      {...rest}
    />
  );
});

export default Skeleton;
