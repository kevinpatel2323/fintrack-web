import { useLayoutEffect, useRef } from 'react';

/**
 * Swipe down to dismiss, for a bottom sheet (Sheet with side="bottom", and
 * Dialog docked as a sheet on phones) — frappe-ui BottomSheet's gesture.
 * Spread the returned handlers on the drag area (grab handle, title). The
 * panel follows the finger downwards (upwards only with heavy resistance);
 * letting go past 30% of its height (at most 140px) or with a quick flick
 * slides it out and calls `onDismiss`, otherwise it springs back.
 *
 * Stamps `data-dragged` on the panel while it follows the finger and
 * `data-drag-dismissed` once it has been flicked away, so the CSS can drop
 * the entry/exit keyframes that would fight the inline transform.
 *
 * `shouldStart(event)` can veto a drag (e.g. a press on a button in the
 * header). `upward: false` pins it instead of letting it rubber-band up (for
 * a panel that can't paint below its own bottom edge).
 */
export function useSheetDrag({ panelRef, open, enabled, onDismiss, shouldStart, upward = true }) {
  const dragRef = useRef(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Re-opened mid-exit after a swipe: clear the drag leftovers.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    // Only after a drag: a panel that was never dragged keeps its own styles.
    if (!el.hasAttribute('data-dragged') && !el.hasAttribute('data-drag-dismissed')) return;
    el.removeAttribute('data-dragged');
    el.removeAttribute('data-drag-dismissed');
    el.style.transform = '';
    el.style.transition = '';
  }, [open, panelRef]);

  function onPointerDown(e) {
    if (!enabled || e.button !== 0) return;
    if (shouldStart && !shouldStart(e)) return;
    const el = panelRef.current;
    if (!el) return;
    dragRef.current = { id: e.pointerId, startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // A running entry animation outranks the inline transform; drop it.
    el.setAttribute('data-dragged', '');
    el.style.transition = 'none';
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    const el = panelRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    // Free downwards, heavy resistance upwards.
    el.style.transform = `translateY(${dy >= 0 ? dy : upward ? dy / 6 : 0}px)`;
  }

  function onPointerEnd(e) {
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
      onDismissRef.current?.();
    } else {
      el.style.transition = 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)';
      el.style.transform = '';
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };
}
