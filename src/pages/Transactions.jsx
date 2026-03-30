import { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Portal from '../components/Portal.jsx';
import DataTable from '../components/DataTable.jsx';
import MobileTransactionCard from '../components/MobileTransactionCard.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { sortTableRows } from '../utils/tableSort.js';
import '../styles/transactionSheet.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function SettlementSelect({ rowId, friendId, linkableTransactions, linkableTransactionsLoading, selectedIds, onChange }) {
  const key = `${rowId}_${friendId}`;
  const transactions = linkableTransactions[key] || [];
  const loading = linkableTransactionsLoading[key];

  const handleToggle = (tagId) => {
    const newSelected = selectedIds.includes(tagId)
      ? selectedIds.filter(id => id !== tagId)
      : [...selectedIds, tagId];
    onChange(newSelected);
  };

  if (loading) {
    return <p className="status">Loading...</p>;
  }

  if (transactions.length === 0) {
    return <p className="empty">No linkable transactions found</p>;
  }

  return (
    <div style={{ 
      display: 'grid', 
      gap: '6px', 
      maxHeight: '240px', 
      overflow: 'auto', 
      padding: '12px', 
      background: '#fff', 
      borderRadius: '12px',
      border: '1px solid var(--stroke)'
    }}>
      {transactions.map((tag) => {
        const isSelected = selectedIds.includes(String(tag.id));
        return (
          <label
            key={tag.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              cursor: 'pointer',
              background: isSelected ? 'rgba(31, 95, 89, 0.08)' : 'rgba(246, 242, 234, 0.5)',
              border: isSelected ? '1px solid rgba(31, 95, 89, 0.3)' : '1px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleToggle(String(tag.id))}
              style={{ 
                width: '18px', 
                height: '18px', 
                flexShrink: 0,
                accentColor: 'var(--teal)'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>
                  {formatDate(tag.transaction?.transactionDate)}
                </span>
                <span style={{ 
                  fontSize: '0.75rem', 
                  padding: '2px 8px', 
                  borderRadius: '999px',
                  background: tag.direction === 'I_OWE' ? 'rgba(185, 56, 41, 0.1)' : 
                             tag.direction === 'OWES_ME' ? 'rgba(27, 122, 57, 0.1)' : 'rgba(108, 98, 88, 0.1)',
                  color: tag.direction === 'I_OWE' ? 'var(--danger)' : 
                         tag.direction === 'OWES_ME' ? 'var(--success)' : 'var(--muted)',
                  fontWeight: 600
                }}>
                  {tag.direction === 'I_OWE' ? 'I owe' :
                   tag.direction === 'OWES_ME' ? 'They owe me' : 'Nothing'}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal)' }}>
                  ₹{formatNumber(tag.amount)}
                </span>
              </div>
              {tag.transaction?.upiName && (
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tag.transaction.upiName}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}

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
  const [tagFormByTransaction, setTagFormByTransaction] = useState({});
  const [confirmState, setConfirmState] = useState({ open: false });
  const [linkableTransactions, setLinkableTransactions] = useState({});
  const [linkableTransactionsLoading, setLinkableTransactionsLoading] = useState({});
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
      setTagFormByTransaction({});
      setRangeStatus('');
    } catch (error) {
      setRangeStatus(error.message || 'Failed to fetch transactions');
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function openFriendTagsSheet(transactionId) {
    if (!tagFormByTransaction[transactionId]) {
      const transaction = transactions.find((row) => row.id === transactionId);
      if (transaction) {
        const withdrawal = Number(transaction.withdrawal || 0);
        const deposit = Number(transaction.deposit || 0);
        const defaultAmount = withdrawal > 0 ? withdrawal : deposit > 0 ? deposit : '';
        updateTagForm(transactionId, {
          direction: 'NOTHING_OUTSTANDING',
          amount: defaultAmount === '' ? '' : String(defaultAmount),
        });
      } else {
        updateTagForm(transactionId, {
          direction: 'NOTHING_OUTSTANDING',
          amount: '',
        });
      }
    }

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

  async function fetchLinkableTransactions(transactionId, friendId) {
    if (!friendId) return;

    const key = `${transactionId}_${friendId}`;
    setLinkableTransactionsLoading(prev => ({ ...prev, [key]: true }));

    try {
      const res = await fetch(`${API_BASE}/friends/${friendId}/linkable-transactions`);
      if (!res.ok) throw new Error('Failed to fetch linkable transactions');
      const data = await res.json();
      setLinkableTransactions(prev => ({ ...prev, [key]: data.data || [] }));
    } catch (error) {
      console.error('Failed to fetch linkable transactions:', error);
      setLinkableTransactions(prev => ({ ...prev, [key]: [] }));
    } finally {
      setLinkableTransactionsLoading(prev => ({ ...prev, [key]: false }));
    }
  }

  function updateTagForm(transactionId, patch) {
    setTagFormByTransaction((prev) => {
      const current = prev[transactionId] || {};
      const updated = {
        friendId: '',
        amount: '',
        direction: 'NOTHING_OUTSTANDING',
        note: '',
        linkedTransactionIds: [],
        ...current,
        ...patch,
      };

      // If direction changed to SETTLEMENT and friend is selected, fetch linkable transactions
      if (patch.direction === 'SETTLEMENT' && updated.friendId) {
        fetchLinkableTransactions(transactionId, updated.friendId);
      }

      // If direction changed away from SETTLEMENT, clear linked transactions
      if (patch.direction && patch.direction !== 'SETTLEMENT') {
        updated.linkedTransactionIds = [];
      }

      // If friend changed and direction is SETTLEMENT, fetch new linkable transactions
      if (patch.friendId && updated.direction === 'SETTLEMENT') {
        fetchLinkableTransactions(transactionId, patch.friendId);
      }

      return { ...prev, [transactionId]: updated };
    });
  }

  async function addTag(transactionId) {
    const form = tagFormByTransaction[transactionId] || {};
    const direction = form.direction || 'NOTHING_OUTSTANDING';
    const rawAmount = form.amount;
    const amountValue = Number(rawAmount || 0);

    if (!form.friendId) {
      setTagsStatusByTransaction((prev) => ({
        ...prev,
        [transactionId]: 'Select a friend.',
      }));
      return;
    }

    if (direction !== 'NOTHING_OUTSTANDING' && (!rawAmount || amountValue <= 0)) {
      setTagsStatusByTransaction((prev) => ({
        ...prev,
        [transactionId]: 'Select friend and valid amount.',
      }));
      return;
    }

    setTagsStatusByTransaction((prev) => ({ ...prev, [transactionId]: 'Adding tag...' }));
    try {
      const res = await fetch(`${API_BASE}/transactions/${transactionId}/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendId: Number(form.friendId),
          amount: direction === 'NOTHING_OUTSTANDING' ? 0 : amountValue,
          direction,
          note: form.note?.trim() || undefined,
          linkedTransactionIds: form.linkedTransactionIds && form.linkedTransactionIds.length > 0
            ? form.linkedTransactionIds.map(Number)
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add tag');
      updateTagForm(transactionId, { 
        amount: '', 
        note: '', 
        direction: 'NOTHING_OUTSTANDING',
        linkedTransactionIds: [],
      });
      await fetchTags(transactionId);
    } catch (error) {
      setTagsStatusByTransaction((prev) => ({
        ...prev,
        [transactionId]: error.message || 'Failed to add tag',
      }));
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

  const transactionColumns = useMemo(
    () => [
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
    ],
    [],
  );

  const sortedForMobile = useMemo(
    () => sortTableRows(transactions, transactionColumns, mobileSort),
    [transactions, transactionColumns, mobileSort],
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
      <div className="friend-tags-header">
        <h3>Friend tags</h3>
        <p>Track who owes whom for this transaction.</p>
      </div>
      <div className="friend-tags-form">
        <div className="tag-form-row">
          <select
            value={tagFormByTransaction[row.id]?.friendId || ''}
            onChange={(event) => updateTagForm(row.id, { friendId: event.target.value })}
          >
            <option value="">Select friend</option>
            {friends.map((friend) => (
              <option key={friend.id} value={friend.id}>
                {friend.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={tagFormByTransaction[row.id]?.amount || ''}
            onChange={(event) => updateTagForm(row.id, { amount: event.target.value })}
          />
          <select
            value={tagFormByTransaction[row.id]?.direction || 'NOTHING_OUTSTANDING'}
            onChange={(event) => updateTagForm(row.id, { direction: event.target.value })}
          >
            <option value="NOTHING_OUTSTANDING">Nothing outstanding</option>
            <option value="I_OWE">I owe</option>
            <option value="OWES_ME">They owe me</option>
            <option value="SETTLEMENT">Settlement</option>
          </select>
        </div>
        {tagFormByTransaction[row.id]?.direction === 'SETTLEMENT' &&
          tagFormByTransaction[row.id]?.friendId && (
            <div className="settlement-section">
              <label className="settlement-label">Select transactions to settle</label>
              <SettlementSelect
                rowId={row.id}
                friendId={tagFormByTransaction[row.id]?.friendId}
                linkableTransactions={linkableTransactions}
                linkableTransactionsLoading={linkableTransactionsLoading}
                selectedIds={tagFormByTransaction[row.id]?.linkedTransactionIds || []}
                onChange={(selected) => updateTagForm(row.id, { linkedTransactionIds: selected })}
              />
            </div>
          )}
        <div className="tag-form-row">
          <input
            type="text"
            placeholder="Note (optional)"
            value={tagFormByTransaction[row.id]?.note || ''}
            onChange={(event) => updateTagForm(row.id, { note: event.target.value })}
            className="note-input"
          />
          <button className="secondary" type="button" onClick={() => addTag(row.id)}>
            Add tag
          </button>
        </div>
      </div>
      {tagsStatusByTransaction[row.id] && (
        <p className="status">{tagsStatusByTransaction[row.id]}</p>
      )}
      <div className="friend-tags-list">
        {(tagsByTransaction[row.id] || []).length === 0 ? (
          <p className="empty">No friend tags for this transaction.</p>
        ) : (
          (tagsByTransaction[row.id] || []).map((tag) => (
            <div className="friend-tag-row" key={tag.id}>
              <div>
                <span>Friend</span>
                <strong>{tag.friend?.name || tag.friendId}</strong>
              </div>
              <div>
                <span>Direction</span>
                <strong>
                  {tag.direction === 'I_OWE'
                    ? 'I owe'
                    : tag.direction === 'OWES_ME'
                      ? 'They owe me'
                      : tag.direction === 'SETTLEMENT'
                        ? 'Settlement'
                        : 'Nothing outstanding'}
                </strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{formatNumber(tag.amount)}</strong>
              </div>
              <div>
                <span>Note</span>
                <strong>{tag.note || '—'}</strong>
              </div>
              {tag.settlesTransactions && tag.settlesTransactions.length > 0 && (
                <div>
                  <span>Settles</span>
                  <strong>
                    {tag.settlesTransactions.map((linked, idx) => (
                      <span key={linked.id}>
                        {idx > 0 && ', '}
                        {formatDate(linked.transaction?.transactionDate)} - ₹{formatNumber(linked.amount)}
                      </span>
                    ))}
                  </strong>
                </div>
              )}
              <button className="ghost" type="button" onClick={() => deleteTag(row.id, tag.id)}>
                Remove
              </button>
            </div>
          ))
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
          </div>
          <form className="range-form range-form--premium" onSubmit={handleRangeFetch}>
            <label>
              <span>Start date</span>
              <input
                type="date"
                value={rangeStart}
                onChange={(event) => setRangeStart(event.target.value)}
              />
            </label>
            <label>
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
          <form className="friend-form manual-form" onSubmit={handleManualSubmit}>
            <div className="friend-tags-header">
              <h3>Add manual transaction</h3>
              <p>Manual entries are posted to the Wallet account.</p>
            </div>
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
                <input type="text" value="Wallet" disabled />
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
              <label className="field">
                <span>Balance (optional)</span>
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
                <span>UPI name (optional)</span>
                <input
                  type="text"
                  value={manualForm.upiName}
                  onChange={(event) =>
                    setManualForm((prev) => ({ ...prev, upiName: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>UPI description (optional)</span>
                <input
                  type="text"
                  value={manualForm.upiDescription}
                  onChange={(event) =>
                    setManualForm((prev) => ({ ...prev, upiDescription: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>UPI bank (optional)</span>
                <input
                  type="text"
                  value={manualForm.upiBank}
                  onChange={(event) =>
                    setManualForm((prev) => ({ ...prev, upiBank: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="friend-actions">
              <button className="secondary" type="submit" disabled={manualSubmitting}>
                {manualSubmitting ? 'Adding...' : 'Add transaction'}
              </button>
              {manualStatus && <p className="status">{manualStatus}</p>}
            </div>
          </form>
        )}
        {rangeStatus && <p className="status">{rangeStatus}</p>}
        {rangeResult && (
          <div className="range-result glass-panel txn-stat-strip">
            <div>
              <span>Transactions</span>
              <strong>{formatNumber(rangeResult.count)}</strong>
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
            rows={transactions}
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
      </section>
    </>
  );
}
