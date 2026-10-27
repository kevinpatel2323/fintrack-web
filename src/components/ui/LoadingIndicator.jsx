import { forwardRef } from 'react';
import Spinner from './Spinner.jsx';
import './LoadingIndicator.css';

// In frappe-ui, LoadingIndicator is Spinner under its older name, same props.
// It also stands in for frappe-ui's LoadingText here: pass `text` for a
// spinner with a label ("Loading...", "Saving...") —
//   flex items-center text-base text-ink-gray-4, spinner -ml-1 mr-2 h-3 w-3.

const cx = (...parts) => parts.filter(Boolean).join(' ');

const LoadingIndicator = forwardRef(function LoadingIndicator({ text, className, ...rest }, ref) {
  if (text === undefined || text === null || text === false) {
    return <Spinner ref={ref} className={className} {...rest} />;
  }
  const { size, theme, track, ...divProps } = rest;
  return (
    <div ref={ref} className={cx('ui-loading-text', className)} {...divProps}>
      <Spinner className="ui-loading-text__spinner" theme={theme} track={track} />
      {text === true ? 'Loading...' : text}
    </div>
  );
});

export default LoadingIndicator;
