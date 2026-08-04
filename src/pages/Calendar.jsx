import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  parseCalendarParams,
  patchCalendarParams,
} from '../utils/calendarParams.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Portal from '../components/Portal.jsx';
import {
  Card, Num, Pill, PrimaryBtn, GhostBtn, CatGlyph, CategoryChip, Overline,
} from '../components/ui/primitives.jsx';
import {
  IcPlus, IcChevL, IcChevR, IcClose, IcTrash, IcRepeat, IcCard,
} from '../components/ui/Icon.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { getCcLink } from '../services/cardsApi.js';
import { cardTxnStatus, toCardTableRow } from '../utils/cardTransactionRow.jsx';
import TransactionListRow from '../components/TransactionListRow.jsx';
import TransactionManageSheet from '../components/TransactionManageSheet.jsx';
import { useCardTransactionManager } from '../hooks/useCardTransactionManager.js';
import { inr, inrCompact } from '../utils/inr.js';
import { CATEGORY_PALETTE, categoryColor, categoryKeyForName } from '../utils/categoryColors.js';
import './calendar-redesign.css';

import { API_BASE, apiFetch } from '../services/http.js';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthBounds(year, month) {
  return {
    startIso: toLocalIso(new Date(year, month, 1)),
    endIso: toLocalIso(new Date(year, month + 1, 0)),
  };
}

function buildCells(year, month) {
  const first = new Date(year, month, 1);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(year, month, 1 - first.getDay() + i);
    cells.push({
      iso: toLocalIso(cur),
      label: cur.getDate(),
      inMonth: cur.getMonth() === month && cur.getFullYear() === year,
    });
  }
  return cells;
}

function parseExdatesText(text) {
  if (!text || !String(text).trim()) return [];
  return String(text).split(/[\s,]+/).map((s) => s.trim()).filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
}

const emptyForm = () => ({
  name: '', amount: '', rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
  dtstart: toLocalIso(new Date()), exdatesText: '', status: 'active',
  isTrial: false, trialStartedOn: '', trialEndsOn: '',
  notes: '', merchantLabel: '', categoryId: '', remindDaysBefore: '',
});

function subColor(name) {
  return CATEGORY_PALETTE[categoryKeyForName(name)] || CATEGORY_PALETTE.transfer;
}

function summarizeRRule(rrule) {
  if (!rrule) return 'Recurring';
  const freq = (rrule.match(/FREQ=([A-Z]+)/) || [])[1];
  const byDay = (rrule.match(/BYMONTHDAY=(\d+)/) || [])[1];
  if (freq === 'MONTHLY' && byDay) return `Day ${byDay} · Monthly`;
  if (freq === 'WEEKLY') return 'Weekly';
  if (freq === 'YEARLY') return 'Yearly';
  return freq ? freq[0] + freq.slice(1).toLowerCase() : 'Recurring';
}

function txMethod(tx) {
  if (tx.upiBank) return `UPI · ${tx.upiBank}`;
  return tx.isManual ? 'Manual' : 'Bank';
}

function accountSuffix(accountNumber) {
  if (!accountNumber) return null;
  return `••••${String(accountNumber).slice(-4)}`;
}

/** Matches Transactions page: uncategorized when categoryId is null/empty. */
function isTransactionCategorized(tx) {
  return tx.categoryId != null && tx.categoryId !== '';
}

/**
 * CC bill payments only count as fully categorized when every nested card
 * transaction under them has a category. Prefer a loaded cc-link detail
 * (reflects in-session edits); fall back to the range payload annotation.
 * Empty nested lists are vacuously complete. Unknown state → not complete
 * (do not show green).
 */
function ccNestedAllCategorized(tx, ccDetail) {
  if (!tx.ccBillPayment) return true;
  if (ccDetail && !ccDetail.loading && !ccDetail.error && Array.isArray(ccDetail.coveredTransactions)) {
    return ccDetail.coveredTransactions.every(isTransactionCategorized);
  }
  if (typeof tx.ccBillPayment.allCoveredCategorized === 'boolean') {
    return tx.ccBillPayment.allCoveredCategorized;
  }
  return false;
}

function dayCategorizationState(txs, ccDetailByTransaction = {}) {
  if (txs.length === 0) return null;
  const complete = txs.every(
    (tx) =>
      isTransactionCategorized(tx) &&
      ccNestedAllCategorized(tx, ccDetailByTransaction[tx.id]),
  );
  return complete ? 'categorized' : 'needs-category';
}

/**
 * Aggregate the month's withdrawals into category-wise slices for the donut.
 * Uses the already-loaded transactions, so the total matches the header "spent".
 * Every category is shown — sorted largest-first, no "Other" bucket.
 */
function buildCategorySpend(transactions) {
  const byCat = new Map();
  let total = 0;
  for (const t of transactions) {
    const amount = Number(t.withdrawal || 0);
    if (!(amount > 0)) continue;
    total += amount;
    const cat = t.category || null;
    const key = cat?.id != null ? `c${cat.id}` : 'uncategorized';
    let entry = byCat.get(key);
    if (!entry) {
      entry = {
        key,
        name: cat?.name || 'Uncategorized',
        color: cat ? categoryColor(cat) : 'var(--ft-text-faint)',
        amount: 0,
      };
      byCat.set(key, entry);
    }
    entry.amount += amount;
  }

  const list = [...byCat.values()].sort((a, b) => b.amount - a.amount);
  const segments = list.map((x) => ({ ...x, fraction: total > 0 ? x.amount / total : 0 }));
  return { segments, total };
}

