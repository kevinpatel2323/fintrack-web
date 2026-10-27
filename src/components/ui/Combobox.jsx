import { forwardRef, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import Portal from '../Portal.jsx';
import { useDismiss, useFloating, useStableId } from './internal/floating.js';
import './Select.css';
import './Combobox.css';

// Port of frappe-ui 1.0.2 Combobox.vue (button-trigger mode) +
// ComboboxResults.vue. The trigger is the Select trigger; the popover holds a
// search input and a listbox. Typing filters by label/value and ranks the
// matches (exact → prefix → word prefix → anywhere). Keyboard: ↑/↓ move,
// Enter picks, Escape closes, Tab leaves; typing on the closed trigger opens
// it with that text. `onChange(value)` gets the option's value (null when
// cleared).

const SIZES = new Set(['xs', 'sm', 'md', 'lg', 'xl']);
const VARIANTS = new Set(['subtle', 'outline', 'ghost']);

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function isComponentType(value) {
  if (!value || isValidElement(value)) return false;
  return typeof value === 'function' || (typeof value === 'object' && '$$typeof' in value);
}

/** Renders an option's `icon`: a lucide component, an element, or an emoji. */
function OptionIcon({ icon }) {
  if (!icon) return null;
  if (isComponentType(icon)) {
    const Icon = icon;
    return <Icon className="ui-combobox__icon" size={16} strokeWidth={1.5} aria-hidden="true" />;
  }
  if (typeof icon === 'string') {
    return (
      <span className="ui-combobox__icon ui-combobox__icon--text" aria-hidden="true">
        {icon}
      </span>
    );
  }
  return icon;
}

function normalizeOption(option) {
  if (option == null) return null;
  if (typeof option !== 'object') return { label: String(option), value: option, raw: option };
  if (option.value === undefined || option.value === null) return null;
  return {
    label: option.label ?? String(option.value),
    value: option.value,
    description: option.description,
    icon: option.icon,
    disabled: Boolean(option.disabled),
    raw: option,
  };
}

/** `[{ group, items | options }]` and plain options → groups, in order. */
export function normalizeComboboxOptions(options = []) {
  const groups = [];
  let loose = [];
  const flush = () => {
    if (!loose.length) return;
    groups.push({ key: `__ungrouped-${groups.length}`, label: null, items: loose });
    loose = [];
  };
  options.forEach((option, i) => {
    if (option && typeof option === 'object' && 'group' in option) {
      flush();
      const items = (option.items ?? option.options ?? []).map(normalizeOption).filter(Boolean);
      if (items.length) groups.push({ key: `group-${i}-${option.group}`, label: option.group, items });
      return;
    }
    const o = normalizeOption(option);
    if (o) loose.push(o);
  });
  flush();
  return groups;
}

/** How well `text` matches `query`, lower is better (frappe-ui rankMatch). */
export function rankMatch(text, query) {
  const t = String(text).toLowerCase();
  const q = query.toLowerCase();
  if (!q || t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(q))) return 2;
  return 3;
}

