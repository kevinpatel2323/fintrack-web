import { Fragment } from 'react';
import { CategoryChip, Num } from './ui/primitives.jsx';
import { IcChevR, IcMore } from './ui/Icon.jsx';
import { categoryColor } from '../utils/categoryColors.js';
import { inr } from '../utils/inr.js';
import '../styles/transactions-redesign.css';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function formatDateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
}

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
        background: `${color}1A`,
        color,
      }}
      aria-hidden="true"
    >
      <span>{emoji}</span>
    </div>
  );
}

function SortTh({ col, active, dir, onSort, children, width, right }) {
  const isActive = active === col;
  return (
    <th
      style={{ width, textAlign: right ? 'right' : 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => onSort(col)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <span style={{
          opacity: isActive ? 1 : 0.3,
          fontSize: 9,
          color: isActive ? 'var(--ft-accent)' : 'var(--ft-text-dim)',
          lineHeight: 1,
        }}>
          {isActive && dir === 'desc' ? '▼' : '▲'}
        </span>
      </span>
    </th>
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

// 6 data columns + the trailing menu cell. Expansion rows span the lot.
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
 * One ledger row. `nested` renders it as a subordinate row of the one above —
 * used for the card transactions a bill payment covers, which stay aligned to
 * the parent table's columns instead of collapsing into a colSpan.
 */
export function TransactionTableRow({
  row, categories, onAssignCategory, onOpenManage, onOpenDetail,
  expanded, onToggleExpand, nested = false, nestedLast = false,
}) {
  return (
    <tr
      className={`txn-row${expanded ? ' is-cc-open' : ''}${
        nested ? ` txn-row--nested${nestedLast ? ' is-last' : ''}` : ''}`}
      onClick={onOpenDetail ? () => onOpenDetail(row.raw) : undefined}
    >
      <td>
        <span style={{ fontFamily: 'var(--ft-font-mono)', fontSize: 12.5, color: 'var(--ft-text)', fontWeight: 500 }}>
          {formatDateShort(row.date)}
        </span>
      </td>
      <td className="txn-cell--description">
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
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        {row.category ? (
          <CategoryChip category={row.category} />
        ) : (
          <select
            className="txn-inline-select"
            value={row.categoryId || ''}
            onChange={(e) => onAssignCategory(row.id, e.target.value)}
          >
            <option value="">Set category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
            ))}
          </select>
        )}
      </td>
      <td>
        <span style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>{row.method}</span>
      </td>
      <td>
        {row.tagCount !== null ? (
          row.tagCount > 0 ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(215,255,61,0.12)', color: 'var(--ft-accent)',
              fontFamily: 'var(--ft-font-mono)', fontSize: 12, fontWeight: 600,
              padding: '2px 8px', borderRadius: 6, minWidth: 24,
            }}>
              {row.tagCount}
            </span>
          ) : <span style={{ color: 'var(--ft-text-faint)', fontSize: 12 }}>—</span>
        ) : (
          <span style={{ color: 'var(--ft-text-faint)', fontSize: 12 }}>·</span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <Num size={14} weight={600} color={row.isIncome ? 'var(--ft-income)' : 'var(--ft-spend)'}>
          {inr(row.isIncome ? row.amount : -row.amount, { sign: row.isIncome })}
        </Num>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        {onOpenManage && (
          <button
            className="txn-row__menu"
            aria-label="Manage transaction"
            onClick={(e) => { e.stopPropagation(); onOpenManage(row.id); }}
          >
            <IcMore size={16} />
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * The desktop ledger table, shared by the bank transactions page and a card's
 * transactions tab. Callers hand over rows already normalized (see the
 * `toTableRow` mappers on each page) and already sorted — sorting rules differ
 * per ledger, so the table only reports the click. Paging is handled here.
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
}) {
  const labels = { ...DEFAULT_COLUMNS, ...(columnLabels || {}) };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = rows.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
  const pageEnd = Math.min(currentPage * pageSize, rows.length);
  const paginationItems = getPaginationItems(currentPage, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return <div style={{ padding: 28 }}><p className="status">{loadingMessage}</p></div>;
  }
  if (rows.length === 0) {
    return <p className="empty" style={{ margin: 24 }}>{emptyMessage}</p>;
  }

  return (
    <>
      <table className="txn-table">
        <thead>
          <tr>
            <SortTh col="date" active={sortCol} dir={sortDir} onSort={onSort} width={110}>{labels.date}</SortTh>
            <SortTh col="description" active={sortCol} dir={sortDir} onSort={onSort}>{labels.description}</SortTh>
            <SortTh col="category" active={sortCol} dir={sortDir} onSort={onSort} width={160}>{labels.category}</SortTh>
            <SortTh col="method" active={sortCol} dir={sortDir} onSort={onSort} width={120}>{labels.method}</SortTh>
            <SortTh col="tags" active={sortCol} dir={sortDir} onSort={onSort} width={100}>{labels.tags}</SortTh>
            <SortTh col="amount" active={sortCol} dir={sortDir} onSort={onSort} width={130} right>{labels.amount}</SortTh>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const expanded = Boolean(expandedIds?.has(row.id));
            return (
              <Fragment key={row.id}>
                <TransactionTableRow
                  row={row}
                  categories={categories}
                  onAssignCategory={onAssignCategory}
                  onOpenManage={onOpenManage}
                  onOpenDetail={onOpenDetail}
                  expanded={expanded}
                  onToggleExpand={onToggleExpand}
                />
                {expanded && renderExpansion?.(row)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="txn-footer">
        <div className="txn-footer__meta">
          <div className="txn-page-size" role="group" aria-label="Rows per page">
            <span className="txn-footer__label">Rows per page</span>
            <div className="txn-page-size__options">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`txn-page-size__option${pageSize === size ? ' is-active' : ''}`}
                  onClick={() => {
                    onPageSizeChange(size);
                    onPageChange(1);
                  }}
                  aria-pressed={pageSize === size}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <span className="txn-footer__summary">
            Showing {pageStart}–{pageEnd} of {rows.length}
          </span>
        </div>
        <div className="txn-pager">
          <button
            type="button"
            className="txn-pager__nav"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Prev
          </button>
          <div className="txn-pager__pages" aria-label={`Page ${currentPage} of ${totalPages}`}>
            {paginationItems.map((item) => (typeof item === 'string' ? (
              <span key={item} className="txn-pager__ellipsis" aria-hidden="true">…</span>
            ) : (
              <button
                key={item}
                type="button"
                className={`txn-pager__page${item === currentPage ? ' is-active' : ''}`}
                onClick={() => onPageChange(item)}
                aria-current={item === currentPage ? 'page' : undefined}
              >
                {item}
              </button>
            )))}
          </div>
          <button
            type="button"
            className="txn-pager__nav"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
