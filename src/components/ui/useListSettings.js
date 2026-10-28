import { useCallback, useEffect, useState } from 'react';

/**
 * Per-table column preferences: which columns are hidden and any widths the
 * user dragged. Persisted in localStorage under the table's `storageKey`
 * (`{ hidden, colWidths }` — the format the transactions ledger always
 * stored, so earlier choices carry over). With no key the preferences live
 * in memory for as long as the table is mounted.
 *
 * ListView makes its own from `storageKey`; call this yourself only when a
 * Columns menu outside the table shares the state (`columnSettings`).
 */

function load(storageKey) {
  if (!storageKey || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(storageKey, patch) {
  if (!storageKey || typeof localStorage === 'undefined') return;
  try {
    const prev = load(storageKey) || {};
    localStorage.setItem(storageKey, JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* quota or private mode: preferences are a nicety, never a hard failure */
  }
}

/**
 * `defaultHidden` columns start hidden until the user turns them on; a choice
 * the user made (shown or hidden) is stored and always wins. `pinned`
 * columns can't be hidden.
 */
export function useListSettings(storageKey, { pinned = [], defaultHidden = [] } = {}) {
  const [hidden, setHidden] = useState(() => {
    const stored = load(storageKey)?.hidden || {};
    const defaults = Object.fromEntries(defaultHidden.filter((id) => !(id in stored)).map((id) => [id, true]));
    return { ...defaults, ...stored };
  });
  const [widths, setWidths] = useState(() => load(storageKey)?.colWidths || {});

  useEffect(() => {
    save(storageKey, { hidden, colWidths: widths });
  }, [storageKey, hidden, widths]);

  const pinnedKey = pinned.join('|');

  /** Toggle a column. The last hideable column that is still shown stays shown. */
  const toggleColumn = useCallback((id, allIds) => {
    if (pinnedKey.split('|').includes(id)) return;
    setHidden((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (allIds && allIds.every((c) => next[c])) return prev;
      return next;
    });
  }, [pinnedKey]);

  const showAllColumns = useCallback(() => setHidden({}), []);

  const setWidth = useCallback((id, width) => {
    setWidths((prev) => (prev[id] === width ? prev : { ...prev, [id]: width }));
  }, []);

  const resetWidth = useCallback((id) => {
    setWidths((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const resetWidths = useCallback(() => setWidths((prev) => (Object.keys(prev).length ? {} : prev)), []);

  return { hidden, widths, toggleColumn, showAllColumns, setWidth, resetWidth, resetWidths };
}
