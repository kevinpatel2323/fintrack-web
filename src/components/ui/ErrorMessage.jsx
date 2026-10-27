import { forwardRef } from 'react';
import './ErrorMessage.css';

// Port of frappe-ui ErrorMessage.vue: `whitespace-pre-line text-sm
// text-ink-red-7`, role="alert", nothing rendered when there is no error.
//
// `message` takes a string, an array of strings, or an Error. An Error shows
// its `messages` (string or array) when it has any, else its `message`.
// Frappe renders sanitised HTML (DOMPurify); this renders plain text.

const cx = (...parts) => parts.filter(Boolean).join(' ');

function errorLines(value) {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  const { messages } = value;
  if (Array.isArray(messages) && messages.length) {
    const lines = messages.filter(Boolean).map(String);
    if (lines.length) return lines;
  } else if (typeof messages === 'string' && messages) {
    return [messages];
  }
  return value.message ? [String(value.message)] : [];
}

const ErrorMessage = forwardRef(function ErrorMessage({ message, className, ...rest }, ref) {
  const lines = errorLines(message);
  if (!lines.length) return null;
  return (
    <div ref={ref} role="alert" className={cx('ui-error-message', className)} {...rest}>
      {lines.join('\n')}
    </div>
  );
});

export default ErrorMessage;
