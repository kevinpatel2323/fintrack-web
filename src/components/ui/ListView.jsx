import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, X } from 'lucide-react';
import { useStableId } from './internal/floating.js';
import { cx, useControllableState, usePresence } from './internal/dialogUtils.js';
import './ListView.css';

/**
 * Config-driven list / table — a port of frappe-ui's list molecule (List,
 * ListHeader, ListHeaderCell(+Sort), ListRow, ListCell, ListGroup) plus the
 * floating "N selected" banner from frappe-ui's classic ListView.
 *
 * One CSS grid template, built from `columns[].width`, drives the header and
 * every row. Columns with `hideBelow` drop out of the template (and the cell
 * hides) under that breakpoint. When the tracks need more room than there
 * is, the list scrolls sideways inside its own box — never the page.
 */

const DEFAULT_TRACK_MIN = 96;
const TIERS = [
  ['xs', ['sm', 'md', 'lg']],
  ['sm', ['md', 'lg']],
  ['md', ['lg']],
  ['lg', []],
];

function toTrack(width) {
  if (width == null || width === '') return `minmax(${DEFAULT_TRACK_MIN}px, 1fr)`;
  if (typeof width === 'number') return `${width}px`;
  const w = String(width).trim();
  // A bare `Nfr` gets a floor so the column cannot collapse to nothing.
  if (/^\d*\.?\d+fr$/.test(w)) return `minmax(${DEFAULT_TRACK_MIN}px, ${w})`;
  return w;
}

function trackMin(track) {
  let m = /^(\d*\.?\d+)px$/.exec(track);
  if (m) return Number(m[1]);
  m = /^minmax\(\s*(\d*\.?\d+)px\s*,/.exec(track);
  if (m) return Number(m[1]);
  return 0;
}

function templateVars(columns, selectable) {
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

const INTERACTIVE_INSIDE = 'a, button, input, select, textarea, label, summary, [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [data-row-click-ignore]';

const SKELETON_WIDTHS = [72, 48, 60, 84, 40, 66];

export default function ListView({
  columns = [],
  rows = [],
  rowKey = 'id',
  onRowClick,
  rowHref,
  selectable = false,
  selection: selectionProp,
  onSelectionChange,
  selectionActions,
  sort,
  onSortChange,
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

  // Groups: collapsed state starts from `groups[].collapsed`, then is ours.
  const [collapsed, setCollapsed] = useState(() => {
    const init = {};
    (groups || []).forEach((g) => {
      if (g.collapsed) init[g.key] = true;
    });
    return init;
  });

  const allRows = useMemo(() => (groups ? groups.flatMap((g) => g.rows || []) : rows || []), [groups, rows]);
  const allKeys = useMemo(() => allRows.map((r, i) => keyOf(r, i)), [allRows, keyOf]);
  const selectedSet = useMemo(() => new Set(selection || []), [selection]);
  const selectedCount = useMemo(() => allKeys.filter((k) => selectedSet.has(k)).length, [allKeys, selectedSet]);
  const allSelected = allKeys.length > 0 && selectedCount === allKeys.length;
  const headerState = allSelected ? 'checked' : selectedCount > 0 ? 'mixed' : 'unchecked';

  const style = useMemo(() => ({ ...templateVars(columns, selectable), ...styleProp }), [columns, selectable, styleProp]);

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

  // ---- Sorting ----
  function toggleSort(key) {
    if (!onSortChange) return;
    if (!sort || sort.key !== key) onSortChange({ key, direction: 'asc' });
    else if (sort.direction === 'asc') onSortChange({ key, direction: 'desc' });
    else onSortChange(null);
  }

  // ---- Rows ----
  const interactive = Boolean(onRowClick || rowHref || selectable);

  function activate(row, e, flatIndex, key) {
    if (onRowClick) onRowClick(row, e);
    else if (selectable && !rowHref) toggleKey(key, flatIndex, e.shiftKey);
  }

  function focusSibling(current, dir) {
    const table = tableRef.current;
    if (!table) return;
    const all = Array.from(table.querySelectorAll('[data-row-nav]'));
    const i = all.indexOf(current);
    const next = all[i + dir];
    if (next) next.focus();
  }

  function renderRow(row, flatIndex) {
    const key = keyOf(row, flatIndex);
    const selected = selectable && selectedSet.has(key);
    const href = rowHref ? rowHref(row) : undefined;

    const onClick = (e) => {
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
        focusSibling(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
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
        {columns.map((col) => (
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
        <Link key={String(key)} to={href} {...props}>
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
        {columns.map((col, c) => (
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

  const total = allRows.length;
  const showEmpty = !loading && total === 0;

  let body;
  if (groups) {
    let offset = 0;
    body = groups.map((group) => {
      const groupRows = group.rows || [];
      const start = offset;
      offset += groupRows.length;
      const isCollapsed = !!collapsed[group.key];
      const bodyId = `${listId}-group-${String(group.key)}`;
      const count = group.count ?? groupRows.length;
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
    body = (rows || []).map((row, i) => renderRow(row, i));
  }

  const banner = usePresence(selectable && selectedCount > 0, 200);
  const selectedKeys = useMemo(() => allKeys.filter((k) => selectedSet.has(k)), [allKeys, selectedSet]);
  const bannerCountRef = useRef(selectedCount);
  if (selectedCount > 0) bannerCountRef.current = selectedCount;

  return (
    <div
      {...rest}
      className={cx('ui-list', className)}
      data-selectable={selectable ? '' : undefined}
      data-sticky={stickyHeader ? '' : undefined}
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
              {columns.map((col) => {
                const align = col.align && col.align !== 'left' ? col.align : undefined;
                const sortable = Boolean(col.sortable && onSortChange);
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
                    </div>
                  );
                }
                const Glyph = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
                const glyph = (
                  <span className="ui-list__sort-glyph" data-active={direction ? '' : undefined} aria-hidden="true">
                    <Glyph size={14} />
                  </span>
                );
                const labelText = typeof col.label === 'string' ? col.label : String(col.key);
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
                      onClick={() => toggleSort(col.key)}
                    >
                      {align === 'right' && glyph}
                      <span className="ui-list__text">{col.label}</span>
                      {align !== 'right' && glyph}
                    </button>
                  </div>
                );
              })}
              {selectable && (
                <div
                  className="ui-list__header-checkbox"
                  role="checkbox"
                  aria-checked={headerState === 'checked' ? 'true' : headerState === 'mixed' ? 'mixed' : 'false'}
                  aria-label="Select all"
                  tabIndex={total ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    if (total) toggleAll();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (total) toggleAll();
                    }
                  }}
                >
                  <CheckboxGlyph state={headerState} />
                </div>
              )}
              <div className="ui-list__header-border" aria-hidden="true" />
            </div>
          </div>

          <div role={groups ? undefined : 'rowgroup'} className="ui-list__body">
            {loading && total === 0 ? renderSkeleton(skeletonRows) : body}
            {loading && total > 0 && renderSkeleton(2, total)}
          </div>

          {showEmpty && <div className="ui-list__empty">{emptyState ?? 'No results'}</div>}
        </div>
      </div>

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

