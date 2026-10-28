import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';
import Select from './Select.jsx';
import { useStableId } from './internal/floating.js';
import { cx, useControllableState, usePresence } from './internal/dialogUtils.js';
import {
  DEFAULT_PAGE_SIZE, PAGE_SIZES, clampWidth, columnName, flattenRows, flexColumnKey, getPaginationItems,
  nextSort, paginateRows, resizeHandles, resolveWidth, sortRows, templateVars, toTrack, trackMin,
} from './internal/listModel.js';
import { useListSettings } from './useListSettings.js';
import './ListView.css';

/**
 * The one table every list of records renders through — a port of
 * frappe-ui's list molecule (List, ListHeader, ListHeaderCell(+Sort),
 * ListRow, ListCell, ListGroup) plus the floating "N selected" banner from
 * frappe-ui's classic ListView, with what the Transactions ledger grew on
 * top: column resizing, saved column choices, a pager and sub-rows.
 *
 * One CSS grid template, built from `columns[].width`, drives the header and
 * every row. Columns with `hideBelow` drop out of the template (and the cell
 * hides) under that breakpoint. When the tracks need more room than there
 * is, the list scrolls sideways inside its own box — never the page.
 *
 * The rules (tracks, resize handles, sorting, paging) live in
 * `internal/listModel.js`; API in `docs/overlays.md#listview`.
 */

function CheckboxGlyph({ state }) {
  return (
    <span className="ui-list-checkbox" data-state={state} aria-hidden="true">
      {state === 'checked' && (
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
        </svg>
      )}
      {state === 'mixed' && (
        <svg viewBox="0 0 16 16" fill="none">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h8" />
        </svg>
      )}
    </span>
  );
}

function cellContent(col, row) {
  const value = col.render ? col.render(row) : row?.[col.key];
  if (value == null || value === false) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    return <span className="ui-list__text">{value}</span>;
  }
  return value;
}

