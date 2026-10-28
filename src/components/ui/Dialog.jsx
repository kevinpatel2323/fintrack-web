import { isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Portal from '../Portal.jsx';
import { useDismiss, useStableId } from './internal/floating.js';
import { cx, keepOpenLayersRef, useModalFocus, usePresence, useScrollLock } from './internal/dialogUtils.js';
import './Dialog.css';

/**
 * Modal dialog — Frappe UI's Dialog: black-overlay scrim, rounded-7 card on
 * surface-elevation-1 with shadow-xl, 18px semibold title with an optional
 * themed icon badge, close button, body, and an action row.
 *
 * Unlike frappe-ui the header and the action row stay put and only the body
 * scrolls when the content is tall.
 *
 * Backward compatible with the old frame: `open` defaults to true (render it
 * conditionally), and `overline`, `maxWidth` and `label` still work.
 */

const SIZES = new Set(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl']);
const FULL_WIDTH_SINGLE_ACTION = new Set(['xs', 'sm', 'md']);
const ICON_TONES = new Set(['amber', 'blue', 'red', 'green']);

function renderIcon(icon, size = 16) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const Icon = icon;
  return <Icon size={size} aria-hidden="true" />;
}

function Spinner() {
  return (
    <svg className="ui-dialog-btn__spinner" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A frappe-ui Button rendered from an action object. */
export function DialogActionButton({ action, close, fullWidth }) {
  const {
    label,
    variant = 'subtle',
    theme = 'gray',
    size = 'sm',
    onClick,
    loading,
    loadingText,
    disabled,
    type = 'button',
    form,
    icon,
    className,
    ...rest
  } = action;
  const [pending, setPending] = useState(false);
  const mountedRef = useRef(true);
  // Set on every mount: StrictMode runs this cleanup once before the real
  // mount, which would otherwise leave the button stuck in its loading state.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isLoading = Boolean(loading || pending);

  async function handleClick(e) {
    if (!onClick) {
      // Like frappe-ui: an action without a handler just closes the dialog.
      if (type !== 'submit') close?.();
      return;
    }
    const result = onClick(e, { close });
    if (result && typeof result.then === 'function') {
      setPending(true);
      try {
        await result;
      } catch {
        // The caller owns the promise and its errors.
      } finally {
        if (mountedRef.current) setPending(false);
      }
    }
  }

  return (
    <button
      {...rest}
      type={type}
      form={form}
      className={cx('ui-dialog-btn', fullWidth && 'ui-dialog-btn--full', className)}
      data-variant={variant}
      data-tone={theme}
      data-size={size}
      data-disabled={disabled ? '' : undefined}
      data-loading={isLoading ? '' : undefined}
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      onClick={handleClick}
    >
      {isLoading ? <Spinner /> : renderIcon(icon)}
      <span className="ui-dialog-btn__label">{isLoading && loadingText ? loadingText : label}</span>
    </button>
  );
}

/** Ghost icon button with lucide `x` — frappe-ui's dialog close affordance. */
export function DialogCloseButton({ onClick, className, label = 'Close' }) {
  return (
    <button type="button" className={cx('ui-dialog-close', className)} aria-label={label} onClick={onClick}>
      <X size={16} aria-hidden="true" />
    </button>
  );
}

/** Tracks whether a scroll container has content above / below the fold. */
export function useScrollEdges(ref, enabled) {
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const updateRef = useRef(() => {});

  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    const update = () => {
      const top = el.scrollTop > 0;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    updateRef.current = update;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) {
      ro.observe(el);
      Array.from(el.children).forEach((c) => ro.observe(c));
    }
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
      updateRef.current = () => {};
    };
  }, [ref, enabled]);

  // Content can change without resizing an observed node (new children).
  useLayoutEffect(() => {
    updateRef.current();
  });

  return edges;
}

