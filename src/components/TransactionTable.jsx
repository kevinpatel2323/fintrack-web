import { useMemo } from 'react';
import DynamicTable from './DynamicTable.jsx';
import { CategoryChip, Num } from './ui/primitives.jsx';
import { IcChevR, IcMore } from './ui/Icon.jsx';
import { categoryColor } from '../utils/categoryColors.js';
import { inr } from '../utils/inr.js';
import '../styles/transactions-redesign.css';

export function formatDateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
}

export function TransactionCategoryGlyph({ category, size = 38 }) {
  const color = categoryColor(category);
  const emoji = category?.icon?.trim() || '◌';

  return (
    <div
      className={`txn-category-glyph${category?.icon ? '' : ' is-empty'}`}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
      }}
      aria-hidden="true"
    >
      <span>{emoji}</span>
    </div>
  );
}

/**
 * Column set both the bank ledger and the card ledger render. The labels
 * differ per page (a card row has a merchant, not a description), the
 * behaviour does not.
 */
export const DEFAULT_COLUMNS = {
  date: 'Date',
  description: 'Description',
  category: 'Category',
  method: 'Method',
  tags: 'Split count',
  amount: 'Amount',
};

/**
 * Full column count including the trailing menu cell. Only correct when every
 * column is visible — expansion rows should use the `colSpan` handed to
 * `renderExpansion` instead, which tracks hidden columns.
 */
export const TXN_TABLE_COLSPAN = 7;

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
      case 'category': return (r.category?.name || '').toLowerCase();
      case 'method': return r.method || '';
      case 'tags': return r.tagCount ?? -1;
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
 * The ledger's column definitions, in DynamicTable's shape. Split out so the
 * nested card rows inside an expansion can render the same cells against the
 * same visible columns.
 */
export function buildTransactionColumns({
  labels = DEFAULT_COLUMNS,
  categories = [],
  onAssignCategory,
  onOpenManage,
  expandedIds,
  onToggleExpand,
} = {}) {
  return [
    {
      id: 'date',
      header: labels.date,
      width: 110,
      minWidth: 84,
      sortable: true,
      accessor: (row) => row.date || '',
      filterValue: (row) => formatDateShort(row.date),
      cell: (row) => (
        <span style={{ fontFamily: 'var(--ft-font-mono)', fontSize: 12.5, color: 'var(--ft-text)', fontWeight: 500 }}>
          {formatDateShort(row.date)}
        </span>
      ),
    },
    {
      id: 'description',
      header: labels.description,
      width: 320,
      minWidth: 160,
      sortable: true,
      hideable: false,
      className: 'txn-cell--description',
      headerClassName: 'txn-cell--description',
      accessor: (row) => (row.title || '').toLowerCase(),
      filterValue: (row) => `${row.title || ''} ${row.subtitle || ''}`,
      cell: (row) => {
        const expanded = Boolean(expandedIds?.has(row.id));
        return (
          <div className="txn-row__desc">
            {/* The whole <tr> navigates to the detail page, so the disclosure
                must not let its click bubble. */}
            {row.expandable && (
              <button
                type="button"
                className={`txn-row__disclosure${expanded ? ' is-open' : ''}`}
                aria-label={expanded ? 'Hide linked transactions' : 'Show linked transactions'}
                aria-expanded={expanded}
                onClick={(e) => { e.stopPropagation(); onToggleExpand?.(row.id); }}
              >
                <IcChevR size={13} stroke={2} />
              </button>
            )}
            <TransactionCategoryGlyph category={row.category} size={30} />
            <div className="txn-row__desc-text">
              <div className="txn-row__title" title={row.title || undefined}>
                {row.title || '—'}
                {row.titleBadge}
              </div>
              <div className="txn-row__subtitle" title={row.subtitle || undefined}>
                {row.subtitle}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'category',
      header: labels.category,
      width: 160,
      minWidth: 110,
      sortable: true,
      // Assigning a category must not also open the row's detail page.
      stopRowClick: true,
      accessor: (row) => (row.category?.name || '').toLowerCase(),
      cell: (row) => (row.category ? (
        <CategoryChip category={row.category} />
      ) : (
        <select
          className="txn-inline-select"
          value={row.categoryId || ''}
          onChange={(e) => onAssignCategory?.(row.id, e.target.value)}
        >
          <option value="">Set category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
          ))}
        </select>
      )),
    },
    {
      id: 'method',
      header: labels.method,
      width: 120,
      minWidth: 90,
      sortable: true,
      accessor: (row) => row.method || '',
      cell: (row) => <span style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>{row.method}</span>,
    },
    {
      id: 'tags',
      header: labels.tags,
      width: 100,
      minWidth: 80,
      sortable: true,
      accessor: (row) => row.tagCount ?? -1,
      cell: (row) => (row.tagCount !== null ? (
        row.tagCount > 0 ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--ft-accent-soft)', color: 'var(--ft-accent-fg)',
            fontFamily: 'var(--ft-font-mono)', fontSize: 12, fontWeight: 600,
            padding: '2px 8px', borderRadius: 6, minWidth: 24,
          }}>
            {row.tagCount}
          </span>
        ) : <span style={{ color: 'var(--ft-text-faint)', fontSize: 12 }}>—</span>
      ) : (
        <span style={{ color: 'var(--ft-text-faint)', fontSize: 12 }}>·</span>
      )),
    },
    {
      id: 'amount',
      header: labels.amount,
      width: 130,
      minWidth: 100,
      sortable: true,
      align: 'right',
      // Sort on the signed ledger effect so income and spend separate.
      accessor: (row) => (row.isIncome ? Number(row.amount) : -Number(row.amount)),
      filterValue: (row) => String(row.amount ?? ''),
      cell: (row) => (
        <Num size={14} weight={600} color={row.isIncome ? 'var(--ft-income)' : 'var(--ft-spend)'}>
          {inr(row.isIncome ? row.amount : -row.amount, { sign: row.isIncome })}
        </Num>
      ),
    },
    {
      id: 'actions',
      header: '',
      width: 48,
      minWidth: 48,
      sortable: false,
      hideable: false,
      resizable: false,
      filterable: false,
      stopRowClick: true,
      cell: (row) => (onOpenManage ? (
        <button
          className="txn-row__menu"
          aria-label="Manage transaction"
          onClick={(e) => { e.stopPropagation(); onOpenManage(row.id); }}
        >
          <IcMore size={16} />
        </button>
      ) : null),
    },
  ];
}

