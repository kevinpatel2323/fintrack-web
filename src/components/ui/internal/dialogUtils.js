// Modal plumbing shared by Dialog and Sheet (and the small helpers Popover,
// Dropdown, Tabs and ListView lean on). floating.js owns placement and
// dismissal; this file owns what only modal surfaces need: mount/unmount
// around exit animations, focus trap + restore, an inert background and the
// body scroll lock. Everything here is ref-counted so nested modals stack.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** `cx('a', cond && 'b', undefined)` → `'a b'`. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Callback ref that writes to every ref passed (object or function). */
export function assignRefs(...refs) {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else ref.current = node;
    }
  };
}

/** Memoised `assignRefs`, stable while the refs themselves are. */
export function useMergedRef(...refs) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => assignRefs(...refs), refs);
}

/**
 * `[value, setValue]` that is controlled when `value` is defined and
 * internal otherwise. `onChange` fires on every requested change either way.
 */
export function useControllableState(value, defaultValue, onChange) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const currentRef = useRef(current);
  currentRef.current = current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const set = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(currentRef.current) : next;
      if (Object.is(resolved, currentRef.current)) return;
      currentRef.current = resolved;
      if (!controlled) setInner(resolved);
      onChangeRef.current?.(resolved);
    },
    [controlled],
  );

  return [current, set];
}

/**
 * Keeps a surface mounted for `exitMs` after `open` turns false so its leave
 * animation can run. Returns `{ present, state }` — render while `present`,
 * stamp `data-state={state}` for the CSS.
 */
export function usePresence(open, exitMs = 150) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    const t = window.setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { present: open || mounted, state: open ? 'open' : 'closed' };
}

// ---------- Focus ----------

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',');

/** Keyboard-reachable descendants of `container`, in DOM order. */
export function getTabbables(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (el.tabIndex < 0) return false;
    if (el.closest('[inert]')) return false;
    if (el.getClientRects().length === 0) return false;
    return window.getComputedStyle(el).visibility !== 'hidden';
  });
}

/** Focus the `[autofocus]`/`[data-autofocus]` element, else the first tabbable, else `fallback`. */
export function focusFirst(container, { fallback = container, preferTabbable = true } = {}) {
  if (!container) return;
  const auto = container.querySelector('[autofocus], [data-autofocus]');
  const target = auto || (preferTabbable ? getTabbables(container)[0] : null) || fallback;
  target?.focus?.({ preventScroll: true });
}

// The app renders into #root; overlays portal to <body> next to it. While a
// modal is open #root is made inert so neither Tab nor a screen reader can
// reach the page behind it. Body-level portals (popovers, the toaster) stay
// interactive.
let inertCount = 0;
function setBackgroundInert(on) {
  const root = typeof document !== 'undefined' ? document.getElementById('root') : null;
  if (!root) return;
  if (on) {
    inertCount += 1;
    if (inertCount === 1) {
      root.setAttribute('inert', '');
      root.setAttribute('aria-hidden', 'true');
    }
  } else {
    inertCount = Math.max(0, inertCount - 1);
    if (inertCount === 0) {
      root.removeAttribute('inert');
      root.removeAttribute('aria-hidden');
    }
  }
}

const modalStack = [];

/**
 * Focus management for a modal surface while `active`:
 *  - moves focus inside on open (an `[autofocus]` element, else the container
 *    itself — which needs `tabIndex={-1}`), unless something inside already
 *    took it (React's `autoFocus`);
 *  - cycles Tab / Shift+Tab inside the container (top-most modal only);
 *  - makes the page behind inert;
 *  - returns focus to whatever was focused before, on close.
 */
export function useModalFocus({ active, containerRef, restoreFocus = true }) {
  // Read during render, before children commit: a child's `autoFocus` moves
  // focus in the same commit, so an effect would see the wrong element.
  const prevFocusRef = useRef(null);
  const wasActiveRef = useRef(false);
  // What had focus inside the modal when the effect last cleaned up. React's
  // StrictMode runs a new modal's effect twice in development; the first
  // cleanup hands focus back to the page, so the re-run puts it back here
  // (an `autoFocus` field) instead of on the panel.
  const insideFocusRef = useRef(null);
  if (active && !wasActiveRef.current && typeof document !== 'undefined') {
    prevFocusRef.current = document.activeElement;
  }
  wasActiveRef.current = active;

  useLayoutEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    const token = {};
    modalStack.push(token);
    setBackgroundInert(true);

    const inside = insideFocusRef.current;
    insideFocusRef.current = null;
    if (container && !container.contains(document.activeElement)) {
      if (inside && inside.isConnected && container.contains(inside)) inside.focus({ preventScroll: true });
      else focusFirst(container, { preferTabbable: false });
    }

    const onKeyDown = (e) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      if (modalStack[modalStack.length - 1] !== token) return;
      const el = containerRef.current;
      if (!el) return;
      const current = document.activeElement;
      if (!el.contains(current)) {
        // Focus sits in another body-level layer (a popover opened from this
        // modal): leave it alone. Only pull it back from nowhere.
        if (current && current !== document.body) return;
        e.preventDefault();
        (getTabbables(el)[0] || el).focus({ preventScroll: true });
        return;
      }
      const list = getTabbables(el);
      if (list.length === 0) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (current === first || current === el)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const i = modalStack.indexOf(token);
      if (i !== -1) modalStack.splice(i, 1);
      setBackgroundInert(false);
      if (container && container.contains(document.activeElement)) insideFocusRef.current = document.activeElement;
      const prev = prevFocusRef.current;
      if (!restoreFocus || !prev || typeof prev.focus !== 'function' || !prev.isConnected) return;
      const now = document.activeElement;
      // Don't yank focus from something the user deliberately moved to.
      if (!now || now === document.body || (container && container.contains(now))) {
        prev.focus({ preventScroll: true });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

// ---------- Scroll lock ----------

let lockCount = 0;
let savedBodyStyle = null;

/** Locks page scroll while `active` (ref-counted, compensates the scrollbar). */
export function useScrollLock(active) {
  useLayoutEffect(() => {
    if (!active) return undefined;
    const { body, documentElement } = document;
    if (lockCount === 0) {
      const scrollbar = window.innerWidth - documentElement.clientWidth;
      savedBodyStyle = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      if (scrollbar > 0) {
        const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${current + scrollbar}px`;
      }
      body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0 && savedBodyStyle) {
        body.style.overflow = savedBodyStyle.overflow;
        body.style.paddingRight = savedBodyStyle.paddingRight;
        savedBodyStyle = null;
      }
    };
  }, [active]);
}

// ---------- Outside-click helpers ----------

// useDismiss() treats a pointer-down outside every ref as a dismissal. These
// pseudo-refs widen "inside" to body-level layers that are not part of the
// page behind a modal: the toaster, and any kit floating layer.
export const keepOpenLayersRef = {
  current: {
    contains: (target) =>
      !!(target && typeof target.closest === 'function' && target.closest('[data-ui-toaster]')),
  },
};

/** Watches `query` (a media query string). */
export function useMatchMedia(query) {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
