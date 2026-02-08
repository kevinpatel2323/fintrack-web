import { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

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
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [tagFormByTransaction, setTagFormByTransaction] = useState({});
  const [confirmState, setConfirmState] = useState({ open: false });

  const canFetchRange = useMemo(() => rangeStart && rangeEnd, [rangeStart, rangeEnd]);

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
        setFriendsStatus(error.message || 'Failed to fetch friends');
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
      setExpandedTransactionId(null);
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

  async function toggleTags(transactionId) {
    if (expandedTransactionId === transactionId) {
      setExpandedTransactionId(null);
      return;
    }

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

    setExpandedTransactionId(transactionId);
    if (!tagsByTransaction[transactionId]) {
      await fetchTags(transactionId);
    }
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

  function updateTagForm(transactionId, patch) {
    setTagFormByTransaction((prev) => ({
      ...prev,
      [transactionId]: {
        friendId: '',
        amount: '',
        direction: 'NOTHING_OUTSTANDING',
        note: '',
        ...(prev[transactionId] || {}),
        ...patch,
      },
    }));
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add tag');
      updateTagForm(transactionId, { amount: '', note: '', direction: 'NOTHING_OUTSTANDING' });
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
      <section className="card">
        <div className="card-header">
          <div>
            <h2>Transactions</h2>
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
        {accountsStatus && <p className="status">{accountsStatus}</p>}
        {friendsStatus && <p className="status">{friendsStatus}</p>}
        <form className="range-form" onSubmit={handleRangeFetch}>
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
        {rangeStatus && <p className="status">{rangeStatus}</p>}
        {rangeResult && (
          <div className="range-result">
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
        <div className="transactions-table">
          {transactionsLoading ? (
            <p className="status">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="empty">No transactions in this range.</p>
          ) : (
            <div className="table">
              <div className="table-head" aria-hidden="true">
                <span>Date</span>
                <span>Account</span>
                <span>UPI name</span>
                <span>UPI description</span>
                <span>UPI bank</span>
                <span>Amount</span>
                <span>Balance</span>
                <span>Actions</span>
              </div>
              {transactions.map((row) => {
                const withdrawal = Number(row.withdrawal || 0);
                const deposit = Number(row.deposit || 0);
                const amount = withdrawal > 0 ? withdrawal : deposit;
                const isWithdrawal = withdrawal > 0;

                return (
                  <div className={`table-row ${isWithdrawal ? 'transaction-withdrawal' : 'transaction-deposit'}`} key={row.id}>
                    <div className="table-cell">
                      <span className="table-cell-label">Date</span>
                      <strong className="transaction-date">{formatDate(row.transactionDate)}</strong>
                    </div>
                    <div className="table-cell">
                      <span className="table-cell-label">Account</span>
                      <span className="transaction-account-badge">{row.accountNumber || 'unknown'}</span>
                    </div>
                    <div className="table-cell table-upi-name">
                      <span className="table-cell-label">UPI name</span>
                      <strong>{row.upiName || '—'}</strong>
                    </div>
                    <div className="table-cell table-upi-desc">
                      <span className="table-cell-label">UPI description</span>
                      <strong title={row.upiDescription || '—'}>{row.upiDescription || '—'}</strong>
                    </div>
                    <div className="table-cell table-upi-bank">
                      <span className="table-cell-label">UPI bank</span>
                      <strong>{row.upiBank || '—'}</strong>
                    </div>
                    <div className="table-cell">
                      <span className="table-cell-label">Amount</span>
                      <strong className={`transaction-amount ${isWithdrawal ? 'amount-withdrawal' : 'amount-deposit'}`}>
                        {isWithdrawal ? '-' : '+'}{formatNumber(amount)}
                      </strong>
                    </div>
                    <div className="table-cell">
                      <span className="table-cell-label">Balance</span>
                      <strong>{formatNumber(row.balance)}</strong>
                    </div>
                    <div className="table-actions">
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => toggleTags(row.id)}
                        aria-label={
                          expandedTransactionId === row.id ? 'Close tags panel' : 'Manage friends'
                        }
                      >
                        {expandedTransactionId === row.id ? '⌃' : 'Manage'}
                      </button>
                    </div>
                    {expandedTransactionId === row.id && (
                      <div className="friend-tags-panel">
                        <div className="friend-tags-header">
                          <h3>Friend tags</h3>
                          <p>Track who owes whom for this transaction.</p>
                        </div>
                        <div className="friend-tags-form">
                          <select
                            value={tagFormByTransaction[row.id]?.friendId || ''}
                            onChange={(event) =>
                              updateTagForm(row.id, { friendId: event.target.value })
                            }
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
                            onChange={(event) =>
                              updateTagForm(row.id, { amount: event.target.value })
                            }
                          />
                          <select
                            value={tagFormByTransaction[row.id]?.direction || 'NOTHING_OUTSTANDING'}
                            onChange={(event) =>
                              updateTagForm(row.id, { direction: event.target.value })
                            }
                          >
                            <option value="NOTHING_OUTSTANDING">Nothing outstanding</option>
                            <option value="I_OWE">I owe</option>
                            <option value="OWES_ME">They owe me</option>
                            <option value="SETTLEMENT">Settlement</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Note (optional)"
                            value={tagFormByTransaction[row.id]?.note || ''}
                            onChange={(event) =>
                              updateTagForm(row.id, { note: event.target.value })
                            }
                          />
                          <button className="secondary" type="button" onClick={() => addTag(row.id)}>
                            Add tag
                          </button>
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
                                <button
                                  className="ghost"
                                  type="button"
                                  onClick={() => deleteTag(row.id, tag.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