/**
 * One ledger row rendered outside DynamicTable's own body — used for the card
 * transactions a bill payment covers, which stay aligned to the parent table's
 * columns instead of collapsing into a colSpan. `columns` comes from the
 * `renderExpansion` callback so hidden columns stay hidden here too.
 */
export function TransactionTableRow({
  row, columns, onOpenDetail, nested = false, nestedLast = false,
}) {
  return (
    <tr
      className={`txn-row${nested ? ` txn-row--nested${nestedLast ? ' is-last' : ''}` : ''}`}
      onClick={onOpenDetail ? () => onOpenDetail(row.raw) : undefined}
    >
      {columns.map((col) => (
        <td
          key={col.id}
          className={['dyn-td', col.align === 'right' ? 'is-right' : '', col.className]
            .filter(Boolean).join(' ')}
          onClick={col.stopRowClick ? (e) => e.stopPropagation() : undefined}
        >
          {col.cell(row)}
        </td>
      ))}
    </tr>
  );
}

/**
 * The desktop ledger table, shared by the bank transactions page and a card's
 * transactions tab. Callers hand over rows already normalized (see the
 * `toTableRow` mappers on each page) and already sorted — sorting rules differ
 * per ledger, so the table only reports the click.
 *
 * Built on DynamicTable, so every ledger also gets resizable columns, a
 * column-visibility menu and a search box for free.
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
  renderExpansion,
  loading = false,
  loadingMessage = 'Loading transactions…',
  emptyMessage = 'No transactions match.',
  // Each ledger persists its own widths and hidden columns — the bank ledger
  // and a card's ledger are different views even though the columns match.
  storageKey = 'fintrack.ledger',
}) {
  const labels = useMemo(
    () => ({ ...DEFAULT_COLUMNS, ...(columnLabels || {}) }),
    [columnLabels],
  );

  const columns = useMemo(
    () => buildTransactionColumns({
      labels,
      categories,
      onAssignCategory,
      onOpenManage,
      expandedIds,
      onToggleExpand,
    }),
    [labels, categories, onAssignCategory, onOpenManage, expandedIds, onToggleExpand],
  );

  const sort = useMemo(
    () => (sortCol ? { columnId: sortCol, dir: sortDir } : null),
    [sortCol, sortDir],
  );

  return (
    <DynamicTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      aria-label="Transactions"
      tableClassName="txn-table"
      storageKey={storageKey}
      // The page owns sorting: each ledger has its own tie-breaks and sorts raw
      // records before mapping, so DynamicTable only reports which column was
      // clicked and the page decides the direction.
      sort={sort}
      onSortChange={(next) => next && onSort?.(next.columnId)}
      page={page}
      onPageChange={onPageChange}
      pageSize={pageSize}
      onPageSizeChange={onPageSizeChange}
      enableGlobalFilter={false}
      onRowClick={onOpenDetail ? (row) => onOpenDetail(row.raw) : undefined}
      // `txn-row` carries the ledger's row decoration — notably the hover-reveal
      // manage button and the open-bill-payment highlight.
      rowClassName={(row) => `txn-row${expandedIds?.has(row.id) ? ' is-cc-open' : ''}`}
      expandedIds={expandedIds}
      renderExpansion={renderExpansion}
      loading={loading}
      loadingMessage={loadingMessage}
      emptyMessage={emptyMessage}
      filteredEmptyMessage={emptyMessage}
    />
  );
}