/** Case-insensitive label/value substring filter, ranked within each group. */
export function filterComboboxGroups(groups, query) {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((group) => {
      const items = group.items
        .map((item, index) => ({ item, index }))
        .filter(
          ({ item }) => item.label.toLowerCase().includes(q) || String(item.value).toLowerCase().includes(q),
        )
        .map((entry) => ({ ...entry, rank: rankMatch(entry.item.label, q) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map((entry) => entry.item);
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);
}

function firstEnabled(list, from = 0, dir = 1) {
  for (let i = from; i >= 0 && i < list.length; i += dir) {
    if (!list[i].disabled) return i;
  }
  return -1;
}

const Combobox = forwardRef(function Combobox(
  {
    options = [],
    value,
    onChange,
    placeholder = 'Select option',
    searchPlaceholder = 'Search',
    size = 'sm',
    variant = 'subtle',
    disabled = false,
    invalid = false,
    emptyText = 'No results',
    renderOption,
    onCreate,
    createLabel,
    clearable = false,
    prefix,
    id: idProp,
    className,
    style,
    onClick,
    onKeyDown,
    'aria-invalid': ariaInvalid,
    ...rest
  },
  ref,
) {
  const s = SIZES.has(size) ? size : 'sm';
  const v = VARIANTS.has(variant) ? variant : 'subtle';
  const autoId = useStableId('ui-combobox');
  const id = idProp ?? autoId;
  const listboxId = `${id}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const viewportRef = useRef(null);
  const { anchorRef: triggerRef, floatingRef, style: floatingStyle } = useFloating({
    open,
    placement: 'bottom-start',
    offset: 4,
    matchWidth: true,
  });

  const setTriggerRef = useCallback(
    (node) => {
      triggerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [triggerRef, ref],
  );

  const groups = useMemo(() => normalizeComboboxOptions(options), [options]);
  const allOptions = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const selected = value === undefined || value === null ? null : (allOptions.find((o) => o.value === value) ?? null);
  // A value that matches no option is kept and shown as-is (Frappe "free text").
  const hasValue = selected !== null || (value !== undefined && value !== null && value !== '');
  const displayLabel = selected ? selected.label : hasValue ? String(value) : placeholder;

  const q = query.trim();
  const visibleGroups = useMemo(() => filterComboboxGroups(groups, q), [groups, q]);
  const exactMatch = q !== '' && allOptions.some((o) => o.label.toLowerCase() === q.toLowerCase());
  const createItem =
    onCreate && q && !exactMatch
      ? { create: true, label: createLabel ? createLabel(q) : `Create “${q}”`, value: '__create__' }
      : null;

  // Navigation order: every visible option, then the create row.
  const flat = visibleGroups.flatMap((g) => g.items);
  if (createItem) flat.push(createItem);

  const optionId = (i) => `${listboxId}-option-${i}`;

  const openMenu = (initialQuery = '') => {
    if (disabled) return;
    setQuery(initialQuery);
    if (!initialQuery) {
      const sel = selected ? allOptions.indexOf(selected) : -1;
      setActiveIndex(sel >= 0 && !allOptions[sel].disabled ? sel : firstEnabled(allOptions));
    }
    setOpen(true);
  };

  const closeMenu = useCallback(
    (refocus) => {
      setOpen(false);
      setQuery('');
      if (refocus) triggerRef.current?.focus({ preventScroll: true });
    },
    [triggerRef],
  );

  useDismiss({
    active: open,
    refs: [rootRef, floatingRef],
    onDismiss: (event) => closeMenu(event?.type === 'keydown'),
  });

  // Typing highlights the best match; an empty query goes back to the
  // selected option.
  useEffect(() => {
    if (!open) return;
    if (q) {
      setActiveIndex(firstEnabled(flat));
    } else {
      const sel = selected ? flat.indexOf(selected) : -1;
      setActiveIndex(sel >= 0 && !flat[sel].disabled ? sel : firstEnabled(flat));
    }
    // Only a new query (or opening) moves the highlight, not new option objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  // The search input takes focus as the popover opens.
  useEffect(() => {
    if (open) searchRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Keep the active option in view (scrolls the list only, never the page).
  useEffect(() => {
    if (!open) return;
    const list = viewportRef.current;
    const el = list?.querySelector(`[data-index="${activeIndex}"]`);
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop - 4;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 4;
    }
  }, [activeIndex, open]);

  const choose = (item) => {
    if (!item || item.disabled) return;
    if (item.create) {
      onCreate?.(q);
    } else if (item.value !== value) {
      onChange?.(item.value);
    }
    closeMenu(true);
  };

  const move = (dir) => {
    if (!flat.length) return;
    let next;
    if (activeIndex < 0) next = dir > 0 ? firstEnabled(flat) : firstEnabled(flat, flat.length - 1, -1);
    else next = firstEnabled(flat, activeIndex + dir, dir);
    if (next >= 0) setActiveIndex(next);
  };

  const onTriggerKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openMenu();
    } else if ((event.key === 'Backspace' || event.key === 'Delete') && clearable && hasValue && !open) {
      event.preventDefault();
      onChange?.(null);
    } else if (
      !open &&
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      // Typeahead: start searching with the typed character.
      event.preventDefault();
      openMenu(event.key);
    }
  };

  const onSearchKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'PageDown':
        event.preventDefault();
        setActiveIndex(firstEnabled(flat, flat.length - 1, -1));
        break;
      case 'PageUp':
        event.preventDefault();
        setActiveIndex(firstEnabled(flat));
        break;
      case 'Enter':
        event.preventDefault();
        choose(flat[activeIndex]);
        break;
      case 'Tab':
        // Back to the trigger; a forward Tab then carries on from there.
        if (event.shiftKey) event.preventDefault();
        closeMenu(true);
        break;
      default:
        break;
    }
  };

  const showClear = clearable && hasValue && !disabled;
  const PrefixIcon = isComponentType(prefix) ? prefix : null;
  const activeId = activeIndex >= 0 && activeIndex < flat.length ? optionId(activeIndex) : undefined;

  let index = -1;
  const renderItem = (item) => {
    index += 1;
    const i = index;
    const isSelected = !item.create && selected !== null && item === selected;
    const active = i === activeIndex;
    return (
      <div
        key={item.create ? '__create__' : `${typeof item.value}:${String(item.value)}`}
        id={optionId(i)}
        role="option"
        aria-selected={isSelected}
        aria-disabled={item.disabled || undefined}
        data-index={i}
        data-highlighted={active ? '' : undefined}
        data-state={isSelected ? 'checked' : 'unchecked'}
        data-disabled={item.disabled ? '' : undefined}
        className={cx('ui-combobox__item', item.create && 'ui-combobox__item--create')}
        onMouseMove={() => {
          if (!active && !item.disabled) setActiveIndex(i);
        }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => choose(item)}
      >
        {item.create ? (
          <span className="ui-combobox__item-prefix">
            <Plus className="ui-combobox__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
          </span>
        ) : (
          item.icon && (
            <span className="ui-combobox__item-prefix">
              <OptionIcon icon={item.icon} />
            </span>
          )
        )}
        <div className="ui-combobox__item-label">
          {renderOption && !item.create ? (
            renderOption(item.raw, { active, selected: isSelected })
          ) : (
            <>
              <div className="ui-combobox__item-text">{item.label}</div>
              {item.description && <div className="ui-combobox__item-description">{item.description}</div>}
            </>
          )}
        </div>
        {isSelected && (
          <span className="ui-combobox__item-suffix">
            <Check className="ui-combobox__check" size={16} strokeWidth={1.5} aria-hidden="true" />
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={cx('ui-combobox', `ui-combobox--${s}`, showClear && 'has-clear', className)}
      style={style}
    >
      <button
        ref={setTriggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-invalid={invalid || ariaInvalid || undefined}
        data-variant={v}
        data-size={s}
        data-state={open ? 'open' : 'closed'}
        className="ui-select__trigger ui-combobox__trigger"
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          if (open) closeMenu(false);
          else openMenu();
        }}
        onKeyDown={onTriggerKeyDown}
        {...rest}
      >
        {selected?.icon ? (
          <OptionIcon icon={selected.icon} />
        ) : (
          !hasValue &&
          prefix != null &&
          (PrefixIcon ? (
            <PrefixIcon className="ui-combobox__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            prefix
          ))
        )}
        <span className={cx('ui-combobox__value', !hasValue && 'is-placeholder')}>{displayLabel}</span>
        {showClear && <span className="ui-combobox__clear-space" aria-hidden="true" />}
        <ChevronDown className="ui-combobox__chevron" size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {showClear && (
        <button
          type="button"
          className="ui-combobox__clear"
          aria-label="Clear selection"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange?.(null);
            triggerRef.current?.focus();
          }}
        >
          <X size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}

      {open && (
        <Portal>
          <div
            ref={floatingRef}
            className="ui-combobox__panel"
            data-size={s}
            style={floatingStyle}
            onMouseDown={(e) => {
              // Keep focus in the search box when the panel chrome is pressed.
              if (e.target !== searchRef.current) e.preventDefault();
            }}
          >
            <div className="ui-combobox__search">
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-activedescendant={activeId}
                aria-autocomplete="list"
                aria-label={searchPlaceholder || 'Search options'}
                autoComplete="off"
                spellCheck={false}
                placeholder={searchPlaceholder}
                className="ui-combobox__search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>
            <div ref={viewportRef} className="ui-combobox__viewport">
              {flat.length === 0 && (
                <div className="ui-combobox__empty" role="status">
                  {emptyText}
                </div>
              )}
              <div id={listboxId} role="listbox" aria-label={placeholder} className="ui-combobox__listbox">
                  {visibleGroups.map((group) =>
                    group.label ? (
                      <div
                        key={group.key}
                        role="group"
                        aria-labelledby={`${listboxId}-${group.key}`}
                        className="ui-combobox__group"
                      >
                        <div
                          id={`${listboxId}-${group.key}`}
                          role="presentation"
                          className="ui-combobox__group-label"
                        >
                          {group.label}
                        </div>
                        {group.items.map(renderItem)}
                      </div>
                    ) : (
                      <div key={group.key} role="presentation" className="ui-combobox__group">
                        {group.items.map(renderItem)}
                      </div>
                    ),
                  )}
                  {createItem && renderItem(createItem)}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
});

export default Combobox;
