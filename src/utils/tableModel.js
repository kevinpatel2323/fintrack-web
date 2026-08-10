/**
 * Pure row-model helpers behind DynamicTable: filtering and pagination.
 * Sorting lives in `tableSort.js`. Keeping these free of React means the
 * table's behaviour is unit-testable without a DOM.
 */

/**
 * Text a column contributes to search. Columns render arbitrary JSX, so the
 * searchable value has to come from data, not from the rendered cell:
 * `filterValue` when given, else `accessor`, else the raw field.
 */
export function columnText(column, row) {
  if (!column) return '';
  const raw = column.filterValue
    ? column.filterValue(row)
    : column.accessor
      ? column.accessor(row)
      : row?.[column.id];
  if (raw == null) return '';
  return String(raw);
}

function matches(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Applies the global search box and any per-column filters.
 *
 * A column opts out of search with `filterable: false` — used for action
 * columns and for glyph-only cells that carry no text worth matching.
 *
 * @param rows           the full row set
 * @param columns        every column definition, including hidden ones
 * @param globalFilter   free text matched against all filterable columns
 * @param columnFilters  `{ [columnId]: string }`, each matched against its own column
 */
export function filterTableRows(rows, columns, globalFilter = '', columnFilters = {}) {
  const global = globalFilter.trim();
  const activeColumnFilters = Object.entries(columnFilters).filter(
    ([, value]) => String(value ?? '').trim() !== '',
  );

  if (!global && activeColumnFilters.length === 0) return rows;

  const searchable = columns.filter((c) => c.filterable !== false);

  return rows.filter((row) => {
    for (const [columnId, value] of activeColumnFilters) {
      const column = columns.find((c) => c.id === columnId);
      if (!column) continue;
      if (!matches(columnText(column, row), String(value).trim())) return false;
    }
    if (!global) return true;
    return searchable.some((column) => matches(columnText(column, row), global));
  });
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
