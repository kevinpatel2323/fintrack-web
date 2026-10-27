import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Users } from 'lucide-react';
import { Amount, AvatarGroup, Badge, Button, Combobox, EmptyState, ListView, Select } from './ui';
import { CategoryIcon } from './common/Category.jsx';
import TransactionColumnsMenu from './transactions/TransactionColumnsMenu.jsx';
import { flattenWithExpansion, signedAmount } from './transactions/transactionListModel.js';
import { useTransactionTableSettings } from './transactions/useTransactionTableSettings.js';
import { getPaginationItems, paginateRows } from '../utils/tableModel.js';
import './transactions/transactions.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export function formatDateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
}

/** Kept for existing imports: the category tile is now the shared `CategoryIcon`. */
export function TransactionCategoryGlyph({ category, size = 32 }) {
  return <CategoryIcon category={category} size={size} />;
}

/**
 * Column set both the bank ledger and the card ledger render. The labels
 * differ per page (a card row has a merchant, not a description), the
 * behaviour does not.
 */
export const DEFAULT_COLUMNS = {
  date: 'Date',
  description: 'Description',
  note: 'Note',
  category: 'Category',
  method: 'Method',
  tags: 'People',
  amount: 'Amount',
};

/** Column count including the trailing menu cell (kept for existing imports). */
export const TXN_TABLE_COLSPAN = 7;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Sorts already-normalized rows. Pages that sort their raw records before
 * mapping (to keep ledger-specific tie-breaks) do not need this; pages holding
 * only normalized rows do.
 */
export function sortTableRows(rows, col, dir) {
  const value = (r) => {
    switch (col) {
      case 'date': return r.date || '';
      case 'description': return (r.title || '').toLowerCase();
      case 'note': return (r.note || '').toLowerCase();
      case 'category': return (r.category?.name || '').toLowerCase();
      case 'method': return r.method || '';
      case 'tags': return r.people ? r.people.length : (r.tagCount ?? -1);
      // Sort on the signed ledger effect so income and spend separate.
      case 'amount': return r.isIncome ? Number(r.amount) : -Number(r.amount);
      default: return 0;
    }
  };
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Track sizes and rules per column. Description is the flexible column (it
 * takes the leftover width); the rest can be dragged wider or narrower.
 */
const COLUMN_SPECS = [
  { id: 'date', width: 88, min: 72 },
  { id: 'description', width: 240, min: 200, flex: true, pinned: true },
  // The UPI note / remark. Off until the user turns it on in Columns.
  { id: 'note', width: 200, min: 120, hideBelow: 'lg', defaultHidden: true },
  { id: 'category', width: 168, min: 112 },
  { id: 'method', width: 128, min: 88, hideBelow: 'lg' },
  { id: 'tags', width: 132, min: 72, hideBelow: 'lg' },
  { id: 'amount', width: 120, min: 96, align: 'right' },
];

const PINNED = COLUMN_SPECS.filter((c) => c.pinned).map((c) => c.id);
const DEFAULT_HIDDEN = COLUMN_SPECS.filter((c) => c.defaultHidden).map((c) => c.id);

/** Hideable columns as `[{ id, label }]`, for a page that renders its own Columns menu. */
export function transactionColumnChoices(columnLabels) {
  const labels = { ...DEFAULT_COLUMNS, ...(columnLabels || {}) };
  return COLUMN_SPECS.filter((c) => !c.pinned).map((c) => ({ id: c.id, label: labels[c.id] }));
}

/** Column preferences for a ledger; pass the result to both the table and its Columns menu. */
export function useTransactionColumns(storageKey) {
  return useTransactionTableSettings(storageKey, { pinned: PINNED, defaultHidden: DEFAULT_HIDDEN });
}

function stopRowClick(e) {
  e.stopPropagation();
}

const NO_CATEGORY = '__none__';

/**
 * Category, editable in place on every row: the category's icon and name, a
 * chevron on hover, and the shared category picker on click. Read-only
 * ledgers (no `onAssignCategory`) show the same icon and name.
 */
function CategoryCell({ row, categoryOptions, onAssignCategory }) {
  const name = row.category?.name;
  const face = (
    <span className={`txl-cat${name ? '' : ' is-empty'}`}>
      <CategoryIcon category={row.category} size={22} />
      <span className="txl-cat__name truncate">{name || 'Set category'}</span>
      {onAssignCategory && <ChevronDown className="txl-cat__chevron" size={14} strokeWidth={1.5} aria-hidden="true" />}
    </span>
  );
  if (!onAssignCategory) return face;
  return (
    // Options render in a portal, but React still bubbles their clicks
    // through here: stop them before they reach the row and open it.
    <div className="txl-cell-control" data-row-click-ignore onClick={stopRowClick}>
      <Combobox
        options={categoryOptions}
        value={row.categoryId ? String(row.categoryId) : NO_CATEGORY}
        onChange={(value) => {
          const next = value === NO_CATEGORY || value == null ? '' : value;
          if (next !== (row.categoryId ? String(row.categoryId) : '')) onAssignCategory(row.id, next);
        }}
        searchPlaceholder="Search categories"
        aria-label={name ? `Category: ${name}. Change category` : 'Set category'}
        triggerClassName="txl-cat-trigger"
        renderTrigger={() => face}
      />
    </div>
  );
}

function DescriptionCell({ row, expanded, onToggleExpand }) {
  return (
    <div className="txl-desc">
      {row.expandable && onToggleExpand && (
        <Button
          variant="ghost"
          size="xs"
          icon={ChevronRight}
          label={expanded ? 'Hide linked card transactions' : 'Show linked card transactions'}
          aria-expanded={expanded}
          className={cx('txl-disclosure', expanded && 'is-open')}
          onClick={() => onToggleExpand(row.id)}
        />
      )}
      <div className="txl-desc__text">
        <div className="txl-desc__title">
          <span className="truncate" title={row.title || undefined}>{row.title || '—'}</span>
          {row.titleBadge}
        </div>
      </div>
    </div>
  );
}

/** Header label plus the drag handle that resizes its column. */
function HeaderLabel({ text, onResizeStart, onResizeReset }) {
  return (
    <>
      {text}
      <span
        className="txl-resizer"
        aria-hidden="true"
        onPointerDown={onResizeStart}
        onClick={stopRowClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onResizeReset();
        }}
      />
    </>
  );
}

