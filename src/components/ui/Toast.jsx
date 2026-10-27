import { isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import Portal from '../Portal.jsx';
import { cx } from './internal/dialogUtils.js';
import './Toast.css';

/**
 * Toasts — frappe-ui's ToastProvider (vue-sonner, unstyled, bottom-right,
 * 3 visible, collapsed stack that fans out on hover). Dark `surface-gray-9`
 * card, rounded-5, shadow-xl, 360px wide; sonner's solid status glyphs.
 *
 *   toast('Saved')                         toast.success('Saved')
 *   toast({ title, description, variant, action: { label, onClick }, duration })
 *   toast.error(err.message)               toast.dismiss(id)  // no id → all
 *
 * Mount <Toaster /> once at the app root.
 */

const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 6000;
const VISIBLE_TOASTS = 3;
const GAP = 14;
const EXIT_MS = 200;
const MAX_TOASTS = 12;

// ---------- Store ----------

let toasts = []; // newest first
let counter = 0;
const listeners = new Set();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

function isOptions(value) {
  return value !== null && typeof value === 'object' && !isValidElement(value);
}

function create(input, extra, variant) {
  const base = isOptions(input) ? input : { title: input };
  const opts = isOptions(extra) ? { ...base, ...extra } : base;
  const resolvedVariant = opts.variant ?? variant ?? 'default';
  const id = opts.id ?? `toast-${(counter += 1)}`;
  const next = {
    id,
    title: opts.title ?? opts.message,
    description: opts.description,
    variant: resolvedVariant,
    action: opts.action,
    duration: opts.duration ?? (resolvedVariant === 'error' ? ERROR_DURATION : DEFAULT_DURATION),
    onDismiss: opts.onDismiss,
    removed: false,
    version: Date.now() + Math.random(),
  };
  const existing = toasts.find((t) => t.id === id);
  if (existing) {
    toasts = toasts.map((t) => (t.id === id ? next : t));
  } else {
    toasts = [next, ...toasts];
    if (toasts.length > MAX_TOASTS) toasts = toasts.slice(0, MAX_TOASTS);
  }
  emit();
  return id;
}

function dismiss(id) {
  const targets = toasts.filter((t) => !t.removed && (id === undefined || t.id === id));
  if (!targets.length) return;
  const ids = new Set(targets.map((t) => t.id));
  toasts = toasts.map((t) => (ids.has(t.id) ? { ...t, removed: true } : t));
  emit();
  targets.forEach((t) => t.onDismiss?.(t));
  window.setTimeout(() => {
    toasts = toasts.filter((t) => !(ids.has(t.id) && t.removed));
    emit();
  }, EXIT_MS);
}

export const toast = Object.assign((message, options) => create(message, options), {
  success: (message, options) => create(message, options, 'success'),
  error: (message, options) => create(message, options, 'error'),
  info: (message, options) => create(message, options, 'info'),
  warning: (message, options) => create(message, options, 'warning'),
  dismiss,
});

// ---------- Glyphs (sonner's solid status icons) ----------

const ICONS = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
      />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
      />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
      />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
      />
    </svg>
  ),
};

// ---------- Rendering ----------

function useDocumentHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

