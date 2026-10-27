import { useCallback, useLayoutEffect, useRef } from 'react';
import Portal from '../Portal.jsx';
import { useDismiss, useStableId } from './internal/floating.js';
import {
  cx,
  keepOpenLayersRef,
  useMatchMedia,
  useModalFocus,
  usePresence,
  useScrollLock,
} from './internal/dialogUtils.js';
import { DialogCloseButton } from './Dialog.jsx';
import './Dialog.css';
import './Sheet.css';

/**
 * Side panel / drawer. `side="right"` is a full-height panel that slides in
 * from the right (Frappe CRM side panel look); `side="bottom"` is frappe-ui's
 * BottomSheet (36px top radius, grab handle, centred title, 90dvh cap, swipe
 * down to dismiss). `auto` (default) is right from 768px up, bottom below.
 *
 * Same modal behaviour as Dialog: portal, Escape, outside click, focus trap
 * and restore, scroll lock.
 */

const DESKTOP = '(min-width: 768px)';

export default function Sheet({
  open = false,
  onClose,
  title,
  description,
  side = 'auto',
  width = 480,
  footer,
  children,
  dismissable = true,
  closeOnOutsideClick = true,
  label,
  className,
  bodyClassName,
  style: styleProp,
  ...rest
}) {
  const isDesktop = useMatchMedia(DESKTOP);
  const resolvedSide = side === 'auto' ? (isDesktop ? 'right' : 'bottom') : side === 'bottom' ? 'bottom' : 'right';
  const { present, state } = usePresence(open, 200);
  const panelRef = useRef(null);
  const titleId = useStableId('ui-sheet-title');
  const descriptionId = useStableId('ui-sheet-desc');

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

  // ---- Swipe down to dismiss (bottom sheet, from the handle/title area) ----
  const dragRef = useRef(null);

  // Re-opened mid-exit after a swipe: clear the drag leftovers.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    el.removeAttribute('data-dragged');
    el.removeAttribute('data-drag-dismissed');
    el.style.transform = '';
    el.style.transition = '';
  }, [open]);

  function onDragStart(e) {
    if (!dismissable || resolvedSide !== 'bottom' || e.button !== 0) return;
    const el = panelRef.current;
    if (!el) return;
    dragRef.current = { id: e.pointerId, startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // A running entry animation outranks the inline transform; drop it.
    el.setAttribute('data-dragged', '');
    el.style.transition = 'none';
  }

  function onDragMove(e) {
    const d = dragRef.current;
    const el = panelRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    // Free downwards, heavy resistance upwards.
    el.style.transform = `translateY(${dy >= 0 ? dy : dy / 6}px)`;
  }

  function onDragEnd(e) {
    const d = dragRef.current;
    const el = panelRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    dragRef.current = null;
    const dy = Math.max(0, e.clientY - d.startY);
    const dismiss = e.type === 'pointerup' && (dy > Math.min(140, el.offsetHeight * 0.3) || (d.v > 0.6 && dy > 8));
    if (dismiss) {
      el.setAttribute('data-drag-dismissed', '');
      el.style.transition = 'transform 200ms ease-in';
      el.style.transform = 'translateY(100%)';
      close();
    } else {
      el.style.transition = 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)';
      el.style.transform = '';
    }
  }

  if (!present) return null;

  const isBottom = resolvedSide === 'bottom';
  const panelStyle = isBottom ? styleProp : { width, ...styleProp };

  const dragHandlers = isBottom
    ? {
        onPointerDown: onDragStart,
        onPointerMove: onDragMove,
        onPointerUp: onDragEnd,
        onPointerCancel: onDragEnd,
      }
    : {};

  return (
    <Portal>
      <div className="ui-sheet-layer" data-state={state} data-side={resolvedSide}>
        <div className="ui-overlay-scrim ui-sheet-overlay" data-state={state} aria-hidden="true" />
        <div
          {...rest}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={!label && title ? titleId : undefined}
          aria-label={label || (!title ? (isBottom ? 'Bottom sheet' : 'Side panel') : undefined)}
          aria-describedby={description != null ? descriptionId : undefined}
          tabIndex={-1}
          data-state={state}
          data-side={resolvedSide}
          className={cx('ui-sheet', className)}
          style={panelStyle}
        >
          {isBottom ? (
            <div className="ui-sheet__grab" data-draggable={dismissable ? '' : undefined} {...dragHandlers}>
              <div className="ui-sheet__handle-row">
                <div className="ui-sheet__handle" />
              </div>
              {title && (
                <h2 id={titleId} className="ui-sheet__title">
                  {title}
                </h2>
              )}
              {description != null && (
                <p id={descriptionId} className="ui-sheet__description">
                  {description}
                </p>
              )}
              {dismissable && (
                <button type="button" className="sr-only" onClick={close}>
                  Close
                </button>
              )}
            </div>
          ) : (
            (title || description != null || dismissable) && (
              <div className="ui-sheet__header">
                <div className="ui-sheet__titles">
                  {title && (
                    <h2 id={titleId} className="ui-sheet__title">
                      {title}
                    </h2>
                  )}
                  {description != null && (
                    <p id={descriptionId} className="ui-sheet__description">
                      {description}
                    </p>
                  )}
                </div>
                {dismissable && <DialogCloseButton onClick={close} />}
              </div>
            )
          )}

          <div className={cx('ui-sheet__body', bodyClassName)} data-footer={footer != null ? '' : undefined}>
            {children}
          </div>

          {footer != null && <div className="ui-sheet__footer">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
