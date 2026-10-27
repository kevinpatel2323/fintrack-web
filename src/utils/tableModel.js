/**
 * Pure pagination helpers behind TransactionTable's pager. Keeping them free
 * of React means the behaviour is unit-testable without a DOM.
 */

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
