import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import Dialog from './Dialog.jsx';
import './ConfirmDialog.css';

/**
 * Confirm / cancel prompt built on Dialog — frappe-ui's `dialog.confirm()`:
 * size md, theme-coloured icon badge (red/amber → alert-triangle, blue → info,
 * green → check-circle), message as `text-p-base text-ink-gray-7`, actions
 * `flex-row-reverse` with the confirm button solid in the theme colour and
 * cancel as outline.
 *
 * `onConfirm` may return a promise: the confirm button shows a spinner until
 * it settles. A rejection is shown inline (frappe ErrorMessage) and the
 * dialog stays open; closing on success is the caller's job (set `open`).
 */

const THEME_ICON = { red: TriangleAlert, amber: TriangleAlert, blue: Info, green: CircleCheck };

function errorText(err) {
  if (err == null) return 'Something went wrong';
  if (typeof err === 'string') return err;
  if (Array.isArray(err.messages) && typeof err.messages[0] === 'string') return err.messages[0];
  if (typeof err.message === 'string' && err.message) return err.message;
  return 'Something went wrong';
}

export default function ConfirmDialog({
  open = false,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  theme = 'red',
  icon,
  size = 'md',
  onConfirm,
  onCancel,
  children,
  ...rest
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (open) {
      setError('');
      setLoading(false);
    }
  }, [open]);

  async function confirm(e) {
    if (loading) return;
    setError('');
    let result;
    try {
      result = onConfirm?.(e);
    } catch (err) {
      setError(errorText(err));
      return;
    }
    if (!result || typeof result.then !== 'function') return;
    setLoading(true);
    try {
      await result;
    } catch (err) {
      if (mountedRef.current) setError(errorText(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function cancel() {
    if (loading) return;
    onCancel?.();
  }

  const tone = theme === 'gray' ? undefined : theme;
  const buttonTheme = theme === 'amber' ? 'gray' : theme;
  const resolvedIcon = icon === null ? null : icon ?? THEME_ICON[tone];

  return (
    <Dialog
      {...rest}
      open={open}
      onClose={cancel}
      title={title}
      icon={resolvedIcon}
      theme={tone}
      size={size}
      mobile="center"
      dismissable={!loading}
      footer={
        <div className="ui-confirm-dialog__actions">
          <button
            type="button"
            className="ui-dialog-btn"
            data-variant="solid"
            data-tone={buttonTheme}
            data-size="sm"
            data-loading={loading ? '' : undefined}
            aria-busy={loading || undefined}
            disabled={loading}
            onClick={confirm}
          >
            {loading && (
              <svg className="ui-dialog-btn__spinner" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
                <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            <span className="ui-dialog-btn__label">{confirmLabel}</span>
          </button>
          <button
            type="button"
            className="ui-dialog-btn"
            data-variant="outline"
            data-tone="gray"
            data-size="sm"
            data-disabled={loading ? '' : undefined}
            disabled={loading}
            onClick={cancel}
          >
            <span className="ui-dialog-btn__label">{cancelLabel}</span>
          </button>
        </div>
      }
    >
      {(message || children || error) && (
        <div className="ui-confirm-dialog__content">
          {message && <p className="ui-confirm-dialog__message">{message}</p>}
          {children}
          {error && (
            <p className="ui-confirm-dialog__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
