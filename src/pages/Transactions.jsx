import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CreditCard, Inbox, Plus, RefreshCw, Search, SearchX, SlidersHorizontal, Upload,
} from 'lucide-react';
import CcLinkModal from '../components/CcLinkModal.jsx';
import TransactionManageSheet from '../components/TransactionManageSheet.jsx';
import TransactionMobileList from '../components/TransactionMobileList.jsx';
import TransactionTable, {
  transactionColumnChoices,
  useTransactionColumns,
} from '../components/TransactionTable.jsx';
import ManualTransactionDialog from '../components/transactions/ManualTransactionDialog.jsx';
import TransactionColumnsMenu from '../components/transactions/TransactionColumnsMenu.jsx';
import {
  TYPE_OPTIONS,
  TransactionFilterSheet,
  TransactionPeriodFilter,
  accountOptions,
  useCategoryFilterOptions,
} from '../components/transactions/TransactionFilters.jsx';
import {
  ccExpansionItems,
  countActiveFilters,
  formatRangeLabel,
  getCurrentMonthRange,
  getMonthOptions,
  matchMonthValue,
} from '../components/transactions/transactionListModel.js';
import {
  Alert, Amount, Badge, Button, Combobox, ConfirmDialog, EmptyState, ErrorMessage, KeyboardShortcut,
  PageBody, PageHeader, Select, Skeleton, TabButtons, TextInput, toast,
} from '../components/ui';
import { useCardTransactionManager } from '../hooks/useCardTransactionManager.js';
import { useIsCompact } from '../styles/breakpoints.js';
import { getCcLink, unlinkCcBillPayment } from '../services/cardsApi.js';
import { cardTxnStatus, toCardTableRow } from '../utils/cardTransactionRow.jsx';
import {
  parseTransactionsListParams,
  patchTransactionsListParams,
} from '../utils/transactionsListParams.js';
import { API_BASE, apiFetch } from '../services/http.js';
import './Transactions.css';

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
      <Badge size="sm" prefix={CreditCard} label={`CC bill${cc.cardLast4 ? ` · •• ${cc.cardLast4}` : ''}`} />
    ) : null,
    category: row.category,
    categoryId: row.categoryId,
    method: row.upiBank ? `UPI · ${row.upiBank}` : row.isManual ? 'Manual' : 'Bank',
    tagCount: tags === undefined ? null : tags.length,
    amount: isIncome ? deposit : withdrawal,
    isIncome,
    expandable: Boolean(cc),
    // Phone-only extras.
    mobileSubtitle: row.upiDescription || row.upiBank || 'Manual',
    metaTrailing: row.accountNumber ? `•• ${row.accountNumber.slice(-4)}` : null,
  };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function ListSkeleton() {
  return (
    <div className="txns-skeleton" aria-busy="true" aria-label="Loading transactions">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div className="txns-skeleton__row" key={i}>
          <Skeleton width={32} height={32} />
          <div className="txns-skeleton__text">
            <Skeleton height={12} width={`${60 - i * 4}%`} />
            <Skeleton height={10} width="35%" />
          </div>
          <Skeleton height={12} width={56} />
        </div>
      ))}
    </div>
  );
}

