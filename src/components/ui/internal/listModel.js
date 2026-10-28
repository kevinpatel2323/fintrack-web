/**
 * Pure rules behind ListView: column tracks, which column flexes and where
 * each resize handle sits, sorting, sub-rows and paging. No React, so the
 * behaviour is unit-testable in node (`ui/__tests__/listModel.test.ts`).
 */

export const DEFAULT_TRACK_MIN = 96;
/** Narrowest a column can be dragged when it sets no `minWidth`. */
export const RESIZE_MIN = 64;
export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

const TIERS = [
  ['xs', ['sm', 'md', 'lg']],
  ['sm', ['md', 'lg']],
  ['md', ['lg']],
  ['lg', []],
];

export function toTrack(width) {
  if (width == null || width === '') return `minmax(${DEFAULT_TRACK_MIN}px, 1fr)`;
  if (typeof width === 'number') return `${width}px`;
  const w = String(width).trim();
  // A bare `Nfr` gets a floor so the column cannot collapse to nothing.
  if (/^\d*\.?\d+fr$/.test(w)) return `minmax(${DEFAULT_TRACK_MIN}px, ${w})`;
  return w;
}

export function trackMin(track) {
  let m = /^(\d*\.?\d+)px$/.exec(track);
  if (m) return Number(m[1]);
  m = /^minmax\(\s*(\d*\.?\d+)px\s*,/.exec(track);
  if (m) return Number(m[1]);
  return 0;
}

/** `--ui-list-cols-*` / `--ui-list-min-*` per breakpoint tier, from columns with resolved widths. */
export function templateVars(columns, selectable) {
  const style = {};
  for (const [tier, hidden] of TIERS) {
    const visible = columns.filter((c) => !hidden.includes(c.hideBelow));
    const tracks = visible.map((c) => toTrack(c.width));
    const min = tracks.reduce((sum, t) => sum + trackMin(t), 0);
    style[`--ui-list-cols-${tier}`] = tracks.join(' ') || 'minmax(0, 1fr)';
    style[`--ui-list-min-${tier}`] = `calc(${min + (selectable ? 32 : 0)}px + ${Math.max(0, visible.length - 1)} * var(--ui-list-gap) + 2 * var(--ui-list-pad))`;
  }
  return style;
}

/** A column's name in words: for the Columns menu, sort tooltips and the resize handle. */
export function columnName(col) {
  const name = col.menuLabel ?? col.sortLabel ?? (typeof col.label === 'string' ? col.label : '');
  return String(name || '').trim();
}

const isFrTrack = (width) => width == null || width === '' || (typeof width === 'string' && /fr\b|fr\)/.test(width));

/**
 * The column that takes the leftover width: the one marked `flex`, else the
 * first whose track is fractional. `null` when every track is fixed.
 */
export function flexColumnKey(columns) {
  const marked = columns.find((c) => c.flex);
  if (marked) return marked.key;
  const fr = columns.find((c) => isFrTrack(c.width));
  return fr ? fr.key : null;
}

/**
 * Where each resizable column's drag handle sits: `'end'` (its right edge)
 * left of the flexible column, `'start'` (its left edge) right of it. Either
 * way the handle is on the boundary the flexible column gives way at, so the
 * boundary follows the pointer. A column is resizable when the list is, it
 * isn't the flexible one, and it has a name (blank action columns are not),
 * unless it says otherwise with `resizable`.
 */
export function resizeHandles(columns, resizable, flexKey = flexColumnKey(columns)) {
  const sides = new Map();
  if (!resizable) return sides;
  const flexIndex = flexKey == null ? -1 : columns.findIndex((c) => c.key === flexKey);
  columns.forEach((col, i) => {
    if (col.key === flexKey || col.resizable === false) return;
    if (col.resizable !== true && !columnName(col)) return;
    sides.set(col.key, flexIndex >= 0 && i > flexIndex ? 'start' : 'end');
  });
  return sides;
}

/** The track a column renders with: the user's dragged width when it has one. */
export function resolveWidth(col, { flexKey, resizable, widths }) {
  if (col.key === flexKey) {
    return typeof col.width === 'number' ? `minmax(${col.minWidth ?? col.width}px, 1fr)` : col.width;
  }
  if (resizable && widths && widths[col.key] != null) return widths[col.key];
  return col.width;
}

/** A dragged width, kept at or above the column's floor. */
export function clampWidth(col, width) {
  return Math.max(col.minWidth ?? RESIZE_MIN, Math.round(width));
}

/**
 * The sort after a header click: a new column starts in its `sortFirst`
 * direction (`'asc'` unless set; dates usually want `'desc'`), the same
 * column flips. There is always an order, as on Transactions.
 */
export function nextSort(current, col) {
  if (!current || current.key !== col.key) return { key: col.key, direction: col.sortFirst === 'desc' ? 'desc' : 'asc' };
  return { key: col.key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

const isBlank = (v) => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v));

export function compareValues(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Rows ordered by the sort column's `sortValue(row)` (or `row[key]`). Blank
 * values go last either way; ties keep their given order.
 */
export function sortRows(rows, columns, sort) {
  if (!sort || !rows?.length) return rows || [];
  const col = columns.find((c) => c.key === sort.key);
  if (!col) return rows;
  const value = col.sortValue || ((row) => row?.[col.key]);
  const dir = sort.direction === 'desc' ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: value(row) }))
    .sort((a, b) => {
      const blankA = isBlank(a.value);
      const blankB = isBlank(b.value);
      if (blankA || blankB) return blankA === blankB ? a.index - b.index : blankA ? 1 : -1;
      return compareValues(a.value, b.value) * dir || a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** Rows with each row's `subRows(row)` (an expanded group, a bill's items) right after it. */
export function flattenRows(rows, subRows) {
  if (!subRows) return rows;
  const out = [];
  for (const row of rows) {
    out.push(row);
    const children = subRows(row);
    if (children?.length) out.push(...children);
  }
  return out;
}

/**
 * Clamps `page` into range and slices the rows for it. `pageSize <= 0` means
 * "no paging" and returns everything on a single page.
 */
export function paginateRows(rows, page, pageSize) {
  if (!pageSize || pageSize <= 0) {
    return { pageRows: rows, currentPage: 1, totalPages: 1, pageStart: rows.length ? 1 : 0, pageEnd: rows.length };
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const from = (currentPage - 1) * pageSize;
  return {
    pageRows: rows.slice(from, from + pageSize),
    currentPage,
    totalPages,
    pageStart: rows.length === 0 ? 0 : from + 1,
    pageEnd: Math.min(currentPage * pageSize, rows.length),
  };
}

/**
 * Page numbers to render, with `ellipsis-*` sentinels where the run breaks.
 * Always keeps first, last and the neighbours of the current page.
 */
export function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, currentPage]);
  if (currentPage > 2) pages.add(currentPage - 1);
  if (currentPage < totalPages - 1) pages.add(currentPage + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const items = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const page = sorted[index];
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) items.push(`ellipsis-${previous}`);
    items.push(page);
  }

  return items;
}

/**
 * Columns the Columns menu lists, as `[{ id, label }]`: every named column
 * that isn't `pinned`. Accepts ListView columns (`key`) or ready choices (`id`).
 */
export function listColumnChoices(columns) {
  return (columns || [])
    .filter((c) => !c.pinned)
    .map((c) => ({ id: c.id ?? c.key, label: c.id != null && typeof c.label === 'string' ? c.label : columnName(c) }))
    .filter((c) => c.label);
}
