import { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import {
  FriendTagMobileDetails,
  rowForFriendTagCard,
} from '../components/FriendTagLedgerDisplay.jsx';
import Portal from '../components/Portal.jsx';
import DataTable from '../components/DataTable.jsx';
import MobileTransactionCard from '../components/MobileTransactionCard.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { sortTableRows } from '../utils/tableSort.js';
import SplitTransactionForm from '../components/SplitTransactionForm.jsx';
import '../styles/transactionSheet.css';
import '../styles/txn-manage-forms.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateCompact(value) {
  if (!value) return '—';
  const date = new Date(value);
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
  return new Intl.NumberFormat('en-IN').format(num);
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  return { startIso, endIso };
}

function getTodayIso() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function Transactions() {
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

  const canFetchRange = useMemo(() => rangeStart && rangeEnd, [rangeStart, rangeEnd]);
  const isNarrow = useMediaQuery('(max-width: 1099px)');
  const isPhone = useMediaQuery('(max-width: 719px)');
  const [mobileSort, setMobileSort] = useState({ columnId: 'date', dir: 'desc' });

  useEffect(() => {
    async function fetchAccounts() {
      setAccountsStatus('');
      try {
        const res = await fetch(`${API_BASE}/imports/accounts`);
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const data = await res.json();
        setAccounts(data.data || []);
      } catch (error) {
        setAccountsStatus(error.message || 'Failed to fetch accounts');
      }
    }

    fetchAccounts();
  }, []);

  useEffect(() => {
    async function fetchFriends() {
      setFriendsStatus('');
      try {
        const res = await fetch(`${API_BASE}/friends`);
        if (!res.ok) throw new Error('Failed to fetch friends');
        const data = await res.json();
        setFriends(data.data || []);
      } catch (error) {
        setFriendsStatus(error.message || 'Failed to fetch friends.');
      }
    }

    fetchFriends();
  }, []);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        if (!res.ok) return;
        const data = await res.json();
        setCategories(data.data || []);
      } catch {}
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!canFetchRange) return;
    handleRangeFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd, rangeAccount]);

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
  }

  function minorToApiAmount(amountMinor, minorPerMajor = 100) {
    return Number((amountMinor / minorPerMajor).toFixed(2));
  }

  async function applySplitTags(transactionId, { results, direction, note, linkedTagsByParticipant }) {
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
  }

  async function deleteTag(transactionId, tagId) {
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
  }

  async function handleManualSubmit(event) {
    event.preventDefault();
    setManualStatus('');

    const narration = manualForm.narration.trim();
    const amountValue = Number(manualForm.amount);
    const balanceValue = manualForm.balance === '' ? undefined : Number(manualForm.balance);

    if (!manualForm.transactionDate) {
      setManualStatus('Select a transaction date.');
      return;
    }
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
          transactionDate: manualForm.transactionDate,
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
      setManualStatus('Manual transaction added.');
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
      setManualOpen(false);
      await handleRangeFetch();
    } catch (error) {
      setManualStatus(error.message || 'Failed to add manual transaction.');
    } finally {
      setManualSubmitting(false);
    }
  }

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

  const transactionColumns = [
      {
        id: 'date',
        header: 'Date',
        defaultWidth: 120,
        minWidth: 88,
        sortable: true,
        accessor: (row) => new Date(row.transactionDate).getTime(),
        trim: true,
        title: (row) => formatDate(row.transactionDate),
        cellClassName: 'data-table-cell--span-mobile',
        cell: (row) => <strong className="transaction-date">{formatDate(row.transactionDate)}</strong>,
      },
      {
        id: 'account',
        header: 'Account',
        defaultWidth: 180,
        sortable: true,
        accessor: (row) => row.accountNumber || '',
        trim: true,
        title: (row) => row.accountNumber || 'unknown',
        cell: (row) => (
          <>
            <span className="transaction-account-badge">{row.accountNumber || 'unknown'}</span>
            {row.isManual && <span className="transaction-status-badge manual">Manual</span>}
          </>
        ),
      },
      {
        id: 'upiName',
        header: 'UPI name',
        defaultWidth: 200,
        sortable: true,
        accessor: (row) => row.upiName || '',
        trim: true,
        title: (row) => row.upiName || '—',
        cellClassName: 'data-table-cell--span-mobile',
        cell: (row) => <strong>{row.upiName || '—'}</strong>,
      },
      {
        id: 'upiDescription',
        header: 'UPI description',
        defaultWidth: 220,
        sortable: true,
        accessor: (row) => (row.isManual ? row.narration : row.upiDescription) || '',
        trim: true,
        title: (row) => (row.isManual ? row.narration : row.upiDescription) || '—',
        cellClassName: 'data-table-cell--span-mobile',
        cell: (row) => {
          const text = row.isManual ? row.narration : row.upiDescription;
          return <strong>{text || '—'}</strong>;
        },
      },
      {
        id: 'upiBank',
        header: 'UPI bank',
        defaultWidth: 160,
        sortable: true,
        accessor: (row) => row.upiBank || '',
        trim: true,
        title: (row) => row.upiBank || '—',
        cellClassName: 'data-table-cell--span-mobile',
        cell: (row) => <strong>{row.upiBank || '—'}</strong>,
      },
      {
        id: 'amount',
        header: 'Amount',
        defaultWidth: 120,
        sortable: true,
        accessor: (row) => {
          const w = Number(row.withdrawal || 0);
          const d = Number(row.deposit || 0);
          return w > 0 ? -w : d;
        },
        trim: true,
        cell: (row) => {
          const withdrawal = Number(row.withdrawal || 0);
          const deposit = Number(row.deposit || 0);
          const amount = withdrawal > 0 ? withdrawal : deposit;
          const isWithdrawal = withdrawal > 0;
          return (
            <strong className={`transaction-amount ${isWithdrawal ? 'amount-withdrawal' : 'amount-deposit'}`}>
              {isWithdrawal ? '-' : '+'}
              {formatNumber(amount)}
            </strong>
          );
        },
      },
      {
        id: 'balance',
        header: 'Balance',
        defaultWidth: 130,
        sortable: true,
        accessor: (row) => Number(row.balance) || 0,
        trim: true,
        title: (row) => formatNumber(row.balance),
        cell: (row) => <strong>{formatNumber(row.balance)}</strong>,
      },
      {
        id: 'category',
        header: 'Category',
        defaultWidth: 176,
        minWidth: 120,
        sortable: true,
        accessor: (row) => row.category?.name || '',
        trim: false,
        title: (row) =>
          row.category
            ? `${row.category.icon ? `${row.category.icon} ` : ''}${row.category.name}`
            : 'None',
        cellClassName: 'data-table-cell--category',
        cell: (row) => {
          const status = categoryStatusByTransaction[row.id];
          const busy = status === 'Saving…';
          return (
            <div className="data-table-category-cell">
              <select
                className={`data-table-category-select${row.categoryId == null ? ' data-table-category-select--empty' : ''}`}
                value={row.categoryId != null ? String(row.categoryId) : ''}
                onChange={(e) => assignCategory(row.id, e.target.value)}
                aria-label={`Category for transaction on ${formatDate(row.transactionDate)}`}
                disabled={busy}
              >
                <option value="">None</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}
                    {cat.name}
                  </option>
                ))}
              </select>
              {status ? <span className="data-table-category-status">{status}</span> : null}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        defaultWidth: 120,
        minWidth: 96,
        hideable: false,
        sortable: false,
        cellClassName: 'data-table-cell--actions',
        cell: (row) => (
          <button
            className="ghost"
            type="button"
            onClick={() => openFriendTagsSheet(row.id)}
            aria-label="Manage friends for this transaction"
          >
            Manage
          </button>
        ),
      },
    ];

  // Category-filtered view for table/mobile
  const filteredTransactions = useMemo(() => {
    if (!categoryFilter) return transactions;
    if (categoryFilter === '__none__') return transactions.filter((t) => !t.categoryId);
    return transactions.filter((t) => String(t.categoryId) === categoryFilter);
  }, [transactions, categoryFilter]);

  const sortedForMobile = useMemo(
    () => sortTableRows(filteredTransactions, transactionColumns, mobileSort),
    [filteredTransactions, transactionColumns, mobileSort],
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
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
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
      {friendTagsSheetRow && (
        <Portal>
          <div
            className="calendar-sheet-backdrop"
            role="presentation"
            onClick={(e) => e.target === e.currentTarget && closeFriendTagsSheet()}
          >
            <div
              className="calendar-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="txn-friend-sheet-title"
            >
            <div className="calendar-sheet__header">
              <div>
                <h3 id="txn-friend-sheet-title">
                  {formatDate(friendTagsSheetRow.transactionDate)}
                </h3>
                <p>
                  {(tagsByTransaction[friendTagsSheetRow.id] || []).length}{' '}
                  {(tagsByTransaction[friendTagsSheetRow.id] || []).length === 1
                    ? 'friend tag'
                    : 'friend tags'}
                  {' · '}
                  {(() => {
                    const w = Number(friendTagsSheetRow.withdrawal || 0);
                    const d = Number(friendTagsSheetRow.deposit || 0);
                    const isW = w > 0;
                    const amt = isW ? w : d;
                    return `${isW ? 'Out' : 'In'} ₹${formatNumber(amt)}`;
                  })()}
                </p>
                <p className="calendar-sheet__header-meta">
                  {[friendTagsSheetRow.accountNumber, friendTagsSheetRow.isManual ? 'Manual' : null]
                    .filter(Boolean)
                    .join(' · ')}
                  {(() => {
                    const line = friendTagsSheetRow.isManual
                      ? friendTagsSheetRow.narration
                      : friendTagsSheetRow.upiDescription || friendTagsSheetRow.upiName;
                    const t = (line || '').trim();
                    if (!t) return null;
                    return ` · ${t.length > 140 ? `${t.slice(0, 137)}…` : t}`;
                  })()}
                </p>
              </div>
              <button
                type="button"
                className="ghost calendar-sheet__close"
                onClick={closeFriendTagsSheet}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="calendar-sheet__body">
              <div className="calendar-summary-strip" aria-label="Transaction amounts">
                <div>
                  <span>Total in</span>
                  <strong>₹{formatNumber(Number(friendTagsSheetRow.deposit || 0))}</strong>
                </div>
                <div>
                  <span>Total out</span>
                  <strong>₹{formatNumber(Number(friendTagsSheetRow.withdrawal || 0))}</strong>
                </div>
                <div>
                  <span>Net</span>
                  <strong>
                    {(() => {
                      const net =
                        Number(friendTagsSheetRow.deposit || 0) -
                        Number(friendTagsSheetRow.withdrawal || 0);
                      return (
                        <>
                          {net >= 0 ? '+' : '−'}₹{formatNumber(Math.abs(net))}
                        </>
                      );
                    })()}
                  </strong>
                </div>
              </div>
              <div className="calendar-manage-shell glass-panel">
                {renderFriendTagsPanel(friendTagsSheetRow)}
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
      <section className="card card--transactions">
        <div className="glass-panel txn-premium-filters">
          <div className="card-header">
            <div>
              <h2>Filters</h2>
              <p>Filter by date range. Defaults to the current month.</p>
            </div>
            <div className="select-wrap">
              <select value={rangeAccount} onChange={(e) => setRangeAccount(e.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option value={account} key={account}>
                    {account}
                  </option>
                ))}
              </select>
            </div>
            <div className="select-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                title="Filter by category"
              >
                <option value="">All categories</option>
                <option value="__none__">Uncategorised</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <form className="range-form range-form--premium" onSubmit={handleRangeFetch}>
            <label className="txn-field">
              <span>Start date</span>
              <input
                type="date"
                value={rangeStart}
                onChange={(event) => setRangeStart(event.target.value)}
              />
            </label>
            <label className="txn-field">
              <span>End date</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={(event) => setRangeEnd(event.target.value)}
              />
            </label>
            <button className="secondary" type="submit" disabled={!canFetchRange}>
              Refresh
            </button>
          </form>
        </div>
        {accountsStatus && <p className="status">{accountsStatus}</p>}
        {friendsStatus && <p className="status">{friendsStatus}</p>}
        {!isPhone && (
          <div className="friend-actions">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setManualStatus('');
                setManualOpen((prev) => !prev);
              }}
            >
              {manualOpen ? 'Close manual form' : 'Add manual transaction'}
            </button>
          </div>
        )}
        {manualOpen && (
          <form className="friend-form manual-form txn-manual-form" onSubmit={handleManualSubmit}>
            <div className="friend-tags-header txn-manual-form__head">
              <h3>Add manual transaction</h3>
              <p>Manual entries are posted to the Wallet account.</p>
            </div>
            <div className="txn-form-section">
              <p className="txn-form-section__label">Details</p>
              <div className="form-grid">
                <label className="field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={manualForm.transactionDate}
                    onChange={(event) =>
                      setManualForm((prev) => ({ ...prev, transactionDate: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Account</span>
                  <input className="txn-input--muted" type="text" value="Wallet" disabled readOnly />
                </label>
                <label className="field">
                  <span>Type</span>
                  <select
                    value={manualForm.type}
                    onChange={(event) =>
                      setManualForm((prev) => ({ ...prev, type: event.target.value }))
                    }
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
                      onChange={(event) =>
                        setManualForm((prev) => ({
                          ...prev,
                          settlementDirection: event.target.value,
                        }))
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
                    onChange={(event) =>
                      setManualForm((prev) => ({ ...prev, amount: event.target.value }))
                    }
                    placeholder="0.00"
                  />
                </label>
                <label className="field">
                  <span>Narration</span>
                  <input
                    type="text"
                    value={manualForm.narration}
                    onChange={(event) =>
                      setManualForm((prev) => ({ ...prev, narration: event.target.value }))
                    }
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
                    onChange={(event) =>
                      setManualForm((prev) => ({ ...prev, balance: event.target.value }))
                    }
                    placeholder="0.00"
                  />
                </label>
                <label className="field">
                  <span>UPI name</span>
                  <input
                    type="text"
                    value={manualForm.upiName}
                    onChange={(event) =>
                      setManualForm((prev) => ({ ...prev, upiName: event.target.value }))
                    }
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span>UPI description</span>
                  <input
                    type="text"
                    value={manualForm.upiDescription}
                    onChange={(event) =>
                      setManualForm((prev) => ({ ...prev, upiDescription: event.target.value }))
                    }
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span>UPI bank</span>
                  <input
                    type="text"
                    value={manualForm.upiBank}
                    onChange={(event) =>
                      setManualForm((prev) => ({ ...prev, upiBank: event.target.value }))
                    }
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
        )}
        {rangeStatus && <p className="status">{rangeStatus}</p>}
        {rangeResult && (
          <div className="range-result glass-panel txn-stat-strip">
            <div>
              <strong>{formatNumber(rangeResult.count)}</strong>
              <span>Tnsx.</span>
            </div>
            <div>
              <span>Start</span>
              <strong>{formatDate(rangeStart)}</strong>
            </div>
            <div>
              <span>End</span>
              <strong>{formatDate(rangeEnd)}</strong>
            </div>
          </div>
        )}
        {transactionsLoading ? (
          <p className="status">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="empty">No transactions in this range.</p>
        ) : isNarrow ? (
          <div className="txn-mobile-stack">
            <div className="glass-panel mobile-txn-toolbar">
              <label className="mobile-txn-toolbar__label" htmlFor="txn-mobile-sort">
                Sort
              </label>
              <select
                id="txn-mobile-sort"
                className="mobile-txn-toolbar__select"
                value={`${mobileSort.columnId}:${mobileSort.dir}`}
                onChange={(e) => {
                  const [columnId, dir] = e.target.value.split(':');
                  setMobileSort({ columnId, dir });
                }}
              >
                <option value="date:desc">Newest first</option>
                <option value="date:asc">Oldest first</option>
                <option value="amount:desc">Amount · high to low</option>
                <option value="amount:asc">Amount · low to high</option>
              </select>
            </div>
            <div className="txn-mobile-list">
              {sortedForMobile.map((row) => (
                <MobileTransactionCard
                  key={row.id}
                  row={row}
                  expanded={false}
                  onToggleExpand={() => openFriendTagsSheet(row.id)}
                  formatDateCompact={formatDateCompact}
                  formatNumber={formatNumber}
                  categories={categories}
                  onAssignCategory={assignCategory}
                  categoryStatus={categoryStatusByTransaction[row.id]}
                >
                  {null}
                </MobileTransactionCard>
              ))}
            </div>
          </div>
        ) : (
          <DataTable
            storageKey="fintrack-transactions-v1"
            columns={transactionColumns}
            rows={filteredTransactions}
            getRowKey={(row) => row.id}
            scrollClassName="data-table-scroll transactions-table"
            mobileHeroColumnIds={['date', 'amount', 'actions']}
            aria-label="Transactions in selected range"
            rowClassName={(row) => {
              const withdrawal = Number(row.withdrawal || 0);
              const isWithdrawal = withdrawal > 0;
              return isWithdrawal ? 'transaction-withdrawal' : 'transaction-deposit';
            }}
          />
        )}
      </section>
      {isPhone && !manualOpen && (
        <button
          type="button"
          className="mobile-transaction-fab"
          aria-label="Add manual transaction"
          onClick={() => {
            setManualStatus('');
            setManualOpen((prev) => !prev);
          }}
        >
          +
        </button>
      )}
    </>
  );
}
