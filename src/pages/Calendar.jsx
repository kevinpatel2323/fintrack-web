import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import {
  FriendTagMobileDetails,
  rowForFriendTagCard,
} from '../components/FriendTagLedgerDisplay.jsx';
import MobileTransactionCard from '../components/MobileTransactionCard.jsx';
import Portal from '../components/Portal.jsx';
import SplitTransactionForm from '../components/SplitTransactionForm.jsx';
import '../styles/txn-manage-forms.css';
import './Calendar.css';
import './SubscriptionsCalendar.css';
import SubscriptionsCalendarContent from './SubscriptionsCalendarContent.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalIso(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function getTodayIso() {
  return toLocalIso(new Date());
}

function parseLocalDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

function formatDate(value) {
  if (!value) return '—';
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateCompact(value) {
  if (!value) return '—';
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
}

/** Short amounts for calendar cells so seven columns fit on narrow screens. */
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
    cells.push({
      iso,
      label: cur.getDate(),
      inMonth,
    });
    dayCounter += 1;
  }
  return cells;
}

function aggregateByDay(transactions) {
  const map = new Map();
  for (const t of transactions) {
    const raw = t.transactionDate;
    const d = typeof raw === 'string' ? raw.slice(0, 10) : '';
    if (!d) continue;
    const cur = map.get(d) || { net: 0, totalIn: 0, totalOut: 0, count: 0 };
    const w = Number(t.withdrawal || 0);
    const dep = Number(t.deposit || 0);
    cur.totalOut += w;
    cur.totalIn += dep;
    cur.net += dep - w;
    cur.count += 1;
    map.set(d, cur);
  }
  return map;
}

function transactionHasCategory(t) {
  if (t.category && (t.category.id != null || t.category.name)) return true;
  const cid = t.categoryId;
  if (cid == null || cid === '') return false;
  const n = Number(cid);
  if (!Number.isNaN(n) && n <= 0) return false;
  return true;
}

/** Per local date (YYYY-MM-DD): whether every txn that day has a category. */
function computeCategoryCoverageByDay(transactions) {
  const map = new Map();
  for (const t of transactions) {
    const raw = t.transactionDate;
    const d = typeof raw === 'string' ? raw.slice(0, 10) : '';
    if (!d) continue;
    const cur = map.get(d) || { total: 0, missing: 0 };
    cur.total += 1;
    if (!transactionHasCategory(t)) cur.missing += 1;
    map.set(d, cur);
  }
  const out = new Map();
  for (const [iso, v] of map) {
    if (v.total > 0) out.set(iso, v.missing === 0 ? 'complete' : 'incomplete');
  }
  return out;
}

