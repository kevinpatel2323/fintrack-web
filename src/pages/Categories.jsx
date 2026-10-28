import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Download, MoreHorizontal, Pencil, Plus, Search, Tags, Trash2,
} from 'lucide-react';
import {
  Alert, Amount, Button, ConfirmDialog, Dropdown, EmptyState, ListView, PageBody, PageHeader, Skeleton, TextInput,
  toast,
} from '../components/ui';
import { CategoryIcon } from '../components/common/Category.jsx';
import CategoryExportModal from '../components/CategoryExportModal.jsx';
import CategoryFormDialog from '../components/categories/CategoryFormDialog.jsx';
import CategorySplitCard from '../components/categories/CategorySplitCard.jsx';
import { categoryColor } from '../utils/categoryColors.js';
import { fetchCategoryBreakdown } from '../services/dashboardApi.js';
import { API_BASE, apiErrorMessage, apiFetch } from '../services/http.js';
import './Categories.css';

/** First and last day of the month `offset` months from now, as ISO dates. */
function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset + 1, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start),
    short: new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone: 'UTC' }).format(start),
  };
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function pctText(pct) {
  return `${pct < 1 ? '<1' : pct.toFixed(0)}%`;
}

/** Colour for spending that has no category (list bar and donut slice). */
const UNCATEGORISED_COLOR = 'var(--ink-gray-6)';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [breakdown, setBreakdown] = useState(null);
  const [breakdownError, setBreakdownError] = useState('');
  const [breakdownKey, setBreakdownKey] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [query, setQuery] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCat, setExportCat] = useState(null);

  const month = useMemo(() => monthRange(monthOffset), [monthOffset]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiFetch(`${API_BASE}/categories`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      setCategories((await res.json()).data || []);
    } catch (err) {
      setLoadError(err.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    let cancelled = false;
    setBreakdown(null);
    setBreakdownError('');
    (async () => {
      try {
        const b = await fetchCategoryBreakdown(month.startDate, month.endDate);
        if (!cancelled) setBreakdown(b);
      } catch (err) {
        if (!cancelled) setBreakdownError(err?.message || 'Could not load spending');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, breakdownKey]);

  function openCreate() {
    setEditCat(null);
    setFormOpen(true);
  }

  function openEdit(cat) {
    setEditCat(cat);
    setFormOpen(true);
  }

  function openExport(cat = null) {
    setExportCat(cat);
    setExportOpen(true);
  }

  async function saveCategory({ name, color, icon }) {
    const editId = editCat?.id;
    const url = editId ? `${API_BASE}/categories/${editId}` : `${API_BASE}/categories`;
    const res = await apiFetch(url, {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        color: color || undefined,
        icon: icon.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(apiErrorMessage(data, 'Save failed'));
    setFormOpen(false);
    toast.success(editId ? 'Category saved' : `Added ${name}`);
    await fetchCategories();
  }

  async function confirmDelete() {
    const cat = deleting;
    const res = await apiFetch(`${API_BASE}/categories/${cat.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Delete failed');
    }
    setDeleting(null);
    toast.success(`Deleted ${cat.name}`);
    await fetchCategories();
    // Its spending is uncategorised now; the month's split has to follow.
    setBreakdownKey((k) => k + 1);
  }

  // Spend for the chosen month, keyed by category id.
  const statById = useMemo(() => {
    const m = new Map();
    for (const item of breakdown?.categories || []) {
      if (item.categoryId != null) m.set(String(item.categoryId), item);
    }
    return m;
  }, [breakdown]);

  const uncategorizedStat = breakdown?.uncategorizedAmount > 0
    ? breakdown.categories.find((c) => c.categoryId == null) || null
    : null;

  const usedCount = useMemo(
    () => categories.filter((c) => {
      const stat = statById.get(String(c.id));
      return stat && stat.totalAmount !== 0;
    }).length,
    [categories, statById],
  );

  // Categories with movement this month first, biggest spend on top; the rest
  // alphabetically underneath, where they are out of the way but findable.
  const { active, idle } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = categories.filter((c) => !q || c.name.toLowerCase().includes(q));
    const withStat = matches.map((c) => ({ id: c.id, cat: c, stat: statById.get(String(c.id)) || null }));
    return {
      active: withStat
        .filter((r) => r.stat && r.stat.totalAmount !== 0)
        .sort((x, y) => y.stat.totalAmount - x.stat.totalAmount),
      idle: withStat
        .filter((r) => !r.stat || r.stat.totalAmount === 0)
        .sort((x, y) => x.cat.name.localeCompare(y.cat.name)),
    };
  }, [categories, statById, query]);

  const uncategorisedRow = uncategorizedStat && !query.trim()
    ? { id: '__uncategorised__', cat: null, stat: uncategorizedStat, uncategorised: true }
    : null;

  // The donut follows the categories as they are now (a rename or recolour
  // shows at once), and ignores the search box.
  const splitItems = useMemo(() => {
    const items = [];
    for (const c of categories) {
      const stat = statById.get(String(c.id));
      if (stat && stat.totalAmount > 0) {
        items.push({ key: String(c.id), label: c.name, value: stat.totalAmount, color: categoryColor(c) });
      }
    }
    if (uncategorizedStat && uncategorizedStat.totalAmount > 0) {
      items.push({ key: '__uncategorised__', label: 'Uncategorised', value: uncategorizedStat.totalAmount, color: UNCATEGORISED_COLOR });
    }
    return items;
  }, [categories, statById, uncategorizedStat]);
  const splitTotal = splitItems.reduce((sum, i) => sum + i.value, 0);

  const breakdownLoading = !breakdown && !breakdownError;

  const rowMenu = (cat) => (
    <Dropdown
      placement="bottom-end"
      options={[
        {
          items: [
            { label: 'Edit', icon: Pencil, onClick: () => openEdit(cat) },
            { label: 'Export CSV', icon: Download, onClick: () => openExport(cat) },
          ],
        },
        { items: [{ label: 'Delete', icon: Trash2, theme: 'red', onClick: () => setDeleting(cat) }] },
      ]}
    >
      <Button variant="ghost" icon={MoreHorizontal} label={`Actions for ${cat.name}`} />
    </Dropdown>
  );

  const columns = [
    {
      key: 'name',
      label: 'Category',
      width: 'minmax(160px, 2fr)',
      flex: true,
      sortable: true,
      sortValue: (row) => (row.uncategorised ? 'Uncategorised' : row.cat.name),
      render: (row) => <NameCell row={row} loading={breakdownLoading} />,
    },
    {
      key: 'spent',
      label: 'Spent',
      width: 112,
      align: 'right',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (row) => row.stat?.totalAmount ?? 0,
      render: (row) => <SpentCell stat={row.stat} loading={breakdownLoading} />,
    },
    {
      key: 'share',
      label: `Share of ${month.short}`,
      // The label names the month; the menu and handle don't need to.
      sortLabel: 'Share',
      width: 'minmax(140px, 1fr)',
      hideBelow: 'md',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (row) => row.stat?.totalAmount ?? 0,
      render: (row) => <ShareCell row={row} loading={breakdownLoading} />,
    },
    {
      key: 'count',
      label: 'Transactions',
      width: 104,
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (row) => (row.stat && row.stat.totalAmount !== 0 ? row.stat.transactionCount : 0),
      render: (row) =>
        breakdownLoading ? (
          <Skeleton as="span" width={24} height={12} />
        ) : row.stat && row.stat.totalAmount !== 0 ? (
          <span className="tabular-nums">{row.stat.transactionCount}</span>
        ) : (
          <span className="catg-muted">—</span>
        ),
    },
    {
      key: 'actions',
      label: <span className="sr-only">Actions</span>,
      width: 40,
      align: 'right',
      render: (row) => (row.uncategorised ? null : rowMenu(row.cat)),
    },
  ];

  const activeRows = uncategorisedRow ? [...active, uncategorisedRow] : active;
  const groups = breakdown
    ? [
        activeRows.length > 0 && { key: 'spent', label: `Spent in ${month.short}`, rows: activeRows },
        idle.length > 0 && { key: 'idle', label: `No spending in ${month.short}`, rows: idle },
      ].filter(Boolean)
    : undefined;
  // Until the month's figures arrive (or if they fail), one alphabetical list.
  const flatRows = breakdown ? undefined : idle;
  const visibleCount = active.length + idle.length;

  const q = query.trim();
  let summary = '';
  if (q) summary = `${visibleCount} of ${plural(categories.length, 'category', 'categories')}`;
  else if (categories.length || !loading) {
    summary = plural(categories.length, 'category', 'categories');
    if (breakdown) summary += ` · ${usedCount} used in ${month.short}`;
  }

  const noCategories = !loading && !loadError && categories.length === 0;

  // When the first load fails, the alert says so; an empty table adds nothing.
  const showList = !(loadError && !categories.length);

  let list = null;
  if (showList && !noCategories) {
    list = (
      <ListView
        className="catg-list"
        aria-label={`Categories, ${month.label}`}
        columns={columns}
        rows={flatRows}
        groups={flatRows ? undefined : groups}
        rowKey="id"
        storageKey="fintrack.categories"
        loading={loading && categories.length === 0}
        onRowClick={(row) => {
          if (!row.uncategorised) openEdit(row.cat);
        }}
        rowClassName={(row) => (row.uncategorised ? 'catg-row--static' : '')}
        emptyState={
          q ? (
            <EmptyState
              size="sm"
              icon={Search}
              title={`No category matches “${q}”`}
              action={<Button label="Clear search" onClick={() => setQuery('')} />}
            />
          ) : null
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Categories"
        actions={
          <>
            <Button iconLeft={Download} label="Export" onClick={() => openExport(null)} disabled={!categories.length} />
            <Button variant="solid" iconLeft={Plus} label="Add category" onClick={openCreate} />
          </>
        }
        mobileActions={
          <>
            <Button variant="ghost" size="md" icon={Download} label="Export" onClick={() => openExport(null)} disabled={!categories.length} />
            <Button variant="ghost" size="md" icon={Plus} label="Add category" onClick={openCreate} />
          </>
        }
      />
      <PageBody className="catg-page">
        {noCategories ? (
          // Nothing to search, page through or split yet: just the way in.
          <EmptyState
            className="catg-empty"
            icon={Tags}
            title="No categories yet"
            description="Add categories to sort your spending, like Food or Rent."
            action={<Button iconLeft={Plus} label="Add category" onClick={openCreate} />}
          />
        ) : (
          <div className="catg-layout">
            <div className="catg-main">
              <div className="catg-toolbar">
                <TextInput
                  className="catg-search"
                  type="search"
                  prefix={Search}
                  placeholder="Search categories"
                  aria-label="Search categories"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="catg-toolbar__end">
                  <span className="catg-summary text-sm">{summary}</span>
                  <div className="catg-month" role="group" aria-label="Month">
                    <Button variant="ghost" icon={ChevronLeft} label="Previous month" onClick={() => setMonthOffset((o) => o - 1)} />
                    <span className="catg-month__label" aria-live="polite">{month.label}</span>
                    <Button
                      variant="ghost"
                      icon={ChevronRight}
                      label="Next month"
                      disabled={monthOffset >= 0}
                      onClick={() => setMonthOffset((o) => o + 1)}
                    />
                  </div>
                </div>
              </div>

              {loadError && (
                <Alert
                  theme="red"
                  title="Couldn't load categories"
                  description={loadError}
                  primaryAction={{ label: 'Try again', onClick: fetchCategories }}
                />
              )}
              {breakdownError && !loadError && (
                <Alert
                  theme="amber"
                  title={`Couldn't load spending for ${month.label}`}
                  primaryAction={{ label: 'Try again', onClick: () => setBreakdownKey((k) => k + 1) }}
                />
              )}

              {list}
            </div>

            <aside className="catg-aside" aria-label="Spending split">
              <CategorySplitCard
                month={month}
                items={splitItems}
                total={breakdown?.totalSpent || splitTotal}
                loading={breakdownLoading || (loading && categories.length === 0)}
                error={breakdownError}
                onRetry={() => setBreakdownKey((k) => k + 1)}
              />
            </aside>
          </div>
        )}
      </PageBody>

      <CategoryFormDialog
        open={formOpen}
        category={editCat}
        onClose={() => setFormOpen(false)}
        onSubmit={saveCategory}
      />

      <CategoryExportModal
        open={exportOpen}
        category={exportCat}
        categories={categories}
        onClose={() => setExportOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={deleting ? `Delete “${deleting.name}”?` : 'Delete category?'}
        message={deleting ? deleteMessage(deleting) : ''}
        confirmLabel="Delete category"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

/** What deleting a category does to the transactions filed under it. */
function deleteMessage(cat) {
  const n = Number(cat.transactionCount) || 0;
  if (n === 0) {
    return 'No transactions use it. Any card transactions or subscriptions filed under it become uncategorised.';
  }
  return `Its ${plural(n, 'transaction', 'transactions')} won’t be deleted: ${n === 1 ? 'it becomes' : 'they become'} uncategorised, and so do card transactions and subscriptions filed under it.`;
}

function NameCell({ row, loading }) {
  const { cat, stat, uncategorised } = row;
  const amount = stat?.totalAmount || 0;
  const used = stat && amount !== 0;
  let hint = null;
  if (uncategorised) hint = 'Not in any category yet';
  else if (!used && !loading) {
    hint = cat.transactionCount ? `${plural(cat.transactionCount, 'transaction', 'transactions')} all time` : 'Not used yet';
  }

  // Phones drop the share and count columns; this line carries them instead.
  let meta = hint;
  if (used) {
    meta = amount < 0
      ? `Money in · ${plural(stat.transactionCount, 'transaction', 'transactions')}`
      : `${plural(stat.transactionCount, 'transaction', 'transactions')} · ${pctText(Math.max(0, stat.percentage || 0))}`;
    if (uncategorised) meta = `${hint} · ${meta}`;
  }

  return (
    <div className="catg-name">
      <CategoryIcon category={cat} size={24} />
      <div className="catg-name__text">
        <span className="catg-name__label truncate">{uncategorised ? 'Uncategorised' : cat.name}</span>
        {hint && <span className="catg-name__hint truncate">{hint}</span>}
        {meta && <span className="catg-name__meta truncate">{meta}</span>}
      </div>
    </div>
  );
}

/**
 * A category can net to a credit (refunds, a card bill paid from the account)
 * — that shows as money in, outside the month's spend.
 */
function SpentCell({ stat, loading }) {
  if (loading) return <Skeleton as="span" width={56} height={12} />;
  if (!stat || stat.totalAmount === 0) return <span className="catg-muted">—</span>;
  if (stat.totalAmount < 0) return <Amount value={-stat.totalAmount} sign="always" />;
  return <Amount value={stat.totalAmount} tone="out" />;
}

function ShareCell({ row, loading }) {
  const { cat, stat, uncategorised } = row;
  if (loading) return <Skeleton as="span" width="70%" height={4} />;
  if (!stat || stat.totalAmount === 0) return null;
  if (stat.totalAmount < 0) return <span className="catg-muted text-sm">Money in</span>;
  const pct = Math.max(0, stat.percentage || 0);
  const color = uncategorised ? UNCATEGORISED_COLOR : categoryColor(cat);
  return (
    <div className="catg-share">
      <div className="catg-share__track" aria-hidden>
        <div
          className="catg-share__fill"
          style={{ width: `${Math.min(100, Math.max(pct, 1))}%`, background: color }}
        />
      </div>
      <span className="catg-share__pct tabular-nums">{pctText(pct)}</span>
    </div>
  );
}
