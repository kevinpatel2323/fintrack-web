import { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import './Categories.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const PRESET_COLORS = [
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#1abc9c',
  '#3498db',
  '#9b59b6',
  '#e91e63',
  '#00bcd4',
  '#795548',
  '#607d8b',
  '#f07c4a',
];

const EMPTY_FORM = { name: '', color: PRESET_COLORS[0], icon: '' };

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formStatus, setFormStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [confirmState, setConfirmState] = useState({ open: false });

  async function fetchCategories() {
    setLoading(true);
    setStatus('');
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      setCategories(data.data || []);
    } catch (err) {
      setStatus(err.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
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

  function cancelForm() {
    setFormOpen(false);
    setEditId(null);
    setFormStatus('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormStatus('Name is required.');
      return;
    }

    setSubmitting(true);
    setFormStatus('');
    try {
      const url = editId ? `${API_BASE}/categories/${editId}` : `${API_BASE}/categories`;
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          color: form.color || undefined,
          icon: form.icon.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to save category');
      setFormOpen(false);
      setEditId(null);
      await fetchCategories();
    } catch (err) {
      setFormStatus(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(cat) {
    setConfirmState({
      open: true,
      title: 'Delete category?',
      message: `"${cat.name}" will be removed. Transactions using it will lose their category.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmState({ open: false });
        await runDelete(cat.id);
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  async function runDelete(id) {
    try {
      const res = await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setStatus(data.message || 'Failed to delete');
        return;
      }
      await fetchCategories();
    } catch (err) {
      setStatus(err.message || 'Failed to delete');
    }
  }

  return (
    <>
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={confirmState.onCancel}
      />

      <div className="card categories-page">
        <header className="card-header categories-page__header">
          <div>
            <h2>Categories</h2>
            <p className="categories-page__subtitle">Organise transactions with labels you recognise at a glance.</p>
          </div>
          {!formOpen && (
            <button
              className="secondary categories-page__add-btn"
              type="button"
              onClick={openCreate}
              id="btn-add-category"
            >
              New category
            </button>
          )}
        </header>

        {formOpen && (
          <form className="category-form" onSubmit={handleSubmit}>
            <p className="category-form-title">{editId ? 'Edit category' : 'New category'}</p>

            <div className="category-form-grid">
              <label className="category-field category-field--name">
                <span className="label">Name</span>
                <input
                  id="cat-name"
                  type="text"
                  placeholder="e.g. Groceries, Rent"
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </label>

              <div className="category-field category-field--icon">
                <span className="label">Icon</span>
                <div className="category-icon-row">
                  <div
                    className="category-icon-preview"
                    style={
                      form.color
                        ? { borderColor: form.color, background: `${form.color}22` }
                        : undefined
                    }
                    aria-hidden
                  >
                    {form.icon.trim() || '·'}
                  </div>
                  <input
                    id="cat-icon"
                    type="text"
                    placeholder="Emoji"
                    maxLength={10}
                    value={form.icon}
                    onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                    inputMode="text"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="category-field">
                <span className="label">Colour</span>
                <div className="color-palette" role="group" aria-label="Category colour">
                  <button
                    type="button"
                    className={`color-none-btn${!form.color ? ' swatch-selected' : ''}`}
                    title="No colour"
                    aria-pressed={!form.color}
                    onClick={() => setForm((f) => ({ ...f, color: '' }))}
                  >
                    ✕
                  </button>
                  {PRESET_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`color-swatch${form.color === hex ? ' swatch-selected' : ''}`}
                      style={{ background: hex }}
                      title={hex}
                      aria-label={`Colour ${hex}`}
                      aria-pressed={form.color === hex}
                      onClick={() => setForm((f) => ({ ...f, color: hex }))}
                    />
                  ))}
                </div>
              </div>
            </div>

            {formStatus && <p className="status error">{formStatus}</p>}

            <div className="category-form-actions">
              <button className="secondary" type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : editId ? 'Save changes' : 'Create'}
              </button>
              <button className="ghost" type="button" onClick={cancelForm}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {status && <p className="status error">{status}</p>}

        {loading && (
          <div className="categories-skeleton" aria-busy="true" aria-label="Loading categories">
            {[1, 2, 3, 4].map((i) => (
              <div className="categories-skeleton-row" key={i} />
            ))}
          </div>
        )}

        {!loading && categories.length === 0 ? (
          <div className="categories-empty">
            <div className="categories-empty__visual" aria-hidden>
              <span className="categories-empty__glyph">⊞</span>
            </div>
            <h3 className="categories-empty__title">No categories yet</h3>
            <p className="categories-empty__text">Add a few labels—colour and emoji help you scan your spending faster.</p>
            {!formOpen && (
              <button className="secondary categories-empty__cta" type="button" onClick={openCreate}>
                Add your first category
              </button>
            )}
          </div>
        ) : (
          !loading && (
            <ul className="categories-list">
              {categories.map((cat) => {
                const count = cat.transactionCount ?? 0;
                return (
                  <li className="category-row" key={cat.id}>
                    <div className="category-row__main">
                      <div
                        className="category-avatar"
                        style={
                          cat.color
                            ? { borderColor: cat.color, background: `${cat.color}24` }
                            : undefined
                        }
                        aria-hidden
                      >
                        <span className="category-avatar__icon">{cat.icon?.trim() || '·'}</span>
                      </div>
                      <div className="category-row__text">
                        <strong className="category-row__name">{cat.name}</strong>
                        <span className="category-count-badge">
                          {count} transaction{count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div
                        className="category-row__tools"
                        role="group"
                        aria-label={`${cat.name} actions`}
                      >
                        <button
                          type="button"
                          className="category-icon-btn"
                          onClick={() => openEdit(cat)}
                          id={`btn-edit-cat-${cat.id}`}
                          aria-label={`Edit ${cat.name}`}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                            <path
                              d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="category-icon-btn category-icon-btn--danger"
                          onClick={() => handleDelete(cat)}
                          id={`btn-delete-cat-${cat.id}`}
                          aria-label={`Delete ${cat.name}`}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                            <path
                              d="M3 6h18"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>
    </>
  );
}
