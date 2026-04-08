import { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Portal from '../components/Portal.jsx';
import './Calendar.css';
import './SubscriptionsCalendar.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalIso(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function monthBounds(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { startIso: toLocalIso(start), endIso: toLocalIso(end) };
}

function buildCalendarCells(viewYear, viewMonth) {
  const first = new Date(viewYear, viewMonth, 1);
  const pad = first.getDay();
  const cells = [];
  let dayCounter = 1 - pad;
  for (let i = 0; i < 42; i += 1) {
    const cur = new Date(viewYear, viewMonth, dayCounter);
    const iso = toLocalIso(cur);
    const inMonth = cur.getMonth() === viewMonth && cur.getFullYear() === viewYear;
    cells.push({ iso, label: cur.getDate(), inMonth });
    dayCounter += 1;
  }
  return cells;
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
}

function formatNetCompact(value) {
  const num = Math.abs(Number(value));
  if (Number.isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    return formatNumber(num);
  }
}

function parseExdatesText(text) {
  if (!text || !String(text).trim()) return [];
  const parts = String(text)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) out.push(p);
  }
  return out;
}

function aggregateSubsByDay(occurrences) {
  const map = new Map();
  for (const o of occurrences) {
    const cur = map.get(o.date) || { total: 0, count: 0, items: [] };
    cur.total += Number(o.amount || 0);
    cur.count += 1;
    cur.items.push(o);
    map.set(o.date, cur);
  }
  return map;
}

const emptyForm = () => ({
  name: '',
  amount: '',
  rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
  dtstart: toLocalIso(new Date()),
  exdatesText: '',
  status: 'active',
  isTrial: false,
  trialStartedOn: '',
  trialEndsOn: '',
  notes: '',
  merchantLabel: '',
  categoryId: '',
  remindDaysBefore: '',
});