export default function Transactions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsCompact();
  // The toolbar pins under the page header; the table header pins under it.
  const toolbarRef = useRef(null);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setToolbarHeight(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const { rangeStart, rangeEnd, filterTab, search, categoryFilter } = useMemo(
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

  const setCategoryFilter = useCallback((value) => {
    setSearchParams((prev) => patchTransactionsListParams(prev, { categoryFilter: value }), { replace: true });
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
  const [categoryStatusByTransaction, setCategoryStatusByTransaction] = useState({});
  const [rangeAccount, setRangeAccount] = useState('');
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
  const [manualOpen, setManualOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The box keeps what was typed; the URL keeps it trimmed.
  const [searchDraft, setSearchDraft] = useState(search);
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const searchInputRef = useRef(null);
  const columnSettings = useTransactionColumns('fintrack.ledger.bank');
  const categoryFilterOptions = useCategoryFilterOptions(categories);

  const canFetchRange = useMemo(() => rangeStart && rangeEnd, [rangeStart, rangeEnd]);

  useEffect(() => {
    setSearchDraft((draft) => (draft.trim() === search ? draft : search));
  }, [search]);

  // "New transaction" elsewhere (the dashboard) lands here with router state.
  // Open the form once, then drop the state so a refresh doesn't reopen it.
  useEffect(() => {
    if (!location.state?.openNewTransaction) return;
    setManualOpen(true);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  // A narrower filter can leave the current page past the end.
  useEffect(() => {
    setPage(1);
  }, [filterTab, search, categoryFilter]);

  // -- Effects --
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

  // ⌘K / Ctrl+K focuses the search box.
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
    setTransactionsLoading(true);
    try {
      const accountQuery = rangeAccount ? `&accountNumber=${encodeURIComponent(rangeAccount)}` : '';
      const res = await apiFetch(
        `${API_BASE}/imports/transactions/range?start=${rangeStart}&end=${rangeEnd}${accountQuery}`,
      );
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      const rows = data.data || [];
      setTransactions(rows);
      setFriendTagsSheetId(null);
      // The /range payload carries each transaction's friend tags inline, so
      // seed the People column from it instead of fetching them per row.
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

  const closeConfirm = useCallback(() => setConfirmState((p) => ({ ...p, open: false })), []);

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
          toast.success('Card bill unlinked');
        } catch (error) {
          toast.error(error.message || 'Failed to unlink');
        }
        closeConfirm();
      },
      onCancel: closeConfirm,
    });
  }, [closeConfirm]);

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

  async function applySplitTags(transactionId, { results, direction, note, allocationsByParticipant, groupByParticipant }) {
    setTagsStatusByTransaction((p) => ({ ...p, [transactionId]: '' }));
    setSplitApplyingTransactionId(transactionId);
    const noteTrimmed = typeof note === 'string' ? note.trim() : '';
    try {
      for (const r of results) {
        const amountMinor = r.amountMinor;
        const lineDirection = amountMinor === 0 ? 'NOTHING_OUTSTANDING' : direction;
        const amountValue = amountMinor === 0 ? 0 : minorToApiAmount(amountMinor, 100);
        const allocations = allocationsByParticipant?.[r.participantId];
        const groupId = groupByParticipant?.[r.participantId];
        const res = await apiFetch(`${API_BASE}/transactions/${transactionId}/friends`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            friendId: Number(r.participantId),
            amount: amountValue,
            direction: lineDirection,
            ...(noteTrimmed ? { note: noteTrimmed } : {}),
            ...(lineDirection === 'SETTLEMENT' && allocations?.length > 0 ? { allocations } : {}),
            ...(lineDirection !== 'SETTLEMENT' && groupId ? { entryGroupId: Number(groupId) } : {}),
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
        await runDeleteTag(transactionId, tagId);
        closeConfirm();
      },
      onCancel: closeConfirm,
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

  /** POST /transactions/manual. Throws so the form stays open with the message. */
  async function submitManual(payload) {
    const res = await apiFetch(`${API_BASE}/transactions/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add manual transaction.');
    setManualOpen(false);
    toast.success('Transaction added');
    await handleRangeFetch();
  }

  // `notify`: inline pickers in the list toast a failure themselves; the
  // manage sheet turns the status string into its own toast.
  const assignCategory = useCallback(
    async (transactionId, categoryId, { notify = false } = {}) => {
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
        if (notify) toast.error('Could not save the category');
      }
    },
    [categories],
  );

  const assignCategoryInline = useCallback(
    (transactionId, categoryId) => assignCategory(transactionId, categoryId, { notify: true }),
    [assignCategory],
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

  // -- Filters --
  const clearListFilters = useCallback(() => {
    setSearchParams(
      (prev) => patchTransactionsListParams(prev, { filterTab: 'all', search: '', categoryFilter: '' }),
      { replace: true },
    );
    setSearchDraft('');
    setRangeAccount('');
  }, [setSearchParams]);

  const resetSheetFilters = useCallback(() => {
    setSearchParams(
      (prev) => patchTransactionsListParams(prev, {
        filterTab: 'all', rangeStart: '', rangeEnd: '', categoryFilter: '',
      }),
      { replace: true },
    );
    setRangeAccount('');
  }, [setSearchParams]);

  const hasClientFilters = filterTab !== 'all' || Boolean(search.trim()) || Boolean(categoryFilter);
  const hasListFilters = hasClientFilters || Boolean(rangeAccount);
  const activeSheetFilters = countActiveFilters({
    filterTab,
    account: rangeAccount,
    category: categoryFilter,
    rangeStart,
    rangeEnd,
    defaultRange: monthRange,
  });

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

  // Totals describe what the list shows: the whole period, or the filtered rows.
  const summaryRows = hasClientFilters ? filteredTransactions : transactions;
  const totalSpent = useMemo(
    () => summaryRows.reduce((s, t) => s + (Number(t.withdrawal) || 0), 0),
    [summaryRows],
  );
  const totalEarned = useMemo(
    () => summaryRows.reduce((s, t) => s + (Number(t.deposit) || 0), 0),
    [summaryRows],
  );

  const tableRows = useMemo(
    () => sortedTransactions.map((row) => toTableRow(row, tagsByTransaction)),
    [sortedTransactions, tagsByTransaction],
  );

  const { tagsByTransaction: cardTags, assignCategory: assignCardCategory, openManage: openCardManage } = cardManager;
  const ccExpansionRows = useCallback(
    (row) => ccExpansionItems(row.id, ccDetailByTransaction[row.id], (t) => toCardTableRow(t, cardTags)),
    [ccDetailByTransaction, cardTags],
  );
  const ccExpansionHandlers = useMemo(
    () => ({ onAssignCategory: assignCardCategory, onOpenManage: openCardManage }),
    [assignCardCategory, openCardManage],
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

  // -- Copy --
  const periodLabel = selectedMonth
    ? monthOptions.find((m) => m.value === selectedMonth)?.label
    : null;
  const loadError = rangeStatus && rangeStatus !== 'Loading...' ? rangeStatus : '';
  const countLabel = hasClientFilters
    ? `${filteredTransactions.length} of ${plural(transactions.length, 'transaction')}`
    : plural(transactions.length, 'transaction');

  const summaryContent = transactionsLoading ? null : (
    <>
      {countLabel}
      {' · '}
      <Amount value={totalSpent} sign="never" tone="inherit" /> spent
      {' · '}
      <Amount value={totalEarned} sign="never" tone="inherit" /> earned
    </>
  );

  let emptyState;
  if (loadError) {
    emptyState = (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load transactions"
        description={loadError}
        action={<Button label="Try again" iconLeft={RefreshCw} onClick={() => handleRangeFetch()} />}
      />
    );
  } else if (hasListFilters) {
    emptyState = (
      <EmptyState
        icon={SearchX}
        title="No transactions match these filters"
        description={periodLabel
          ? `Nothing in ${periodLabel} matches the search and filters.`
          : 'Nothing in these dates matches the search and filters.'}
        action={<Button label="Clear filters" onClick={clearListFilters} />}
      />
    );
  } else {
    emptyState = (
      <EmptyState
        icon={Inbox}
        title={periodLabel ? `No transactions in ${periodLabel}` : 'No transactions in these dates'}
        description="Import a statement or add one by hand."
        action={<Button iconLeft={Upload} label="Import statement" to="/import" />}
      />
    );
  }

  // -- Overlays --
  const manageSheet = friendTagsSheetRow && (
    <TransactionManageSheet
      transaction={friendTagsSheetRow}
      date={friendTagsSheetRow.transactionDate}
      metaLine={[friendTagsSheetRow.accountNumber, friendTagsSheetRow.isManual ? 'Manual' : null]
        .filter(Boolean).join(' · ')}
      amountIn={Number(friendTagsSheetRow.deposit || 0)}
      amountOut={Number(friendTagsSheetRow.withdrawal || 0)}
      categories={categories}
      categoryId={friendTagsSheetRow.categoryId}
      onAssignCategory={(value) => assignCategory(friendTagsSheetRow.id, value)}
      categoryStatus={categoryStatusByTransaction[friendTagsSheetRow.id]}
      actions={
        /* Only a debit can be a card bill payment — the API enforces this too. */
        Number(friendTagsSheetRow.withdrawal || 0) > 0
        && !(Number(friendTagsSheetRow.deposit || 0) > 0)
          ? (friendTagsSheetRow.ccBillPayment ? (
            <Button label="Unlink card bill" onClick={() => unlinkCc(friendTagsSheetRow.id)} />
          ) : (
            <Button iconLeft={CreditCard} label="Link to card bill" onClick={() => setCcLinkModalRow(friendTagsSheetRow)} />
          ))
          : null
      }
      friends={friends}
      tags={tagsByTransaction[friendTagsSheetRow.id] || []}
      tagsStatus={tagsStatusByTransaction[friendTagsSheetRow.id]}
      splitApplying={splitApplyingTransactionId === friendTagsSheetRow.id}
      onApplySplit={(args) => applySplitTags(friendTagsSheetRow.id, args)}
      onDeleteTag={(tagId) => deleteTag(friendTagsSheetRow.id, tagId)}
      onTagsChanged={() => fetchTags(friendTagsSheetRow.id)}
      onClose={closeFriendTagsSheet}
    />
  );

  // Manage sheet for a nested card transaction (opened from a card bill's row).
  const cardSheet = cardManageRow && (
    <TransactionManageSheet
      {...cardManager.manageSheetPropsFor(cardManageRow)}
      metaLine={cardTxnStatus(cardManageRow)}
      friends={friends}
    />
  );

  const overlays = (
    <>
      <ConfirmDialog
        open={Boolean(confirmState.open)}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={confirmState.onCancel || closeConfirm}
      />
      {manageSheet}
      {cardSheet}
      {ccLinkModalRow && (
        <CcLinkModal
          transaction={ccLinkModalRow}
          onClose={() => setCcLinkModalRow(null)}
          onLinked={(result) => handleCcLinked(ccLinkModalRow.id, result)}
        />
      )}
      <ManualTransactionDialog open={manualOpen} onClose={() => setManualOpen(false)} onSubmit={submitManual} />
    </>
  );

  const pageErrors = [accountsStatus, friendsStatus].filter(Boolean);
  const newTransaction = () => setManualOpen(true);

  // ===== PHONE =====
  if (isMobile) {
    return (
      <>
        <PageHeader
          title="Activity"
          mobileActions={<Button variant="ghost" size="md" icon={Plus} label="New transaction" onClick={newTransaction} />}
        />
        <PageBody className="txns-page" style={{ '--txl-sticky-offset': `${toolbarHeight}px` }}>
          <div className="txns-mobile-toolbar" ref={toolbarRef}>
            <TextInput
              className="txns-search"
              type="search"
              prefix={Search}
              placeholder="Search transactions"
              aria-label="Search transactions"
              value={searchDraft}
              onChange={(e) => {
                setSearchDraft(e.target.value);
                setSearch(e.target.value);
              }}
            />
            <Button
              iconLeft={SlidersHorizontal}
              iconRight={activeSheetFilters > 0
                ? <Badge variant="solid" size="sm" label={activeSheetFilters} aria-hidden="true" />
                : undefined}
              label="Filter"
              aria-label={activeSheetFilters ? `Filter, ${activeSheetFilters} active` : 'Filter'}
              aria-haspopup="dialog"
              active={activeSheetFilters > 0}
              onClick={() => setFiltersOpen(true)}
            />
          </div>

          <p className="txns-summary txns-summary--mobile">
            {periodLabel || formatRangeLabel(rangeStart, rangeEnd)}
            {summaryContent && <> · {summaryContent}</>}
          </p>

          {pageErrors.length > 0 && <ErrorMessage message={pageErrors} />}
          {loadError && transactions.length > 0 && (
            <Alert
              theme="red"
              title="Couldn't refresh transactions"
              description={loadError}
              primaryAction={{ label: 'Try again', onClick: () => handleRangeFetch() }}
            />
          )}

          {transactionsLoading ? (
            <ListSkeleton />
          ) : tableRows.length === 0 ? (
            emptyState
          ) : (
            <TransactionMobileList
              rows={tableRows}
              onOpenDetail={openTransactionDetail}
              categories={categories}
              onAssignCategory={assignCategoryInline}
            />
          )}
        </PageBody>

        <TransactionFilterSheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          activeCount={activeSheetFilters}
          onReset={resetSheetFilters}
          filterTab={filterTab}
          onFilterTabChange={setFilterTab}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onRangeChange={applyDateRange}
          monthOptions={monthOptions}
          accounts={accounts}
          account={rangeAccount}
          onAccountChange={setRangeAccount}
          categoryOptions={categoryFilterOptions}
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />
        {overlays}
      </>
    );
  }

  // ===== DESKTOP =====
  return (
    <>
      <PageHeader
        title="Transactions"
        actions={(
          <>
            <Button iconLeft={Upload} label="Import" to="/import" />
            <Button variant="solid" iconLeft={Plus} label="New transaction" onClick={newTransaction} />
          </>
        )}
      />
      <PageBody className="txns-page" style={{ '--txl-sticky-offset': `${toolbarHeight}px` }}>
        <div className="txns-toolbar" ref={toolbarRef}>
          <div className="txns-toolbar__filters">
            <TextInput
              ref={searchInputRef}
              className="txns-search"
              type="search"
              prefix={Search}
              suffix={!searchFocused && !searchDraft ? <KeyboardShortcut combo="Mod+K" /> : null}
              placeholder="Search transactions"
              aria-label="Search transactions"
              value={searchDraft}
              onChange={(e) => {
                setSearchDraft(e.target.value);
                setSearch(e.target.value);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <TabButtons aria-label="Type" options={TYPE_OPTIONS} value={filterTab} onChange={setFilterTab} />
            <Select
              aria-label="Account"
              className="txns-filter"
              options={accountOptions(accounts)}
              value={rangeAccount}
              onChange={(e) => setRangeAccount(e.target.value)}
            />
            <Combobox
              aria-label="Category"
              className="txns-filter"
              options={categoryFilterOptions}
              value={categoryFilter || null}
              onChange={(value) => setCategoryFilter(value || '')}
              placeholder="All categories"
              searchPlaceholder="Search categories"
              clearable
            />
            <TransactionPeriodFilter
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onChange={applyDateRange}
              monthOptions={monthOptions}
            />
          </div>
          <div className="txns-toolbar__meta">
            {summaryContent && <span className="txns-summary">{summaryContent}</span>}
            <TransactionColumnsMenu columns={transactionColumnChoices()} settings={columnSettings} />
            <Button
              variant="ghost"
              icon={RefreshCw}
              label="Refresh"
              tooltip="Refresh"
              loading={transactionsLoading}
              onClick={() => handleRangeFetch()}
            />
          </div>
        </div>

        {pageErrors.length > 0 && <ErrorMessage message={pageErrors} />}
        {loadError && transactions.length > 0 && (
          <Alert
            theme="red"
            title="Couldn't refresh transactions"
            description={loadError}
            primaryAction={{ label: 'Try again', onClick: () => handleRangeFetch() }}
          />
        )}

        <TransactionTable
          className="txns-table"
          rows={tableRows}
          storageKey="fintrack.ledger.bank"
          columnSettings={columnSettings}
          categories={categories}
          onAssignCategory={assignCategoryInline}
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
          expansionRows={ccExpansionRows}
          expansionHandlers={ccExpansionHandlers}
          loading={transactionsLoading}
          stickyHeader
          emptyState={emptyState}
        />
      </PageBody>
      {overlays}
    </>
  );
}
