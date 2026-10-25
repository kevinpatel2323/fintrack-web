import { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Portal from '../components/Portal.jsx';
import CategoryExportModal from '../components/CategoryExportModal.jsx';
import {
  Card, Num, PrimaryBtn, GhostBtn, Overline, CatGlyph,
} from '../components/ui/primitives.jsx';
import { IcPlus, IcEdit, IcTrash, IcDownload, IcChevR, IcChevL, IcSearch } from '../components/ui/Icon.jsx';
import { useIsCompact } from '../styles/breakpoints.js';
import { CATEGORY_PALETTE, categoryColor } from '../utils/categoryColors.js';
import { inr } from '../utils/inr.js';
import { fetchCategoryBreakdown } from '../services/dashboardApi.js';

import { API_BASE, apiFetch } from '../services/http.js';
import './categories-redesign.css';

const PRESET_COLORS = Object.values(CATEGORY_PALETTE);
const EMPTY_FORM = { name: '', color: PRESET_COLORS[0], icon: '' };

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

export default function Categories() {
  const isMobile = useIsCompact();

  const [categories, setCategories] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formStatus, setFormStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false });
  const [exportCat, setExportCat] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [query, setQuery] = useState('');
  const month = useMemo(() => monthRange(monthOffset), [monthOffset]);

  async function fetchCategories() {
    setLoading(true); setStatus('');
    try {
      const res = await apiFetch(`${API_BASE}/categories`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      setCategories((await res.json()).data || []);
    } catch (err) { setStatus(err.message || 'Failed to fetch categories'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => {
    let cancelled = false;
    setBreakdown(null);
    (async () => {
      try {
        const b = await fetchCategoryBreakdown(month.startDate, month.endDate);
        if (!cancelled) setBreakdown(b);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [month]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormStatus('');
    setFormOpen(true);
  }

  function openEdit(cat) {
    setEditId(cat.id);
    setForm({ name: cat.name, color: cat.color || PRESET_COLORS[0], icon: cat.icon || '' });
    setFormStatus('');
    setFormOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { setFormStatus('Name is required.'); return; }
    setSubmitting(true);
    setFormStatus('');
    try {
      const url = editId ? `${API_BASE}/categories/${editId}` : `${API_BASE}/categories`;
      const res = await apiFetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          color: form.color || undefined,
          icon: form.icon.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Save failed');
      setFormOpen(false);
      setEditId(null);
      await fetchCategories();
    } catch (err) {
      setFormStatus(err.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  function askDelete(cat) {
    setConfirmState({
      open: true,
      title: `Delete "${cat.name}"?`,
      message: 'Transactions using this category will lose their category.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmState({ open: false });
        try {
          const res = await apiFetch(`${API_BASE}/categories/${cat.id}`, { method: 'DELETE' });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setStatus(data.message || 'Delete failed');
            return;
          }
          await fetchCategories();
        } catch (err) {
          setStatus(err.message || 'Delete failed');
        }
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  // Spend for the chosen month, keyed by category id.
  const statById = useMemo(() => {
    const m = new Map();
    for (const item of breakdown?.categories || []) {
      if (item.categoryId != null) m.set(String(item.categoryId), item);
    }
    return m;
  }, [breakdown]);

  // Categories with movement this month first, biggest spend on top; the rest
  // alphabetically underneath, where they are out of the way but findable.
  const { active, idle } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = categories.filter((c) => !q || c.name.toLowerCase().includes(q));
    const withStat = matches.map((c) => ({ cat: c, stat: statById.get(String(c.id)) || null }));
    return {
      active: withStat
        .filter((r) => r.stat && r.stat.totalAmount !== 0)
        .sort((x, y) => y.stat.totalAmount - x.stat.totalAmount),
      idle: withStat
        .filter((r) => !r.stat || r.stat.totalAmount === 0)
        .sort((x, y) => x.cat.name.localeCompare(y.cat.name)),
    };
  }, [categories, statById, query]);

  const uncategorized = breakdown?.uncategorizedAmount > 0 && !query.trim()
    ? breakdown.categories.find((c) => c.categoryId == null)
    : null;

  const rowActions = (c) => (
    <div className="cat-row__actions">
      <button type="button" className="cat-icon-btn" onClick={() => setExportCat(c)} aria-label={`Export ${c.name} as CSV`} title="Export transactions as CSV">
        <IcDownload size={14} />
      </button>
      <button type="button" className="cat-icon-btn" onClick={() => openEdit(c)} aria-label={`Edit ${c.name}`} title="Edit">
        <IcEdit size={14} />
      </button>
      <button type="button" className="cat-icon-btn cat-icon-btn--danger" onClick={() => askDelete(c)} aria-label={`Delete ${c.name}`} title="Delete">
        <IcTrash size={14} />
      </button>
    </div>
  );

  const formSheet = formOpen && (
    <Portal>
      <div className="calendar-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setFormOpen(false)}>
        <div className="calendar-sheet" role="dialog" aria-modal="true">
          <div className="ft-sheet__grabber" />
          <h3 className="ft-sheet__title">{editId ? 'Edit category' : 'New category'}</h3>
          <p className="ft-sheet__sub">Color-coded buckets for your spending.</p>
          <form onSubmit={submit} className="form-grid">
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Name</span>
              <input type="text" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Coffee" autoFocus />
            </label>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Color</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, color: c }))}
                    aria-label={c}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: c,
                      border: form.color === c ? '2px solid var(--ft-text)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Icon (emoji or short)</span>
              <input type="text" value={form.icon}
                onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                placeholder="optional" maxLength={6} />
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <GhostBtn onClick={() => setFormOpen(false)}>Cancel</GhostBtn>
              <PrimaryBtn type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</PrimaryBtn>
            </div>
            {formStatus && <p className="status" style={{ gridColumn: '1 / -1' }}>{formStatus}</p>}
          </form>
        </div>
      </div>
    </Portal>
  );

  const list = (
    <Card pad={0}>
      <div className="cat-toolbar">
        <label className="cat-search">
          <IcSearch size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${categories.length} categories`}
            aria-label="Search categories"
          />
        </label>
        {isMobile && (
          <MonthSwitch month={month} offset={monthOffset} onChange={setMonthOffset} />
        )}
      </div>

      {loading && categories.length === 0 ? (
        <p className="status" style={{ padding: '0 18px 16px' }}>Loading…</p>
      ) : categories.length === 0 ? (
        <div className="cat-empty">
          <p>No categories yet.</p>
          <GhostBtn onClick={openCreate}><IcPlus size={14} /> Add your first category</GhostBtn>
        </div>
      ) : (
        <>
          {(active.length > 0 || uncategorized) && (
            <section>
              <div className="cat-section-head">
                <Overline>Spent in {month.short}</Overline>
                <span>{plural(active.length, 'category', 'categories')}</span>
              </div>
              {active.map(({ cat, stat }) => (
                <CategoryRow key={cat.id} cat={cat} stat={stat} actions={rowActions(cat)} />
              ))}
              {uncategorized && (
                <CategoryRow
                  cat={{ id: 'none', name: 'Uncategorised', color: null, icon: '?' }}
                  stat={uncategorized}
                  hint="Not in any category yet"
                />
              )}
            </section>
          )}

          {idle.length > 0 && (
            <section>
              <div className="cat-section-head">
                <Overline>{breakdown ? `Nothing in ${month.short}` : 'All categories'}</Overline>
                <span>{plural(idle.length, 'category', 'categories')}</span>
              </div>
              <div className="cat-idle-grid">
                {idle.map(({ cat }) => (
                  <div key={cat.id} className="cat-idle">
                    <CatGlyph category={cat} size={32} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="cat-row__name">{cat.name}</div>
                      <div className="cat-row__meta">
                        {cat.transactionCount ? plural(cat.transactionCount, 'transaction', 'transactions') + ' all time' : 'Not used yet'}
                      </div>
                    </div>
                    {rowActions(cat)}
                  </div>
                ))}
              </div>
            </section>
          )}

          {active.length === 0 && idle.length === 0 && (
            <p className="empty" style={{ padding: '4px 18px 18px' }}>No category matches “{query}”.</p>
          )}
        </>
      )}
      {status && <p className="status" style={{ padding: '0 18px 14px' }}>{status}</p>}
    </Card>
  );

  const donut = (
    <MonthSummary
      breakdown={breakdown}
      month={month}
      offset={monthOffset}
      onOffsetChange={setMonthOffset}
      showSwitch={!isMobile}
    />
  );

  if (isMobile) {
    return (
      <>
        <ConfirmDialog {...confirmState} />
        {formSheet}
        <CategoryExportModal
          category={exportCat}
          open={!!exportCat}
          onClose={() => setExportCat(null)}
        />
        <header className="ft-mobile__header">
          <h1 className="ft-mobile__title">Categories</h1>
          <button className="ft-mobile__icon-btn" onClick={openCreate} aria-label="New category">
            <IcPlus size={20} />
          </button>
        </header>
        <main className="ft-mobile__content">
          {donut}
          {list}
        </main>
      </>
    );
  }

  return (
    <>
      <ConfirmDialog {...confirmState} />
      {formSheet}
      <CategoryExportModal
        category={exportCat}
        open={!!exportCat}
        onClose={() => setExportCat(null)}
      />
      <header className="ft-page-header">
        <div>
          <p className="ft-page-header__sub">
            {plural(categories.length, 'category', 'categories')}
            {breakdown ? ` · ${active.length} used in ${month.short}` : ''}
          </p>
          <h1 className="ft-page-header__title">Categories</h1>
        </div>
        <div className="ft-page-header__actions">
          <PrimaryBtn onClick={openCreate}><IcPlus size={16} /> Add category</PrimaryBtn>
        </div>
      </header>
      <div className="ft-split" style={{ '--ft-split-aside': '340px' }}>
        {list}
        <div className="cat-aside">{donut}</div>
      </div>
    </>
  );
}

function MonthSwitch({ month, offset, onChange }) {
  return (
    <div className="cat-month">
      <button type="button" className="cat-icon-btn" onClick={() => onChange(offset - 1)} aria-label="Previous month">
        <IcChevL size={14} />
      </button>
      <span>{month.label}</span>
      <button type="button" className="cat-icon-btn" onClick={() => onChange(offset + 1)} disabled={offset >= 0} aria-label="Next month">
        <IcChevR size={14} />
      </button>
    </div>
  );
}

/**
 * One category with spend in the month. A category can net to a credit (a
 * card bill paid from the account, refunds) — that shows as money in, with no
 * share-of-spend bar, since it is not part of the total spent.
 */
function CategoryRow({ cat, stat, actions, hint }) {
  const amount = stat.totalAmount;
  const isCredit = amount < 0;
  const pct = Math.max(0, stat.percentage || 0);
  const color = categoryColor(cat);
  return (
    <div className="cat-row">
      <CatGlyph category={cat} size={36} />
      <div className="cat-row__body">
        <div className="cat-row__line">
          <span className="cat-row__name">{cat.name}</span>
          <Num size={14} weight={600} color={isCredit ? 'var(--ft-income)' : undefined} style={{ flexShrink: 0 }}>
            {isCredit ? inr(-amount, { sign: true }) : inr(amount)}
          </Num>
        </div>
        <div className="cat-row__line" style={{ marginTop: 6 }}>
          {isCredit ? (
            <span className="cat-row__meta">Net money in · {plural(stat.transactionCount, 'transaction', 'transactions')}</span>
          ) : (
            <>
              <div className="cat-bar"><div style={{ width: `${Math.min(100, Math.max(pct, 1))}%`, background: color }} /></div>
              <span className="cat-row__meta" style={{ flexShrink: 0 }}>
                {hint ? `${hint} · ` : ''}{plural(stat.transactionCount, 'txn', 'txns')} · {pct < 1 ? '<1' : pct.toFixed(0)}%
              </span>
            </>
          )}
        </div>
      </div>
      {actions || <div className="cat-row__actions" aria-hidden />}
    </div>
  );
}

const DONUT_SLICES = 5;

/** Total spent in the month, and a donut of where it went — top five plus the rest. */
function MonthSummary({ breakdown, month, offset, onOffsetChange, showSwitch }) {
  const spend = (breakdown?.categories || [])
    .filter((c) => c.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);
  const total = spend.reduce((sum, c) => sum + c.totalAmount, 0);
  const top = spend.slice(0, DONUT_SLICES).map((c) => ({
    name: c.categoryId == null ? 'Uncategorised' : c.categoryName,
    amount: c.totalAmount,
    color: c.categoryId == null ? 'var(--ft-text-faint)' : categoryColor({ name: c.categoryName, color: c.categoryColor }),
  }));
  const rest = spend.slice(DONUT_SLICES).reduce((sum, c) => sum + c.totalAmount, 0);
  if (rest > 0) top.push({ name: `${spend.length - DONUT_SLICES} more`, amount: rest, color: 'var(--ft-surface-3)' });

  const R = 52;
  const C = 2 * Math.PI * R;
  let offsetAcc = 0;

  return (
    <Card pad={18}>
      {showSwitch ? (
        <MonthSwitch month={month} offset={offset} onChange={onOffsetChange} />
      ) : (
        <Overline>{month.label}</Overline>
      )}

      {!breakdown ? (
        <p className="status" style={{ margin: '18px 0 4px' }}>Loading…</p>
      ) : total === 0 ? (
        <p className="empty" style={{ margin: '18px 0 4px' }}>No spending in {month.short}.</p>
      ) : (
        <>
          <div className="cat-donut">
            <svg viewBox="0 0 128 128" width="148" height="148" aria-hidden>
              <circle cx="64" cy="64" r={R} fill="none" stroke="var(--ft-surface-2)" strokeWidth="14" />
              {top.map((s) => {
                const len = (s.amount / total) * C;
                // A hairline gap between slices, unless the slice is too thin to spare it.
                const gap = len > 4 ? 1.5 : 0;
                const el = (
                  <circle
                    key={s.name}
                    cx="64" cy="64" r={R} fill="none"
                    stroke={s.color} strokeWidth="14"
                    strokeDasharray={`${len - gap} ${C - len + gap}`}
                    strokeDashoffset={-offsetAcc}
                    transform="rotate(-90 64 64)"
                  />
                );
                offsetAcc += len;
                return el;
              })}
            </svg>
            <div className="cat-donut__center">
              <Num size={19} weight={600}>{inr(breakdown.totalSpent || total)}</Num>
              <span>spent</span>
            </div>
          </div>

          <div className="cat-legend">
            {top.map((s) => (
              <div key={s.name} className="cat-legend__row">
                <span className="cat-legend__dot" style={{ background: s.color }} />
                <span className="cat-legend__name">{s.name}</span>
                <Num size={12} weight={500} color="var(--ft-text-dim)">{((s.amount / total) * 100).toFixed(0)}%</Num>
                <Num size={12.5} weight={600} style={{ minWidth: 72, textAlign: 'right' }}>{inr(s.amount)}</Num>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