export default function SubscriptionsCalendar() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [occurrences, setOccurrences] = useState([]);
  const [subscriptionRows, setSubscriptionRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  const [selectedIso, setSelectedIso] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formStatus, setFormStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const todayIso = toLocalIso(new Date());
  const { startIso, endIso } = useMemo(
    () => monthBounds(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setFetchStatus('');
    try {
      const res = await fetch(
        `${API_BASE}/subscriptions/calendar?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load subscription calendar');
      setOccurrences(data.data || []);
    } catch (e) {
      setFetchStatus(e.message || 'Failed to load subscription calendar');
      setOccurrences([]);
    } finally {
      setLoading(false);
    }
  }, [startIso, endIso]);

  const loadSubscriptions = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch(`${API_BASE}/subscriptions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to list subscriptions');
      setSubscriptionRows(data.data || []);
    } catch {
      setSubscriptionRows([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        if (!res.ok) return;
        const data = await res.json();
        setCategories(data.data || []);
      } catch {
        setCategories([]);
      }
    }
    fetchCategories();
  }, []);

  const byDay = useMemo(() => aggregateSubsByDay(occurrences), [occurrences]);
  const cells = useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
        new Date(viewYear, viewMonth, 1),
      ),
    [viewYear, viewMonth],
  );

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function goThisMonth() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
  }

  function openDay(iso) {
    setSelectedIso(iso);
  }

  function closeSheet() {
    setSelectedIso(null);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormStatus('');
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditingId(String(row.id));
    setForm({
      name: row.name || '',
      amount: String(row.amount ?? ''),
      rrule: row.rrule || '',
      dtstart: typeof row.dtstart === 'string' ? row.dtstart.slice(0, 10) : '',
      exdatesText: Array.isArray(row.exdates) ? row.exdates.join('\n') : '',
      status: row.status || 'active',
      isTrial: Boolean(row.isTrial),
      trialStartedOn: row.trialStartedOn ? String(row.trialStartedOn).slice(0, 10) : '',
      trialEndsOn: row.trialEndsOn ? String(row.trialEndsOn).slice(0, 10) : '',
      notes: row.notes || '',
      merchantLabel: row.merchantLabel || '',
      categoryId: row.categoryId != null ? String(row.categoryId) : '',
      remindDaysBefore: row.remindDaysBefore != null ? String(row.remindDaysBefore) : '',
    });
    setFormStatus('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setFormStatus('');
  }

  async function submitForm(e) {
    e.preventDefault();
    setFormStatus('');
    const name = form.name.trim();
    const amount = Number(form.amount);
    if (!name) {
      setFormStatus('Enter a name.');
      return;
    }
    if (!form.amount || Number.isNaN(amount) || amount < 0) {
      setFormStatus('Enter a valid amount.');
      return;
    }
    if (!form.dtstart || !/^\d{4}-\d{2}-\d{2}$/.test(form.dtstart)) {
      setFormStatus('Pick a valid dtstart date.');
      return;
    }
    if (!form.rrule.trim()) {
      setFormStatus('Enter an RRULE.');
      return;
    }

    const body = {
      name,
      amount,
      rrule: form.rrule.trim(),
      dtstart: form.dtstart,
      exdates: parseExdatesText(form.exdatesText),
      status: form.status,
      isTrial: form.isTrial,
      notes: form.notes.trim() || null,
      merchantLabel: form.merchantLabel.trim() || null,
    };
    if (form.trialStartedOn && /^\d{4}-\d{2}-\d{2}$/.test(form.trialStartedOn)) {
      body.trialStartedOn = form.trialStartedOn;
    } else if (!form.trialStartedOn) {
      body.trialStartedOn = null;
    }
    if (form.trialEndsOn && /^\d{4}-\d{2}-\d{2}$/.test(form.trialEndsOn)) {
      body.trialEndsOn = form.trialEndsOn;
    } else if (!form.trialEndsOn) {
      body.trialEndsOn = null;
    }
    if (form.categoryId) body.categoryId = String(form.categoryId);
    else body.categoryId = null;
    if (form.remindDaysBefore !== '' && form.remindDaysBefore != null) {
      const n = Number(form.remindDaysBefore);
      if (!Number.isNaN(n)) body.remindDaysBefore = n;
    } else {
      body.remindDaysBefore = null;
    }

    setSaving(true);
    try {
      const url = editingId ? `${API_BASE}/subscriptions/${editingId}` : `${API_BASE}/subscriptions`;
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let msg = 'Request failed';
        if (Array.isArray(data.message)) {
          msg = data.message.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('; ');
        } else if (typeof data.message === 'string') {
          msg = data.message;
        }
        throw new Error(msg);
      }
      closeForm();
      await loadCalendar();
      await loadSubscriptions();
    } catch (err) {
      setFormStatus(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteId(null);
      await loadCalendar();
      await loadSubscriptions();
    } catch (e) {
      setFetchStatus(e.message || 'Delete failed');
      setDeleteId(null);
    }
  }

  const dayItems = selectedIso ? byDay.get(selectedIso) : null;

  return (
    <>
      <section className="card calendar-card">
        <div className="glass-panel calendar-filters">
          <div className="card-header">
            <div>
              <h2>Subscriptions calendar</h2>
              <p>
                Expected debits from RRULE rules. Isolated from bank transactions—expand occurrences on demand, no
                per-date rows in the database.
              </p>
            </div>
            <button type="button" className="primary" onClick={openCreate}>
              Add subscription
            </button>
          </div>
        </div>

        <div className="glass-panel calendar-filters">
          <div className="calendar-toolbar">
            <h2>Month</h2>
            <div className="calendar-nav-cluster">
              <button className="secondary" type="button" onClick={goPrevMonth} aria-label="Previous month">
                ‹
              </button>
              <span className="calendar-month-label">{monthTitle}</span>
              <button className="secondary" type="button" onClick={goNextMonth} aria-label="Next month">
                ›
              </button>
              <button className="secondary" type="button" onClick={goThisMonth}>
                Today
              </button>
            </div>
          </div>
          {loading && <p className="status">Loading…</p>}
          {fetchStatus && <p className="status">{fetchStatus}</p>}

          <div className="calendar-grid-wrap">
            <div className="calendar-weekdays" aria-hidden>
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="calendar-grid" role="grid" aria-label={`Subscriptions ${monthTitle}`}>
              {cells.map((cell) => {
                const stats = byDay.get(cell.iso);
                const hasData = stats && stats.count > 0;
                const isToday = cell.iso === todayIso;
                const total = stats?.total ?? 0;

                return (
                  <div
                    key={cell.iso}
                    role="gridcell"
                    className={[
                      'calendar-cell',
                      'calendar-cell--subs',
                      !cell.inMonth ? 'calendar-cell--muted' : '',
                      isToday && cell.inMonth ? 'calendar-cell--today' : '',
                      cell.inMonth && hasData ? 'calendar-cell--has-data' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    tabIndex={cell.inMonth ? 0 : -1}
                    onClick={() => cell.inMonth && openDay(cell.iso)}
                    onKeyDown={(e) => {
                      if (!cell.inMonth) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDay(cell.iso);
                      }
                    }}
                    aria-label={
                      cell.inMonth
                        ? `${cell.label} ${monthTitle.split(' ')[0]}, ${hasData ? `₹${formatNumber(total)} due` : 'no subscriptions'}`
                        : undefined
                    }
                  >
                    <span className="calendar-cell__dow-num">{cell.label}</span>
                    {cell.inMonth && hasData ? (
                      <>
                        <span className="calendar-cell__net calendar-cell__net--out">₹{formatNetCompact(total)}</span>
                        <span className="calendar-cell__count">{stats.count} due</span>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="calendar-legend">
            <span>
              <i className="out" /> Expected debit total
            </span>
            <span>
              <i /> Tap a date for details
            </span>
          </div>
        </div>

        <div className="glass-panel subscriptions-list-panel">
          <h3>All subscriptions</h3>
          {listLoading && <p className="status">Loading list…</p>}
          {!listLoading && subscriptionRows.length === 0 && (
            <p className="muted">No subscriptions yet. Add one to see it on the calendar.</p>
          )}
          <ul className="subscriptions-list">
            {subscriptionRows.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.name}</strong>
                  <span className="subscriptions-list__meta">
                    ₹{formatNumber(row.amount)} · {row.status}
                    {row.isTrial ? ' · trial' : ''}
                  </span>
                  <div className="subscriptions-list__rrule">
                    <code>{row.rrule}</code>
                  </div>
                </div>
                <div className="subscriptions-list__actions">
                  <button type="button" className="secondary" onClick={() => openEdit(row)}>
                    Edit
                  </button>
                  <button type="button" className="ghost danger" onClick={() => setDeleteId(String(row.id))}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {selectedIso && (
        <Portal>
          <div
            className="calendar-sheet-backdrop"
            role="presentation"
            onClick={(e) => e.target === e.currentTarget && closeSheet()}
          >
            <div className="calendar-sheet" role="dialog" aria-modal="true" aria-labelledby="subs-sheet-title">
              <div className="calendar-sheet__header">
                <div>
                  <h3 id="subs-sheet-title">{selectedIso}</h3>
                  <p>
                    {dayItems
                      ? `${dayItems.count} charge${dayItems.count === 1 ? '' : 's'} · ₹${formatNumber(dayItems.total)}`
                      : 'Nothing scheduled'}
                  </p>
                </div>
                <button type="button" className="ghost calendar-sheet__close" onClick={closeSheet} aria-label="Close">
                  ✕
                </button>
              </div>
              <div className="calendar-sheet__body">
                {dayItems?.items?.length ? (
                  <ul className="subs-day-list">
                    {dayItems.items.map((o) => (
                      <li key={`${o.subscriptionId}-${o.date}`}>
                        <div>
                          <strong>{o.name}</strong>
                          {o.isTrial ? <span className="subs-pill">Trial</span> : null}
                        </div>
                        <div className="subs-day-list__amt">₹{formatNumber(o.amount)}</div>
                        {o.trialEndsOn ? (
                          <div className="muted small">Trial ends {String(o.trialEndsOn).slice(0, 10)}</div>
                        ) : null}
                        {o.merchantLabel ? <div className="muted small">{o.merchantLabel}</div> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No subscription charges on this date.</p>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {formOpen && (
        <Portal>
          <div
            className="calendar-sheet-backdrop"
            role="presentation"
            onClick={(e) => e.target === e.currentTarget && !saving && closeForm()}
          >
            <div
              className="calendar-sheet calendar-sheet--wide subs-form-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="subs-form-title"
            >
              <div className="calendar-sheet__header">
                <div>
                  <h3 id="subs-form-title">{editingId ? 'Edit subscription' : 'New subscription'}</h3>
                  <p>RRULE + dtstart are stored; dates are expanded when you load the calendar.</p>
                </div>
                <button type="button" className="ghost calendar-sheet__close" onClick={closeForm} aria-label="Close">
                  ✕
                </button>
              </div>
              <form className="calendar-sheet__body subs-form" onSubmit={submitForm}>
                <label className="subs-form__field">
                  Name
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    maxLength={200}
                  />
                </label>
                <label className="subs-form__field">
                  Amount (debit)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </label>
                <label className="subs-form__field">
                  dtstart
                  <input
                    type="date"
                    value={form.dtstart}
                    onChange={(e) => setForm((f) => ({ ...f, dtstart: e.target.value }))}
                    required
                  />
                </label>
                <label className="subs-form__field">
                  RRULE
                  <textarea
                    value={form.rrule}
                    onChange={(e) => setForm((f) => ({ ...f, rrule: e.target.value }))}
                    rows={3}
                    required
                    placeholder="FREQ=MONTHLY;BYMONTHDAY=15"
                  />
                </label>
                <label className="subs-form__field">
                  Exdates (optional, one YYYY-MM-DD per line)
                  <textarea
                    value={form.exdatesText}
                    onChange={(e) => setForm((f) => ({ ...f, exdatesText: e.target.value }))}
                    rows={2}
                    placeholder="2025-06-15"
                  />
                </label>
                <label className="subs-form__field">
                  Status
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>
                <label className="subs-form__inline">
                  <input
                    type="checkbox"
                    checked={form.isTrial}
                    onChange={(e) => setForm((f) => ({ ...f, isTrial: e.target.checked }))}
                  />
                  Free trial
                </label>
                <label className="subs-form__field">
                  Trial started
                  <input
                    type="date"
                    value={form.trialStartedOn}
                    onChange={(e) => setForm((f) => ({ ...f, trialStartedOn: e.target.value }))}
                  />
                </label>
                <label className="subs-form__field">
                  Trial ends
                  <input
                    type="date"
                    value={form.trialEndsOn}
                    onChange={(e) => setForm((f) => ({ ...f, trialEndsOn: e.target.value }))}
                  />
                </label>
                <label className="subs-form__field">
                  Merchant label
                  <input
                    value={form.merchantLabel}
                    onChange={(e) => setForm((f) => ({ ...f, merchantLabel: e.target.value }))}
                    maxLength={200}
                  />
                </label>
                <label className="subs-form__field">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                  />
                </label>
                <label className="subs-form__field">
                  Category (optional)
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="subs-form__field">
                  Remind days before (optional)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.remindDaysBefore}
                    onChange={(e) => setForm((f) => ({ ...f, remindDaysBefore: e.target.value }))}
                  />
                </label>
                {formStatus && <p className="status">{formStatus}</p>}
                <div className="subs-form__actions">
                  <button type="button" className="ghost" onClick={closeForm} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" disabled={saving}>
                    {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete subscription?"
        message="This removes the rule; past bank data is unchanged."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
