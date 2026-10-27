// Floating-element plumbing shared by every overlay in the kit (Popover,
// Dropdown, Tooltip, Combobox, DatePicker). One implementation, so they all
// place, flip and dismiss the same way.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Positions `floating` next to `anchor` in viewport coordinates (use with
 * `position: fixed`). Placement is `<side>-<align>`: side ∈ top|bottom|left|
 * right, align ∈ start|center|end (`bottom` = `bottom-center`). Flips to the
 * opposite side when the preferred one lacks room and shifts to stay on screen.
 */
export function computePosition(anchorRect, floatingRect, placement = 'bottom-start', offset = GAP) {
  const [side, align = 'center'] = placement.split('-');
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const place = (s) => {
    let top;
    let left;
    if (s === 'bottom' || s === 'top') {
      top = s === 'bottom' ? anchorRect.bottom + offset : anchorRect.top - floatingRect.height - offset;
      if (align === 'start') left = anchorRect.left;
      else if (align === 'end') left = anchorRect.right - floatingRect.width;
      else left = anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2;
    } else {
      left = s === 'right' ? anchorRect.right + offset : anchorRect.left - floatingRect.width - offset;
      if (align === 'start') top = anchorRect.top;
      else if (align === 'end') top = anchorRect.bottom - floatingRect.height;
      else top = anchorRect.top + anchorRect.height / 2 - floatingRect.height / 2;
    }
    return { top, left };
  };

  const fits = (s, pos) => {
    if (s === 'bottom') return pos.top + floatingRect.height <= vh - VIEWPORT_MARGIN;
    if (s === 'top') return pos.top >= VIEWPORT_MARGIN;
    if (s === 'right') return pos.left + floatingRect.width <= vw - VIEWPORT_MARGIN;
    return pos.left >= VIEWPORT_MARGIN;
  };

  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side];
  let finalSide = side;
  let pos = place(side);
  if (!fits(side, pos)) {
    const flipped = place(opposite);
    if (fits(opposite, flipped)) {
      finalSide = opposite;
      pos = flipped;
    }
  }

  // Shift along both axes to stay inside the viewport.
  pos.left = Math.min(Math.max(pos.left, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vw - floatingRect.width - VIEWPORT_MARGIN));
  pos.top = Math.min(Math.max(pos.top, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vh - floatingRect.height - VIEWPORT_MARGIN));

  return { top: Math.round(pos.top), left: Math.round(pos.left), side: finalSide };
}

/**
 * Keeps a floating element positioned against its anchor while `open`.
 * Returns `{ anchorRef, floatingRef, style, side, update }`; spread `style` on
 * the floating element (it is `position: fixed`). `matchWidth` makes the
 * floating element at least as wide as the anchor (selects, comboboxes).
 */
export function useFloating({ open, placement = 'bottom-start', offset = GAP, matchWidth = false } = {}) {
  const anchorRef = useRef(null);
  const floatingRef = useRef(null);
  const [state, setState] = useState({ top: -9999, left: -9999, side: placement.split('-')[0], minWidth: undefined });

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating) return;
    const a = anchor.getBoundingClientRect();
    const f = floating.getBoundingClientRect();
    const next = computePosition(a, f, placement, offset);
    setState((prev) => {
      const minWidth = matchWidth ? Math.round(a.width) : undefined;
      if (prev.top === next.top && prev.left === next.left && prev.side === next.side && prev.minWidth === minWidth) {
        return prev;
      }
      return { ...next, minWidth };
    });
  }, [placement, offset, matchWidth]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    update();
    // Content can change size after mount (async options, fonts).
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro && floatingRef.current) ro.observe(floatingRef.current);
    if (ro && anchorRef.current) ro.observe(anchorRef.current);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);

  const style = {
    position: 'fixed',
    top: state.top,
    left: state.left,
    minWidth: state.minWidth,
  };

  return { anchorRef, floatingRef, style, side: state.side, update };
}

/**
 * Calls `onDismiss` on a pointer-down outside every ref in `refs`, or on
 * Escape, while `active`. Escape is only honoured by the top-most active
 * layer, so a dropdown inside a dialog closes before the dialog does.
 */
const layerStack = [];

export function useDismiss({ active, refs, onDismiss, escape = true, outside = true }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    if (!active) return undefined;
    const token = {};
    layerStack.push(token);

    const onPointerDown = (e) => {
      if (!outside) return;
      if (layerStack[layerStack.length - 1] !== token) return;
      const inside = refsRef.current.some((r) => r.current && r.current.contains(e.target));
      if (!inside) onDismissRef.current?.(e);
    };
    const onKeyDown = (e) => {
      if (!escape || e.key !== 'Escape') return;
      if (layerStack[layerStack.length - 1] !== token) return;
      e.stopPropagation();
      onDismissRef.current?.(e);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      const i = layerStack.indexOf(token);
      if (i !== -1) layerStack.splice(i, 1);
    };
  }, [active, escape, outside]);
}

let idCounter = 0;
/** Stable unique id for aria wiring (React 18's useId works too). */
export function useStableId(prefix = 'ui') {
  const ref = useRef(null);
  if (ref.current === null) {
    idCounter += 1;
    ref.current = `${prefix}-${idCounter}`;
  }
  return ref.current;
}
