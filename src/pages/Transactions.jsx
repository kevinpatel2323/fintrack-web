import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CcLinkModal from '../components/CcLinkModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { FriendTagCard } from '../components/FriendTagLedgerDisplay.jsx';
import Portal from '../components/Portal.jsx';
import SplitTransactionForm from '../components/SplitTransactionForm.jsx';
import TransactionManageSheet from '../components/TransactionManageSheet.jsx';
import TransactionMobileList from '../components/TransactionMobileList.jsx';
import TransactionTable, {
  TXN_TABLE_COLSPAN,
  TransactionTableRow,
  buildTransactionColumns,
} from '../components/TransactionTable.jsx';
import { useCardTransactionManager } from '../hooks/useCardTransactionManager.js';
import { useIsCompact } from '../styles/breakpoints.js';
import {
  Card, Num, Pill, PrimaryBtn, GhostBtn, Avatar, Overline, SectionTitle,
} from '../components/ui/primitives.jsx';
import {
  IcSearch, IcPlus, IcCommand, IcRepeat, IcArrowDL, IcArrowUR, IcClose, IcCal,
  IcCard,
} from '../components/ui/Icon.jsx';
import { getCcLink, unlinkCcBillPayment } from '../services/cardsApi.js';
import { cardTxnStatus, toCardTableRow } from '../utils/cardTransactionRow.jsx';
import { getLast30DayRange } from '../utils/dateUtils.js';
import { inr } from '../utils/inr.js';
import { friendTint, initialsOf } from '../utils/categoryColors.js';
import {
  parseTransactionsListParams,
  patchTransactionsListParams,
} from '../utils/transactionsListParams.js';
import '../styles/transactions-redesign.css';

import { API_BASE, apiFetch } from '../services/http.js';

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

/** Last `count` months, newest first, as `{ value: 'YYYY-MM', label, startIso, endIso }`. */
function getMonthOptions(count = 24) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i + 1, 0));
    out.push({
      value: start.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(start),
      startIso: start.toISOString().slice(0, 10),
      endIso: end.toISOString().slice(0, 10),
    });
  }
  return out;
}

/** `YYYY-MM` when the range covers exactly one calendar month, else '' (custom range). */
function matchMonthValue(startIso, endIso, options) {
  const hit = options.find((m) => m.startIso === startIso && m.endIso === endIso);
  return hit ? hit.value : '';
}

function MobileTxnDateRange({ rangeStart, rangeEnd, onStartChange, onEndChange, onRangeChange }) {
  return (
    <div className="txn-mobile-range">
      <div className="txn-mobile-range__dates">
        <label className="ft-date-chip txn-mobile-range__chip">
          <IcCal size={14} style={{ color: 'var(--ft-text-dim)', flexShrink: 0 }} />
          <span className="txn-mobile-range__chip-copy">
            <span className="txn-mobile-range__chip-label">From</span>
            <span className="txn-mobile-range__chip-value">{formatDateShort(rangeStart)}</span>
          </span>
          <input
            type="date"
            value={rangeStart}
            max={rangeEnd || undefined}
            onChange={(e) => onStartChange(e.target.value)}
            aria-label="Start date"
          />
        </label>
        <label className="ft-date-chip txn-mobile-range__chip">
          <IcCal size={14} style={{ color: 'var(--ft-text-dim)', flexShrink: 0 }} />
          <span className="txn-mobile-range__chip-copy">
            <span className="txn-mobile-range__chip-label">To</span>
            <span className="txn-mobile-range__chip-value">{formatDateShort(rangeEnd)}</span>
          </span>
          <input
            type="date"
            value={rangeEnd}
            min={rangeStart || undefined}
            onChange={(e) => onEndChange(e.target.value)}
            aria-label="End date"
          />
        </label>
      </div>
      <div className="txn-mobile-range__presets" role="group" aria-label="Date range presets">
        <button
          type="button"
          className="txn-mobile-range__preset"
          onClick={() => {
            const { startIso, endIso } = getCurrentMonthRange();
            onRangeChange(startIso, endIso);
          }}
        >
          This month
        </button>
        <button
          type="button"
          className="txn-mobile-range__preset"
          onClick={() => {
            const { startIso, endIso } = getLast30DayRange();
            onRangeChange(startIso, endIso);
          }}
        >
          Last 30 days
        </button>
      </div>
    </div>
  );
}

function getTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Maps a bank transaction into the shape TransactionTable renders. */
function toTableRow(row, tagsByTransaction) {
  const withdrawal = Number(row.withdrawal || 0);
  const deposit = Number(row.deposit || 0);
  const isIncome = deposit > 0;
  const cc = row.ccBillPayment;
  const tags = tagsByTransaction[row.id];

  return {
    id: row.id,
    raw: row,
    date: row.transactionDate,
    title: row.upiName || row.narration || '',
    subtitle: row.upiDescription || row.narration || row.upiBank,
    titleBadge: cc ? (
      <span className="txn-row__cc-badge">
        <IcCard size={11} />
        CC bill{cc.cardLast4 ? ` · ····${cc.cardLast4}` : ''}
      </span>
    ) : null,
    category: row.category,
    categoryId: row.categoryId,
    method: row.upiBank ? `UPI · ${row.upiBank}` : row.isManual ? 'Manual' : 'Bank',
    tagCount: tags === undefined ? null : tags.length,
    amount: isIncome ? deposit : withdrawal,
    isIncome,
    expandable: Boolean(cc),
    // Mobile-only extras.
    mobileSubtitle: row.upiDescription || row.upiBank || 'Manual',
    metaTrailing: row.accountNumber ? `····${row.accountNumber.slice(-4)}` : null,
  };
}

