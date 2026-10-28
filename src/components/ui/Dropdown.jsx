import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import Portal from '../Portal.jsx';
import { useDismiss, useFloating, useStableId } from './internal/floating.js';
import { cx, useControllableState, useMergedRef } from './internal/dialogUtils.js';
import { normalizeOptions, renderIcon } from './internal/menuOptions.jsx';
import ActionSheet from './ActionSheet.jsx';
import { useIsCompact } from '../../styles/breakpoints.js';
import './Popover.css';
import './Dropdown.css';

/**
 * Action menu — Frappe UI's Dropdown + Menu. Opens from `children` (the
 * trigger element; it receives `data-state="open"` while open, which our
 * Button reads for its pressed look).
 *
 * `options` is a flat list of items, groups `{ group, items }` (Frappe's
 * `options` key works too), or a mix. Item: `{ label, icon, onClick, to,
 * theme: 'red', disabled, shortcut, description, selected, condition }`.
 */

export default function Dropdown({
  options = [],
  children,
  placement = 'bottom-start',
  offset = 4,
  matchWidth = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  label,
  style: styleProp,
  ...rest
}) {
  const [open, setOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  // Phones get the same options as an action sheet instead of a floating menu.
  const asSheet = useIsCompact();
  const floatingOpen = open && !asSheet;
  const { anchorRef, floatingRef, style, side } = useFloating({ open: floatingOpen, placement, offset, matchWidth });
  const menuId = useStableId('ui-menu');
  const fallbackTriggerId = useStableId('ui-menu-trigger');

  const groups = useMemo(() => normalizeOptions(options), [options]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const enabled = useMemo(() => flat.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0), [flat]);

  const [highlight, setHighlight] = useState(-1);
  const itemRefs = useRef([]);
  const initialFocusRef = useRef('menu');
  const lastPointerRef = useRef(null);
  const typeaheadRef = useRef({ text: '', timer: 0 });

  const trigger = isValidElement(children) ? children : <button type="button" className="ui-menu-default-trigger">Options</button>;
  const triggerDisabled = !!trigger.props.disabled;
  const triggerId = trigger.props.id ?? fallbackTriggerId;
  const mergedTriggerRef = useMergedRef(trigger.ref, anchorRef);

  const focusItem = useCallback((index, scroll = false) => {
    setHighlight(index);
    const el = itemRefs.current[index];
    if (!el) return;
    el.focus({ preventScroll: true });
    if (scroll) el.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const openMenu = useCallback(
    (focus) => {
      initialFocusRef.current = focus;
      setOpen(true);
    },
    [setOpen],
  );

  const closeMenu = useCallback(
    ({ focusTrigger = true } = {}) => {
      setOpen(false);
      setHighlight(-1);
      if (focusTrigger) anchorRef.current?.focus?.({ preventScroll: true });
    },
    [setOpen, anchorRef],
  );

  useDismiss({
    active: floatingOpen,
    refs: [anchorRef, floatingRef],
    // Escape returns focus to the trigger; an outside click leaves it where the user put it.
    onDismiss: (e) => closeMenu({ focusTrigger: e?.type !== 'pointerdown' }),
  });

  // Initial focus once the menu is mounted and placed.
  useEffect(() => {
    if (!floatingOpen) {
      setHighlight(-1);
      return;
    }
    const mode = initialFocusRef.current;
    initialFocusRef.current = 'menu';
    if (mode === 'first' && enabled.length) focusItem(enabled[0]);
    else if (mode === 'last' && enabled.length) focusItem(enabled[enabled.length - 1]);
    else floatingRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatingOpen]);

  function onItemClick(item, e) {
    if (item.disabled) {
      e.preventDefault();
      return;
    }
    item.onClick?.(e);
    // Keyboard activation (detail 0) hands focus back to the trigger; after a
    // mouse pick, restoring it would only paint a stray focus ring.
    closeMenu({ focusTrigger: e.detail === 0 });
  }

  function onMenuKeyDown(e) {
    const cur = highlight;
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = enabled.find((i) => i > cur);
        if (next !== undefined) focusItem(next, true);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = cur === -1 ? enabled[enabled.length - 1] : [...enabled].reverse().find((i) => i < cur);
        if (prev !== undefined) focusItem(prev, true);
        break;
      }
      case 'Home':
      case 'PageUp':
        e.preventDefault();
        if (enabled.length) focusItem(enabled[0], true);
        break;
      case 'End':
      case 'PageDown':
        e.preventDefault();
        if (enabled.length) focusItem(enabled[enabled.length - 1], true);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (cur >= 0) itemRefs.current[cur]?.click();
        break;
      case 'Tab':
        // Close and hand focus back to the trigger; the browser then moves on
        // from there, so Tab lands on the element after the trigger.
        closeMenu({ focusTrigger: true });
        break;
      default: {
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        const ta = typeaheadRef.current;
        window.clearTimeout(ta.timer);
        ta.text += e.key.toLowerCase();
        ta.timer = window.setTimeout(() => {
          ta.text = '';
        }, 500);
        const from = ta.text.length === 1 ? cur + 1 : Math.max(cur, 0);
        const order = [...enabled.filter((i) => i >= from), ...enabled.filter((i) => i < from)];
        const match = order.find((i) => String(flat[i].label ?? '').toLowerCase().startsWith(ta.text));
        if (match !== undefined) focusItem(match, true);
      }
    }
  }

  const triggerNode = cloneElement(trigger, {
    ref: mergedTriggerRef,
    id: triggerId,
    'aria-haspopup': asSheet ? 'dialog' : 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    'data-state': open ? 'open' : 'closed',
    onPointerDown: (e) => {
      trigger.props.onPointerDown?.(e);
      lastPointerRef.current = e.pointerType;
      if (e.defaultPrevented || triggerDisabled) return;
      // A mouse opens on press, like frappe-ui (and Radix): no dead time
      // between press and menu. Touch keeps click, so scrolling still works.
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.ctrlKey) return;
      if (open) {
        closeMenu({ focusTrigger: false });
      } else {
        // Keep the trigger from taking focus so the menu can.
        e.preventDefault();
        openMenu('menu');
      }
    },
    onClick: (e) => {
      trigger.props.onClick?.(e);
      const pointer = lastPointerRef.current;
      lastPointerRef.current = null;
      if (e.defaultPrevented || triggerDisabled) return;
      if (pointer === 'mouse' && e.detail !== 0) return; // already handled on press
      if (open) closeMenu({ focusTrigger: false });
      else openMenu(e.detail === 0 ? 'first' : 'menu');
    },
    onKeyDown: (e) => {
      trigger.props.onKeyDown?.(e);
      if (e.defaultPrevented || triggerDisabled) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (open && enabled.length) focusItem(enabled[0]);
        else if (!open) openMenu('first');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (open && enabled.length) focusItem(enabled[enabled.length - 1]);
        else if (!open) openMenu('last');
      }
    },
  });

  let index = -1;
  const menu = groups.length ? (
    groups.map((group) => {
      const reserveIcon = group.items.some((it) => !!it.icon);
      const labelId = group.label ? `${menuId}-${group.key}` : undefined;
      return (
        <div key={group.key} role="group" aria-labelledby={labelId} className="ui-menu__group">
          {group.label && (
            <div id={labelId} className="ui-menu__label">
              {group.label}
            </div>
          )}
          {group.items.map((item) => {
            index += 1;
            const i = index;
            const icon = renderIcon(item.icon, 'ui-menu__icon');
            const props = {
              ref: (el) => {
                itemRefs.current[i] = el;
              },
              role: 'menuitem',
              tabIndex: -1,
              'aria-disabled': item.disabled || undefined,
              'aria-current': item.selected ? 'true' : undefined,
              'data-disabled': item.disabled ? '' : undefined,
              'data-highlighted': highlight === i ? '' : undefined,
              'data-state': item.selected ? 'checked' : undefined,
              'data-tone': item.theme === 'red' ? 'red' : undefined,
              className: cx('ui-menu__item', item.className),
              onClick: (e) => onItemClick(item, e),
              onPointerMove: () => {
                if (!item.disabled && highlight !== i) focusItem(i);
              },
              onPointerLeave: () => {
                if (highlight === i) {
                  setHighlight(-1);
                  floatingRef.current?.focus({ preventScroll: true });
                }
              },
            };
            const content = (
              <>
                {(icon || reserveIcon) && (
                  <span className="ui-menu__prefix">{icon || <span className="ui-menu__icon" />}</span>
                )}
                <span className="ui-menu__text">
                  <span className="ui-menu__item-label">{item.label}</span>
                  {item.description && <span className="ui-menu__description">{item.description}</span>}
                </span>
                {item.shortcut && (
                  <kbd className="ui-menu__shortcut" aria-hidden="true">
                    {item.shortcut}
                  </kbd>
                )}
                {/* Same check as a picked option in Select / Combobox. */}
                {item.selected && <Check className="ui-menu__check" size={16} strokeWidth={1.5} aria-hidden="true" />}
              </>
            );
            const key = item.key ?? item.label ?? i;
            if (item.to && !item.disabled) {
              return (
                <Link key={key} {...props} to={item.to} replace={item.replace} state={item.state}>
                  {content}
                </Link>
              );
            }
            return (
              <div key={key} {...props}>
                {content}
              </div>
            );
          })}
        </div>
      );
    })
  ) : (
    <div className="ui-menu__empty">No options</div>
  );

  if (asSheet) {
    return (
      <>
        {triggerNode}
        <ActionSheet
          open={open}
          onClose={() => setOpen(false)}
          title={label}
          options={options}
          className={className}
        />
      </>
    );
  }

  return (
    <>
      {triggerNode}
      {open && (
        <Portal>
          <div
            {...rest}
            ref={floatingRef}
            id={menuId}
            role="menu"
            aria-labelledby={label ? undefined : triggerId}
            aria-label={label}
            aria-orientation="vertical"
            tabIndex={-1}
            data-state="open"
            data-side={side}
            className={cx('ui-menu', className)}
            style={{ ...styleProp, ...style }}
            onKeyDown={onMenuKeyDown}
          >
            {menu}
          </div>
        </Portal>
      )}
    </>
  );
}
