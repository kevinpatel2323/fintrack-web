import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { sortTableRows } from '../utils/tableSort.js';
import './DataTable.css';

const MOBILE_TABLE_MQ = '(max-width: 1099px)';

function loadPersisted(storageKey) {
  if (!storageKey || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * @typedef {object} DataTableColumn
 * @property {string} id
 * @property {string} header
 * @property {number} [defaultWidth]
 * @property {number} [minWidth]
 * @property {boolean} [sortable]
 * @property {(row: unknown) => unknown} [accessor]
 * @property {(row: unknown) => import('react').ReactNode} cell
 * @property {(row: unknown) => string} [title]
 * @property {boolean} [trim] - ellipsis + title when trim is true
 * @property {boolean} [hideable]
 * @property {boolean} [resizable]
 * @property {string} [cellClassName]
 */

export default function DataTable({
  columns: columnDefs,
  rows,
  getRowKey,
  storageKey,
  rowClassName,
  renderAfterRow,
  emptyState,
  className = '',
  scrollClassName = '',
  toolbarRight,
  mobileHeroColumnIds,
  'aria-label': ariaLabel = 'Data table',
}) {
  const useMobileCardLayout = useMediaQuery(MOBILE_TABLE_MQ);
  const persisted = useMemo(() => loadPersisted(storageKey), [storageKey]);

  const [widthsById, setWidthsById] = useState(() => {
    const initial = {};
    for (const c of columnDefs) {
      const w = persisted?.widths?.[c.id] ?? c.defaultWidth ?? 140;
      initial[c.id] = Math.max(c.minWidth ?? 72, Number(w) || 140);
    }
    return initial;
  });

  useEffect(() => {
    setWidthsById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of columnDefs) {
        if (next[c.id] === undefined) {
          next[c.id] = Math.max(c.minWidth ?? 72, c.defaultWidth ?? 140);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columnDefs]);

  const [hiddenById, setHiddenById] = useState(() => {
    const h = { ...persisted?.hidden };
    for (const c of columnDefs) {
      if (h[c.id] === undefined) h[c.id] = false;
      if (c.hideable === false) h[c.id] = false;
    }
    return h;
  });

  const [sort, setSort] = useState(() => persisted?.sort ?? null);

  const [resizeLineX, setResizeLineX] = useState(null);
  const resizeRef = useRef(null);
  const widthsRef = useRef(widthsById);
  useEffect(() => {
    widthsRef.current = widthsById;
  }, [widthsById]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          widths: widthsById,
          hidden: hiddenById,
          sort,
        }),
      );
    } catch {
      /* ignore quota */
    }
  }, [storageKey, widthsById, hiddenById, sort]);

  const visibleColumns = useMemo(
    () => columnDefs.filter((c) => !hiddenById[c.id]),
    [columnDefs, hiddenById],
  );

  const gridTemplate = useMemo(() => {
    if (visibleColumns.length === 0) return '';
    return visibleColumns.map((c) => `${widthsById[c.id]}px`).join(' ');
  }, [visibleColumns, widthsById]);

  const sortedRows = useMemo(
    () => sortTableRows(rows, columnDefs, sort),
    [rows, sort, columnDefs],
  );

  const toggleSort = useCallback(
    (columnId) => {
      const col = columnDefs.find((c) => c.id === columnId);
      if (!col?.sortable) return;
      setSort((prev) => {
        if (!prev || prev.columnId !== columnId) return { columnId, dir: 'asc' };
        if (prev.dir === 'asc') return { columnId, dir: 'desc' };
        return null;
      });
    },
    [columnDefs],
  );

  const columnDefsRef = useRef(columnDefs);
  useEffect(() => {
    columnDefsRef.current = columnDefs;
  }, [columnDefs]);

  const toggleColumn = useCallback((id) => {
    const col = columnDefs.find((c) => c.id === id);
    if (!col || col.hideable === false) return;
    setHiddenById((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const visible = columnDefs.filter((c) => !next[c.id]);
      if (visible.length < 1) return prev;
      return next;
    });
  }, [columnDefs]);

  const startResize = useCallback(
    (leftIndex, event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      event.preventDefault();
      const left = visibleColumns[leftIndex];
      const right = visibleColumns[leftIndex + 1];
      if (!left || !right) return;
      if (left.resizable === false || right.resizable === false) return;

      resizeRef.current = {
        startX: event.clientX,
        leftId: left.id,
        rightId: right.id,
        startLeft: widthsRef.current[left.id],
        startRight: widthsRef.current[right.id],
      };
      setResizeLineX(event.clientX);

      function onPointerMove(ev) {
        const state = resizeRef.current;
        if (!state) return;
        ev.preventDefault();
        const defs = columnDefsRef.current;
        const dx = ev.clientX - state.startX;
        const colL = defs.find((c) => c.id === state.leftId);
        const colR = defs.find((c) => c.id === state.rightId);
        const minL = colL?.minWidth ?? 72;
        const minR = colR?.minWidth ?? 72;
        const total = state.startLeft + state.startRight;
        const nextLeft = Math.min(
          Math.max(minL, state.startLeft + dx),
          total - minR,
        );
        const nextRight = total - nextLeft;
        setWidthsById((prev) => ({
          ...prev,
          [state.leftId]: nextLeft,
          [state.rightId]: nextRight,
        }));
        setResizeLineX(ev.clientX);
      }

      function onPointerUp() {
        resizeRef.current = null;
        setResizeLineX(null);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
      }

      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    },
    [visibleColumns],
  );

  const hideableColumns = useMemo(
    () => columnDefs.filter((c) => c.hideable !== false),
    [columnDefs],
  );

  const styleVars =
    visibleColumns.length > 0
      ? { '--data-table-columns': gridTemplate }
      : undefined;

  const heroIdsOrdered = useMemo(() => {
    if (!mobileHeroColumnIds?.length) return [];
    const visibleIds = new Set(visibleColumns.map((c) => c.id));
    return mobileHeroColumnIds.filter((id) => visibleIds.has(id));
  }, [mobileHeroColumnIds, visibleColumns]);

  const renderBodyCell = (row, col, { inHero }) => {
    const content = col.cell(row);
    const title = col.title?.(row);
    const inner =
      col.trim && title ? (
        <span className="data-table-cell-trim" title={title}>
          {content}
        </span>
      ) : col.trim ? (
        <span className="data-table-cell-trim">{content}</span>
      ) : (
        content
      );
    return (
      <div
        key={col.id}
        data-col-id={col.id}
        className={[
          'data-table-cell',
          col.cellClassName,
          inHero ? 'data-table-cell--hero' : 'data-table-cell--meta',
        ]
          .filter(Boolean)
          .join(' ')}
        role="cell"
      >
        <span className="data-table-cell-label">{col.header}</span>
        <div className="data-table-cell-value">{inner}</div>
      </div>
    );
  };

  return (
    <div className={`data-table-host ${className}`.trim()}>
      {(hideableColumns.length > 0 || toolbarRight) && (
        <div className="data-table-toolbar">
          {hideableColumns.length > 0 && (
            <details className="data-table-columns-menu">
              <summary>Columns</summary>
              <div className="data-table-columns-panel" role="group" aria-label="Show or hide columns">
                {hideableColumns.map((c) => (
                  <label key={c.id} className="data-table-column-toggle">
                    <input
                      type="checkbox"
                      checked={!hiddenById[c.id]}
                      onChange={() => toggleColumn(c.id)}
                    />
                    <span>{c.header}</span>
                  </label>
                ))}
              </div>
            </details>
          )}
          {toolbarRight ? <div className="data-table-toolbar-right">{toolbarRight}</div> : null}
        </div>
      )}

      <div className={`data-table-scroll ${scrollClassName}`.trim()}>
        {resizeLineX != null && (
          <>
            <div className="data-table-resize-overlay" aria-hidden />
            <div className="data-table-resize-line" style={{ left: resizeLineX }} aria-hidden />
          </>
        )}

        {sortedRows.length === 0 ? (
          emptyState ?? <p className="data-table-empty">No rows.</p>
        ) : (
          <div
            className="data-table"
            style={styleVars}
            role="table"
            aria-label={ariaLabel}
          >
            <div className="data-table-head" role="rowgroup" aria-hidden="true">
              {visibleColumns.map((col, index) => {
                const sorted = sort?.columnId === col.id;
                const ariaSort = !col.sortable
                  ? undefined
                  : sorted
                    ? sort.dir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none';
                return (
                  <div key={col.id} className="data-table-head-cell" role="columnheader" aria-sort={ariaSort}>
                    {col.sortable ? (
                      <button
                        type="button"
                        className="data-table-sort-btn"
                        onClick={() => toggleSort(col.id)}
                      >
                        <span>{col.header}</span>
                        {sorted ? (
                          <span className="data-table-sort-icon" aria-hidden>
                            {sort.dir === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <span className="data-table-sort-icon muted" aria-hidden>
                            ↕
                          </span>
                        )}
                      </button>
                    ) : (
                      <span className="data-table-head-static">{col.header}</span>
                    )}
                    {index < visibleColumns.length - 1 &&
                      col.resizable !== false &&
                      visibleColumns[index + 1]?.resizable !== false && (
                        <button
                          type="button"
                          className="data-table-col-resizer"
                          aria-label={`Resize column ${col.header}`}
                          onPointerDown={(e) => startResize(index, e)}
                        />
                      )}
                  </div>
                );
              })}
            </div>

            <div className="data-table-body" role="rowgroup">
              {sortedRows.map((row, rowIndex) => {
                const key = getRowKey(row, rowIndex);
                const extra = renderAfterRow?.(row);
                const rowClass = ['data-table-row', rowClassName?.(row)].filter(Boolean).join(' ');
                const showHero =
                  useMobileCardLayout && heroIdsOrdered.length > 0 && !extra;

                if (showHero) {
                  const heroCols = heroIdsOrdered
                    .map((id) => visibleColumns.find((c) => c.id === id))
                    .filter(Boolean);
                  const bodyCols = visibleColumns.filter((c) => !heroIdsOrdered.includes(c.id));
                  return (
                    <div key={key} className={rowClass} role="row">
                      <div className="data-table-mobile-hero">
                        {heroCols.map((col) => renderBodyCell(row, col, { inHero: true }))}
                      </div>
                      {bodyCols.map((col) => renderBodyCell(row, col, { inHero: false }))}
                      {extra ? (
                        <div className="data-table-row-after" role="presentation">
                          {extra}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div key={key} className={rowClass} role="row">
                    {visibleColumns.map((col) => renderBodyCell(row, col, { inHero: false }))}
                    {extra ? (
                      <div className="data-table-row-after" role="presentation">
                        {extra}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