export default function Calendar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const calendarView =
    searchParams.get('view') === 'subscriptions' ? 'subscriptions' : 'transactions';

  const setCalendarView = useCallback(
    (next) => {
      if (next === 'subscriptions') {
        setSearchParams({ view: 'subscriptions' });
      } else {
        setSearchParams({});
      }
    },
    [setSearchParams],
  );

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [account, setAccount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('');
  const [friends, setFriends] = useState([]);
  const [friendsStatus, setFriendsStatus] = useState('');

  const [selectedIso, setSelectedIso] = useState(null);
  const [sheetMode, setSheetMode] = useState('menu');
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);

  const [manualStatus, setManualStatus] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualForm, setManualForm] = useState({
    narration: '',
    type: 'PAID',
    settlementDirection: 'WITHDRAWAL',
    amount: '',
    balance: '',
    upiName: '',
    upiDescription: '',
    upiBank: '',
  });

  const todayIso = getTodayIso();

  const { startIso, endIso } = useMemo(
    () => monthBounds(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setFetchStatus('');
    try {
      const accountQuery = account ? `&accountNumber=${encodeURIComponent(account)}` : '';
      const res = await fetch(
        `${API_BASE}/imports/transactions/range?start=${startIso}&end=${endIso}${accountQuery}`,
      );
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data.data || []);
    } catch (e) {
      setFetchStatus(e.message || 'Failed to load calendar data');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [startIso, endIso, account]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    async function fetchAccounts() {
      setAccountsStatus('');
      try {
        const res = await fetch(`${API_BASE}/imports/accounts`);
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const data = await res.json();
        setAccounts(data.data || []);
      } catch (e) {
        setAccountsStatus(e.message || 'Failed to fetch accounts');
      }
    }
    fetchAccounts();
  }, []);

  useEffect(() => {
    async function fetchFriends() {
      try {
        const res = await fetch(`${API_BASE}/friends`);
        if (!res.ok) throw new Error('Failed to fetch friends');
        const data = await res.json();
        setFriends(data.data || []);
      } catch (e) {
        setFriendsStatus(e.message || 'Failed to fetch friends');
      }
    }
    fetchFriends();
  }, []);

  const [categories, setCategories] = useState([]);
  const [categoryStatusByTransaction, setCategoryStatusByTransaction] = useState({});

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

  const assignCategory = useCallback(async (transactionId, categoryId) => {
    setCategoryStatusByTransaction((prev) => ({ ...prev, [transactionId]: 'Saving…' }));
    try {
      if (categoryId) {
        await fetch(`${API_BASE}/transactions/${transactionId}/category`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: Number(categoryId) }),
        });
      } else {
        await fetch(`${API_BASE}/transactions/${transactionId}/category`, { method: 'DELETE' });
      }
      const cat = categories.find((c) => String(c.id) === String(categoryId)) || null;
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId ? { ...t, categoryId: cat ? cat.id : null, category: cat } : t,
        ),
      );
      setCategoryStatusByTransaction((prev) => ({ ...prev, [transactionId]: '' }));
    } catch {
      setCategoryStatusByTransaction((prev) => ({ ...prev, [transactionId]: 'Failed to save' }));
    }
  }, [categories]);

  const [tagsByTransaction, setTagsByTransaction] = useState({});
  const [tagsStatusByTransaction, setTagsStatusByTransaction] = useState({});
  const [splitApplyingTransactionId, setSplitApplyingTransactionId] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });

  const fetchTags = useCallback(async (transactionId) => {
    setTagsStatusByTransaction((prev) => ({ ...prev, [transactionId]: 'Loading tags...' }));
    try {
      const res = await fetch(`${API_BASE}/transactions/${transactionId}/friends`);
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data = await res.json();
      setTagsByTransaction((prev) => ({ ...prev, [transactionId]: data.data || [] }));
      setTagsStatusByTransaction((prev) => ({ ...prev, [transactionId]: '' }));
    } catch (error) {
      setTagsStatusByTransaction((prev) => ({
        ...prev,
        [transactionId]: error.message || 'Failed to fetch tags',
      }));
    }
  }, []);

  function minorToApiAmount(amountMinor, minorPerMajor = 100) {
    return Number((amountMinor / minorPerMajor).toFixed(2));
  }

  const applySplitTags = useCallback(async (transactionId, { results, direction, note, linkedTagsByParticipant }) => {
    setTagsStatusByTransaction((prev) => ({ ...prev, [transactionId]: '' }));
    setSplitApplyingTransactionId(transactionId);
    const noteTrimmed = typeof note === 'string' ? note.trim() : '';
    try {
      for (const r of results) {
        const amountMinor = r.amountMinor;
        const lineDirection = amountMinor === 0 ? 'NOTHING_OUTSTANDING' : direction;
        const amountValue = amountMinor === 0 ? 0 : minorToApiAmount(amountMinor, 100);
        const linkedIds = linkedTagsByParticipant?.[r.participantId];

        const res = await fetch(`${API_BASE}/transactions/${transactionId}/friends`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            friendId: Number(r.participantId),
            amount: amountValue,
            direction: lineDirection,
            ...(noteTrimmed ? { note: noteTrimmed } : {}),
            ...(lineDirection === 'SETTLEMENT' && linkedIds?.length > 0
              ? { linkedTransactionIds: linkedIds.map(Number) }
              : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Failed to add tag');
      }
      setTagsStatusByTransaction((prev) => ({
        ...prev,
        [transactionId]: 'Split applied — friend tags added.',
      }));
      await fetchTags(transactionId);
    } catch (error) {
      setTagsStatusByTransaction((prev) => ({
        ...prev,
        [transactionId]: error.message || 'Failed to apply split.',
      }));
    } finally {
      setSplitApplyingTransactionId(null);
    }
  }, [fetchTags]);

  const runDeleteTag = useCallback(
    async (transactionId, tagId) => {
      setTagsStatusByTransaction((prev) => ({ ...prev, [transactionId]: 'Removing tag...' }));
      try {
        const res = await fetch(`${API_BASE}/transactions/${transactionId}/friends/${tagId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete tag');
        await fetchTags(transactionId);
      } catch (error) {
        setTagsStatusByTransaction((prev) => ({
          ...prev,
          [transactionId]: error.message || 'Failed to delete tag',
        }));
      }
    },
    [fetchTags],
  );

  const deleteTag = useCallback(
    (transactionId, tagId) => {
      setConfirmState({
        open: true,
        title: 'Remove tag?',
        message: 'This will remove the friend tag from this transaction.',
        confirmLabel: 'Remove',
        onConfirm: async () => {
          setConfirmState({ open: false });
          await runDeleteTag(transactionId, tagId);
        },
        onCancel: () => setConfirmState({ open: false }),
      });
    },
    [runDeleteTag],
  );

  useEffect(() => {
    if (sheetMode !== 'manage' || !expandedTransactionId) return;
    void fetchTags(expandedTransactionId);
  }, [sheetMode, expandedTransactionId, fetchTags]);

  const byDay = useMemo(() => aggregateByDay(transactions), [transactions]);
  const categoryCoverageByIso = useMemo(
    () => computeCategoryCoverageByDay(transactions),
    [transactions],
  );
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
    setSheetMode('menu');
    setExpandedTransactionId(null);
    setManualStatus('');
    setManualForm((prev) => ({
      ...prev,
      narration: '',
      type: 'PAID',
      settlementDirection: 'WITHDRAWAL',
      amount: '',
      balance: '',
      upiName: '',
      upiDescription: '',
      upiBank: '',
    }));
  }

  function closeSheet() {
    setSelectedIso(null);
    setSheetMode('menu');
    setExpandedTransactionId(null);
  }

  const dayTxns = useMemo(() => {
    if (!selectedIso) return [];
    return transactions
      .filter((t) => {
        const d = typeof t.transactionDate === 'string' ? t.transactionDate.slice(0, 10) : '';
        return d === selectedIso;
      })
      .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  }, [transactions, selectedIso]);

  const selectedStats = selectedIso ? byDay.get(selectedIso) : null;

  async function handleManualSubmit(event) {
    event.preventDefault();
    if (!selectedIso) return;
    setManualStatus('');

    const narration = manualForm.narration.trim();
    const amountValue = Number(manualForm.amount);
    const balanceValue = manualForm.balance === '' ? undefined : Number(manualForm.balance);

    if (!narration) {
      setManualStatus('Enter a narration.');
      return;
    }
    if (!manualForm.amount || Number.isNaN(amountValue) || amountValue <= 0) {
      setManualStatus('Enter a valid amount.');
      return;
    }
    if (manualForm.type === 'SETTLEMENT' && !manualForm.settlementDirection) {
      setManualStatus('Select settlement direction.');
      return;
    }
    if (balanceValue !== undefined && (Number.isNaN(balanceValue) || balanceValue < 0)) {
      setManualStatus('Balance must be zero or positive.');
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/transactions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionDate: selectedIso,
          narration,
          type: manualForm.type,
          settlementDirection:
            manualForm.type === 'SETTLEMENT' ? manualForm.settlementDirection : undefined,
          amount: amountValue,
          balance: balanceValue,
          upiName: manualForm.upiName.trim() || undefined,
          upiDescription: manualForm.upiDescription.trim() || undefined,
          upiBank: manualForm.upiBank.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add manual transaction.');
      setManualStatus('Transaction added.');
      setManualForm((prev) => ({
        ...prev,
        narration: '',
        type: 'PAID',
        settlementDirection: 'WITHDRAWAL',
        amount: '',
        balance: '',
        upiName: '',
        upiDescription: '',
        upiBank: '',
      }));
      await loadMonth();
      setSheetMode('menu');
    } catch (e) {
      setManualStatus(e.message || 'Failed to add manual transaction.');
    } finally {
      setManualSubmitting(false);
    }
  }

  function toggleExpand(rowId) {
    setExpandedTransactionId((prev) => (prev === rowId ? null : rowId));
  }

  function renderManageFriendTagsPanel(row) {
    return (
      <div className="friend-tags-panel">
        <div className="txn-assign-section">
          <div className="txn-assign-section__row">
            <select
              className="txn-assign-select"
              value={row.categoryId || ''}
              onChange={(e) => assignCategory(row.id, e.target.value)}
              aria-label="Category for this transaction"
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon ? `${cat.icon} ` : ''}
                  {cat.name}
                </option>
              ))}
            </select>
            {categoryStatusByTransaction[row.id] ? (
              <span className="txn-assign-status">{categoryStatusByTransaction[row.id]}</span>
            ) : null}
          </div>
        </div>
        {(() => {
          const withdrawal = Number(row.withdrawal || 0);
          const deposit = Number(row.deposit || 0);
          const splitTotal = withdrawal > 0 ? withdrawal : deposit > 0 ? deposit : 0;
          return splitTotal > 0 ? (
            <SplitTransactionForm
              key={`split-${row.id}`}
              totalAmount={splitTotal}
              participants={friends.map((f) => ({ id: String(f.id), name: f.name }))}
              taggedFriendIds={(tagsByTransaction[row.id] || []).map((t) => String(t.friendId))}
              defaultDirection="OWES_ME"
              applying={splitApplyingTransactionId === row.id}
              onApplySplit={(args) => applySplitTags(row.id, args)}
            />
          ) : null;
        })()}
        {tagsStatusByTransaction[row.id] && (
          <p className="status">{tagsStatusByTransaction[row.id]}</p>
        )}
        <div
          className={`friend-tags-list${
            (tagsByTransaction[row.id] || []).length ? ' friend-tagged-mobile' : ''
          }`}
        >
          {(tagsByTransaction[row.id] || []).length === 0 ? (
            <p className="empty">No friend attached for this transaction.</p>
          ) : (
            (tagsByTransaction[row.id] || []).map((tag) => {
              const friendName = tag.friend?.name || String(tag.friendId);
              return (
                <MobileTransactionCard
                  key={tag.id}
                  row={rowForFriendTagCard(tag, row)}
                  expanded
                  onToggleExpand={() => {}}
                  formatDateCompact={formatDateCompact}
                  formatNumber={formatNumber}
                  nonInteractive
                  hideBalance
                  cardAriaLabel={`Friend tag ${friendName}`}
                >
                  <FriendTagMobileDetails tag={tag} friendName={friendName} />
                  <button
                    className="ghost friend-tag-sheet-remove"
                    type="button"
                    onClick={() => deleteTag(row.id, tag.id)}
                  >
                    Remove
                  </button>
                </MobileTransactionCard>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={confirmState.onCancel}
      />
      <div className="glass-panel calendar-view-toggle" role="tablist" aria-label="Calendar type">
        <button
          type="button"
          role="tab"
          aria-selected={calendarView === 'transactions'}
          className={`calendar-view-toggle__btn${
            calendarView === 'transactions' ? ' calendar-view-toggle__btn--active' : ''
          }`}
          onClick={() => setCalendarView('transactions')}
        >
          Transactions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={calendarView === 'subscriptions'}
          className={`calendar-view-toggle__btn${
            calendarView === 'subscriptions' ? ' calendar-view-toggle__btn--active' : ''
          }`}
          onClick={() => setCalendarView('subscriptions')}
        >
          Subscriptions
        </button>
      </div>
      {calendarView === 'transactions' ? (
        <>
      <section className="card calendar-card">
        <div className="glass-panel calendar-filters">
          <div className="card-header">
            <div>
              <h2>Filters</h2>
              <p>Pick an account and browse by month.</p>
            </div>
            <div className="select-wrap">
              <select value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option value={a} key={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {accountsStatus && <p className="status">{accountsStatus}</p>}
        {friendsStatus && <p className="status">{friendsStatus}</p>}

        <div className="glass-panel calendar-filters">
          <div className="calendar-toolbar">
            <h2>Transactions calendar</h2>
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

            <div className="calendar-grid" role="grid" aria-label={`Calendar for ${monthTitle}`}>
            {cells.map((cell) => {
              const stats = byDay.get(cell.iso);
              const hasData = stats && stats.count > 0;
              const catCoverage =
                cell.inMonth && hasData ? categoryCoverageByIso.get(cell.iso) : null;
              const isToday = cell.iso === todayIso;
              const net = stats?.net ?? 0;
              let netClass = 'calendar-cell__net--zero';
              if (net > 0.0001) netClass = 'calendar-cell__net--in';
              if (net < -0.0001) netClass = 'calendar-cell__net--out';

              const netLabel = hasData
                ? `${net > 0 ? '+' : net < 0 ? '−' : ''}${formatNetCompact(net)}`
                : '';

              const categoryHint =
                catCoverage === 'complete'
                  ? 'all categorized'
                  : catCoverage === 'incomplete'
                    ? 'needs category'
                    : '';

              return (
                <div
                  key={cell.iso}
                  role="gridcell"
                  className={[
                    'calendar-cell',
                    !cell.inMonth ? 'calendar-cell--muted' : '',
                    isToday && cell.inMonth ? 'calendar-cell--today' : '',
                    cell.inMonth ? 'calendar-cell--has-data' : '',
                    catCoverage === 'complete' ? 'calendar-cell--cats-complete' : '',
                    catCoverage === 'incomplete' ? 'calendar-cell--cats-incomplete' : '',
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
                      ? `${cell.label} ${monthTitle.split(' ')[0]}, net ${hasData ? formatNumber(net) : 'no transactions'}${categoryHint ? `, ${categoryHint}` : ''}`
                      : undefined
                  }
                  title={
                    cell.inMonth && hasData
                      ? `Net ${formatNumber(net)} · ${stats.count} transaction${stats.count === 1 ? '' : 's'}`
                      : undefined
                  }
                >
                  <span className="calendar-cell__dow-num">{cell.label}</span>
                  {cell.inMonth && hasData ? (
                    <>
                      <span className={`calendar-cell__net ${netClass}`}>{netLabel}</span>
                      <span className="calendar-cell__count">{stats.count} txn</span>
                    </>
                  ) : null}
                </div>
              );
            })}
            </div>
          </div>

          <div className="calendar-legend">
            <span>
              <i className="in" /> Net in (deposits − withdrawals)
            </span>
            <span>
              <i className="out" /> Net out
            </span>
          </div>
        </div>
      </section>

      {selectedIso && (
        <Portal>
          <div
            className="calendar-sheet-backdrop"
            role="presentation"
            onClick={(e) => e.target === e.currentTarget && closeSheet()}
          >
            <div className="calendar-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-sheet-title">
            <div className="calendar-sheet__header">
              <div>
                <h3 id="calendar-sheet-title">{formatDate(selectedIso)}</h3>
                <p>
                  {selectedStats
                    ? `${selectedStats.count} transaction${selectedStats.count === 1 ? '' : 's'} · net ${formatNumber(selectedStats.net)}`
                    : 'No transactions yet'}
                </p>
              </div>
              <button type="button" className="ghost calendar-sheet__close" onClick={closeSheet} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="calendar-sheet__body">
              {sheetMode === 'menu' && (
                <>
                  <div className="calendar-sheet__actions">
                    <button
                      type="button"
                      className="calendar-action-primary"
                      onClick={() => {
                        setManualStatus('');
                        setSheetMode('manual');
                      }}
                    >
                      Add manual transaction
                    </button>
                    <button
                      type="button"
                      className="calendar-action-secondary"
                      onClick={() => {
                        setExpandedTransactionId(null);
                        setSheetMode('manage');
                      }}
                    >
                      Manage transactions on this day
                    </button>
                  </div>
                  {selectedStats && (
                    <div className="calendar-summary-strip">
                      <div>
                        <span>Total in</span>
                        <strong>₹{formatNumber(selectedStats.totalIn)}</strong>
                      </div>
                      <div>
                        <span>Total out</span>
                        <strong>₹{formatNumber(selectedStats.totalOut)}</strong>
                      </div>
                      <div>
                        <span>Net</span>
                        <strong>
                          {selectedStats.net >= 0 ? '+' : '−'}₹{formatNumber(Math.abs(selectedStats.net))}
                        </strong>
                      </div>
                    </div>
                  )}
                </>
              )}

              {sheetMode === 'manual' && (
                <>
                  <div className="calendar-sheet__actions calendar-sheet__actions--single">
                    <button
                      type="button"
                      className="calendar-action-secondary"
                      onClick={() => setSheetMode('menu')}
                    >
                      ← Back to options
                    </button>
                  </div>
                  <form className="friend-form manual-form txn-manual-form" onSubmit={handleManualSubmit}>
                    <div className="friend-tags-header txn-manual-form__head">
                      <h3>Add manual transaction</h3>
                      <p>Posted to Wallet · {formatDateCompact(selectedIso)}</p>
                    </div>
                    <div className="txn-form-section">
                      <p className="txn-form-section__label">Details</p>
                      <div className="form-grid">
                        <label className="field">
                          <span>Type</span>
                          <select
                            value={manualForm.type}
                            onChange={(e) => setManualForm((p) => ({ ...p, type: e.target.value }))}
                          >
                            <option value="PAID">Paid</option>
                            <option value="RECEIVED">Received</option>
                            <option value="I_OWE">I owe</option>
                            <option value="SETTLEMENT">Settlement</option>
                          </select>
                        </label>
                        {manualForm.type === 'SETTLEMENT' && (
                          <label className="field">
                            <span>Settlement direction</span>
                            <select
                              value={manualForm.settlementDirection}
                              onChange={(e) =>
                                setManualForm((p) => ({ ...p, settlementDirection: e.target.value }))
                              }
                            >
                              <option value="WITHDRAWAL">Withdrawal</option>
                              <option value="DEPOSIT">Deposit</option>
                            </select>
                          </label>
                        )}
                        <label className="field">
                          <span>Amount</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualForm.amount}
                            onChange={(e) => setManualForm((p) => ({ ...p, amount: e.target.value }))}
                            placeholder="0.00"
                          />
                        </label>
                        <label className="field">
                          <span>Narration</span>
                          <input
                            type="text"
                            value={manualForm.narration}
                            onChange={(e) => setManualForm((p) => ({ ...p, narration: e.target.value }))}
                            placeholder="What was this for?"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="txn-form-section">
                      <p className="txn-form-section__label">Optional</p>
                      <div className="form-grid">
                        <label className="field">
                          <span>Balance</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={manualForm.balance}
                            onChange={(e) => setManualForm((p) => ({ ...p, balance: e.target.value }))}
                            placeholder="0.00"
                          />
                        </label>
                        <label className="field">
                          <span>UPI name</span>
                          <input
                            type="text"
                            value={manualForm.upiName}
                            onChange={(e) => setManualForm((p) => ({ ...p, upiName: e.target.value }))}
                            placeholder="Optional"
                          />
                        </label>
                        <label className="field">
                          <span>UPI description</span>
                          <input
                            type="text"
                            value={manualForm.upiDescription}
                            onChange={(e) =>
                              setManualForm((p) => ({ ...p, upiDescription: e.target.value }))
                            }
                            placeholder="Optional"
                          />
                        </label>
                        <label className="field">
                          <span>UPI bank</span>
                          <input
                            type="text"
                            value={manualForm.upiBank}
                            onChange={(e) => setManualForm((p) => ({ ...p, upiBank: e.target.value }))}
                            placeholder="Optional"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="friend-actions txn-manual-form__actions">
                      <button className="secondary" type="submit" disabled={manualSubmitting}>
                        {manualSubmitting ? 'Adding…' : 'Add transaction'}
                      </button>
                      {manualStatus && <p className="status">{manualStatus}</p>}
                    </div>
                  </form>
                </>
              )}

              {sheetMode === 'manage' && (
                <>
                  <div className="calendar-sheet__actions calendar-sheet__actions--single">
                    <button
                      type="button"
                      className="calendar-action-secondary"
                      onClick={() => {
                        setSheetMode('menu');
                        setExpandedTransactionId(null);
                      }}
                    >
                      ← Back to options
                    </button>
                  </div>
                  {selectedStats && (
                    <div className="calendar-summary-strip" aria-label="Day totals">
                      <div>
                        <span>Total in</span>
                        <strong>₹{formatNumber(selectedStats.totalIn)}</strong>
                      </div>
                      <div>
                        <span>Total out</span>
                        <strong>₹{formatNumber(selectedStats.totalOut)}</strong>
                      </div>
                      <div>
                        <span>Net</span>
                        <strong>
                          {selectedStats.net >= 0 ? '+' : '−'}₹{formatNumber(Math.abs(selectedStats.net))}
                        </strong>
                      </div>
                    </div>
                  )}
                  <div className="calendar-manage-shell glass-panel">
                    <div className="calendar-manage-shell__head">
                      <h4 className="calendar-manage-shell__title">Transactions on this day</h4>
                      <p className="calendar-manage-shell__sub">
                        {dayTxns.length === 0
                          ? 'No entries yet — use “Add manual transaction” from the previous screen.'
                          : 'Expand a transaction to add or edit friend tags.'}
                      </p>
                    </div>
                    {dayTxns.length === 0 ? (
                      <p className="empty calendar-manage-shell__empty">Nothing to show for this date.</p>
                    ) : (
                      <div className="calendar-manage-list">
                        {dayTxns.map((row) => (
                          <MobileTransactionCard
                            key={row.id}
                            row={row}
                            expanded={expandedTransactionId === row.id}
                            onToggleExpand={() => toggleExpand(row.id)}
                            formatDateCompact={formatDateCompact}
                            formatNumber={formatNumber}
                            categories={categories}
                            onAssignCategory={assignCategory}
                            categoryStatus={categoryStatusByTransaction[row.id]}
                          >
                            {renderManageFriendTagsPanel(row)}
                          </MobileTransactionCard>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}
        </>
      ) : (
        <SubscriptionsCalendarContent />
      )}
    </>
  );
}
