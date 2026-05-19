import { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Portal from '../components/Portal.jsx';
import {
  Card, Num, Pill, PrimaryBtn, GhostBtn, Overline, SectionTitle, CatGlyph,
} from '../components/ui/primitives.jsx';
import { IcPlus, IcEdit, IcTrash, IcChevR, IcChevL } from '../components/ui/Icon.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { CATEGORY_PALETTE, categoryColor } from '../utils/categoryColors.js';
import { inr } from '../utils/inr.js';
import { fetchCategoryBreakdown } from '../services/dashboardApi.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const PRESET_COLORS = Object.values(CATEGORY_PALETTE);
const EMPTY_FORM = { name: '', color: PRESET_COLORS[0], icon: '' };

function monthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export default function Categories() {
  const isMobile = useMediaQuery('(max-width: 720px)');

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

  async function fetchCategories() {
    setLoading(true); setStatus('');
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      setCategories((await res.json()).data || []);
    } catch (err) { setStatus(err.message || 'Failed to fetch categories'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => {
    (async () => {
      try {
        const r = monthRange();
        const b = await fetchCategoryBreakdown(r.startDate, r.endDate);
        setBreakdown(b);
      } catch {}
    })();
  }, []);

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
      const res = await fetch(url, {
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
          const res = await fetch(`${API_BASE}/categories/${cat.id}`, { method: 'DELETE' });
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

  const totalForCat = (catId) => {
    if (!breakdown?.categories) return null;
    const item = breakdown.categories.find((c) => String(c.categoryId) === String(catId));
    return item || null;
  };

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
    <Card pad={14}>
      <SectionTitle action={
        <GhostBtn onClick={openCreate}>
          <IcPlus size={14} /> Add category
        </GhostBtn>
      }>
        All categories
      </SectionTitle>
      {loading ? (
        <p className="status">Loading…</p>
      ) : categories.length === 0 ? (
        <p className="empty">No categories yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {categories.map((c, i) => {
            const stat = totalForCat(c.id);
            const total = stat?.totalAmount ?? 0;
            const pct = stat?.percentage ?? 0;
            const color = categoryColor(c);
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 6px',
                  borderTop: i ? '1px solid var(--ft-border)' : 'none',
                }}
              >
                <CatGlyph category={c} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span
                      style={{
                        color: 'var(--ft-text)',
                        fontWeight: 500,
                        fontSize: 15,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {c.name}
                    </span>
                    <Num size={14} weight={600} style={{ flexShrink: 0 }}>
                      {total > 0 ? inr(total) : '—'}
                    </Num>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--ft-surface-2)', borderRadius: 999 }}>
                      <div
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          height: '100%',
                          background: color,
                          borderRadius: 999,
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </div>
                    <Num size={11} weight={500} color="var(--ft-text-dim)" style={{ flexShrink: 0, minWidth: 28, textAlign: 'right' }}>
                      {pct.toFixed(0)}%
                    </Num>
                  </div>
                </div>
                <button
                  type="button"
                  className="ft-mobile__icon-btn"
                  style={{ width: 32, height: 32 }}
                  onClick={() => openEdit(c)}
                  aria-label="Edit"
                >
                  <IcEdit size={14} />
                </button>
                <button
                  type="button"
                  className="ft-mobile__icon-btn"
                  style={{ width: 32, height: 32, color: 'var(--ft-spend)' }}
                  onClick={() => askDelete(c)}
                  aria-label="Delete"
                >
                  <IcTrash size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {status && <p className="status">{status}</p>}
    </Card>
  );

  const donut = breakdown?.categories?.length > 0 && (
    <Card pad={18}>
      <SectionTitle>This month</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ fontFamily: 'var(--ft-font-mono)', fontSize: 28, fontWeight: 500, color: 'var(--ft-text)', letterSpacing: '-1px' }}>
          {inr(breakdown.totalSpent || 0)}
        </div>
        <Overline style={{ marginTop: 6 }}>Total spent</Overline>
      </div>
    </Card>
  );

  if (isMobile) {
    return (
      <>
        <ConfirmDialog {...confirmState} />
        {formSheet}
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
      <header className="ft-page-header">
        <div>
          <p className="ft-page-header__sub">{categories.length} categories</p>
          <h1 className="ft-page-header__title">Categories</h1>
        </div>
        <div className="ft-page-header__actions">
          <PrimaryBtn onClick={openCreate}><IcPlus size={16} /> Add category</PrimaryBtn>
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {list}
        <div>{donut}</div>
      </div>
    </>
  );
}
