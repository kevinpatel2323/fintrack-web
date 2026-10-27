import { Children, cloneElement, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Portal from '../Portal.jsx';
import { useDismiss, useFloating, useStableId } from './internal/floating.js';
import './Tooltip.css';

// Port of frappe-ui Tooltip + TooltipBubble (reka-ui underneath there).
//
// <Tooltip text="Delete"><Button icon={Trash2} label="Delete" /></Tooltip>
//
// The child is the trigger: it is cloned with a merged ref and handlers, not
// wrapped. Opens after `hoverDelay` on pointer hover, at once on keyboard
// focus; closes on leave, blur, pointer-down and Escape. The bubble is
// hoverable (WCAG 1.4.13), so the pointer can cross onto it.

const ARROW_HEIGHT = 4;
const CLOSE_GRACE_MS = 100;
// Like reka's skipDelayDuration: right after one tooltip closes, the next
// opens without the hover delay, so scanning a toolbar is not a wait per button.
const SKIP_DELAY_MS = 300;
let lastClosedAt = 0;

function assignRef(ref, node) {
  if (typeof ref === 'function') ref(node);
  else if (ref && typeof ref === 'object') ref.current = node;
}

function isFocusVisible(el) {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

export default function Tooltip({
  text,
  children,
  placement = 'top',
  hoverDelay = 500,
  offset = 4,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;
  const id = useStableId('ui-tooltip');
  const { anchorRef, floatingRef, style, side } = useFloating({
    open,
    placement,
    // reka offsets by sideOffset + arrow height: the arrow sits in the gap.
    offset: offset + ARROW_HEIGHT,
  });
  const arrowRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  // After a press (or Escape) the trigger stays quiet until the pointer leaves.
  const suppressed = useRef(false);

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };

  const show = useCallback(() => {
    clearTimers();
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    clearTimers();
    if (openRef.current) lastClosedAt = Date.now();
    setOpen(false);
  }, []);

  const scheduleOpen = () => {
    clearTimeout(closeTimer.current);
    if (open || suppressed.current) return;
    const delay = Date.now() - lastClosedAt < SKIP_DELAY_MS ? 0 : hoverDelay;
    clearTimeout(openTimer.current);
    if (delay <= 0) show();
    else openTimer.current = setTimeout(show, delay);
  };

  const scheduleClose = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(hide, CLOSE_GRACE_MS);
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (disabled) hide();
  }, [disabled, hide]);

  // Escape, top-most layer only (so Escape in a dialog closes the tooltip
  // first). Outside presses are handled below instead.
  useDismiss({
    active: open,
    refs: [anchorRef, floatingRef],
    outside: false,
    onDismiss: () => {
      suppressed.current = true;
      hide();
    },
  });

  // Close on any press outside the bubble. Listens on window in the capture
  // phase and closes synchronously, so the tooltip has left floating.js's
  // layer stack before the document-level listeners of a popover underneath
  // run. useDismiss joins the stack even with `outside: false`, and only the
  // top layer acts on outside presses, so an open tooltip would otherwise
  // stop a dropdown beneath it from closing on an outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (floatingRef.current && floatingRef.current.contains(e.target)) return;
      clearTimers();
      lastClosedAt = Date.now();
      flushSync(() => setOpen(false));
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, floatingRef]);

  // Point the arrow at the trigger's centre, even when the bubble was shifted
  // to stay on screen.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    const arrow = arrowRef.current;
    if (!anchor || !floating || !arrow) return;
    const a = anchor.getBoundingClientRect();
    const f = floating.getBoundingClientRect();
    const inset = 10;
    if (side === 'top' || side === 'bottom') {
      const x = Math.min(Math.max(a.left + a.width / 2 - f.left, inset), Math.max(inset, f.width - inset));
      arrow.style.left = `${x}px`;
      arrow.style.top = '';
    } else {
      const y = Math.min(Math.max(a.top + a.height / 2 - f.top, inset), Math.max(inset, f.height - inset));
      arrow.style.top = `${y}px`;
      arrow.style.left = '';
    }
  }, [open, side, style.top, style.left, anchorRef, floatingRef]);

  const child = Children.count(children) === 1 && isValidElement(children) ? children : null;
  const hasContent = text !== undefined && text !== null && text !== '' && text !== false;

  // Hooks above run unconditionally; from here the trigger is decorated.
  const childRef = child ? child.ref : null;
  const setTriggerRef = useCallback(
    (node) => {
      anchorRef.current = node;
      assignRef(childRef, node);
    },
    [anchorRef, childRef],
  );

  if (disabled || !hasContent) return children;

  const triggerProps = child ? child.props : {};
  const chain = (name, fn) => (e) => {
    triggerProps[name]?.(e);
    if (!e.defaultPrevented) fn(e);
  };

  const describedBy = [triggerProps['aria-describedby'], open ? id : null].filter(Boolean).join(' ') || undefined;

  const handlers = {
    ref: setTriggerRef,
    'aria-describedby': describedBy,
    onPointerEnter: chain('onPointerEnter', (e) => {
      if (e.pointerType === 'touch') return;
      scheduleOpen();
    }),
    onPointerLeave: chain('onPointerLeave', () => {
      suppressed.current = false;
      scheduleClose();
    }),
    onPointerDown: chain('onPointerDown', () => {
      suppressed.current = true;
      hide();
    }),
    onFocus: chain('onFocus', (e) => {
      if (isFocusVisible(e.target)) show();
    }),
    onBlur: chain('onBlur', () => hide()),
  };

  const trigger = child ? (
    cloneElement(child, handlers)
  ) : (
    // Text or several nodes: give them one focusable box to hang off.
    <span className="ui-tooltip-trigger" tabIndex={0} {...handlers}>
      {children}
    </span>
  );

  return (
    <>
      {trigger}
      {open && (
        <Portal>
          <div
            ref={floatingRef}
            id={id}
            role="tooltip"
            className="ui-tooltip"
            data-side={side}
            style={style}
            onPointerEnter={() => clearTimeout(closeTimer.current)}
            onPointerLeave={scheduleClose}
          >
            <div className="ui-tooltip__bubble">{text}</div>
            <svg
              ref={arrowRef}
              className="ui-tooltip__arrow"
              width="8"
              height="4"
              viewBox="0 0 30 10"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="0,0 30,0 15,10" />
            </svg>
          </div>
        </Portal>
      )}
    </>
  );
}
