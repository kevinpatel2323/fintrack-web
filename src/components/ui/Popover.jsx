import { cloneElement, isValidElement, useCallback, useEffect, useRef } from 'react';
import Portal from '../Portal.jsx';
import { useDismiss, useFloating, useStableId } from './internal/floating.js';
import { cx, focusFirst, useControllableState, useMergedRef } from './internal/dialogUtils.js';
import './Popover.css';

/**
 * Click-to-open floating panel — Frappe UI's Popover (PopoverPanel shell:
 * rounded-6, surface-elevation-2, shadow-2xl, 1px black/5 ring, 80ms fade in).
 *
 * `trigger` is a single element (it gets the ref, onClick and aria wiring) or
 * a render function `({ ref, open, toggle, close, props })` — spread `props`
 * and attach `ref` yourself. `children` is content or `({ close }) => content`.
 */
export default function Popover({
  trigger,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
  offset = 4,
  matchWidth = false,
  panelClassName,
  className,
  closeOnOutsideClick = true,
  autoFocus = true,
  style: styleProp,
  ...rest
}) {
  const [open, setOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  const { anchorRef, floatingRef, style, side } = useFloating({ open, placement, offset, matchWidth });
  const id = useStableId('ui-popover');
  const dismissedOutsideRef = useRef(false);

  const close = useCallback(() => setOpen(false), [setOpen]);
  const toggle = useCallback(() => setOpen((v) => !v), [setOpen]);

  useDismiss({
    active: open,
    refs: [anchorRef, floatingRef],
    outside: closeOnOutsideClick,
    onDismiss: (e) => {
      dismissedOutsideRef.current = e?.type === 'pointerdown';
      setOpen(false);
    },
  });

  // Focus moves into the panel on open and back to the trigger on close —
  // except after an outside click, where the user has already moved on.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      dismissedOutsideRef.current = false;
      if (autoFocus) focusFirst(floatingRef.current);
    } else if (!open && wasOpenRef.current) {
      const active = document.activeElement;
      const lost = !active || active === document.body || floatingRef.current?.contains(active);
      if (!dismissedOutsideRef.current && lost) anchorRef.current?.focus?.({ preventScroll: true });
    }
    wasOpenRef.current = open;
  }, [open, autoFocus, anchorRef, floatingRef]);

  const triggerProps = {
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    'data-state': open ? 'open' : 'closed',
    onClick: toggle,
  };

  const childRef = isValidElement(trigger) ? trigger.ref : null;
  const mergedRef = useMergedRef(childRef, anchorRef);

  let triggerNode = null;
  if (typeof trigger === 'function') {
    triggerNode = trigger({ ref: anchorRef, open, toggle, close, props: triggerProps });
  } else if (isValidElement(trigger)) {
    triggerNode = cloneElement(trigger, {
      ...triggerProps,
      ref: mergedRef,
      onClick: (e) => {
        trigger.props.onClick?.(e);
        if (!e.defaultPrevented) toggle();
      },
    });
  }

  return (
    <>
      {triggerNode}
      {open && (
        <Portal>
          <div
            {...rest}
            ref={floatingRef}
            id={id}
            role="dialog"
            tabIndex={-1}
            data-state="open"
            data-side={side}
            className={cx('ui-popover', panelClassName, className)}
            style={{ ...styleProp, ...style }}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>
        </Portal>
      )}
    </>
  );
}