export default function Dialog({
  open = true,
  onClose,
  title,
  description,
  icon,
  theme,
  size,
  actions,
  footer,
  children,
  closeOnOutsideClick = true,
  dismissable = true,
  overline,
  maxWidth,
  label,
  className,
  bodyClassName,
  mobile = 'sheet',
  style: styleProp,
  ...rest
}) {
  const { present, state } = usePresence(open, 150);
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const titleId = useStableId('ui-dialog-title');
  const descriptionId = useStableId('ui-dialog-desc');

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => onCloseRef.current?.(), []);

  useModalFocus({ active: open && present, containerRef: panelRef });
  useScrollLock(open);
  useDismiss({
    active: open,
    refs: [panelRef, keepOpenLayersRef],
    escape: dismissable,
    outside: dismissable && closeOnOutsideClick,
    onDismiss: close,
  });

  const hasBody = description != null || (children != null && children !== false);
  const edges = useScrollEdges(bodyRef, present && hasBody);

  if (!present) return null;

  const sizeKey = SIZES.has(size) ? size : 'lg';
  // `maxWidth` (legacy) wins over `size`. The old frame defaulted to 560px;
  // callers still on that API (they pass `overline`) keep it.
  const width = maxWidth ?? (size === undefined && overline != null ? 560 : undefined);

  const iconSpec =
    icon && typeof icon === 'object' && !isValidElement(icon) && 'icon' in icon
      ? { icon: icon.icon, tone: icon.theme ?? theme }
      : { icon, tone: theme };
  const showHeader = Boolean(title || overline);
  const iconNode = showHeader ? renderIcon(iconSpec.icon) : null;

  const actionList = Array.isArray(actions) ? actions.filter(Boolean) : [];
  const hasActions = footer != null || actionList.length > 0;
  const singleFullWidth =
    footer == null && actionList.length === 1 && width == null && FULL_WIDTH_SINGLE_ACTION.has(sizeKey);

  const labelledBy = !label && title ? titleId : undefined;
  const ariaLabel = label || (!title && typeof overline === 'string' ? overline : undefined);

  return (
    <Portal>
      <div className="ui-dialog-layer" data-state={state}>
        <div className="ui-overlay-scrim ui-dialog-overlay" data-state={state} aria-hidden="true" />
        <div className="ui-dialog-container" data-state={state} data-mobile={mobile}>
          <div
            {...rest}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={ariaLabel}
            aria-describedby={description != null ? descriptionId : undefined}
            tabIndex={-1}
            data-state={state}
            data-size={width == null ? sizeKey : undefined}
            data-header={showHeader ? '' : undefined}
            data-mobile={mobile}
            className={cx('ui-dialog', className)}
            style={width != null ? { maxWidth: width, ...styleProp } : styleProp}
          >
            {showHeader && (
              <div className="ui-dialog__header" data-overline={overline != null ? '' : undefined}>
                <div className="ui-dialog__heading">
                  {iconNode && (
                    <div className="ui-dialog__icon" data-tone={ICON_TONES.has(iconSpec.tone) ? iconSpec.tone : undefined}>
                      {iconNode}
                    </div>
                  )}
                  <div className="ui-dialog__titles">
                    {overline != null && <div className="ui-dialog__overline">{overline}</div>}
                    {title && (
                      <h3 id={titleId} className="ui-dialog__title">
                        {title}
                      </h3>
                    )}
                  </div>
                </div>
                {dismissable && <DialogCloseButton onClick={close} />}
              </div>
            )}
            {!showHeader && dismissable && <DialogCloseButton className="ui-dialog-close--floating" onClick={close} />}

            {hasBody && (
              <div
                ref={bodyRef}
                className={cx('ui-dialog__body', bodyClassName)}
                data-scrolled={edges.top ? '' : undefined}
              >
                {description != null && (
                  <p id={descriptionId} className="ui-dialog__description">
                    {description}
                  </p>
                )}
                {children}
              </div>
            )}

            {hasActions && (
              <div
                className="ui-dialog__actions"
                data-more={edges.bottom ? '' : undefined}
                data-full={singleFullWidth ? '' : undefined}
              >
                {footer ??
                  actionList.map((action, i) => (
                    <DialogActionButton
                      key={action.key ?? action.label ?? i}
                      action={action}
                      close={close}
                      fullWidth={singleFullWidth}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