/** Rows-per-page and page buttons under a ledger. */
function TablePager({ total, currentPage, totalPages, pageStart, pageEnd, pageSize, onPageChange, onPageSizeChange }) {
  return (
    <div className="txl-pager">
      <label className="txl-pager__size">
        <span>Rows per page</span>
        <Select
          options={PAGE_SIZE_OPTIONS.map((n) => ({ label: String(n), value: String(n) }))}
          value={String(pageSize)}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
        />
      </label>
      <div className="txl-pager__nav">
        <span className="txl-pager__range">
          {pageStart}–{pageEnd} of {total}
        </span>
        {totalPages > 1 && (
          <div className="txl-pager__pages">
            <Button
              variant="ghost"
              icon={ChevronLeft}
              label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            />
            {getPaginationItems(currentPage, totalPages).map((item) => (typeof item === 'string' ? (
              <span key={item} className="txl-pager__ellipsis" aria-hidden="true">…</span>
            ) : (
              <Button
                key={item}
                variant={item === currentPage ? 'subtle' : 'ghost'}
                label={String(item)}
                aria-label={`Page ${item}`}
                aria-current={item === currentPage ? 'page' : undefined}
                className="txl-pager__page"
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

/**
 * The desktop ledger, shared by the bank transactions page, a card's
 * transactions tab and a bill payment's covered list. Rendered through the
 * kit ListView. Callers hand over rows already normalized (see the
 * `toTableRow` mappers on each page) and already sorted — sorting rules differ
 * per ledger, so the table only reports which header was clicked.
 *
 * Row shape: `{ id, raw, date, title, subtitle, titleBadge, category,
 * categoryId, method, tagCount, amount, isIncome, expandable }`.
 *
 * Expansion: rows in `expandedIds` get the items `expansionRows(row)` returns
 * inserted after them (see `ccExpansionItems`): `kind: 'nested'` rows render
 * like any ledger row against `expansionHandlers`, `kind: 'note'` and
 * `kind: 'remainder'` render as a single muted line.
 *
 * Columns can be hidden and resized; preferences persist per `storageKey`.
 * Pass `columnSettings` (from `useTransactionColumns`) when the page renders
 * its own `TransactionColumnsMenu`; otherwise the table shows one above itself
 * unless `showColumnsMenu` is false.
 */
export default function TransactionTable({
  rows,
  columnLabels,
  categories = [],
  onAssignCategory,
  onOpenDetail,
  onOpenManage,
  sortCol,
  sortDir,
  onSort,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  expandedIds,
  onToggleExpand,
  expansionRows,
  expansionHandlers,
  loading = false,
  emptyMessage = 'No transactions match.',
  emptyState,
  // Each ledger persists its own hidden columns and widths — the bank ledger
  // and a card's ledger are different views even though the columns match.
  storageKey = 'fintrack.ledger',
  columnSettings,
  showColumnsMenu = true,
  stickyHeader = false,
  // Columns this view never shows (e.g. Date on a single day's list).
  omitColumns,
  // Extra class per ledger row, e.g. to mark rows that need attention.
  rowClassName,
  // Off for short lists that should never page (a calendar day).
  paginate = true,
  className,
}) {
  const labels = useMemo(() => ({ ...DEFAULT_COLUMNS, ...(columnLabels || {}) }), [columnLabels]);

  // The page's settings when it renders its own Columns menu; ours otherwise
  // (inert with no storage key, so the two never write over each other).
  const ownSettings = useTransactionTableSettings(columnSettings ? null : storageKey, {
    pinned: PINNED,
    defaultHidden: DEFAULT_HIDDEN,
  });
  const settings = columnSettings || ownSettings;
  const { hidden, widths, setWidth, resetWidth } = settings;

  // ── paging (controlled by the page, or local) ─────────────────────────────
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(25);
  const pageValue = page ?? localPage;
  const pageSizeValue = pageSize ?? localPageSize;
  const setPage = useCallback((p) => {
    if (page === undefined) setLocalPage(p);
    onPageChange?.(p);
  }, [page, onPageChange]);
  const setPageSize = useCallback((n) => {
    if (pageSize === undefined) setLocalPageSize(n);
    onPageSizeChange?.(n);
  }, [pageSize, onPageSizeChange]);

  const { pageRows, currentPage, totalPages, pageStart, pageEnd } = useMemo(
    () => (paginate
      ? paginateRows(rows || [], pageValue, pageSizeValue)
      : { pageRows: rows || [], currentPage: 1, totalPages: 1, pageStart: 1, pageEnd: (rows || []).length }),
    [rows, pageValue, pageSizeValue, paginate],
  );

  const items = useMemo(
    () => flattenWithExpansion(pageRows, expandedIds, expansionRows),
    [pageRows, expandedIds, expansionRows],
  );

  // ── column resizing ───────────────────────────────────────────────────────
  const [resizing, setResizing] = useState(null);
  const cleanupRef = useRef(null);

  const startResize = useCallback((spec, event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const cell = event.currentTarget.closest('.txl-hcell');
    const startWidth = cell ? cell.getBoundingClientRect().width : (widths[spec.id] ?? spec.width);
    const startX = event.clientX;
    setResizing(spec.id);

    function onMove(e) {
      setWidth(spec.id, Math.max(spec.min, Math.round(startWidth + (e.clientX - startX))));
    }
    function onUp() {
      cleanupRef.current?.();
      setResizing(null);
      // The release can land on the header's sort button; that click must
      // not re-sort the table.
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
  }, [widths, setWidth]);

  // ── columns ───────────────────────────────────────────────────────────────
  const categoryOptions = useMemo(
    () => [
      { label: 'No category', value: NO_CATEGORY, icon: <CategoryIcon category={null} size={20} /> },
      ...categories.map((c) => ({
        label: c.name,
        value: String(c.id),
        icon: <CategoryIcon category={c} size={20} />,
      })),
    ],
    [categories],
  );

  const columns = useMemo(() => {
    const nestedHandlers = expansionHandlers || {};
    const ctxFor = (item) => (item.kind === 'nested'
      ? { onAssignCategory: nestedHandlers.onAssignCategory, onOpenManage: nestedHandlers.onOpenManage, nested: true }
      : { onAssignCategory, onOpenManage, nested: false });

    const render = {
      date: (row) => <span className="txl-date">{formatDateShort(row.date)}</span>,
      description: (row) => (
        <DescriptionCell
          row={row}
          expanded={Boolean(expandedIds?.has(row.id))}
          onToggleExpand={row.kind ? undefined : onToggleExpand}
        />
      ),
      category: (row, ctx) => (
        <CategoryCell row={row} categoryOptions={categoryOptions} onAssignCategory={ctx.onAssignCategory} />
      ),
      method: (row) => <span className="txl-muted truncate">{row.method}</span>,
      note: (row) => (row.note ? (
        <span className="txl-note truncate" title={row.note}>{row.note}</span>
      ) : null),
      tags: (row) => (row.people ? (
        row.people.length > 0 ? <AvatarGroup people={row.people} size="md" max={5} label="Split with" /> : null
      ) : row.tagCount > 0 ? (
        <Badge prefix={Users} label={row.tagCount} title={`Split with ${row.tagCount} ${row.tagCount === 1 ? 'person' : 'people'}`} />
      ) : null),
      amount: (row) => <Amount value={signedAmount(row)} sign="always" />,
    };

    const cols = COLUMN_SPECS.filter(
      (spec) => (!hidden[spec.id] || spec.pinned) && !omitColumns?.includes(spec.id),
    ).map((spec) => {
      const custom = widths[spec.id];
      const width = spec.flex ? `minmax(${spec.min}px, 1fr)` : (custom ?? spec.width);
      return {
        key: spec.id,
        label: spec.flex ? labels[spec.id] : (
          <HeaderLabel
            text={labels[spec.id]}
            onResizeStart={(e) => startResize(spec, e)}
            onResizeReset={() => resetWidth(spec.id)}
          />
        ),
        width,
        align: spec.align,
        hideBelow: spec.hideBelow,
        sortable: Boolean(onSort),
        headerClassName: 'txl-hcell',
        className: `txl-cell txl-cell--${spec.id}`,
        render: (item) => {
          if (item.kind === 'note' || item.kind === 'remainder') {
            if (spec.id === 'description') return <span className="txl-note">{item.text}</span>;
            if (spec.id === 'amount' && item.kind === 'remainder') {
              return <Amount value={item.amount} decimals={2} tone="muted" />;
            }
            return null;
          }
          return render[spec.id](item, ctxFor(item));
        },
      };
    });

    if (onOpenManage || nestedHandlers.onOpenManage) {
      cols.push({
        key: 'actions',
        label: '',
        width: 36,
        align: 'right',
        className: 'txl-cell txl-cell--actions',
        render: (item) => {
          if (item.kind === 'note' || item.kind === 'remainder') return null;
          const open = ctxFor(item).onOpenManage;
          return open ? (
            <Button
              variant="ghost"
              icon={MoreHorizontal}
              label="Manage transaction"
              className="txl-manage"
              onClick={() => open(item.id)}
            />
          ) : null;
        },
      });
    }
    return cols;
  }, [
    hidden, widths, labels, categoryOptions, expandedIds, onToggleExpand, onAssignCategory, onOpenManage,
    expansionHandlers, onSort, startResize, resetWidth, omitColumns,
  ]);

  const sort = sortCol ? { key: sortCol, direction: sortDir === 'desc' ? 'desc' : 'asc' } : null;

  const handleRowClick = useCallback((item) => {
    if (item.kind === 'nested') {
      expansionHandlers?.onOpenManage?.(item.id);
      return;
    }
    if (item.kind) return;
    onOpenDetail?.(item.raw);
  }, [expansionHandlers, onOpenDetail]);

  const clickable = Boolean(onOpenDetail || expansionHandlers?.onOpenManage);
  const total = (rows || []).length;

  return (
    <div className={cx('txl-table', className)} data-resizing={resizing ? '' : undefined}>
      {!columnSettings && showColumnsMenu && (
        <div className="txl-table__bar">
          <TransactionColumnsMenu
            variant="ghost"
            columns={transactionColumnChoices(columnLabels)}
            settings={settings}
          />
        </div>
      )}
      <ListView
        aria-label="Transactions"
        className="txl-list"
        columns={columns}
        rows={loading ? [] : items}
        rowKey={(item) => item.key ?? item.id}
        rowClassName={(item) => cx(
          'txl-row',
          item.kind && `is-${item.kind}`,
          item.last && 'is-last',
          !item.kind && expandedIds?.has(item.id) && 'is-open',
          !item.kind && rowClassName?.(item),
        )}
        onRowClick={clickable ? handleRowClick : undefined}
        sort={sort}
        onSortChange={onSort ? (next) => onSort(next ? next.key : sortCol) : undefined}
        loading={loading}
        skeletonRows={8}
        stickyHeader={stickyHeader}
        emptyState={emptyState ?? <EmptyState size="sm" title={emptyMessage} />}
        footer={paginate && !loading && total > 0 ? (
          <TablePager
            total={total}
            currentPage={currentPage}
            totalPages={totalPages}
            pageStart={pageStart}
            pageEnd={pageEnd}
            pageSize={pageSizeValue}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : undefined}
      />
    </div>
  );
}
