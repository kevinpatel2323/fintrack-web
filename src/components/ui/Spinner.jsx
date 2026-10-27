import { forwardRef } from 'react';
import './Spinner.css';

// Port of frappe-ui Spinner. An empty <svg> used as a paint surface: the ring
// is drawn with gradients and a mask, and the gradient angle (not the element)
// spins, so the circle never wobbles.
//
// size: 'xs' 12px | 'sm' 14px | 'md' 16px | 'lg' 20px. Omit it to size with CSS
// (16px when nothing sets a size; the ring stays in proportion).
// theme: 'gray' | 'red'. Omit it to inherit the current text colour.

const SIZES = new Set(['xs', 'sm', 'md', 'lg']);
const THEMES = new Set(['gray', 'red']);

const cx = (...parts) => parts.filter(Boolean).join(' ');

const Spinner = forwardRef(function Spinner({ size, theme, track = false, className, ...rest }, ref) {
  return (
    <svg
      ref={ref}
      width="16"
      height="16"
      role="status"
      aria-label="Loading"
      className={cx(
        'ui-spinner',
        SIZES.has(size) && `ui-spinner--${size}`,
        THEMES.has(theme) && `ui-spinner--${theme}`,
        track && 'ui-spinner--track',
        className,
      )}
      {...rest}
    />
  );
});

export default Spinner;
