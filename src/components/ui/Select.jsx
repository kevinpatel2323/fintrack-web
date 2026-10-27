import { forwardRef, useMemo, useState } from 'react';
import Combobox from './Combobox.jsx';

// frappe-ui 1.0.2's Select: the selection trigger opening a listbox — the
// same panel and option rows as Combobox, so every dropdown in the app looks
// and behaves alike. Long lists get the search box; short ones don't.
//
// The API stays that of a native <select>, so forms and filters written
// against one keep working: option values are compared as strings and
// `onChange` receives an event-like `{ target: { value, name } }`.

/** Lists longer than this show a search box. */
const SEARCH_THRESHOLD = 8;

function toOption(option) {
  if (option == null) return null;
  if (typeof option !== 'object') return { label: String(option), value: String(option) };
  if (option.value === undefined || option.value === null) return null;
  return { ...option, label: option.label ?? String(option.value), value: String(option.value) };
}

function toOptions(options) {
  return (options || [])
    .map((option) => {
      if (option && typeof option === 'object' && 'group' in option) {
        return { group: option.group, items: (option.options ?? option.items ?? []).map(toOption).filter(Boolean) };
      }
      return toOption(option);
    })
    .filter(Boolean);
}

function countOptions(options) {
  return options.reduce((n, o) => n + (o.items ? o.items.length : 1), 0);
}

const Select = forwardRef(function Select(
  {
    options = [],
    placeholder,
    value,
    defaultValue,
    onChange,
    name,
    searchable,
    selectClassName,
    required,
    ...rest
  },
  ref,
) {
  const normalized = useMemo(() => toOptions(options), [options]);
  const controlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(defaultValue == null ? '' : String(defaultValue));
  const current = controlled ? (value == null ? '' : String(value)) : innerValue;

  const handleChange = (next) => {
    const v = next == null ? '' : String(next);
    if (!controlled) setInnerValue(v);
    const target = { value: v, name, id: rest.id };
    onChange?.({
      type: 'change',
      target,
      currentTarget: target,
      preventDefault() {},
      stopPropagation() {},
      persist() {},
    });
  };

  return (
    <Combobox
      ref={ref}
      options={normalized}
      value={current}
      onChange={handleChange}
      placeholder={placeholder ?? 'Select…'}
      searchable={searchable ?? countOptions(normalized) > SEARCH_THRESHOLD}
      triggerClassName={selectClassName}
      aria-required={required || undefined}
      {...rest}
    />
  );
});

export default Select;
