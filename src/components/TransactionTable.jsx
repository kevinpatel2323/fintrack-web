import { useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal, Users } from 'lucide-react';
import { Amount, AvatarGroup, Badge, Button, Combobox, EmptyState, ListView, sortListRows, useListSettings } from './ui';
import { CategoryIcon, categoryOptions as buildCategoryOptions } from './common/Category.jsx';
import { signedAmount } from './transactions/transactionListModel.js';
import './transactions/transactions.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export function formatDateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
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

/**
 * Track sizes and rules per column, in the kit ListView's column terms.
 * Description is the flexible column (it takes the leftover width and can't
 * be hidden); the rest can be dragged wider or narrower and sorted.
 * `sortValue` is what the table orders by when the page leaves sorting to it.
 */
const COLUMN_SPECS = [
  { key: 'date', width: 88, minWidth: 72, sortFirst: 'desc', sortValue: (r) => r.date || '' },
  {
    key: 'description', width: 240, minWidth: 200, flex: true, pinned: true,
    sortValue: (r) => (r.title || '').toLowerCase(),
  },
  // The UPI note / remark. Off until the user turns it on in Columns.
  {
    key: 'note', width: 200, minWidth: 120, hideBelow: 'lg', defaultHidden: true,
    sortValue: (r) => (r.note || '').toLowerCase(),
  },
  { key: 'category', width: 168, minWidth: 112, sortValue: (r) => (r.category?.name || '').toLowerCase() },
  { key: 'method', width: 128, minWidth: 88, hideBelow: 'lg', sortValue: (r) => r.method || '' },
  {
    key: 'tags', width: 132, minWidth: 72, hideBelow: 'lg',
    sortValue: (r) => (r.people ? r.people.length : (r.tagCount ?? -1)),
  },
  // Sort on the signed ledger effect so income and spend separate.
  { key: 'amount', width: 120, minWidth: 96, align: 'right', sortValue: (r) => signedAmount(r) },
];

const PINNED = COLUMN_SPECS.filter((c) => c.pinned).map((c) => c.key);
const DEFAULT_HIDDEN = COLUMN_SPECS.filter((c) => c.defaultHidden).map((c) => c.key);

/**
 * Normalized ledger rows in the order the table would put them for `sort`
 * (`{ key, direction }`) — for a phone list that shows the same rows.
 */
export function sortTableRows(rows, sort) {
  return sortListRows(rows, COLUMN_SPECS, sort);
}

/** Hideable columns as `[{ id, label }]`, for the page's Columns menu. */
export function transactionColumnChoices(columnLabels) {
  const labels = { ...DEFAULT_COLUMNS, ...(columnLabels || {}) };
  return COLUMN_SPECS.filter((c) => !c.pinned).map((c) => ({ id: c.key, label: labels[c.key] }));
}

/**
 * The columns a ledger sorts by, as `[{ key, label, sortFirst }]` — for a
 * phone list, which has no header row to click.
 */
export function transactionSortChoices(columnLabels) {
  const labels = { ...DEFAULT_COLUMNS, ...(columnLabels || {}) };
  return COLUMN_SPECS.map((c) => ({ key: c.key, label: labels[c.key], sortFirst: c.sortFirst || 'asc' }));
}

/** Column preferences for a ledger; pass the result to both the table and its Columns menu. */
export function useTransactionColumns(storageKey) {
  return useListSettings(storageKey, { pinned: PINNED, defaultHidden: DEFAULT_HIDDEN });
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
      <span className="txl-cat__name truncate">{name || (onAssignCategory ? 'Set category' : 'Uncategorised')}</span>
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

/**
 * The desktop ledger, shared by the bank transactions page, a card's
 * transactions tab, a calendar day and a bill payment's covered list: the
 * transaction columns on the kit ListView, which brings sorting, resizing,
 * saved column choices, paging and the nested rows. Callers hand over rows
 * already normalized (see the `toTableRow` mappers on each page).
 *
 * Row shape: `{ id, raw, date, title, titleBadge, note, category,
 * categoryId, method, people | tagCount, amount, isIncome, expandable }`.
 *
 * Sorting: pass `sort` + `onSortChange` when the page orders the rows itself
 * (Transactions and a card's ledger keep their own tie-breaks); leave them
 * out and the table orders the rows, starting from `defaultSort`.
 *
 * Expansion: rows in `expandedIds` get the items `expansionRows(row)` returns
 * right under them (see `ccExpansionItems`): `kind: 'nested'` rows render
 * like any ledger row against `expansionHandlers`, `kind: 'note'` and
 * `kind: 'remainder'` render as a single muted line.
 *
 * Column choices persist per `columnSettings` (from `useTransactionColumns`,
 * shared with the page's Columns menu) or per `storageKey`.
 */
export default function TransactionTable({
  rows,
  columnLabels,
  categories = [],
  onAssignCategory,
  onOpenDetail,
  onOpenManage,
  sort,
  defaultSort,
  onSortChange,
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
  storageKey,
  columnSettings,
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

  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories, { label: 'No category', value: NO_CATEGORY }),
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

    const cols = COLUMN_SPECS.filter((spec) => !omitColumns?.includes(spec.key)).map((spec) => ({
      ...spec,
      label: labels[spec.key],
      sortable: true,
      className: `txl-cell txl-cell--${spec.key}`,
      render: (item) => {
        if (item.kind === 'note' || item.kind === 'remainder') {
          if (spec.key === 'description') return <span className="txl-note">{item.text}</span>;
          if (spec.key === 'amount' && item.kind === 'remainder') {
            return <Amount value={item.amount} decimals={2} tone="muted" />;
          }
          return null;
        }
        return render[spec.key](item, ctxFor(item));
      },
    }));

    if (onOpenManage || nestedHandlers.onOpenManage) {
      cols.push({
        key: 'actions',
        label: '',
        width: 36,
        align: 'right',
        pinned: true,
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
    labels, categoryOptions, expandedIds, onToggleExpand, onAssignCategory, onOpenManage, expansionHandlers,
    omitColumns,
  ]);

  const subRows = useCallback(
    (row) => (!row.kind && expandedIds?.has(row.id) ? expansionRows?.(row) : null),
    [expandedIds, expansionRows],
  );

  const handleRowClick = useCallback((item) => {
    if (item.kind === 'nested') {
      expansionHandlers?.onOpenManage?.(item.id);
      return;
    }
    if (item.kind) return;
    onOpenDetail?.(item.raw);
  }, [expansionHandlers, onOpenDetail]);

  const clickable = Boolean(onOpenDetail || expansionHandlers?.onOpenManage);

  return (
    <ListView
      aria-label="Transactions"
      className={cx('txl-list', className)}
      columns={columns}
      rows={loading ? [] : rows || []}
      rowKey={(item) => item.key ?? item.id}
      subRows={expansionRows ? subRows : undefined}
      rowClassName={(item) => cx(
        'txl-row',
        item.kind && `is-${item.kind}`,
        item.last && 'is-last',
        !item.kind && expandedIds?.has(item.id) && 'is-open',
        !item.kind && rowClassName?.(item),
      )}
      onRowClick={clickable ? handleRowClick : undefined}
      sort={sort}
      defaultSort={defaultSort}
      onSortChange={onSortChange}
      columnSettings={columnSettings}
      storageKey={storageKey}
      pagination={paginate ? { page, pageSize, onPageChange, onPageSizeChange } : false}
      loading={loading}
      skeletonRows={8}
      stickyHeader={stickyHeader}
      emptyState={emptyState ?? <EmptyState size="sm" title={emptyMessage} />}
    />
  );
}