/** Rows-per-page and page buttons under a paged list. */
function ListPager({ total, currentPage, totalPages, pageStart, pageEnd, pageSize, pageSizes, onPageChange, onPageSizeChange }) {
  return (
    <div className="ui-list-pager">
      <label className="ui-list-pager__size">
        <span>Rows per page</span>
        <Select
          options={pageSizes.map((n) => ({ label: String(n), value: String(n) }))}
          value={String(pageSize)}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
        />
      </label>
      <div className="ui-list-pager__nav">
        <span className="ui-list-pager__range">
          {pageStart}–{pageEnd} of {total}
        </span>
        {totalPages > 1 && (
          <div className="ui-list-pager__pages">
            <Button
              variant="ghost"
              icon={ChevronLeft}
              label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            />
            {getPaginationItems(currentPage, totalPages).map((item) => (typeof item === 'string' ? (
              <span key={item} className="ui-list-pager__ellipsis" aria-hidden="true">…</span>
            ) : (
              <Button
                key={item}
                variant={item === currentPage ? 'subtle' : 'ghost'}
                label={String(item)}
                aria-label={`Page ${item}`}
                aria-current={item === currentPage ? 'page' : undefined}
                className="ui-list-pager__page"
                onClick={() => onPageChange(item)}
              />
            )))}
            <Button
              variant="ghost"
              icon={ChevronRight}
              label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const INTERACTIVE_INSIDE = 'a, button, input, select, textarea, label, summary, [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="separator"], [data-row-click-ignore]';

const SKELETON_WIDTHS = [72, 48, 60, 84, 40, 66];
const NO_PAGING = {};
const stop = (e) => e.stopPropagation();

export default function ListView({
  columns = [],
  rows = [],
  rowKey = 'id',
  onRowClick,
  rowHref,
  rowLinkState,
  subRows,
  selectable = false,
  selection: selectionProp,
  onSelectionChange,
  selectionActions,
  sort: sortProp,
  defaultSort = null,
  onSortChange,
  resizable = true,
  storageKey,
  columnSettings,
  pagination = false,
  loading = false,
  skeletonRows = 5,
  emptyState,
  groups,
  onGroupToggle,
  stickyHeader = false,
  className,
  rowClassName,
  footer,
  'aria-label': ariaLabel,
  style: styleProp,
  ...rest
}) {
  const listId = useStableId('ui-list');
  const scrollRef = useRef(null);
  const tableRef = useRef(null);
  const [overflowX, setOverflowX] = useState(false);
  const [selection, setSelection] = useControllableState(selectionProp, [], onSelectionChange);
  const lastToggledRef = useRef(null);

  const keyOf = useCallback(
    (row, i) => (typeof rowKey === 'function' ? rowKey(row, i) : row?.[rowKey] ?? i),
    [rowKey],
  );

  // ---- Column choices: hidden columns and dragged widths ----
  // A page that renders its own Columns menu hands over the shared settings;
  // otherwise the list keeps its own (saved under `storageKey`, if given).
  const pinnedIds = columns.filter((c) => c.pinned).map((c) => c.key);
  const ownSettings = useListSettings(columnSettings ? null : storageKey, {
    pinned: pinnedIds,
    defaultHidden: columns.filter((c) => c.defaultHidden).map((c) => c.key),
  });
  const settings = columnSettings || ownSettings;
  const { hidden, widths, setWidth, resetWidth } = settings;

  const shownColumns = useMemo(() => columns.filter((c) => c.pinned || !hidden[c.key]), [columns, hidden]);
  const flexKey = useMemo(() => flexColumnKey(shownColumns), [shownColumns]);
  const handles = useMemo(() => resizeHandles(shownColumns, resizable, flexKey), [shownColumns, resizable, flexKey]);
  const laidOut = useMemo(
    () => shownColumns.map((col) => ({
      ...col,
      width: resolveWidth(col, { flexKey, resizable: handles.has(col.key), widths }),
    })),
    [shownColumns, flexKey, handles, widths],
  );

  const style = useMemo(() => ({ ...templateVars(laidOut, selectable), ...styleProp }), [laidOut, selectable, styleProp]);

  // ---- Sorting ----
  // Controlled (`sort` given): the page orders the rows. Uncontrolled: the
  // list orders them by each column's `sortValue`.
  const [sort, setSort] = useControllableState(sortProp, defaultSort, onSortChange);
  const clientSort = sortProp === undefined;
  const canSort = clientSort || Boolean(onSortChange);

  // ---- Paging ----
  const paged = Boolean(pagination) && !groups;
  const paging = pagination && typeof pagination === 'object' ? pagination : NO_PAGING;
  const [page, setPage] = useControllableState(paging.page, 1, paging.onPageChange);
  const [pageSize, setPageSize] = useControllableState(
    paging.pageSize,
    paging.defaultPageSize ?? DEFAULT_PAGE_SIZE,
    paging.onPageSizeChange,
  );

  function toggleSort(col) {
    setSort(nextSort(sort, col));
    if (paged) setPage(1);
  }

  // ---- Rows: sort, then page, then sub-rows under their parents ----
  const sortedRows = useMemo(
    () => (clientSort && !groups ? sortRows(rows || [], columns, sort) : rows || []),
    [clientSort, groups, rows, columns, sort],
  );
  const pageInfo = useMemo(
    () => (paged ? paginateRows(sortedRows, page, pageSize) : null),
    [paged, sortedRows, page, pageSize],
  );
  const shownGroups = useMemo(
    () => groups?.map((g) => {
      const groupRows = clientSort ? sortRows(g.rows || [], columns, sort) : g.rows || [];
      return { ...g, rows: flattenRows(groupRows, subRows) };
    }),
    [groups, clientSort, columns, sort, subRows],
  );
  const bodyRows = useMemo(
    () => (groups ? null : flattenRows(pageInfo ? pageInfo.pageRows : sortedRows, subRows)),
    [groups, pageInfo, sortedRows, subRows],
  );

  // Groups: collapsed state starts from `groups[].collapsed`, then is ours.
  const [collapsed, setCollapsed] = useState(() => {
    const init = {};
    (groups || []).forEach((g) => {
      if (g.collapsed) init[g.key] = true;
    });
    return init;
  });

  const allRows = useMemo(() => (shownGroups ? shownGroups.flatMap((g) => g.rows) : bodyRows), [shownGroups, bodyRows]);
  const allKeys = useMemo(() => allRows.map((r, i) => keyOf(r, i)), [allRows, keyOf]);
  const selectedSet = useMemo(() => new Set(selection || []), [selection]);
  const selectedCount = useMemo(() => allKeys.filter((k) => selectedSet.has(k)).length, [allKeys, selectedSet]);
  const allSelected = allKeys.length > 0 && selectedCount === allKeys.length;
  const headerState = allSelected ? 'checked' : selectedCount > 0 ? 'mixed' : 'unchecked';

  // Scroll sideways only when the tracks actually need it, so a sticky
  // header can stick to the page whenever the list fits.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const table = tableRef.current;
    if (!scroller || !table) return undefined;
    const check = () => {
      const next = table.offsetWidth > scroller.clientWidth + 0.5;
      setOverflowX((prev) => (prev === next ? prev : next));
    };
    check();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(check);
    ro.observe(scroller);
    ro.observe(table);
    return () => ro.disconnect();
  }, []);

  // ---- Column resizing ----
  const [resizingKey, setResizingKey] = useState(null);
  const cleanupRef = useRef(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  function startResize(col, side, event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const cell = event.currentTarget.closest('.ui-list__hcell');
    const startWidth = cell ? cell.getBoundingClientRect().width : 0;
    const startX = event.clientX;
    // A handle on the column's left edge widens it as it moves left.
    const dir = side === 'start' ? -1 : 1;
    setResizingKey(col.key);

    function onMove(e) {
      setWidth(col.key, clampWidth(col, startWidth + dir * (e.clientX - startX)));
    }
    function onUp() {
      cleanupRef.current?.();
      setResizingKey(null);
      // The release can land on a header's sort button; that click must not
      // re-sort the table.
      const swallow = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 0);
    }
    cleanupRef.current?.();
    cleanupRef.current = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      cleanupRef.current = null;
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }

  // Keyboard: ← / → move the column's edge 8px (Shift: 32px).
  function keyResize(col, side, event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const cell = event.currentTarget.closest('.ui-list__hcell');
    const current = cell ? cell.getBoundingClientRect().width : 0;
    const step = (event.shiftKey ? 32 : 8) * (event.key === 'ArrowRight' ? 1 : -1);
    setWidth(col.key, clampWidth(col, current + (side === 'start' ? -step : step)));
  }

  function renderResizer(col) {
    const side = handles.get(col.key);
    if (!side) return null;
    const name = columnName(col) || String(col.key);
    const track = toTrack(col.width);
    return (
      <div
        className="ui-list__resizer"
        data-side={side}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${name.toLowerCase()} column`}
        aria-valuenow={typeof widths[col.key] === 'number' ? widths[col.key] : trackMin(track) || undefined}
        aria-valuemin={col.minWidth ?? undefined}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={(e) => startResize(col, side, e)}
        onKeyDown={(e) => keyResize(col, side, e)}
        onClick={stop}
        onDoubleClick={(e) => {
          e.stopPropagation();
          resetWidth(col.key);
        }}
      />
    );
  }

  // ---- Selection ----
  const toggleKey = useCallback(
    (key, flatIndex, shift) => {
      const willSelect = !selectedSet.has(key);
      const last = lastToggledRef.current;
      lastToggledRef.current = flatIndex;
      if (shift && last != null && last !== flatIndex) {
        const [a, b] = last < flatIndex ? [last, flatIndex] : [flatIndex, last];
        const range = allKeys.slice(a, b + 1);
        const next = new Set(selectedSet);
        range.forEach((k) => (willSelect ? next.add(k) : next.delete(k)));
        setSelection([...next]);
        return;
      }
      setSelection(willSelect ? [...(selection || []), key] : (selection || []).filter((k) => k !== key));
    },
    [allKeys, selectedSet, selection, setSelection],
  );

  const clearSelection = useCallback(() => {
    lastToggledRef.current = null;
    setSelection([]);
  }, [setSelection]);

  const selectAll = useCallback(() => {
    setSelection([...new Set([...(selection || []), ...allKeys])]);
  }, [selection, allKeys, setSelection]);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      const universe = new Set(allKeys);
      setSelection((selection || []).filter((k) => !universe.has(k)));
    } else {
      selectAll();
    }
  }, [allSelected, allKeys, selection, setSelection, selectAll]);

  // ---- Rows ----
  const interactive = Boolean(onRowClick || rowHref || selectable);

  function activate(row, e, flatIndex, key) {
    if (onRowClick) onRowClick(row, e);
    else if (selectable && !rowHref) toggleKey(key, flatIndex, e.shiftKey);
  }

  function focusRow(current, to) {
    const table = tableRef.current;
    if (!table) return;
    const all = Array.from(table.querySelectorAll('[data-row-nav]'));
    const i = all.indexOf(current);
    const next = to === 'first' ? all[0] : to === 'last' ? all[all.length - 1] : all[i + to];
    if (next) next.focus();
  }

  function renderRow(row, flatIndex) {
    const key = keyOf(row, flatIndex);
    const selected = selectable && selectedSet.has(key);
    const href = rowHref ? rowHref(row) : undefined;

    const onClick = (e) => {
      // Clicks inside portaled content (a menu or picker opened from a cell)
      // bubble here through React but never touched the row itself.
      if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) {
        if (href) e.preventDefault();
        return;
      }
      const inner = e.target instanceof Element ? e.target.closest(INTERACTIVE_INSIDE) : null;
      if (inner && inner !== e.currentTarget) {
        // A control inside the row handles its own click; never navigate.
        if (href) e.preventDefault();
        return;
      }
      if (href) {
        onRowClick?.(row, e);
        return; // Link navigates (Cmd/Ctrl-click opens a new tab natively).
      }
      activate(row, e, flatIndex, key);
    };

    const onKeyDown = (e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusRow(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        focusRow(e.currentTarget, e.key === 'Home' ? 'first' : 'last');
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (selectable) toggleKey(key, flatIndex, e.shiftKey);
        else if (!href) activate(row, e, flatIndex, key);
      } else if (e.key === 'Enter' && !href) {
        e.preventDefault();
        activate(row, e, flatIndex, key);
      }
    };

    const content = (
      <>
        {laidOut.map((col) => (
          <div
            key={col.key}
            role="cell"
            className={cx('ui-list__cell', col.className)}
            data-align={col.align && col.align !== 'left' ? col.align : undefined}
            data-hide-below={col.hideBelow}
          >
            {cellContent(col, row)}
          </div>
        ))}
        {selectable && (
          <div
            className="ui-list__row-checkbox"
            role="checkbox"
            aria-checked={selected}
            aria-label="Select row"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleKey(key, flatIndex, e.shiftKey);
            }}
          >
            <CheckboxGlyph state={selected ? 'checked' : 'unchecked'} />
          </div>
        )}
        <div className="ui-list__divider" aria-hidden="true" />
      </>
    );

    const props = {
      role: 'row',
      className: cx('ui-list__row', rowClassName?.(row)),
      'data-interactive': interactive ? '' : undefined,
      'data-selected': selected ? '' : undefined,
      'data-row-nav': interactive ? '' : undefined,
      onClick: interactive ? onClick : undefined,
      onKeyDown: interactive ? onKeyDown : undefined,
    };

    if (href) {
      return (
        <Link key={String(key)} to={href} state={rowLinkState?.(row)} {...props}>
          {content}
        </Link>
      );
    }
    return (
      <div key={String(key)} {...props} tabIndex={interactive ? 0 : undefined}>
        {content}
      </div>
    );
  }

  function renderSkeleton(count, offset = 0) {
    return Array.from({ length: count }, (_, r) => (
      <div key={`skeleton-${offset + r}`} role="row" className="ui-list__row ui-list__row--skeleton" aria-hidden="true">
        {laidOut.map((col, c) => (
          <div
            key={col.key}
            className="ui-list__cell"
            data-align={col.align && col.align !== 'left' ? col.align : undefined}
            data-hide-below={col.hideBelow}
          >
            <span
              className="ui-list__skeleton"
              style={{ width: `${SKELETON_WIDTHS[(r + c * 2 + offset) % SKELETON_WIDTHS.length]}%` }}
            />
          </div>
        ))}
        <div className="ui-list__divider" aria-hidden="true" />
      </div>
    ));
  }

  // Records, not the sub-rows shown under them.
  const total = groups ? groups.reduce((n, g) => n + (g.rows?.length || 0), 0) : sortedRows.length;
  const showEmpty = !loading && total === 0;

  let body;
  if (shownGroups) {
    let offset = 0;
    body = shownGroups.map((group) => {
      const groupRows = group.rows;
      const start = offset;
      offset += groupRows.length;
      const isCollapsed = !!collapsed[group.key];
      const bodyId = `${listId}-group-${String(group.key)}`;
      const count = group.count ?? groups.find((g) => g.key === group.key)?.rows?.length ?? groupRows.length;
      return (
        <div
          key={String(group.key)}
          role="rowgroup"
          aria-label={typeof group.label === 'string' ? group.label : undefined}
          className="ui-list__group"
          data-collapsed={isCollapsed ? '' : undefined}
        >
          <div role="row" className="ui-list__group-header">
            <div role="cell" className="ui-list__group-cell">
              <button
                type="button"
                className="ui-list__group-toggle"
                aria-expanded={!isCollapsed}
                aria-controls={bodyId}
                onClick={() => {
                  const next = !isCollapsed;
                  setCollapsed((prev) => ({ ...prev, [group.key]: next }));
                  onGroupToggle?.(group.key, next);
                }}
              >
                <ChevronDown className="ui-list__group-chevron" size={16} aria-hidden="true" />
                <span className="ui-list__group-label">{group.label}</span>
                {count != null && <span className="ui-list__group-count">{count}</span>}
              </button>
            </div>
          </div>
          <div id={bodyId} role="presentation" className="ui-list__group-rows" hidden={isCollapsed}>
            {!isCollapsed && groupRows.map((row, i) => renderRow(row, start + i))}
          </div>
        </div>
      );
    });
  } else {
    body = bodyRows.map((row, i) => renderRow(row, i));
  }

  const banner = usePresence(selectable && selectedCount > 0, 200);
  const selectedKeys = useMemo(() => allKeys.filter((k) => selectedSet.has(k)), [allKeys, selectedSet]);
  const bannerCountRef = useRef(selectedCount);
  if (selectedCount > 0) bannerCountRef.current = selectedCount;

  const empty = emptyState == null || typeof emptyState === 'string'
    ? <EmptyState size="sm" title={emptyState || 'No results'} />
    : emptyState;

  return (
    <div
      {...rest}
      className={cx('ui-list', className)}
      data-selectable={selectable ? '' : undefined}
      data-sticky={stickyHeader ? '' : undefined}
      data-resizing={resizingKey ? '' : undefined}
      style={style}
    >
      <div ref={scrollRef} className="ui-list__scroll" data-overflow={overflowX ? '' : undefined}>
        <div
          ref={tableRef}
          role="table"
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          className="ui-list__table"
        >
          <div role="rowgroup" className="ui-list__head">
            <div role="row" className="ui-list__header">
              {laidOut.map((col) => {
                const align = col.align && col.align !== 'left' ? col.align : undefined;
                const sortable = Boolean(col.sortable && canSort);
                const direction = sort && sort.key === col.key ? sort.direction : null;
                if (!sortable) {
                  return (
                    <div
                      key={col.key}
                      role="columnheader"
                      className={cx('ui-list__hcell', col.headerClassName)}
                      data-align={align}
                      data-hide-below={col.hideBelow}
                    >
                      <span className="ui-list__text">{col.label}</span>
                      {renderResizer(col)}
                    </div>
                  );
                }
                const Glyph = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
                const glyph = (
                  <span className="ui-list__sort-glyph" data-active={direction ? '' : undefined} aria-hidden="true">
                    <Glyph size={14} />
                  </span>
                );
                const labelText = columnName(col) || String(col.key);
                return (
                  <div
                    key={col.key}
                    role="columnheader"
                    aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cx('ui-list__hcell', col.headerClassName)}
                    data-align={align}
                    data-hide-below={col.hideBelow}
                  >
                    <button
                      type="button"
                      className="ui-list__sort"
                      title={`Order by ${labelText.toLowerCase()}`}
                      onClick={() => toggleSort(col)}
                    >
                      {align === 'right' && glyph}
                      <span className="ui-list__text">{col.label}</span>
                      {align !== 'right' && glyph}
                    </button>
                    {renderResizer(col)}
                  </div>
                );
              })}
              {selectable && (
                <div
                  className="ui-list__header-checkbox"
                  role="checkbox"
                  aria-checked={headerState === 'checked' ? 'true' : headerState === 'mixed' ? 'mixed' : 'false'}
                  aria-label="Select all"
                  tabIndex={allKeys.length ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    if (allKeys.length) toggleAll();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (allKeys.length) toggleAll();
                    }
                  }}
                >
                  <CheckboxGlyph state={headerState} />
                </div>
              )}
              <div className="ui-list__header-border" aria-hidden="true" />
            </div>
          </div>

          <div role={shownGroups ? undefined : 'rowgroup'} className="ui-list__body">
            {loading && total === 0 ? renderSkeleton(skeletonRows) : body}
            {loading && total > 0 && renderSkeleton(2, total)}
          </div>

          {showEmpty && <div className="ui-list__empty">{empty}</div>}
        </div>
      </div>

      {paged && !loading && total > 0 && (
        <div className="ui-list__footer">
          <ListPager
            total={total}
            currentPage={pageInfo.currentPage}
            totalPages={pageInfo.totalPages}
            pageStart={pageInfo.pageStart}
            pageEnd={pageInfo.pageEnd}
            pageSize={pageSize}
            pageSizes={paging.pageSizes ?? PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {footer != null && <div className="ui-list__footer">{footer}</div>}

      {banner.present && (
        <div className="ui-list__banner-anchor">
          <div className="ui-list-banner" data-state={banner.state} role="region" aria-label="Selection">
            <div className="ui-list-banner__start">
              <CheckboxGlyph state="checked" />
              <span className="ui-list-banner__count" aria-live="polite">
                {bannerCountRef.current} selected
              </span>
            </div>
            <div className="ui-list-banner__end">
              {selectionActions?.(selectedKeys, clearSelection)}
              <button
                type="button"
                className="ui-list-banner__btn"
                data-disabled={allSelected ? '' : undefined}
                disabled={allSelected}
                onClick={selectAll}
              >
                Select all
              </button>
              <button
                type="button"
                className="ui-list-banner__btn ui-list-banner__btn--icon"
                aria-label="Clear selection"
                onClick={clearSelection}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
