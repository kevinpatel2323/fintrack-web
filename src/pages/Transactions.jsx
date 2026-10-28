import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CreditCard, Inbox, Plus, RefreshCw, Search, SearchX, Upload,
} from 'lucide-react';
import CcLinkModal from '../components/CcLinkModal.jsx';
import TransactionManageSheet from '../components/TransactionManageSheet.jsx';
import TransactionTable, {
  transactionColumnChoices,
  useTransactionColumns,
} from '../components/TransactionTable.jsx';
import ManualTransactionDialog from '../components/transactions/ManualTransactionDialog.jsx';
import {
  TYPE_OPTIONS,
  TransactionPeriodFilter,
  accountOptions,
  useCategoryFilterOptions,
} from '../components/transactions/TransactionFilters.jsx';
import {
  ccExpansionItems,
  countActiveFilters,
  getCurrentMonthRange,
  getMonthOptions,
  matchMonthValue,
} from '../components/transactions/transactionListModel.js';
import {
  Alert, Amount, Button, Combobox, ConfirmDialog, EmptyState, ErrorMessage, KeyboardShortcut,
  ListColumnsMenu, PageBody, PageHeader, Select, TabButtons, TextInput, toast,
} from '../components/ui';
import { useCardTransactionManager } from '../hooks/useCardTransactionManager.js';
import { useIsCompact } from '../styles/breakpoints.js';
import { getCcLink, unlinkCcBillPayment } from '../services/cardsApi.js';
import { cardTxnStatus, toCardTableRow } from '../utils/cardTransactionRow.jsx';
import {
  parseTransactionsListParams,
  patchTransactionsListParams,
} from '../utils/transactionsListParams.js';
import { API_BASE, apiErrorMessage, apiFetch } from '../services/http.js';
import { toBankTableRow } from '../components/transactions/bankTransactionRow.jsx';
import ListToolbar, { ListSummary } from '../components/common/ListToolbar.jsx';
import TransactionsPhone from './TransactionsPhone.jsx';
import './Transactions.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

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

  // The box keeps what was typed; the URL keeps it trimmed.
  const [searchDraft, setSearchDraft] = useState(search);
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Header clicks come from the table (ListView decides the next sort and
  // returns to page 1); the rows are ordered here, with the ledger's own keys.
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' });

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
        if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to add tag'));
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
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to delete tag'));
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
    if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to add manual transaction.'));
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
      switch (sort.key) {
        case 'date':
          va = a.transactionDate || ''; vb = b.transactionDate || ''; break;
        case 'description':
          va = (a.upiName || a.narration || '').toLowerCase();
          vb = (b.upiName || b.narration || '').toLowerCase(); break;
        case 'note': {
          // The same text the Note column shows.
          const note = (t) => t.upiDescription || (t.narration && t.narration !== t.upiName ? t.narration : '');
          va = note(a).toLowerCase(); vb = note(b).toLowerCase(); break;
        }
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
      if (va < vb) return sort.direction === 'asc' ? -1 : 1;
      if (va > vb) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredTransactions, sort, tagsByTransaction]);

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
    () => sortedTransactions.map((row) => toBankTableRow(row, tagsByTransaction)),
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
        <TransactionsPhone
          onNewTransaction={newTransaction}
          onRefresh={() => handleRangeFetch()}
          searchDraft={searchDraft}
          search={search}
          onSearchChange={(value) => {
            setSearchDraft(value);
            setSearch(value);
          }}
          filterTab={filterTab}
          onFilterTabChange={setFilterTab}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onRangeChange={applyDateRange}
          monthOptions={monthOptions}
          selectedMonth={selectedMonth}
          accounts={accounts}
          account={rangeAccount}
          onAccountChange={setRangeAccount}
          categories={categories}
          categoryFilterOptions={categoryFilterOptions}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          activeFilterCount={activeSheetFilters}
          onResetFilters={resetSheetFilters}
          sort={sort}
          onSortChange={setSort}
          rows={tableRows}
          totalCount={transactions.length}
          filteredCount={filteredTransactions.length}
          hasClientFilters={hasClientFilters}
          totalSpent={totalSpent}
          totalEarned={totalEarned}
          loading={transactionsLoading}
          loadError={loadError}
          hasTransactions={transactions.length > 0}
          pageErrors={pageErrors}
          emptyState={emptyState}
          onAssignCategory={assignCategoryInline}
          onOpenDetail={openTransactionDetail}
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
      <PageBody className="txns-page" style={{ '--list-toolbar-height': `${toolbarHeight}px` }}>
        <ListToolbar
          ref={toolbarRef}
          meta={(
            <>
              {summaryContent && <ListSummary>{summaryContent}</ListSummary>}
              <ListColumnsMenu columns={transactionColumnChoices()} settings={columnSettings} />
              <Button
                variant="ghost"
                icon={RefreshCw}
                label="Refresh"
                tooltip="Refresh"
                loading={transactionsLoading}
                onClick={() => handleRangeFetch()}
              />
            </>
          )}
        >
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
        </ListToolbar>

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
          columnSettings={columnSettings}
          categories={categories}
          onAssignCategory={assignCategoryInline}
          onOpenManage={openFriendTagsSheet}
          onOpenDetail={openTransactionDetail}
          sort={sort}
          onSortChange={setSort}
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
