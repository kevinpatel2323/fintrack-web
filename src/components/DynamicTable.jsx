import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sortTableRows } from '../utils/tableSort.js';
import { filterTableRows, getPaginationItems, paginateRows } from '../utils/tableModel.js';
import './DynamicTable.css';

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const DEFAULT_MIN_WIDTH = 64;
const DEFAULT_WIDTH = 150;

/**
 * @typedef {object} DynamicTableColumn
 * @property {string}   id
 * @property {string}   header
 * @property {number}   [width]        starting width in px
 * @property {number}   [minWidth]     resize floor, default 64
 * @property {boolean}  [sortable]     header toggles asc → desc → unsorted
 * @property {boolean}  [resizable]    default true
 * @property {boolean}  [hideable]     default true; false pins it visible
 * @property {boolean}  [filterable]   default true; false excludes it from search
 * @property {'left'|'right'|'center'} [align]
 * @property {(row: any) => any}       [accessor]    value used for sort/search
 * @property {(row: any) => any}       [filterValue] search text, when it differs from accessor
 * @property {(row: any) => import('react').ReactNode} [cell]  defaults to the accessor value
 * @property {string}   [className]    applied to each body cell
 * @property {string}   [headerClassName]
 */

function loadPersisted(storageKey) {
  if (!storageKey || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePersisted(storageKey, value) {
  if (!storageKey || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* quota or private mode — persistence is a nicety, never a hard failure */
  }
}

/**
 * State that the caller may drive, but does not have to. Pages that already own
 * sort/page state (because their sort rules run over raw records before the
 * rows are mapped) pass value + onChange; everyone else gets it for free.
 */
function useOptionalControl(controlledValue, onChange, initialValue) {
  const isControlled = controlledValue !== undefined;
  const [internal, setInternal] = useState(initialValue);
  const set = useCallback(
    (next) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  return [isControlled ? controlledValue : internal, set, isControlled];
}

function SortIcon({ active, dir }) {
  return (
    <span className={`dyn-th__sort${active ? ' is-active' : ''}`} aria-hidden="true">
      {active ? (dir === 'desc' ? '▼' : '▲') : '▲'}
    </span>
  );
}

/** Dropdown listing every hideable column. Closes on outside click or Escape. */
function ColumnVisibilityMenu({ columns, hiddenById, onToggle, onReset }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const hiddenCount = columns.filter((c) => hiddenById[c.id]).length;

  return (
    <div className="dyn-colmenu" ref={ref}>
      <button
        type="button"
        className={`dyn-colmenu__trigger${hiddenCount ? ' has-hidden' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Columns{hiddenCount ? ` · ${columns.length - hiddenCount}/${columns.length}` : ''}
      </button>
      {open && (
        <div className="dyn-colmenu__panel" role="group" aria-label="Show or hide columns">
          {columns.map((c) => (
            <label key={c.id} className="dyn-colmenu__item">
              <input
                type="checkbox"
                checked={!hiddenById[c.id]}
                onChange={() => onToggle(c.id)}
              />
              <span>{c.header}</span>
            </label>
          ))}
          <button type="button" className="dyn-colmenu__reset" onClick={onReset}>
            Show all
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The shared table for every tabular surface in the app.
 *
 * Sorting, filtering and paging each work uncontrolled by default and switch to
 * controlled the moment the caller passes the matching value + handler — the
 * ledger pages need that because they sort raw records (for ledger-specific
 * tie-breaks) before mapping them into rows.
 *
 * Column widths, hidden columns and page size persist per `storageKey`.
 */
export default function DynamicTable({
  columns,
  rows,
  getRowKey = (row, index) => row?.id ?? index,

  // sort
  sort: sortProp,
  onSortChange,
  defaultSort = null,

  // filtering
  enableGlobalFilter = false,
  globalFilter: globalFilterProp,
  onGlobalFilterChange,
  searchPlaceholder = 'Search…',
  enableColumnFilters = false,

  // pagination
  paginated = true,
  page: pageProp,
  onPageChange,
  pageSize: pageSizeProp,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultPageSize = 25,

  // columns
  enableColumnVisibility = true,
  enableColumnResize = true,
  storageKey,

  // rows
  rowClassName,
  onRowClick,
  expandedIds,
  renderExpansion,

  // states & chrome
  loading = false,
  loadingMessage = 'Loading…',
  emptyMessage = 'Nothing to show.',
  filteredEmptyMessage = 'No rows match your filters.',
  maxHeight,
  toolbarLeft,
  toolbarRight,
  className = '',
  tableClassName = '',
  'aria-label': ariaLabel = 'Data table',
}) {
  const persisted = useMemo(() => loadPersisted(storageKey), [storageKey]);

  // ── column width / visibility ────────────────────────────────────────────
  const [widthsById, setWidthsById] = useState(() => {
    const initial = {};
    for (const c of columns) {
      const stored = persisted?.widths?.[c.id];
      const base = Number(stored ?? c.width ?? DEFAULT_WIDTH) || DEFAULT_WIDTH;
      initial[c.id] = Math.max(c.minWidth ?? DEFAULT_MIN_WIDTH, base);
    }
    return initial;
  });

  const [hiddenById, setHiddenById] = useState(() => {
    const initial = {};
    for (const c of columns) {
      initial[c.id] = c.hideable === false ? false : Boolean(persisted?.hidden?.[c.id]);
    }
    return initial;
  });

  // A column added after mount (labels differ per page, so the set can change)
  // needs its width and visibility seeded rather than rendering at zero width.
  useEffect(() => {
    setWidthsById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of columns) {
        if (next[c.id] === undefined) {
          next[c.id] = Math.max(c.minWidth ?? DEFAULT_MIN_WIDTH, c.width ?? DEFAULT_WIDTH);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setHiddenById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of columns) {
        if (next[c.id] === undefined) {
          next[c.id] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columns]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenById[c.id]),
    [columns, hiddenById],
  );

  const hideableColumns = useMemo(
    () => columns.filter((c) => c.hideable !== false),
    [columns],
  );

  // ── sort / filter / page state ───────────────────────────────────────────
  const [sort, setSort] = useOptionalControl(
    sortProp,
    onSortChange,
    persisted?.sort ?? defaultSort,
  );
  const [globalFilter, setGlobalFilter] = useOptionalControl(
    globalFilterProp,
    onGlobalFilterChange,
    '',
  );
  const [columnFilters, setColumnFilters] = useState({});
  const [page, setPage] = useOptionalControl(pageProp, onPageChange, 1);
  const [pageSize, setPageSize] = useOptionalControl(
    pageSizeProp,
    onPageSizeChange,
    persisted?.pageSize ?? defaultPageSize,
  );

  useEffect(() => {
    if (!storageKey) return;
    savePersisted(storageKey, { widths: widthsById, hidden: hiddenById, sort, pageSize });
  }, [storageKey, widthsById, hiddenById, sort, pageSize]);

  // ── row model ────────────────────────────────────────────────────────────
  // Sorting is skipped when the caller controls it: those rows arrive sorted.
  const sortControlled = sortProp !== undefined;
  const filterControlled = globalFilterProp !== undefined;
  const pageControlled = pageProp !== undefined;

  const filteredRows = useMemo(() => {
    // A controlled global filter means the page already applied it (usually
    // server-side); re-filtering here would double-apply it.
    if (filterControlled && !enableColumnFilters) return rows;
    return filterTableRows(
      rows,
      columns,
      filterControlled ? '' : globalFilter,
      columnFilters,
    );
  }, [rows, columns, globalFilter, columnFilters, filterControlled, enableColumnFilters]);

  const sortedRows = useMemo(
    () => (sortControlled ? filteredRows : sortTableRows(filteredRows, columns, sort)),
    [filteredRows, columns, sort, sortControlled],
  );

  const { pageRows, currentPage, totalPages, pageStart, pageEnd } = useMemo(
    () => (paginated
      ? paginateRows(sortedRows, page, pageSize)
      : { pageRows: sortedRows, currentPage: 1, totalPages: 1, pageStart: sortedRows.length ? 1 : 0, pageEnd: sortedRows.length }),
    [sortedRows, page, pageSize, paginated],
  );

  // Filtering down to fewer pages than the one being viewed would otherwise
  // strand the user on a blank page.
  useEffect(() => {
    if (paginated && !pageControlled && page > totalPages) setPage(totalPages);
  }, [paginated, pageControlled, page, totalPages, setPage]);

  // ── interactions ─────────────────────────────────────────────────────────
  const toggleSort = useCallback(
    (columnId) => {
      const col = columns.find((c) => c.id === columnId);
      if (!col?.sortable) return;
      const next = !sort || sort.columnId !== columnId
        ? { columnId, dir: 'asc' }
        : sort.dir === 'asc'
          ? { columnId, dir: 'desc' }
          // Controlled callers own the cycle and always keep a sort (the ledger
          // pages have no meaningful unsorted order); uncontrolled tables can
          // return to their natural row order.
          : sortControlled ? { columnId, dir: 'asc' } : null;
      setSort(next);
      if (!pageControlled) setPage(1);
    },
    [columns, sort, setSort, sortControlled, pageControlled, setPage],
  );

  const toggleColumn = useCallback(
    (id) => {
      const col = columns.find((c) => c.id === id);
      if (!col || col.hideable === false) return;
      setHiddenById((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        // Never let the last visible column be hidden — an empty table has no
        // affordance left to bring the columns back.
        if (columns.every((c) => next[c.id])) return prev;
        return next;
      });
    },
    [columns],
  );

  const resetColumns = useCallback(() => {
    setHiddenById((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) next[key] = false;
      return next;
    });
  }, []);

  const widthsRef = useRef(widthsById);
  useEffect(() => {
    widthsRef.current = widthsById;
  }, [widthsById]);

  const [resizingId, setResizingId] = useState(null);

  /**
   * Widens/narrows a single column and lets the table overflow into its
   * horizontal scroller, rather than stealing width from the neighbour — the
   * behaviour people expect from a spreadsheet.
   */
  const startResize = useCallback((column, event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = widthsRef.current[column.id] ?? DEFAULT_WIDTH;
    const min = column.minWidth ?? DEFAULT_MIN_WIDTH;
    setResizingId(column.id);

    function onPointerMove(e) {
      const next = Math.max(min, startWidth + (e.clientX - startX));
      setWidthsById((prev) => (prev[column.id] === next ? prev : { ...prev, [column.id]: next }));
    }
    function onPointerUp() {
      setResizingId(null);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    }

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  }, []);

  const autoFitColumn = useCallback((column) => {
    setWidthsById((prev) => ({
      ...prev,
      [column.id]: Math.max(column.minWidth ?? DEFAULT_MIN_WIDTH, column.width ?? DEFAULT_WIDTH),
    }));
  }, []);

  // ── render ───────────────────────────────────────────────────────────────
  const showToolbar =
    enableGlobalFilter || (enableColumnVisibility && hideableColumns.length > 0) || toolbarLeft || toolbarRight;

  const hasActiveFilter =
    Boolean(String(globalFilter || '').trim()) ||
    Object.values(columnFilters).some((v) => String(v ?? '').trim());

  const totalWidth = visibleColumns.reduce(
    (sum, c) => sum + (widthsById[c.id] ?? DEFAULT_WIDTH),
    0,
  );

  const toolbar = showToolbar ? (
    <div className="dyn-toolbar">
      {enableGlobalFilter && (
        <div className="dyn-search">
          <input
            type="search"
            className="dyn-search__input"
            placeholder={searchPlaceholder}
            value={globalFilter ?? ''}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              if (!pageControlled) setPage(1);
            }}
            aria-label={searchPlaceholder}
          />
        </div>
      )}
      {toolbarLeft}
      <div className="dyn-toolbar__right">
        {toolbarRight}
        {enableColumnVisibility && hideableColumns.length > 0 && (
          <ColumnVisibilityMenu
            columns={hideableColumns}
            hiddenById={hiddenById}
            onToggle={toggleColumn}
            onReset={resetColumns}
          />
        )}
      </div>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className={`dyn-table-host ${className}`.trim()}>
        {toolbar}
        <div className="dyn-state" role="status">
          <span className="dyn-state__spinner" aria-hidden="true" />
          <span>{loadingMessage}</span>
        </div>
      </div>
    );
  }

  const isEmpty = sortedRows.length === 0;

  return (
    <div className={`dyn-table-host ${className}`.trim()} data-resizing={resizingId ? 'true' : undefined}>
      {toolbar}

      <div
        className="dyn-table-scroll"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        <table
          className={`dyn-table ${tableClassName}`.trim()}
          style={{ minWidth: totalWidth || undefined }}
          aria-label={ariaLabel}
        >
          <colgroup>
            {visibleColumns.map((c) => (
              <col key={c.id} style={{ width: widthsById[c.id] ?? DEFAULT_WIDTH }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              {visibleColumns.map((col) => {
                const active = sort?.columnId === col.id;
                const canResize = enableColumnResize && col.resizable !== false;
                return (
                  <th
                    key={col.id}
                    className={[
                      'dyn-th',
                      col.align === 'right' ? 'is-right' : col.align === 'center' ? 'is-center' : '',
                      col.sortable ? 'is-sortable' : '',
                      active ? 'is-sorted' : '',
                      col.headerClassName,
                    ].filter(Boolean).join(' ')}
                    aria-sort={
                      !col.sortable ? undefined : active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                    scope="col"
                  >
                    {col.sortable ? (
                      <button type="button" className="dyn-th__btn" onClick={() => toggleSort(col.id)}>
                        <span className="dyn-th__label">{col.header}</span>
                        <SortIcon active={active} dir={sort?.dir} />
                      </button>
                    ) : (
                      <span className="dyn-th__label">{col.header}</span>
                    )}
                    {canResize && (
                      <span
                        className={`dyn-th__resizer${resizingId === col.id ? ' is-active' : ''}`}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${col.header} column`}
                        onPointerDown={(e) => startResize(col, e)}
                        onDoubleClick={() => autoFitColumn(col)}
                      />
                    )}
                  </th>
                );
              })}
            </tr>

            {enableColumnFilters && (
              <tr className="dyn-filter-row">
                {visibleColumns.map((col) => (
                  <th key={col.id} className="dyn-filter-cell">
                    {col.filterable === false ? null : (
                      <input
                        type="text"
                        className="dyn-filter-input"
                        value={columnFilters[col.id] ?? ''}
                        placeholder="Filter"
                        aria-label={`Filter by ${col.header}`}
                        onChange={(e) => {
                          const { value } = e.target;
                          setColumnFilters((prev) => ({ ...prev, [col.id]: value }));
                          if (!pageControlled) setPage(1);
                        }}
                      />
                    )}
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody>
            {isEmpty ? (
              <tr className="dyn-empty-row">
                <td colSpan={visibleColumns.length}>
                  <div className="dyn-state">
                    <span>{hasActiveFilter ? filteredEmptyMessage : emptyMessage}</span>
                    {hasActiveFilter && (
                      <button
                        type="button"
                        className="dyn-state__action"
                        onClick={() => {
                          setGlobalFilter('');
                          setColumnFilters({});
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row, index) => {
                const key = getRowKey(row, index);
                const expanded = Boolean(expandedIds?.has?.(key) || expandedIds?.has?.(row?.id));
                return (
                  <Fragment key={key}>
                    <tr
                      className={['dyn-row', onRowClick ? 'is-clickable' : '', rowClassName?.(row)]
                        .filter(Boolean).join(' ')}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {visibleColumns.map((col) => (
                        <td
                          key={col.id}
                          className={[
                            'dyn-td',
                            col.align === 'right' ? 'is-right' : col.align === 'center' ? 'is-center' : '',
                            col.className,
                          ].filter(Boolean).join(' ')}
                          // Cells holding their own controls opt out of the row
                          // click, padding included — otherwise reaching for a
                          // dropdown would navigate away instead.
                          onClick={col.stopRowClick ? (e) => e.stopPropagation() : undefined}
                        >
                          {col.cell ? col.cell(row) : String(col.accessor ? col.accessor(row) : row?.[col.id] ?? '')}
                        </td>
                      ))}
                    </tr>
                    {/* Expansion rows get the visible columns so nested rows can
                        stay aligned to the parent's columns instead of
                        collapsing into a single spanned cell. */}
                    {expanded && renderExpansion?.(row, {
                      colSpan: visibleColumns.length,
                      columns: visibleColumns,
                    })}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {paginated && !isEmpty && (
        <div className="dyn-footer">
          <div className="dyn-footer__meta">
            {pageSizeOptions.length > 0 && (
              <div className="dyn-pagesize" role="group" aria-label="Rows per page">
                <span className="dyn-footer__label">Rows per page</span>
                <div className="dyn-pagesize__options">
                  {pageSizeOptions.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`dyn-pagesize__option${pageSize === size ? ' is-active' : ''}`}
                      aria-pressed={pageSize === size}
                      onClick={() => {
                        setPageSize(size);
                        setPage(1);
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <span className="dyn-footer__summary">
              Showing {pageStart}–{pageEnd} of {sortedRows.length}
            </span>
          </div>

          <div className="dyn-pager">
            <button
              type="button"
              className="dyn-pager__nav"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Prev
            </button>
            <div className="dyn-pager__pages" aria-label={`Page ${currentPage} of ${totalPages}`}>
              {getPaginationItems(currentPage, totalPages).map((item) => (typeof item === 'string' ? (
                <span key={item} className="dyn-pager__ellipsis" aria-hidden="true">…</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`dyn-pager__page${item === currentPage ? ' is-active' : ''}`}
                  aria-current={item === currentPage ? 'page' : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              )))}
            </div>
            <button
              type="button"
              className="dyn-pager__nav"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