function ToastItem({ item, index, count, expanded, paused, offset, frontHeight, height, onHeight }) {
  const rowRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const remainingRef = useRef(item.duration);
  const versionRef = useRef(item.version);
  const lastIndexRef = useRef(index);
  if (!item.removed) lastIndexRef.current = index;
  const i = item.removed ? lastIndexRef.current : index;

  // Enter two frames later so the start state is painted and the transition runs.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, []);

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return undefined;
    const report = () => onHeight(item.id, el.offsetHeight);
    report();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(report) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [item.id, onHeight]);

  // Auto-dismiss timer: paused while the stack is hovered/focused or the tab is hidden.
  useEffect(() => {
    if (versionRef.current !== item.version) {
      versionRef.current = item.version;
      remainingRef.current = item.duration;
    }
    if (item.removed || paused || !Number.isFinite(item.duration)) return undefined;
    const started = Date.now();
    const timer = window.setTimeout(() => dismiss(item.id), Math.max(0, remainingRef.current));
    return () => {
      window.clearTimeout(timer);
      remainingRef.current -= Date.now() - started;
    };
  }, [item.id, item.version, item.duration, item.removed, paused]);

  const front = i === 0;
  const visible = i < VISIBLE_TOASTS;
  let transform;
  let opacity = visible ? 1 : 0;
  if (!mounted) {
    transform = 'translateY(100%)';
    opacity = 0;
  } else if (item.removed) {
    transform = front ? 'translateY(100%)' : expanded ? `translateY(${-offset}px)` : `translateY(${-GAP * i}px) scale(${1 - 0.05 * i})`;
    opacity = 0;
  } else if (expanded) {
    transform = `translateY(${-offset}px)`;
  } else {
    transform = `translateY(${-GAP * i}px) scale(${1 - 0.05 * i})`;
  }

  const clamp = !expanded && !front && frontHeight > 0;
  const style = {
    zIndex: count - i,
    transform,
    opacity,
    height: clamp ? frontHeight : height || undefined,
  };

  const icon = ICONS[item.variant];

  return (
    <li
      className="ui-toast"
      data-variant={item.variant}
      data-front={front ? '' : undefined}
      data-collapsed={clamp ? '' : undefined}
      data-removed={item.removed ? '' : undefined}
      aria-hidden={!visible || undefined}
      style={style}
    >
      <div ref={rowRef} className="ui-toast__row">
        {icon && (
          <span className="ui-toast__icon" data-icon="">
            {icon}
          </span>
        )}
        <div className="ui-toast__content">
          {item.title != null && <div className="ui-toast__title">{item.title}</div>}
          {item.description != null && <div className="ui-toast__description">{item.description}</div>}
        </div>
        {item.action && (
          <button
            type="button"
            className="ui-toast__action"
            data-action=""
            onClick={(e) => {
              item.action.onClick?.(e);
              if (!e.defaultPrevented) dismiss(item.id);
            }}
          >
            {item.action.label}
          </button>
        )}
        <button type="button" className="ui-toast__close" aria-label="Close toast" onClick={() => dismiss(item.id)}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

// Only one <Toaster /> renders the stack, however many are mounted (an app
// root plus a page that mounts its own), so toasts never show twice.
let hosts = [];
const hostListeners = new Set();

function subscribeHosts(listener) {
  hostListeners.add(listener);
  return () => hostListeners.delete(listener);
}

function getHosts() {
  return hosts;
}

function useIsPrimaryHost() {
  const tokenRef = useRef(null);
  if (!tokenRef.current) tokenRef.current = {};
  const list = useSyncExternalStore(subscribeHosts, getHosts, getHosts);
  useEffect(() => {
    const token = tokenRef.current;
    hosts = [...hosts, token];
    hostListeners.forEach((l) => l());
    return () => {
      hosts = hosts.filter((h) => h !== token);
      hostListeners.forEach((l) => l());
    };
  }, []);
  return list[0] === tokenRef.current;
}

export function Toaster(props) {
  const primary = useIsPrimaryHost();
  return primary ? <ToasterHost {...props} /> : null;
}

function ToasterHost({ className }) {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [heights, setHeights] = useState({});
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hidden = useDocumentHidden();
  // Last expanded offset per toast, so a dismissed one leaves from where it was.
  const offsetMemo = useRef({});

  const onHeight = useCallback((id, h) => {
    setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  }, []);

  // Forget heights of toasts that are gone.
  useEffect(() => {
    setHeights((prev) => {
      const keys = Object.keys(prev);
      const live = new Set(list.map((t) => t.id));
      Object.keys(offsetMemo.current).forEach((k) => {
        if (!live.has(k)) delete offsetMemo.current[k];
      });
      if (keys.every((k) => live.has(k))) return prev;
      const next = {};
      keys.forEach((k) => {
        if (live.has(k)) next[k] = prev[k];
      });
      return next;
    });
    if (list.length === 0) {
      setHovered(false);
      setFocused(false);
    }
  }, [list]);

  const active = list.filter((t) => !t.removed);
  const expanded = (hovered || focused) && active.length > 0;
  const paused = expanded || hidden;
  const frontHeight = active[0] ? heights[active[0].id] || 0 : 0;

  // Expanded offsets: each toast sits above the ones in front of it.
  const offsets = {};
  let acc = 0;
  active.forEach((t, i) => {
    offsets[t.id] = acc;
    if (i < VISIBLE_TOASTS) acc += (heights[t.id] || 0) + GAP;
  });
  const shown = Math.min(active.length, VISIBLE_TOASTS);
  const stackHeight = shown === 0 ? 0 : expanded ? acc - GAP : frontHeight + GAP * (shown - 1);

  const indexOf = new Map(active.map((t, i) => [t.id, i]));

  return (
    <Portal>
      <section
        className={cx('ui-toaster', className)}
        aria-label="Notifications"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        data-ui-toaster=""
      >
        <ol
          className="ui-toaster__list"
          data-expanded={expanded ? '' : undefined}
          data-empty={list.length === 0 ? '' : undefined}
          style={{ height: stackHeight }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
          }}
        >
          {list.map((item) => {
            const index = indexOf.has(item.id) ? indexOf.get(item.id) : 0;
            if (!item.removed) offsetMemo.current[item.id] = offsets[item.id] ?? 0;
            return (
              <ToastItem
                key={item.id}
                item={item}
                index={index}
                count={list.length}
                expanded={expanded}
                paused={paused}
                offset={offsetMemo.current[item.id] ?? 0}
                frontHeight={frontHeight}
                height={heights[item.id]}
                onHeight={onHeight}
              />
            );
          })}
        </ol>
      </section>
    </Portal>
  );
}

export default Toaster;