export default function Transactions() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsCompact();

  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const { rangeStart, rangeEnd, filterTab, search } = useMemo(
    () => parseTransactionsListParams(searchParams, monthRange),
    [searchParams, monthRange],
  );

  const monthOptions = useMemo(() => getMonthOptions(24), []);
  const selectedMonth = useMemo(
    () => matchMonthValue(rangeStart, rangeEnd, monthOptions),
    [rangeStart, rangeEnd, monthOptions],
  );

  const applyDateRange = useCallback((start, end) => {
    setSearchParams(
      (prev) => patchTransactionsListParams(prev, { rangeStart: start, rangeEnd: end }),
      { replace: true },
    );
  }, [setSearchParams]);

  const setFilterTab = useCallback((tab) => {
    setSearchParams((prev) => patchTransactionsListParams(prev, { filterTab: tab }), { replace: true });
  }, [setSearchParams]);

  const setSearch = useCallback((value) => {
    setSearchParams((prev) => patchTransactionsListParams(prev, { search: value }), { replace: true });
  }, [setSearchParams]);

  const openTransactionDetail = useCallback((row) => {
    const qs = searchParams.toString();
    navigate(`/transactions/${row.id}`, {
      state: { tx: row, ...(qs ? { transactionsSearch: qs } : {}) },
    });
  }, [navigate, searchParams]);

  // -- API state --
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('');
  const [friends, setFriends] = useState([]);
  const [friendsStatus, setFriendsStatus] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryStatusByTransaction, setCategoryStatusByTransaction] = useState({});
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
  // CC bill payments: which rows are expanded, and the covered card
  // transactions fetched lazily on first expand.
  const [expandedCcIds, setExpandedCcIds] = useState(() => new Set());
  const [ccDetailByTransaction, setCcDetailByTransaction] = useState({});
  const [ccLinkModalRow, setCcLinkModalRow] = useState(null);
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

  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

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
        const res = await apiFetch(`${API_BASE}/imports/accounts`);
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
        const res = await apiFetch(`${API_BASE}/friends`);
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
        const res = await apiFetch(`${API_BASE}/categories`);
        if (!res.ok) return;
        const data = await res.json();
        setCategories(data.data || []);
      } catch {}
    })();
  }, []);

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
      const res = await apiFetch(
        `${API_BASE}/imports/transactions/range?start=${rangeStart}&end=${rangeEnd}${accountQuery}`,
      );
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      const rows = data.data || [];
      setRangeResult(data);
      setTransactions(rows);
      setFriendTagsSheetId(null);
      // The /range payload now carries each transaction's friend tags inline,
      // so seed the Tags column from it instead of fetching them per row.
      const tagsByTx = {};
      for (const tx of rows) tagsByTx[tx.id] = tx.friendTags || [];
      setTagsByTransaction(tagsByTx);
      setTagsStatusByTransaction({});
      setCategoryStatusByTransaction({});
      setRangeStatus('');
      setPage(1);
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

  // ── CC bill payment nesting ─────────────────────────────────────────────
  // The nested card transactions are managed exactly like top-level rows;
  // patching a row writes back into the cached cc-link detail it came from.
  const cardManager = useCardTransactionManager({
    categories,
    onRowPatched: (txnId, patch) =>
      setCcDetailByTransaction((prev) => {
        const next = { ...prev };
        for (const [bankId, detail] of Object.entries(next)) {
          if (!detail?.coveredTransactions) continue;
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

  const { seedTags: seedCardTags } = cardManager;
  const fetchCcDetail = useCallback(async (transactionId) => {
    setCcDetailByTransaction((p) => ({ ...p, [transactionId]: { loading: true } }));
    try {
      const data = await getCcLink(transactionId);
      setCcDetailByTransaction((p) => ({ ...p, [transactionId]: data }));
      // Merge, not replace: other bill payments may already be expanded.
      seedCardTags(data.coveredTransactions);
    } catch (error) {
      setCcDetailByTransaction((p) => ({
        ...p,
        [transactionId]: { error: error.message || 'Failed to load card transactions' },
      }));
    }
  }, [seedCardTags]);

  const toggleCcExpanded = useCallback((transactionId) => {
    const isOpen = expandedCcIds.has(transactionId);
    setExpandedCcIds((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(transactionId);
      else next.add(transactionId);
      return next;
    });
    // Fetch on first expand only; the cache persists across collapses.
    if (!isOpen && !ccDetailByTransaction[transactionId]) {
      fetchCcDetail(transactionId);
    }
  }, [expandedCcIds, ccDetailByTransaction, fetchCcDetail]);

  const handleCcLinked = useCallback((transactionId, result) => {
    setCcLinkModalRow(null);
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              ccBillPayment: {
                paymentId: result?.payment?.id,
                cardId: result?.card?.id,
                cardLast4: result?.card?.last4,
              },
            }
          : t,
      ),
    );
    setCcDetailByTransaction((p) => ({ ...p, [transactionId]: result }));
    setExpandedCcIds((prev) => new Set(prev).add(transactionId));
  }, []);

  const unlinkCc = useCallback((transactionId) => {
    setConfirmState({
      open: true,
      title: 'Unlink card bill?',
      message:
        'The covered card transactions go back to unpaid, and this debit counts as ordinary spend again.',
      confirmLabel: 'Unlink',
      onConfirm: async () => {
        setConfirmState({ open: false });
        try {
          await unlinkCcBillPayment(transactionId);
          setTransactions((prev) =>
            prev.map((t) => (t.id === transactionId ? { ...t, ccBillPayment: null } : t)),
          );
          setCcDetailByTransaction((p) => {
            const next = { ...p };
            delete next[transactionId];
            return next;
          });
          setExpandedCcIds((prev) => {
            const next = new Set(prev);
            next.delete(transactionId);
            return next;
          });
        } catch (error) {
          setRangeStatus(error.message || 'Failed to unlink');
        }
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }, []);

  async function fetchTags(transactionId) {
    setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: 'Loading tags...' }));
    try {
      const res = await apiFetch(`${API_BASE}/transactions/${transactionId}/friends`);
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
        const res = await apiFetch(`${API_BASE}/transactions/${transactionId}/friends`, {
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
      const res = await apiFetch(`${API_BASE}/transactions/${transactionId}/friends/${tagId}`, { method: 'DELETE' });
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
          await apiFetch(`${API_BASE}/transactions/${transactionId}/category`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: Number(categoryId) }),
          });
        } else {
          await apiFetch(`${API_BASE}/transactions/${transactionId}/category`, { method: 'DELETE' });
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

  const tableRows = useMemo(
    () => sortedTransactions.map((row) => toTableRow(row, tagsByTransaction)),
    [sortedTransactions, tagsByTransaction],
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

  const sheet = friendTagsSheetRow && (
    <TransactionManageSheet
      transaction={friendTagsSheetRow}
      date={friendTagsSheetRow.transactionDate}
      metaLine={[friendTagsSheetRow.accountNumber, friendTagsSheetRow.isManual ? 'Manual' : null]
        .filter(Boolean).join(' \u00b7 ')}
      amountIn={Number(friendTagsSheetRow.deposit || 0)}
      amountOut={Number(friendTagsSheetRow.withdrawal || 0)}
      categories={categories}
      categoryId={friendTagsSheetRow.categoryId}
      onAssignCategory={(value) => assignCategory(friendTagsSheetRow.id, value)}
      categoryStatus={categoryStatusByTransaction[friendTagsSheetRow.id]}
      actions={
        /* Only a debit can be a card bill payment \u2014 the API enforces this too. */
        Number(friendTagsSheetRow.withdrawal || 0) > 0
        && !(Number(friendTagsSheetRow.deposit || 0) > 0)
          ? (friendTagsSheetRow.ccBillPayment ? (
            <GhostBtn onClick={() => unlinkCc(friendTagsSheetRow.id)}>Unlink card bill</GhostBtn>
          ) : (
            <GhostBtn onClick={() => setCcLinkModalRow(friendTagsSheetRow)}>Link to card bill</GhostBtn>
          ))
          : null
      }
      friends={friends}
      tags={tagsByTransaction[friendTagsSheetRow.id] || []}
      tagsStatus={tagsStatusByTransaction[friendTagsSheetRow.id]}
      splitApplying={splitApplyingTransactionId === friendTagsSheetRow.id}
      onApplySplit={(args) => applySplitTags(friendTagsSheetRow.id, args)}
      onDeleteTag={(tagId) => deleteTag(friendTagsSheetRow.id, tagId)}
      onClose={closeFriendTagsSheet}
    />
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

  const ccModal = ccLinkModalRow && (
    <CcLinkModal
      transaction={ccLinkModalRow}
      onClose={() => setCcLinkModalRow(null)}
      onLinked={(result) => handleCcLinked(ccLinkModalRow.id, result)}
    />
  );

  // Manage sheet for a nested card transaction (opened from a CC child row).
  const cardSheet = cardManageRow && (
    <TransactionManageSheet
      {...cardManager.manageSheetPropsFor(cardManageRow)}
      metaLine={cardTxnStatus(cardManageRow)}
      friends={friends}
    />
  );

  // ===== MOBILE =====
  if (isMobile) {
    return (
      <>
        <ConfirmDialog {...confirmState} />
        {sheet}
        {cardSheet}
        {ccModal}
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
          <MobileTxnDateRange
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onRangeChange={applyDateRange}
            onStartChange={(start) => applyDateRange(start, rangeEnd)}
            onEndChange={(end) => applyDateRange(rangeStart, end)}
          />
          {rangeStatus && <p className="status">{rangeStatus}</p>}
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
              <TransactionMobileList
                rows={tableRows}
                onOpenDetail={openTransactionDetail}
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
      {cardSheet}
      {ccModal}
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
            <span>Month</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                const m = monthOptions.find((o) => o.value === e.target.value);
                if (m) applyDateRange(m.startIso, m.endIso);
              }}
            >
              {!selectedMonth && <option value="">Custom range</option>}
              {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="txn-field">
            <span>Start</span>
            <input type="date" value={rangeStart} onChange={(e) => applyDateRange(e.target.value, rangeEnd)} />
          </label>
          <label className="txn-field">
            <span>End</span>
            <input type="date" value={rangeEnd} onChange={(e) => applyDateRange(rangeStart, e.target.value)} />
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
        <TransactionTable
          rows={tableRows}
          storageKey="fintrack.ledger.bank"
          categories={categories}
          onAssignCategory={assignCategory}
          onOpenManage={openFriendTagsSheet}
          onOpenDetail={openTransactionDetail}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          expandedIds={expandedCcIds}
          onToggleExpand={toggleCcExpanded}
          renderExpansion={(row, { colSpan, columns }) => (
            <CcChildRows
              detail={ccDetailByTransaction[row.id]}
              colSpan={colSpan}
              columns={columns}
              categories={categories}
              tagsByTransaction={cardManager.tagsByTransaction}
              onAssignCategory={cardManager.assignCategory}
              onOpenManage={cardManager.openManage}
            />
          )}
          loading={transactionsLoading}
        />
      </Card>
    </>
  );
}

// The credit-card transactions a bill payment covers, rendered as nested rows
// of the payment — same columns and same management as any other ledger row.
// The remainder is not a transaction, so it keeps its own spanned line.
function CcChildRows({
  detail, colSpan, columns, categories, tagsByTransaction, onAssignCategory, onOpenManage,
}) {
  // The parent hands over its *visible* columns; rebuild them against the card
  // manager's handlers (a nested row is a card transaction, not a bank one) and
  // reorder to match, so hiding a column hides it on the nested rows too.
  const nestedColumns = useMemo(() => {
    const byId = new Map(
      buildTransactionColumns({
        categories,
        onAssignCategory,
        onOpenManage,
      }).map((c) => [c.id, c]),
    );
    return columns.map((c) => byId.get(c.id)).filter(Boolean);
  }, [columns, categories, onAssignCategory, onOpenManage]);

  const cell = (content) => (
    <tr className="txn-row__child">
      <td colSpan={colSpan ?? TXN_TABLE_COLSPAN}>{content}</td>
    </tr>
  );

  if (!detail || detail.loading) return cell(<span className="txn-row__child-note">Loading card transactions…</span>);
  if (detail.error) return cell(<span className="txn-row__child-note">{detail.error}</span>);
  if (!detail.linked) return cell(<span className="txn-row__child-note">Not linked to a card bill.</span>);

  const covered = detail.coveredTransactions || [];
  const remainder = Number(detail.remainder || 0);

  return (
    <>
      {covered.length === 0 && cell(<span className="txn-row__child-note">No card transactions covered.</span>)}
      {covered.map((t, i) => (
        <TransactionTableRow
          key={t.id}
          nested
          nestedLast={i === covered.length - 1}
          row={toCardTableRow(t, tagsByTransaction)}
          columns={nestedColumns}
        />
      ))}
      {remainder !== 0 && (
        <tr className="txn-row__child txn-row__remainder">
          <td colSpan={colSpan ?? TXN_TABLE_COLSPAN}>
            <div className="txn-row__child-line">
              <span className="txn-row__child-merchant">
                {remainder > 0 ? 'Carried forward / other charges' : 'Not covered by this payment'}
              </span>
              <span className="txn-row__child-amount">
                <Num size={12.5} weight={600} color="var(--ft-text-dim)">
                  {inr(remainder, { decimals: 2 })}
                </Num>
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
