import { useCallback, useEffect, useState } from 'react';

/**
 * Per-ledger column preferences: which columns are hidden and any widths the
 * user dragged. Persisted in localStorage under the ledger's `storageKey`
 * (the same key and `hidden` map the old table used, so choices carry over).
 * Widths live under `colWidths`: the old `widths` held every column's default,
 * not just the ones the user changed.
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

export function useTransactionTableSettings(storageKey, { pinned = [] } = {}) {
  const [hidden, setHidden] = useState(() => load(storageKey)?.hidden || {});
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

  return { hidden, widths, toggleColumn, showAllColumns, setWidth, resetWidth };
}