export default function Calendar() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 720px)');
  const [searchParams, setSearchParams] = useSearchParams();

  const today = new Date();
  const todayIso = toLocalIso(today);
  const calendarDefaults = useMemo(
    () => ({ viewYear: today.getFullYear(), viewMonth: today.getMonth(), selectedIso: todayIso }),
    [todayIso],
  );
  const { viewYear, viewMonth, selectedIso } = useMemo(
    () => parseCalendarParams(searchParams, calendarDefaults),
    [searchParams, calendarDefaults],
  );

  const patchCalendar = useCallback((patch) => {
    setSearchParams((prev) => patchCalendarParams(prev, patch), { replace: true });
  }, [setSearchParams]);

  // Primary: transactions
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);

  // Secondary: subscriptions
  const [occurrences, setOccurrences] = useState([]);
  const [subs, setSubs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subLoading, setSubLoading] = useState(false);

  const [rightPanel, setRightPanel] = useState('day'); // 'day' | 'subs'
  const [status, setStatus] = useState('');

  // Subscription form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formStatus, setFormStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [categoryStatusByTransaction, setCategoryStatusByTransaction] = useState({});

  // Manual / cash transaction form (mirrors Transactions page)
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualStatus, setManualStatus] = useState('');
  const [manualForm, setManualForm] = useState({
    transactionDate: todayIso,
    narration: '',
    type: 'PAID',
    settlementDirection: 'WITHDRAWAL',
    amount: '',
    balance: '',
    upiName: '',
    upiDescription: '',
    upiBank: '',
  });

  const { startIso, endIso } = useMemo(() => monthBounds(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthTitle = useMemo(
    () => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1)),
    [viewYear, viewMonth],
  );

  // Fetch transactions for the month
  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setStatus('');
    try {
      const res = await apiFetch(`${API_BASE}/imports/transactions/range?start=${startIso}&end=${endIso}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load transactions');
      setTransactions(data.data || []);
    } catch (e) {
      setStatus(e.message || 'Failed to load transactions');
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [startIso, endIso]);

  // Fetch subscription occurrences for the month
  const loadOccurrences = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/subscriptions/calendar?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`);
      const data = await res.json();
      if (res.ok) setOccurrences(data.data || []);
    } catch {}
    finally { setSubLoading(false); }
  }, [startIso, endIso]);

  const loadSubs = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/subscriptions`);
      const data = await res.json();
      if (res.ok) setSubs(data.data || []);
    } catch {}
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadOccurrences(); }, [loadOccurrences]);
  useEffect(() => { loadSubs(); }, [loadSubs]);
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/categories`);
        if (res.ok) { const d = await res.json(); setCategories(d.data || []); }
      } catch {}
    })();
  }, []);

  // If URL has ?view=subscriptions, show the subs panel by default
  useEffect(() => {
    if (searchParams.get('view') === 'subscriptions') setRightPanel('subs');
  }, [searchParams]);

  // Group transactions by day
  const txByDay = useMemo(() => {
    const m = new Map();
    for (const t of transactions) {
      const key = t.transactionDate ? t.transactionDate.slice(0, 10) : 'unknown';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(t);
    }
    return m;
  }, [transactions]);

  // Group subscription occurrences by day
  const subByDay = useMemo(() => {
    const m = new Map();
    for (const o of occurrences) {
      if (!m.has(o.date)) m.set(o.date, []);
      m.get(o.date).push(o);
    }
    return m;
  }, [occurrences]);

  const cells = useMemo(() => buildCells(viewYear, viewMonth), [viewYear, viewMonth]);

  // Monthly summaries
  const monthSpent = useMemo(() => transactions.reduce((s, t) => s + Number(t.withdrawal || 0), 0), [transactions]);
  const monthEarned = useMemo(() => transactions.reduce((s, t) => s + Number(t.deposit || 0), 0), [transactions]);
  const monthSubTotal = useMemo(() => occurrences.reduce((s, o) => s + Number(o.amount || 0), 0), [occurrences]);

  // Selected day data
  const selectedTxs = useMemo(() => (selectedIso ? (txByDay.get(selectedIso) || []) : []), [selectedIso, txByDay]);
  const selectedSubs = useMemo(() => (selectedIso ? (subByDay.get(selectedIso) || []) : []), [selectedIso, subByDay]);

  function goPrev() {
    if (viewMonth === 0) patchCalendar({ viewYear: viewYear - 1, viewMonth: 11 });
    else patchCalendar({ viewYear, viewMonth: viewMonth - 1 });
  }
  function goNext() {
    if (viewMonth === 11) patchCalendar({ viewYear: viewYear + 1, viewMonth: 0 });
    else patchCalendar({ viewYear, viewMonth: viewMonth + 1 });
  }
  function goToday() {
    const t = new Date();
    patchCalendar({ viewYear: t.getFullYear(), viewMonth: t.getMonth(), selectedIso: todayIso });
  }

  const openTransactionDetail = useCallback((tx) => {
    const qs = searchParams.toString();
    navigate(`/transactions/${tx.id}`, {
      state: { tx, ...(qs ? { calendarSearch: qs } : {}) },
    });
  }, [navigate, searchParams]);

  function openCreate() {
    setEditingId(null); setForm(emptyForm()); setFormStatus(''); setFormOpen(true);
  }

  function openManual() {
    setManualForm({
      transactionDate: selectedIso || todayIso,
      narration: '',
      type: 'PAID',
      settlementDirection: 'WITHDRAWAL',
      amount: '',
      balance: '',
      upiName: '',
      upiDescription: '',
      upiBank: '',
    });
    setManualStatus('');
    setManualOpen(true);
  }

  async function handleManualSubmit(event) {
    event.preventDefault();
    setManualStatus('');
    const narration = manualForm.narration.trim();
    const amountValue = Number(manualForm.amount);
    const balanceValue = manualForm.balance === '' ? undefined : Number(manualForm.balance);

    if (!manualForm.transactionDate) return setManualStatus('Select a transaction date.');
    if (!narration) return setManualStatus('Enter a narration.');
    if (!manualForm.amount || Number.isNaN(amountValue) || amountValue <= 0) return setManualStatus('Enter a valid amount.');
    if (manualForm.type === 'SETTLEMENT' && !manualForm.settlementDirection) return setManualStatus('Select settlement direction.');
    if (balanceValue !== undefined && (Number.isNaN(balanceValue) || balanceValue < 0)) return setManualStatus('Balance must be zero or positive.');

    setManualSubmitting(true);
    try {
      const res = await apiFetch(`${API_BASE}/transactions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionDate: manualForm.transactionDate,
          narration,
          type: manualForm.type,
          settlementDirection: manualForm.type === 'SETTLEMENT' ? manualForm.settlementDirection : undefined,
          amount: amountValue,
          balance: balanceValue,
          upiName: manualForm.upiName.trim() || undefined,
          upiDescription: manualForm.upiDescription.trim() || undefined,
          upiBank: manualForm.upiBank.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add manual transaction.');
      setManualStatus('Manual transaction added.');
      setManualOpen(false);
      await loadTransactions();
    } catch (error) {
      setManualStatus(error.message || 'Failed to add manual transaction.');
    } finally {
      setManualSubmitting(false);
    }
  }
  function openEdit(row) {
    setEditingId(String(row.id));
    setForm({
      name: row.name || '', amount: String(row.amount ?? ''),
      rrule: row.rrule || 'FREQ=MONTHLY;BYMONTHDAY=1',
      dtstart: typeof row.dtstart === 'string' ? row.dtstart.slice(0, 10) : toLocalIso(new Date()),
      exdatesText: Array.isArray(row.exdates) ? row.exdates.join('\n') : '',
      status: row.status || 'active', isTrial: Boolean(row.isTrial),
      trialStartedOn: row.trialStartedOn ? String(row.trialStartedOn).slice(0, 10) : '',
      trialEndsOn: row.trialEndsOn ? String(row.trialEndsOn).slice(0, 10) : '',
      notes: row.notes || '', merchantLabel: row.merchantLabel || '',
      categoryId: row.categoryId != null ? String(row.categoryId) : '',
      remindDaysBefore: row.remindDaysBefore != null ? String(row.remindDaysBefore) : '',
    });
    setFormStatus(''); setFormOpen(true);
  }

  async function submitForm(e) {
    e.preventDefault(); setFormStatus('');
    const name = form.name.trim();
    const amount = Number(form.amount);
    if (!name) return setFormStatus('Enter a name.');
    if (Number.isNaN(amount) || amount < 0) return setFormStatus('Enter a valid amount.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dtstart)) return setFormStatus('Pick a valid start date.');
    if (!form.rrule.trim()) return setFormStatus('Enter an RRULE.');
    const body = {
      name, amount, rrule: form.rrule.trim(), dtstart: form.dtstart,
      exdates: parseExdatesText(form.exdatesText), status: form.status, isTrial: form.isTrial,
      notes: form.notes.trim() || null, merchantLabel: form.merchantLabel.trim() || null,
      trialStartedOn: /^\d{4}-\d{2}-\d{2}$/.test(form.trialStartedOn) ? form.trialStartedOn : null,
      trialEndsOn: /^\d{4}-\d{2}-\d{2}$/.test(form.trialEndsOn) ? form.trialEndsOn : null,
      categoryId: form.categoryId ? String(form.categoryId) : null,
      remindDaysBefore: form.remindDaysBefore !== '' ? Number(form.remindDaysBefore) : null,
    };
    setSaving(true);
    try {
      const url = editingId ? `${API_BASE}/subscriptions/${editingId}` : `${API_BASE}/subscriptions`;
      const res = await apiFetch(url, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let msg = 'Request failed';
        if (Array.isArray(data.message)) msg = data.message.map((m) => typeof m === 'string' ? m : JSON.stringify(m)).join('; ');
        else if (typeof data.message === 'string') msg = data.message;
        throw new Error(msg);
      }
      setFormOpen(false); setEditingId(null);
      await loadOccurrences(); await loadSubs();
    } catch (err) { setFormStatus(err.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await apiFetch(`${API_BASE}/subscriptions/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteId(null); await loadOccurrences(); await loadSubs();
    } catch (e) { setStatus(e.message || 'Delete failed'); setDeleteId(null); }
  }

  const assignCategory = useCallback(
    async (transactionId, categoryId) => {
      setCategoryStatusByTransaction((p) => ({ ...p, [transactionId]: 'Saving…' }));
      try {
        const res = categoryId
          ? await apiFetch(`${API_BASE}/transactions/${transactionId}/category`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: Number(categoryId) }),
          })
          : await apiFetch(`${API_BASE}/transactions/${transactionId}/category`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to save category');
        const cat = categories.find((c) => String(c.id) === String(categoryId)) || null;
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, categoryId: cat ? cat.id : null, category: cat } : t)),
        );
        setCategoryStatusByTransaction((p) => ({ ...p, [transactionId]: '' }));
      } catch {
        setCategoryStatusByTransaction((p) => ({ ...p, [transactionId]: 'Failed to save' }));
      }
    },
    [categories],
  );

  // Card transactions nested under a bill payment are managed the same way as
  // anywhere else. They live in each row's local cc-link state, so the tag map
  // is seeded as those rows load and merged across expanded rows.
  const [friends, setFriends] = useState([]);
  // The cc-link payloads live here rather than in each row so that editing a
  // covered card transaction can write straight back into the rendered copy.
  const [ccDetailByTransaction, setCcDetailByTransaction] = useState({});

  useEffect(() => {
    apiFetch(`${API_BASE}/friends`)
      .then((r) => r.json())
      .then((d) => setFriends(d.data || []))
      .catch(() => {});
  }, []);

  const cardManager = useCardTransactionManager({
    categories,
    onRowPatched: (txnId, patch) =>
      setCcDetailByTransaction((prev) => {
        const next = { ...prev };
        for (const [bankId, detail] of Object.entries(next)) {
          if (!detail?.coveredTransactions) continue;
          if (!detail.coveredTransactions.some((t) => String(t.id) === String(txnId))) continue;
          next[bankId] = {
            ...detail,
            coveredTransactions: detail.coveredTransactions.map((t) =>
              String(t.id) === String(txnId) ? { ...t, ...patch } : t,
            ),
          };
        }
        return next;
      }),
  });
  const { seedTags: seedCardTags, openManage: openCardManage } = cardManager;

  const loadCcDetail = useCallback(async (bankTxId) => {
    setCcDetailByTransaction((p) => ({ ...p, [bankTxId]: { loading: true } }));
    try {
      const data = await getCcLink(bankTxId);
      setCcDetailByTransaction((p) => ({ ...p, [bankTxId]: data }));
      // Merge, not replace: other bill payments may already be expanded.
      seedCardTags(data.coveredTransactions);
    } catch (error) {
      setCcDetailByTransaction((p) => ({
        ...p,
        [bankTxId]: { error: error.message || 'Failed to load card transactions' },
      }));
    }
  }, [seedCardTags]);

  // Read the sheet's row back out of the cache so it reflects edits.
  const cardManageRow = useMemo(() => {
    if (!cardManager.manageSheetId) return null;
    for (const detail of Object.values(ccDetailByTransaction)) {
      const hit = (detail?.coveredTransactions || []).find(
        (t) => String(t.id) === String(cardManager.manageSheetId),
      );
      if (hit) return hit;
    }
    return null;
  }, [cardManager.manageSheetId, ccDetailByTransaction]);

  const cardSheet = cardManageRow && (
    <TransactionManageSheet
      {...cardManager.manageSheetPropsFor(cardManageRow)}
      metaLine={cardTxnStatus(cardManageRow)}
      friends={friends}
    />
  );

  // Subscription form sheet (shared)
  const formSheet = formOpen && (
    <Portal>
      <div className="calendar-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setFormOpen(false)}>
        <div className="calendar-sheet" role="dialog" aria-modal="true">
          <div className="ft-sheet__grabber" />
          <h3 className="ft-sheet__title">{editingId ? 'Edit subscription' : 'New subscription'}</h3>
          <p className="ft-sheet__sub">Recurring bills scheduled via RFC 5545 RRULE.</p>
          <form onSubmit={submitForm} className="form-grid">
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Name</span>
              <input type="text" placeholder="Netflix" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label className="field"><span>Amount (₹)</span>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
            </label>
            <label className="field"><span>Start date</span>
              <input type="date" value={form.dtstart} onChange={(e) => setForm((p) => ({ ...p, dtstart: e.target.value }))} />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>RRULE</span>
              <input type="text" value={form.rrule} onChange={(e) => setForm((p) => ({ ...p, rrule: e.target.value }))} />
            </label>
            <label className="field"><span>Status</span>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="field"><span>Category</span>
              <select value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Merchant label</span>
              <input type="text" value={form.merchantLabel} onChange={(e) => setForm((p) => ({ ...p, merchantLabel: e.target.value }))} />
            </label>
            <label className="field"><span>Remind days before</span>
              <input type="number" min="0" value={form.remindDaysBefore} onChange={(e) => setForm((p) => ({ ...p, remindDaysBefore: e.target.value }))} />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Exception dates (YYYY-MM-DD, one per line)</span>
              <textarea rows="2" value={form.exdatesText} onChange={(e) => setForm((p) => ({ ...p, exdatesText: e.target.value }))} style={{ minHeight: 56, resize: 'vertical' }} />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Notes</span>
              <textarea rows="2" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} style={{ minHeight: 56, resize: 'vertical' }} />
            </label>
            <label style={{ gridColumn: '1 / -1', display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--ft-text-dim)', fontSize: 13 }}>
              <input type="checkbox" checked={form.isTrial} onChange={(e) => setForm((p) => ({ ...p, isTrial: e.target.checked }))} style={{ width: 'auto', minHeight: 0 }} />
              <span>Trial subscription</span>
            </label>
            {form.isTrial && (
              <>
                <label className="field"><span>Trial started on</span>
                  <input type="date" value={form.trialStartedOn} onChange={(e) => setForm((p) => ({ ...p, trialStartedOn: e.target.value }))} />
                </label>
                <label className="field"><span>Trial ends on</span>
                  <input type="date" value={form.trialEndsOn} onChange={(e) => setForm((p) => ({ ...p, trialEndsOn: e.target.value }))} />
                </label>
              </>
            )}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              {editingId && (
                <GhostBtn onClick={() => setDeleteId(editingId)} style={{ color: 'var(--ft-spend)', borderColor: 'rgba(255,122,122,0.3)' }}>
                  <IcTrash size={14} /> Delete
                </GhostBtn>
              )}
              <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                <GhostBtn onClick={() => setFormOpen(false)}>Cancel</GhostBtn>
                <PrimaryBtn type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn>
              </div>
            </div>
            {formStatus && <p className="status" style={{ gridColumn: '1 / -1' }}>{formStatus}</p>}
          </form>
        </div>
      </div>
    </Portal>
  );

  const manualSheet = manualOpen && (
    <Portal>
      <div
        className="calendar-sheet-backdrop"
        onClick={(e) => e.target === e.currentTarget && setManualOpen(false)}
      >
        <div className="calendar-sheet" role="dialog" aria-modal="true">
          <div className="ft-sheet__grabber" />
          <h3 className="ft-sheet__title">Add manual transaction</h3>
          <p className="ft-sheet__sub">Manual entries are posted to the Wallet account.</p>
          <form onSubmit={handleManualSubmit} className="form-grid" style={{ marginTop: 4 }}>
            <label className="field"><span>Date</span>
              <input type="date" value={manualForm.transactionDate}
                onChange={(e) => setManualForm((p) => ({ ...p, transactionDate: e.target.value }))} />
            </label>
            <label className="field"><span>Type</span>
              <select value={manualForm.type}
                onChange={(e) => setManualForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="PAID">Paid</option>
                <option value="RECEIVED">Received</option>
                <option value="I_OWE">I owe</option>
                <option value="SETTLEMENT">Settlement</option>
              </select>
            </label>
            {manualForm.type === 'SETTLEMENT' && (
              <label className="field"><span>Settlement direction</span>
                <select value={manualForm.settlementDirection}
                  onChange={(e) => setManualForm((p) => ({ ...p, settlementDirection: e.target.value }))}>
                  <option value="WITHDRAWAL">Withdrawal</option>
                  <option value="DEPOSIT">Deposit</option>
                </select>
              </label>
            )}
            <label className="field"><span>Amount (₹)</span>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={manualForm.amount}
                onChange={(e) => setManualForm((p) => ({ ...p, amount: e.target.value }))} />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Narration</span>
              <input type="text" placeholder="What was this for?" value={manualForm.narration}
                onChange={(e) => setManualForm((p) => ({ ...p, narration: e.target.value }))} />
            </label>
            <label className="field"><span>Balance (optional)</span>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={manualForm.balance}
                onChange={(e) => setManualForm((p) => ({ ...p, balance: e.target.value }))} />
            </label>
            <label className="field"><span>UPI name</span>
              <input type="text" placeholder="Optional" value={manualForm.upiName}
                onChange={(e) => setManualForm((p) => ({ ...p, upiName: e.target.value }))} />
            </label>
            <label className="field"><span>UPI description</span>
              <input type="text" placeholder="Optional" value={manualForm.upiDescription}
                onChange={(e) => setManualForm((p) => ({ ...p, upiDescription: e.target.value }))} />
            </label>
            <label className="field"><span>UPI bank</span>
              <input type="text" placeholder="Optional" value={manualForm.upiBank}
                onChange={(e) => setManualForm((p) => ({ ...p, upiBank: e.target.value }))} />
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <GhostBtn onClick={() => setManualOpen(false)}>Cancel</GhostBtn>
              <PrimaryBtn type="submit" disabled={manualSubmitting}>
                {manualSubmitting ? 'Adding…' : 'Save transaction'}
              </PrimaryBtn>
            </div>
            {manualStatus && <p className="status" style={{ gridColumn: '1 / -1' }}>{manualStatus}</p>}
          </form>
        </div>
      </div>
    </Portal>
  );

  // ===== MOBILE =====
  if (isMobile) {
    const selLabel = selectedIso
      ? new Date(selectedIso + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
      : null;
    const selSpent = selectedTxs.reduce((s, t) => s + Number(t.withdrawal || 0), 0);
    const selEarned = selectedTxs.reduce((s, t) => s + Number(t.deposit || 0), 0);

    return (
      <>
        <ConfirmDialog open={Boolean(deleteId)} title="Delete subscription?" message="This removes the recurring bill." confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
        {formSheet}
        {manualSheet}
        {cardSheet}

        <header className="ft-mobile__header">
          <h1 className="ft-mobile__title">Calendar</h1>
          <button className="ft-mobile__icon-btn" onClick={openManual} aria-label="New transaction">
            <IcPlus size={20} />
          </button>
        </header>

        <main className="ft-mobile__content">
          {/* Month grid */}
          <Card pad={14}>
            <div className="cal-toolbar">
              <button className="ft-mobile__icon-btn" onClick={goPrev} aria-label="Previous"><IcChevL size={18} /></button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{monthTitle}</div>
                <Num size={11} color="var(--ft-text-dim)">
                  {inrCompact(monthSpent)} spent · {inrCompact(monthEarned)} earned
                </Num>
              </div>
              <button className="ft-mobile__icon-btn" onClick={goNext} aria-label="Next"><IcChevR size={18} /></button>
            </div>
            <CalendarGrid
              cells={cells} txByDay={txByDay} subByDay={subByDay}
              ccDetailByTransaction={ccDetailByTransaction}
              todayIso={todayIso} selectedIso={selectedIso}
              onClickDay={(iso) => patchCalendar({ selectedIso: iso })} compact
            />
          </Card>

          {/* Selected day transactions */}
          {selectedIso && (
            <Card pad={0}>
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--ft-border)' }}>
                <Overline>{selLabel}</Overline>
                {(selSpent > 0 || selEarned > 0) && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    {selSpent > 0 && <Num size={14} weight={600} color="var(--ft-spend)">{inr(-selSpent)}</Num>}
                    {selEarned > 0 && <Num size={14} weight={600} color="var(--ft-income)">+{inr(selEarned)}</Num>}
                  </div>
                )}
              </div>
              {selectedTxs.length === 0 && selectedSubs.length === 0 ? (
                <p className="empty" style={{ padding: 20, textAlign: 'center', margin: 0 }}>No activity this day.</p>
              ) : (
                <div>
                  {selectedTxs.map((t) => (
                    <DayTxRow
                      key={t.id}
                      tx={t}
                      categories={categories}
                      categoryStatus={categoryStatusByTransaction[t.id]}
                      onAssignCategory={assignCategory}
                      onOpenDetail={() => openTransactionDetail(t)}
                      ccDetail={ccDetailByTransaction[t.id]}
                      onLoadCcDetail={loadCcDetail}
                      cardTags={cardManager.tagsByTransaction}
                      onAssignCardCategory={cardManager.assignCategory}
                      onOpenCardManage={openCardManage}
                    />
                  ))}
                  {selectedSubs.map((o, i) => (
                    <DaySubRow key={i} occ={o} />
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Month category breakdown */}
          <CategorySpendCard transactions={transactions} />

          {/* Upcoming subscriptions */}
          <Card pad={16}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Overline>Upcoming bills</Overline>
              <GhostBtn onClick={openCreate} style={{ height: 28, padding: '0 10px', fontSize: 12 }}>
                <IcPlus size={12} /> Add
              </GhostBtn>
            </div>
            {occurrences.length > 0 ? (
              <UpcomingList occurrences={occurrences} todayIso={todayIso} onOpenEdit={openEdit} />
            ) : (
              <p className="empty" style={{ margin: 0, padding: '4px 0 2px' }}>No upcoming bills this month.</p>
            )}
          </Card>

          {status && <p className="status">{status}</p>}
        </main>
      </>
    );
  }

  // ===== DESKTOP =====
  const selLabel = selectedIso
    ? new Date(selectedIso + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  const selSpent = selectedTxs.reduce((s, t) => s + Number(t.withdrawal || 0), 0);
  const selEarned = selectedTxs.reduce((s, t) => s + Number(t.deposit || 0), 0);

  return (
    <>
      <ConfirmDialog open={Boolean(deleteId)} title="Delete subscription?" message="This removes the recurring bill." confirmLabel="Delete" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />
      {formSheet}
      {manualSheet}
      {cardSheet}

      <header className="ft-page-header">
        <div>
          <p className="ft-page-header__sub">
            <Num size={13} weight={600}>{inr(monthSpent)}</Num> spent ·{' '}
            <Num size={13} weight={600} color="var(--ft-income)">{inr(monthEarned)}</Num> earned ·{' '}
            <Num size={13} weight={500} color="var(--ft-text-dim)">{inr(monthSubTotal)}</Num> in bills
          </p>
          <h1 className="ft-page-header__title">{monthTitle}</h1>
        </div>
        <div className="ft-page-header__actions">
          <GhostBtn onClick={goPrev} aria-label="Prev month"><IcChevL size={14} /></GhostBtn>
          <GhostBtn onClick={goToday}>Today</GhostBtn>
          <GhostBtn onClick={goNext} aria-label="Next month"><IcChevR size={14} /></GhostBtn>
          <div style={{ width: 1, height: 24, background: 'var(--ft-border)', margin: '0 4px' }} />
          <Pill active={rightPanel === 'day'} onClick={() => setRightPanel('day')}>Transactions</Pill>
          <Pill active={rightPanel === 'subs'} onClick={() => setRightPanel('subs')}>
            <IcRepeat size={12} /> Subscriptions
          </Pill>
          <PrimaryBtn onClick={openManual}><IcPlus size={16} /> New transaction</PrimaryBtn>
          <GhostBtn onClick={openCreate}><IcPlus size={16} /> New subscription</GhostBtn>
        </div>
      </header>

      <div className="cal-grid-2">
        {/* Left: calendar grid */}
        <Card pad={20}>
          {txLoading ? (
            <p className="status">Loading…</p>
          ) : (
            <CalendarGrid
              cells={cells} txByDay={txByDay} subByDay={subByDay}
              ccDetailByTransaction={ccDetailByTransaction}
              todayIso={todayIso} selectedIso={selectedIso}
              onClickDay={(iso) => { patchCalendar({ selectedIso: iso }); setRightPanel('day'); }}
            />
          )}
          {status && <p className="status">{status}</p>}
        </Card>

        {/* Right column: day detail / subscriptions + month category breakdown */}
        <div className="cal-right-col">
        {rightPanel === 'day' ? (
          <Card pad={0}>
            {selectedIso ? (
              <>
                <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--ft-border)' }}>
                  <Overline>{selLabel}</Overline>
                  <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                    <div>
                      <div style={{ color: 'var(--ft-text-dim)', fontSize: 11, marginBottom: 2 }}>Spent</div>
                      <Num size={20} weight={600} color={selSpent > 0 ? 'var(--ft-spend)' : 'var(--ft-text-faint)'}>
                        {inr(selSpent)}
                      </Num>
                    </div>
                    <div>
                      <div style={{ color: 'var(--ft-text-dim)', fontSize: 11, marginBottom: 2 }}>Earned</div>
                      <Num size={20} weight={600} color={selEarned > 0 ? 'var(--ft-income)' : 'var(--ft-text-faint)'}>
                        {inr(selEarned)}
                      </Num>
                    </div>
                    <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
                      <span style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>
                        {selectedTxs.length} transaction{selectedTxs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 480 }}>
                  {selectedTxs.length === 0 && selectedSubs.length === 0 ? (
                    <p className="empty" style={{ padding: '24px 18px', margin: 0 }}>No activity this day.</p>
                  ) : (
                    <>
                      {selectedTxs.map((t) => (
                        <DayTxRow
                          key={t.id}
                          tx={t}
                          categories={categories}
                          categoryStatus={categoryStatusByTransaction[t.id]}
                          onAssignCategory={assignCategory}
                          onOpenDetail={() => openTransactionDetail(t)}
                          ccDetail={ccDetailByTransaction[t.id]}
                          onLoadCcDetail={loadCcDetail}
                          cardTags={cardManager.tagsByTransaction}
                          onAssignCardCategory={cardManager.assignCategory}
                          onOpenCardManage={openCardManage}
                        />
                      ))}
                      {selectedSubs.length > 0 && (
                        <div style={{ padding: '10px 18px 6px', borderTop: selectedTxs.length > 0 ? '1px solid var(--ft-border)' : 0 }}>
                          <Overline>Bills due</Overline>
                        </div>
                      )}
                      {selectedSubs.map((o, i) => (
                        <DaySubRow key={i} occ={o} />
                      ))}
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="empty" style={{ padding: 28 }}>Select a day to see activity.</p>
            )}
          </Card>
        ) : (
          <Card pad={18}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.2px' }}>Subscriptions</div>
                <div style={{ color: 'var(--ft-text-dim)', fontSize: 12, marginTop: 2 }}>
                  {subs.length} recurring bill{subs.length !== 1 ? 's' : ''} · {inr(monthSubTotal)} this month
                </div>
              </div>
              <GhostBtn onClick={openCreate} style={{ height: 32, padding: '0 12px', fontSize: 12 }}>
                <IcPlus size={12} /> Add
              </GhostBtn>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subs.length === 0 ? (
                <p className="empty">No subscriptions yet.</p>
              ) : (
                subs.map((row) => (
                  <button key={row.id} type="button" className="cal-sub-row" onClick={() => openEdit(row)}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: subColor(row.merchantLabel || row.name), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ color: 'var(--ft-text)', fontWeight: 500, fontSize: 14 }}>{row.name}</div>
                      <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>{summarizeRRule(row.rrule)}</div>
                    </div>
                    <Num size={14} weight={600}>{inr(Number(row.amount || 0))}</Num>
                  </button>
                ))
              )}
            </div>
            {subLoading && <p className="status" style={{ marginTop: 10 }}>Refreshing…</p>}
          </Card>
        )}
          <CategorySpendCard transactions={transactions} />
        </div>
      </div>
    </>
  );
}

// ── Calendar Grid ──────────────────────────────────────────────────────────────
function CalendarGrid({ cells, txByDay, subByDay, ccDetailByTransaction = {}, todayIso, selectedIso, onClickDay, compact }) {
  return (
    <div className={`cal-grid${compact ? ' cal-grid--compact' : ''}`}>
      {WEEKDAYS.map((wd) => (
        <div key={wd} className="cal-grid__wd">{wd}</div>
      ))}
      {cells.map((cell, i) => {
        const txs = txByDay.get(cell.iso) || [];
        const subs = subByDay.get(cell.iso) || [];
        const isToday = cell.iso === todayIso;
        const isSelected = cell.iso === selectedIso;
        const spent = txs.reduce((s, t) => s + Number(t.withdrawal || 0), 0);
        const earned = txs.reduce((s, t) => s + Number(t.deposit || 0), 0);
        const hasTx = txs.length > 0;
        const hasSub = subs.length > 0;
        const catState = dayCategorizationState(txs, ccDetailByTransaction);

        return (
          <button
            key={i}
            type="button"
            className={[
              'cal-cell',
              !cell.inMonth ? 'cal-cell--off' : '',
              isToday ? 'cal-cell--today' : '',
              isSelected ? 'cal-cell--selected' : '',
              hasTx ? 'cal-cell--has-tx' : '',
              catState === 'categorized' ? 'cal-cell--categorized' : '',
              catState === 'needs-category' ? 'cal-cell--needs-category' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onClickDay(cell.iso)}
          >
            <div className="cal-cell__day">
              <span className={isToday ? 'cal-cell__day-today' : undefined}>{cell.label}</span>
              {hasSub && <span className="cal-cell__sub-dot" title={`${subs.length} bill${subs.length > 1 ? 's' : ''} due`} />}
            </div>
            {hasTx && !compact && (
              <div className="cal-cell__amounts">
                {spent > 0 && (
                  <span className="cal-cell__amt cal-cell__amt--spend">
                    {inrCompact(spent)}
                  </span>
                )}
                {earned > 0 && (
                  <span className="cal-cell__amt cal-cell__amt--earn">
                    +{inrCompact(earned)}
                  </span>
                )}
              </div>
            )}
            {hasTx && compact && (
              <div className="cal-cell__dot-row">
                {spent > 0 && <span className="cal-cell__dot cal-cell__dot--spend" />}
                {earned > 0 && <span className="cal-cell__dot cal-cell__dot--earn" />}
              </div>
            )}
            {!compact && hasTx && (
              <div className="cal-cell__bar" style={{
                background: spent > 0 && earned > 0
                  ? `linear-gradient(to right, var(--ft-spend) ${Math.round(spent / (spent + earned) * 100)}%, var(--ft-income) 0)`
                  : spent > 0 ? 'var(--ft-spend)' : 'var(--ft-income)',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Day transaction row ────────────────────────────────────────────────────────
// CC bill payments expand in-place (same getCcLink payload as Transactions) and
// list covered card txns under the row. Expand state lives on the row so mobile
// and desktop share one component without Calendar plumbing.
function DayTxRow({
  tx, categories, categoryStatus, onAssignCategory, onOpenDetail,
  ccDetail, onLoadCcDetail, cardTags, onAssignCardCategory, onOpenCardManage,
}) {
  const withdrawal = Number(tx.withdrawal || 0);
  const deposit = Number(tx.deposit || 0);
  const isIncome = deposit > 0;
  const amount = isIncome ? deposit : withdrawal;
  const account = accountSuffix(tx.accountNumber);
  const description = tx.upiDescription || tx.narration || tx.upiBank || (tx.isManual ? 'Manual entry' : 'Bank transaction');
  const cc = tx.ccBillPayment;
  const [expanded, setExpanded] = useState(false);

  // Fetch on first expand only; the page-level cache persists across collapses.
  const toggleCcExpanded = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next && !ccDetail) onLoadCcDetail(tx.id);
  }, [expanded, ccDetail, tx.id, onLoadCcDetail]);

  return (
    <div className={`cal-day-tx-row${cc ? ' is-cc-bill' : ''}${expanded ? ' is-cc-open' : ''}`}>
      <div className={`cal-day-tx-row__head${cc ? ' has-disclosure' : ''}`}>
        <label
          className="cal-day-tx-row__cat-pick"
          title="Change category"
          onClick={(e) => e.stopPropagation()}
        >
          <CatGlyph category={tx.category} size={38} />
          <select
            className="cal-day-tx-row__cat-select"
            value={tx.categoryId || ''}
            onChange={(e) => { e.stopPropagation(); onAssignCategory(tx.id, e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Category for this transaction"
            disabled={categoryStatus === 'Saving…'}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="cal-day-tx-row__nav" onClick={onOpenDetail}>
          <div className="cal-day-tx-row__copy">
            <div className="cal-day-tx-row__title">
              {tx.upiName || tx.narration || '—'}
              {cc ? (
                <span className="cal-day-tx-row__cc-badge">
                  <IcCard size={11} />
                  CC bill{cc.cardLast4 ? ` · ····${cc.cardLast4}` : ''}
                </span>
              ) : null}
            </div>
            <div className="cal-day-tx-row__sub">
              {description}
            </div>
            <div className="cal-day-tx-row__meta">
              {tx.category ? (
                <CategoryChip category={tx.category} />
              ) : (
                <span className="cal-day-tx-row__chip">No category</span>
              )}
              <span>{txMethod(tx)}</span>
              {account ? <span className="cal-day-tx-row__account">{account}</span> : null}
              {categoryStatus ? (
                <span className="cal-day-tx-row__cat-status">{categoryStatus}</span>
              ) : null}
            </div>
          </div>
          <div className="cal-day-tx-row__amount">
            <Num size={15} weight={700} color={isIncome ? 'var(--ft-income)' : 'var(--ft-spend)'}>
              {inr(isIncome ? amount : -amount, { sign: isIncome })}
            </Num>
          </div>
        </button>
        {cc ? (
          <button
            type="button"
            className={`cal-day-tx-row__disclosure${expanded ? ' is-open' : ''}`}
            aria-label={expanded ? 'Hide linked transactions' : 'Show linked transactions'}
            aria-expanded={expanded}
            onClick={(e) => { e.stopPropagation(); toggleCcExpanded(); }}
          >
            <IcChevR size={14} stroke={2} />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <DayTxCcChildren
          detail={ccDetail}
          categories={categories}
          tagsByTransaction={cardTags}
          onAssignCategory={onAssignCardCategory}
          onOpenManage={onOpenCardManage}
        />
      ) : null}
    </div>
  );
}

// The card transactions a bill payment covers, rendered with the same row
// treatment as every other ledger in the app. The remainder is not a
// transaction, so it keeps its own thin line.
function DayTxCcChildren({ detail, categories, tagsByTransaction, onAssignCategory, onOpenManage }) {
  if (!detail || detail.loading) {
    return (
      <div className="cal-day-tx-row__children">
        <span className="cal-day-tx-row__child-note">Loading card transactions…</span>
      </div>
    );
  }
  if (detail.error) {
    return (
      <div className="cal-day-tx-row__children">
        <span className="cal-day-tx-row__child-note">{detail.error}</span>
      </div>
    );
  }
  if (!detail.linked) {
    return (
      <div className="cal-day-tx-row__children">
        <span className="cal-day-tx-row__child-note">Not linked to a card bill.</span>
      </div>
    );
  }

  const covered = detail.coveredTransactions || [];
  const remainder = Number(detail.remainder || 0);

  return (
    <div className="cal-day-tx-row__children">
      {covered.length === 0 ? (
        <span className="cal-day-tx-row__child-note">No card transactions covered.</span>
      ) : null}
      {covered.map((t, i) => (
        <TransactionListRow
          key={t.id}
          nested
          nestedLast={i === covered.length - 1}
          showDate
          row={toCardTableRow(t, tagsByTransaction)}
          categories={categories}
          onAssignCategory={onAssignCategory}
          onOpenDetail={() => onOpenManage(t.id)}
        />
      ))}
      {remainder !== 0 ? (
        <div className="cal-day-tx-row__child-line cal-day-tx-row__remainder">
          <span className="cal-day-tx-row__child-merchant">
            {remainder > 0 ? 'Carried forward / other charges' : 'Not covered by this payment'}
          </span>
          <span className="cal-day-tx-row__child-amount">
            <Num size={12.5} weight={600} color="var(--ft-text-dim)">
              {inr(remainder, { decimals: 2 })}
            </Num>
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ── Day subscription occurrence row ───────────────────────────────────────────
function DaySubRow({ occ }) {
  return (
    <div className="cal-day-sub-row">
      <span style={{ width: 8, height: 8, borderRadius: 3, background: subColor(occ.merchantLabel || occ.name), flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--ft-text)', fontWeight: 500, fontSize: 13 }}>{occ.name}</div>
        <div style={{ color: 'var(--ft-text-dim)', fontSize: 11.5 }}>{occ.merchantLabel || 'Subscription'}</div>
      </div>
      <Num size={13} weight={600} color="var(--ft-violet)">{inr(Number(occ.amount || 0))}</Num>
    </div>
  );
}

// ── Upcoming bills list (mobile) ───────────────────────────────────────────────
function UpcomingList({ occurrences, todayIso, onOpenEdit }) {
  const upcoming = useMemo(
    () => occurrences.filter((o) => o.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
    [occurrences, todayIso],
  );
  if (upcoming.length === 0) return <p className="empty">No upcoming bills.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {upcoming.map((o, i) => {
        const d = new Date(o.date + 'T12:00:00');
        return (
          <button key={i} type="button" className="cal-upcoming-row"
            onClick={() => o.subscriptionId && onOpenEdit({ id: o.subscriptionId, name: o.name, amount: o.amount, rrule: o.rrule, dtstart: o.date })}
          >
            <div className="cal-day-chip">
              <span className="cal-day-chip__mon">{d.toLocaleString('en-IN', { month: 'short' }).toUpperCase()}</span>
              <span className="cal-day-chip__day">{d.getDate()}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ color: 'var(--ft-text)', fontWeight: 500, fontSize: 14 }}>{o.name}</div>
              <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>{o.merchantLabel || summarizeRRule(o.rrule)}</div>
            </div>
            <Num size={14} weight={600}>{inr(Number(o.amount || 0))}</Num>
          </button>
        );
      })}
    </div>
  );
}

// ── Donut ring (SVG) ──────────────────────────────────────────────────────────
function Donut({ segments, size = 148, stroke = 16, gap = 2.5, children }) {
  const cx = size / 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="cal-cat__ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={cx} cy={cx} r={r} fill="none" strokeWidth={stroke}
          style={{ stroke: 'var(--ft-surface-3)' }}
        />
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {segments.map((s) => {
            const len = s.fraction * c;
            // Subtract the gap from normal slices, but keep tiny slices fully
            // drawn so small categories stay visible on the ring.
            const dash = segments.length > 1 && len > gap * 1.6 ? len - gap : len;
            const node = (
              <circle
                key={s.key}
                cx={cx} cy={cx} r={r} fill="none" strokeWidth={stroke} strokeLinecap="butt"
                style={{ stroke: s.color }}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-acc * c}
              />
            );
            acc += s.fraction;
            return node;
          })}
        </g>
      </svg>
      <div className="cal-cat__center">{children}</div>
    </div>
  );
}

// ── Category spending donut + legend (month overview) ─────────────────────────
function CategorySpendCard({ transactions, style }) {
  const { segments, total } = useMemo(() => buildCategorySpend(transactions), [transactions]);

  return (
    <Card pad={18} style={style}>
      <div className="cal-cat__head">
        <Overline>Spending by category</Overline>
        {total > 0 && <Num size={13} weight={600} color="var(--ft-text-dim)">{inr(total)}</Num>}
      </div>
      {total === 0 ? (
        <p className="empty" style={{ margin: '16px 0 4px' }}>No spending this month yet.</p>
      ) : (
        <div className="cal-cat">
          <Donut segments={segments}>
            <span className="cal-cat__center-label">Spent</span>
            <Num size={19} weight={700} style={{ letterSpacing: '-0.6px' }}>{inrCompact(total)}</Num>
          </Donut>
          <ul className="cal-cat__legend">
            {segments.map((s) => (
              <li key={s.key} className="cal-cat__legend-row">
                <span className="cal-cat__legend-dot" style={{ background: s.color }} />
                <span className="cal-cat__legend-name" title={s.name}>{s.name}</span>
                <span className="cal-cat__legend-pct">{Math.round(s.fraction * 100)}%</span>
                <span className="cal-cat__legend-amt">
                  <Num size={12.5} weight={600}>{inr(s.amount)}</Num>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
