import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { FriendTagCard } from '../components/FriendTagLedgerDisplay.jsx';
import Portal from '../components/Portal.jsx';
import SplitTransactionForm from '../components/SplitTransactionForm.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import {
  Card, Num, Pill, PrimaryBtn, GhostBtn, Avatar, CategoryChip, Overline, SectionTitle,
} from '../components/ui/primitives.jsx';
import {
  IcSearch, IcPlus, IcCommand, IcMore, IcRepeat, IcArrowDL, IcArrowUR, IcClose,
} from '../components/ui/Icon.jsx';
import { inr } from '../utils/inr.js';
import { categoryColor, friendTint, initialsOf } from '../utils/categoryColors.js';
import '../styles/transactions-redesign.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function formatDateShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
}

function formatTimeShort(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return { startIso: start.toISOString().slice(0, 10), endIso: end.toISOString().slice(0, 10) };
}

function getTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getPaginationItems(currentPage, totalPages) {
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

function TransactionCategoryGlyph({ category, size = 38 }) {
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

export default function Transactions() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 720px)');

  // -- API state --
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('');
  const [friends, setFriends] = useState([]);
  const [friendsStatus, setFriendsStatus] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryStatusByTransaction, setCategoryStatusByTransaction] = useState({});

  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const [rangeStart, setRangeStart] = useState(monthRange.startIso);
  const [rangeEnd, setRangeEnd] = useState(monthRange.endIso);
  const [rangeAccount, setRangeAccount] = useState('');
  const [rangeResult, setRangeResult] = useState(null);
  const [rangeStatus, setRangeStatus] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [tagsByTransaction, setTagsByTransaction] = useState({});
  const [tagsStatusByTransaction, setTagsStatusByTransaction] = useState({});
  const [friendTagsSheetId, setFriendTagsSheetId] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });
  const [splitApplyingTransactionId, setSplitApplyingTransactionId] = useState(null);
  const [manualStatus, setManualStatus] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    transactionDate: getTodayIso(),
    narration: '',
    type: 'PAID',
    settlementDirection: 'WITHDRAWAL',
    amount: '',
    balance: '',
    upiName: '',
    upiDescription: '',
    upiBank: '',
  });

  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterTab, setFilterTab] = useState('all'); // all, spent, earned
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const fetchedTagIds = useRef(new Set());
  const searchInputRef = useRef(null);

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent),
    [],
  );
  const showSearchShortcut = !searchFocused && !search;

  const canFetchRange = useMemo(() => rangeStart && rangeEnd, [rangeStart, rangeEnd]);

  // -- Effects (preserved from original) --
  useEffect(() => {
    (async () => {
      setAccountsStatus('');
      try {
        const res = await fetch(`${API_BASE}/imports/accounts`);
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const data = await res.json();
        setAccounts(data.data || []);
      } catch (error) {
        setAccountsStatus(error.message || 'Failed to fetch accounts');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setFriendsStatus('');
      try {
        const res = await fetch(`${API_BASE}/friends`);
        if (!res.ok) throw new Error('Failed to fetch friends');
        const data = await res.json();
        setFriends(data.data || []);
      } catch (error) {
        setFriendsStatus(error.message || 'Failed to fetch friends.');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        if (!res.ok) return;
        const data = await res.json();
        setCategories(data.data || []);
      } catch {}
    })();
  }, []);

  // Prefetch friend-tag counts for all loaded transactions so the Tags column shows immediately
  useEffect(() => {
    for (const tx of transactions) {
      if (fetchedTagIds.current.has(tx.id)) continue;
      fetchedTagIds.current.add(tx.id);
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/transactions/${tx.id}/friends`);
          if (!res.ok) return;
          const data = await res.json();
          setTagsByTransaction((p) => ({ ...p, [tx.id]: data.data || [] }));
        } catch {}
      })();
    }
  }, [transactions]);

  useEffect(() => {
    if (!canFetchRange) return;
    handleRangeFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd, rangeAccount]);

  useEffect(() => {
    if (isMobile) return undefined;
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile]);

  async function handleRangeFetch(event) {
    if (event) event.preventDefault();
    if (!canFetchRange) return;
    setRangeStatus('Loading...');
    setRangeResult(null);
    setTransactionsLoading(true);
    try {
      const accountQuery = rangeAccount ? `&accountNumber=${encodeURIComponent(rangeAccount)}` : '';
      const res = await fetch(
        `${API_BASE}/imports/transactions/range?start=${rangeStart}&end=${rangeEnd}${accountQuery}`,
      );
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setRangeResult(data);
      setTransactions(data.data || []);
      setFriendTagsSheetId(null);
      setTagsByTransaction({});
      setTagsStatusByTransaction({});
      setCategoryStatusByTransaction({});
      setRangeStatus('');
      setPage(1);
      fetchedTagIds.current.clear();
    } catch (error) {
      setRangeStatus(error.message || 'Failed to fetch transactions');
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function openFriendTagsSheet(transactionId) {
    setFriendTagsSheetId(transactionId);
    if (!tagsByTransaction[transactionId]) {
      await fetchTags(transactionId);
    }
  }
  function closeFriendTagsSheet() {
    setFriendTagsSheetId(null);
  }

  async function fetchTags(transactionId) {
    setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: 'Loading tags...' }));
    try {
      const res = await fetch(`${API_BASE}/transactions/${transactionId}/friends`);
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data = await res.json();
      setTagsByTransaction((p) => ({ ...p, [transactionId]: data.data || [] }));
      setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: '' }));
    } catch (error) {
      setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: error.message || 'Failed to fetch tags' }));
    }
  }

  function minorToApiAmount(amountMinor, minorPerMajor = 100) {
    return Number((amountMinor / minorPerMajor).toFixed(2));
  }

  async function applySplitTags(transactionId, { results, direction, note, linkedTagsByParticipant }) {
    setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: '' }));
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
              ? { linkedTransactionIds: linkedIds.map(Number) } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Failed to add tag');
      }
      setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: 'Split applied — friend tags added.' }));
      await fetchTags(transactionId);
    } catch (error) {
      setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: error.message || 'Failed to apply split.' }));
    } finally {
      setSplitApplyingTransactionId(null);
    }
  }

  function deleteTag(transactionId, tagId) {
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
  }
  async function runDeleteTag(transactionId, tagId) {
    setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: 'Removing tag...' }));
    try {
      const res = await fetch(`${API_BASE}/transactions/${transactionId}/friends/${tagId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete tag');
      await fetchTags(transactionId);
    } catch (error) {
      setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: error.message || 'Failed to delete tag' }));
    }
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
      const res = await fetch(`${API_BASE}/transactions/manual`, {
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
      setManualForm((p) => ({
        ...p,
        narration: '', type: 'PAID', settlementDirection: 'WITHDRAWAL',
        amount: '', balance: '', upiName: '', upiDescription: '', upiBank: '',
      }));
      setManualOpen(false);
      await handleRangeFetch();
    } catch (error) {
      setManualStatus(error.message || 'Failed to add manual transaction.');
    } finally {
      setManualSubmitting(false);
    }
  }

  const assignCategory = useCallback(
    async (transactionId, categoryId) => {
      setCategoryStatusByTransaction((p) => ({ ...p, [transactionId]: 'Saving…' }));
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
          prev.map((t) => (t.id === transactionId ? { ...t, categoryId: cat ? cat.id : null, category: cat } : t)),
        );
        setCategoryStatusByTransaction((p) => ({ ...p, [transactionId]: '' }));
      } catch {
        setCategoryStatusByTransaction((p) => ({ ...p, [transactionId]: 'Failed to save' }));
      }
    },
    [categories],
  );

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
    setPage(1);
  }

  // -- Derived --
  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (categoryFilter) {
      list = categoryFilter === '__none__'
        ? list.filter((t) => !t.categoryId)
        : list.filter((t) => String(t.categoryId) === categoryFilter);
    }
    if (filterTab === 'spent') list = list.filter((t) => Number(t.withdrawal) > 0);
    if (filterTab === 'earned') list = list.filter((t) => Number(t.deposit) > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) =>
        [t.upiName, t.upiDescription, t.narration, t.upiBank, t.category?.name]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [transactions, categoryFilter, filterTab, search]);

  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];
    sorted.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'date':
          va = a.transactionDate || ''; vb = b.transactionDate || ''; break;
        case 'description':
          va = (a.upiName || a.narration || '').toLowerCase();
          vb = (b.upiName || b.narration || '').toLowerCase(); break;
        case 'category':
          va = (a.category?.name || '').toLowerCase();
          vb = (b.category?.name || '').toLowerCase(); break;
        case 'method':
          va = a.upiBank || (a.isManual ? 'manual' : 'bank');
          vb = b.upiBank || (b.isManual ? 'manual' : 'bank'); break;
        case 'tags':
          va = (tagsByTransaction[a.id] || []).length;
          vb = (tagsByTransaction[b.id] || []).length; break;
        case 'amount':
          va = Number(a.withdrawal || 0) - Number(a.deposit || 0);
          vb = Number(b.withdrawal || 0) - Number(b.deposit || 0); break;
        default:
          return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredTransactions, sortCol, sortDir, tagsByTransaction]);

  const totalSpent = useMemo(
    () => transactions.reduce((s, t) => s + (Number(t.withdrawal) || 0), 0),
    [transactions],
  );
  const totalEarned = useMemo(
    () => transactions.reduce((s, t) => s + (Number(t.deposit) || 0), 0),
    [transactions],
  );

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const pageStart = sortedTransactions.length === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const pageEnd = Math.min(page * pageSize, sortedTransactions.length);
  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages]);
  const pageRows = useMemo(
    () => sortedTransactions.slice((page - 1) * pageSize, page * pageSize),
    [sortedTransactions, page, pageSize],
  );

  const friendTagsSheetRow = useMemo(
    () => (friendTagsSheetId ? transactions.find((r) => r.id === friendTagsSheetId) : null),
    [friendTagsSheetId, transactions],
  );

  useEffect(() => {
    if (friendTagsSheetId && !transactions.some((r) => r.id === friendTagsSheetId)) {
      setFriendTagsSheetId(null);
    }
  }, [transactions, friendTagsSheetId]);

  const renderFriendTagsPanel = (row) => (
    <div className="friend-tags-panel">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select
          className="txn-assign-select"
          value={row.categoryId || ''}
          onChange={(e) => assignCategory(row.id, e.target.value)}
          aria-label="Category for this transaction"
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon ? `${cat.icon} ` : ''}{cat.name}
            </option>
          ))}
        </select>
        {categoryStatusByTransaction[row.id] ? (
          <span className="status">{categoryStatusByTransaction[row.id]}</span>
        ) : null}
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
      {tagsStatusByTransaction[row.id] && <p className="status">{tagsStatusByTransaction[row.id]}</p>}
      <div className="friend-tags-list">
        {(tagsByTransaction[row.id] || []).length === 0 ? (
          <p className="empty">No friend attached.</p>
        ) : (
          (tagsByTransaction[row.id] || []).map((tag) => {
            const friendName = tag.friend?.name || String(tag.friendId);
            return (
              <FriendTagCard
                key={tag.id}
                tag={tag}
                transaction={row}
                friendName={friendName}
                onRemove={() => deleteTag(row.id, tag.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );

  // -- Friend tag sheet rendered on both layouts --
  const sheet = friendTagsSheetRow && (
    <Portal>
      <div
        className="calendar-sheet-backdrop"
        onClick={(e) => e.target === e.currentTarget && closeFriendTagsSheet()}
      >
        <div className="calendar-sheet" role="dialog" aria-modal="true">
          <div className="calendar-sheet__header">
            <div>
              <h3>{formatDate(friendTagsSheetRow.transactionDate)}</h3>
              <p>
                {(tagsByTransaction[friendTagsSheetRow.id] || []).length}{' '}
                {(tagsByTransaction[friendTagsSheetRow.id] || []).length === 1 ? 'friend tag' : 'friend tags'}
                {' · '}
                {(() => {
                  const w = Number(friendTagsSheetRow.withdrawal || 0);
                  const d = Number(friendTagsSheetRow.deposit || 0);
                  const isW = w > 0;
                  const amt = isW ? w : d;
                  return `${isW ? 'Out' : 'In'} ${inr(amt)}`;
                })()}
              </p>
              <p className="calendar-sheet__header-meta">
                {[friendTagsSheetRow.accountNumber, friendTagsSheetRow.isManual ? 'Manual' : null]
                  .filter(Boolean).join(' · ')}
              </p>
            </div>
            <button className="ghost calendar-sheet__close" type="button" onClick={closeFriendTagsSheet} aria-label="Close">
              <IcClose size={16} />
            </button>
          </div>
          <div className="calendar-summary-strip">
            <div>
              <span>Total in</span>
              <strong>{inr(Number(friendTagsSheetRow.deposit || 0))}</strong>
            </div>
            <div>
              <span>Total out</span>
              <strong>{inr(Number(friendTagsSheetRow.withdrawal || 0))}</strong>
            </div>
            <div>
              <span>Net</span>
              <strong>
                {(() => {
                  const net = Number(friendTagsSheetRow.deposit || 0) - Number(friendTagsSheetRow.withdrawal || 0);
                  return inr(net, { sign: true });
                })()}
              </strong>
            </div>
          </div>
          <div className="calendar-manage-shell">{renderFriendTagsPanel(friendTagsSheetRow)}</div>
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
    return (
      <>
        <ConfirmDialog {...confirmState} />
        {sheet}
        {manualSheet}
        <header className="ft-mobile__header">
          <h1 className="ft-mobile__title">Activity</h1>
          <button className="ft-mobile__icon-btn" onClick={() => setManualOpen(true)} aria-label="Add transaction">
            <IcPlus size={20} />
          </button>
        </header>
        <main className="ft-mobile__content">
          <div className="txn-search">
            <IcSearch size={16} />
            <input
              type="search"
              placeholder="Search transactions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="txn-pills">
            <Pill active={filterTab === 'all'} onClick={() => setFilterTab('all')}>All</Pill>
            <Pill active={filterTab === 'spent'} onClick={() => setFilterTab('spent')}>Spent</Pill>
            <Pill active={filterTab === 'earned'} onClick={() => setFilterTab('earned')}>Earned</Pill>
          </div>
          <div className="txn-mobile-stats">
            <div>
              <Overline>Spent</Overline>
              <Num size={20} weight={600} color="var(--ft-spend)">{inr(totalSpent)}</Num>
            </div>
            <div>
              <Overline>Earned</Overline>
              <Num size={20} weight={600} color="var(--ft-income)">{inr(totalEarned)}</Num>
            </div>
          </div>
          <Card pad={14}>
            {transactionsLoading ? (
              <p className="status">Loading…</p>
            ) : filteredTransactions.length === 0 ? (
              <p className="empty">No transactions in this range.</p>
            ) : (
              <GroupedTxList
                rows={sortedTransactions}
                onOpenDetail={(row) => navigate(`/transactions/${row.id}`, { state: { tx: row } })}
                onOpenManage={openFriendTagsSheet}
                categories={categories}
                onAssignCategory={assignCategory}
              />
            )}
          </Card>
        </main>
      </>
    );
  }

  // ===== DESKTOP =====
  return (
    <>
      <ConfirmDialog {...confirmState} />
      {sheet}
      {manualSheet}

      <header className="ft-page-header">
        <div>
          <p className="ft-page-header__sub">{rangeResult ? `${rangeResult.count || transactions.length} transactions` : 'Filterable ledger'}</p>
          <h1 className="ft-page-header__title">Transactions</h1>
        </div>
        <div className="ft-page-header__actions">
          <GhostBtn onClick={() => handleRangeFetch()}>Refresh</GhostBtn>
          <PrimaryBtn onClick={() => setManualOpen(true)}>
            <IcPlus size={16} /> New transaction
          </PrimaryBtn>
        </div>
      </header>

      <Card pad={18} style={{ marginBottom: 16 }}>
        <div className="txn-toolbar">
          <div className="txn-search txn-search--wide">
            <IcSearch size={16} />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search by description, party, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <button
              type="button"
              className={`txn-search__keys${showSearchShortcut ? '' : ' is-hidden'}`}
              onClick={() => searchInputRef.current?.focus()}
              tabIndex={-1}
              aria-label={isMac ? 'Focus search (Command K)' : 'Focus search (Control K)'}
            >
              <kbd className="txn-key">{isMac ? <IcCommand size={10} /> : 'Ctrl'}</kbd>
              <kbd className="txn-key">K</kbd>
            </button>
          </div>
          <div className="txn-pills">
            <Pill active={filterTab === 'all'} onClick={() => setFilterTab('all')}>All</Pill>
            <Pill active={filterTab === 'spent'} onClick={() => setFilterTab('spent')}>Spent</Pill>
            <Pill active={filterTab === 'earned'} onClick={() => setFilterTab('earned')}>Earned</Pill>
          </div>
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
            <select value={rangeAccount} onChange={(e) => setRangeAccount(e.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              <option value="__none__">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="txn-range-row">
          <label className="txn-field">
            <span>Start</span>
            <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </label>
          <label className="txn-field">
            <span>End</span>
            <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Num size={13} color="var(--ft-text-dim)">
              {inr(totalSpent)} spent · {inr(totalEarned)} earned
            </Num>
          </div>
        </div>
        {accountsStatus && <p className="status">{accountsStatus}</p>}
        {friendsStatus && <p className="status">{friendsStatus}</p>}
        {rangeStatus && <p className="status">{rangeStatus}</p>}
      </Card>

      <Card pad={0}>
        {transactionsLoading ? (
          <div style={{ padding: 28 }}><p className="status">Loading transactions…</p></div>
        ) : pageRows.length === 0 ? (
          <p className="empty" style={{ margin: 24 }}>No transactions match.</p>
        ) : (
          <>
            <table className="txn-table">
              <thead>
                <tr>
                  <SortTh col="date" active={sortCol} dir={sortDir} onSort={handleSort} width={110}>Date</SortTh>
                  <SortTh col="description" active={sortCol} dir={sortDir} onSort={handleSort}>Description</SortTh>
                  <SortTh col="category" active={sortCol} dir={sortDir} onSort={handleSort} width={160}>Category</SortTh>
                  <SortTh col="method" active={sortCol} dir={sortDir} onSort={handleSort} width={120}>Method</SortTh>
                  <SortTh col="tags" active={sortCol} dir={sortDir} onSort={handleSort} width={100}>Split count</SortTh>
                  <SortTh col="amount" active={sortCol} dir={sortDir} onSort={handleSort} width={130} right>Amount</SortTh>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <TxTableRow
                    key={row.id}
                    row={row}
                    tagCount={(tagsByTransaction[row.id] || []).length}
                    tagsLoaded={tagsByTransaction[row.id] !== undefined}
                    categories={categories}
                    onAssignCategory={assignCategory}
                    onOpenManage={openFriendTagsSheet}
                    onOpenDetail={() => navigate(`/transactions/${row.id}`, { state: { tx: row } })}
                  />
                ))}
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
                          setPageSize(size);
                          setPage(1);
                        }}
                        aria-pressed={pageSize === size}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="txn-footer__summary">
                  Showing {pageStart}–{pageEnd} of {sortedTransactions.length}
                </span>
              </div>
              <div className="txn-pager">
                <button
                  type="button"
                  className="txn-pager__nav"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Prev
                </button>
                <div className="txn-pager__pages" aria-label={`Page ${page} of ${totalPages}`}>
                  {paginationItems.map((item) => (typeof item === 'string' ? (
                    <span key={item} className="txn-pager__ellipsis" aria-hidden="true">…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={`txn-pager__page${item === page ? ' is-active' : ''}`}
                      onClick={() => setPage(item)}
                      aria-current={item === page ? 'page' : undefined}
                    >
                      {item}
                    </button>
                  )))}
                </div>
                <button
                  type="button"
                  className="txn-pager__nav"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function TxTableRow({ row, tagCount, tagsLoaded, categories, onAssignCategory, onOpenManage, onOpenDetail }) {
  const withdrawal = Number(row.withdrawal || 0);
  const deposit = Number(row.deposit || 0);
  const isIncome = deposit > 0;
  const amount = isIncome ? deposit : withdrawal;
  const method = row.upiBank ? `UPI · ${row.upiBank}` : row.isManual ? 'Manual' : 'Bank';
  return (
    <tr className="txn-row" onClick={onOpenDetail}>
      <td>
        <span style={{ fontFamily: 'var(--ft-font-mono)', fontSize: 12.5, color: 'var(--ft-text)', fontWeight: 500 }}>
          {formatDateShort(row.transactionDate)}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <TransactionCategoryGlyph category={row.category} size={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--ft-text)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.upiName || row.narration || '—'}
            </div>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
              {row.upiDescription || row.narration || row.upiBank}
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
        <span style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>{method}</span>
      </td>
      <td>
        {tagsLoaded ? (
          tagCount > 0 ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(215,255,61,0.12)', color: 'var(--ft-accent)',
              fontFamily: 'var(--ft-font-mono)', fontSize: 12, fontWeight: 600,
              padding: '2px 8px', borderRadius: 6, minWidth: 24,
            }}>
              {tagCount}
            </span>
          ) : <span style={{ color: 'var(--ft-text-faint)', fontSize: 12 }}>—</span>
        ) : (
          <span style={{ color: 'var(--ft-text-faint)', fontSize: 12 }}>·</span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <Num size={14} weight={600} color={isIncome ? 'var(--ft-income)' : 'var(--ft-spend)'}>
          {inr(isIncome ? amount : -amount, { sign: isIncome })}
        </Num>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <button
          className="txn-row__menu"
          aria-label="Manage transaction"
          onClick={(e) => { e.stopPropagation(); onOpenManage(row.id); }}
        >
          <IcMore size={16} />
        </button>
      </td>
    </tr>
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

function GroupedTxList({ rows, onOpenDetail, onOpenManage, categories, onAssignCategory }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const d = r.transactionDate ? new Date(r.transactionDate) : null;
      const key = d ? d.toISOString().slice(0, 10) : 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [rows]);

  return (
    <div className="txn-grouped">
      {groups.map(([dateKey, items]) => {
        const net = items.reduce((s, r) => s + (Number(r.deposit) || 0) - (Number(r.withdrawal) || 0), 0);
        return (
          <div key={dateKey}>
            <div className="txn-grouped__head">
              <span>{formatDate(dateKey)}</span>
              <Num size={12} weight={600} color={net >= 0 ? 'var(--ft-income)' : 'var(--ft-spend)'}>
                {inr(net, { sign: true })}
              </Num>
            </div>
            <div>
              {items.map((row) => {
                const isIncome = Number(row.deposit) > 0;
                const amt = isIncome ? Number(row.deposit) : Number(row.withdrawal);
                const acctLast4 = row.accountNumber ? row.accountNumber.slice(-4) : null;
                return (
                  <div key={row.id} className="txn-mobile-row">
                    {/* Category glyph — tap to pick category */}
                    <label
                      className="txn-mobile-row__cat-pick"
                      title="Change category"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TransactionCategoryGlyph category={row.category} size={38} />
                      <select
                        className="txn-mobile-cat-select"
                        value={row.categoryId || ''}
                        onChange={(e) => { e.stopPropagation(); onAssignCategory(row.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">No category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                        ))}
                      </select>
                    </label>

                    {/* Tap-to-detail body */}
                    <button
                      type="button"
                      className="txn-mobile-row__body"
                      onClick={() => onOpenDetail(row)}
                    >
                      <div className="txn-mobile-row__copy">
                        <div style={{ color: 'var(--ft-text)', fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.upiName || row.narration || '—'}
                        </div>
                        <div className="txn-mobile-row__meta">
                          <span className="txn-mobile-row__meta-copy">
                            {row.upiDescription || row.upiBank || 'Manual'}
                          </span>
                          {acctLast4 && (
                            <span style={{ flexShrink: 0, fontFamily: 'var(--ft-font-mono)', fontSize: 11, color: 'var(--ft-text-faint)' }}>
                              ····{acctLast4}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="txn-mobile-row__amount">
                        <Num size={14} weight={600} color={isIncome ? 'var(--ft-income)' : 'var(--ft-spend)'}>
                          {inr(isIncome ? amt : -amt, { sign: isIncome })}
                        </Num>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
