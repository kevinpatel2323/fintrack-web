import { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DataTable from '../components/DataTable.jsx';
import FriendLedgerExportModal from '../components/FriendLedgerExportModal.jsx';
import {
  FriendTagAmountCell,
  FriendTagMobileDetails,
  rowForFriendTagCard,
} from '../components/FriendTagLedgerDisplay.jsx';
import MobileTransactionCard from '../components/MobileTransactionCard.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { ledgerDirectionPhrase } from '../utils/ledgerParties';

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

/** Same compact date as Transactions → MobileTransactionCard */
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

/** Same row accent as Transactions (DataTable.css ::before on row). */
function tagTransactionRowClassName(tag) {
  const tx = tag.transaction;
  if (!tx) return '';
  const w = Number(tx.withdrawal || 0);
  return w > 0 ? 'transaction-withdrawal' : 'transaction-deposit';
}

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [formStatus, setFormStatus] = useState('');

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    note: '',
  });

  const [editFriendId, setEditFriendId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    note: '',
  });

  const [summaries, setSummaries] = useState({});
  const [transactionsByFriend, setTransactionsByFriend] = useState({});
  const [transactionsStatusByFriend, setTransactionsStatusByFriend] = useState({});
  const [expandedFriendId, setExpandedFriendId] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });
  const [ledgerExportFriend, setLedgerExportFriend] = useState(null);

  const isNarrow = useMediaQuery('(max-width: 1099px)');

  const canCreate = useMemo(() => createForm.name.trim().length > 0, [createForm]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setQuery(queryInput.trim());
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [queryInput]);

  useEffect(() => {
    const controller = new AbortController();
    fetchFriends(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function fetchFriends(signal) {
    setStatus('Loading...');
    try {
      const qParam = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await fetch(`${API_BASE}/friends${qParam}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch friends');
      const data = await res.json();
      setFriends(data.data || []);
      setStatus('');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setStatus(error.message || 'Failed to fetch friends.');
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!canCreate) return;

    setFormStatus('Creating...');
    try {
      const res = await fetch(`${API_BASE}/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim() || undefined,
          phone: createForm.phone.trim() || undefined,
          note: createForm.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create friend');
      setCreateForm({ name: '', email: '', phone: '', note: '' });
      setFormStatus('Friend added.');
      await fetchFriends();
    } catch (error) {
      setFormStatus(error.message || 'Failed to create friend');
    }
  }

  function startEdit(friend) {
    setEditFriendId(friend.id);
    setEditForm({
      name: friend.name || '',
      email: friend.email || '',
      phone: friend.phone || '',
      note: friend.note || '',
    });
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!editFriendId) return;

    setFormStatus('Updating...');
    try {
      const res = await fetch(`${API_BASE}/friends/${editFriendId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim() || undefined,
          email: editForm.email.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          note: editForm.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update friend');
      setFormStatus('Friend updated.');
      setEditFriendId(null);
      await fetchFriends();
    } catch (error) {
      setFormStatus(error.message || 'Failed to update friend');
    }
  }

  async function handleDelete(friendId) {
    if (!friendId) return;
    setConfirmState({
      open: true,
      title: 'Delete friend?',
      message: 'This will fail if the friend has tagged transactions.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmState({ open: false });
        await runDelete(friendId);
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  async function runDelete(friendId) {
    setFormStatus('Deleting...');
    try {
      const res = await fetch(`${API_BASE}/friends/${friendId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete friend');
      setFormStatus('Friend deleted.');
      await fetchFriends();
    } catch (error) {
      setFormStatus(error.message || 'Failed to delete friend');
    }
  }

  async function loadSummary(friendId) {
    try {
      const res = await fetch(`${API_BASE}/friends/${friendId}/summary`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      setSummaries((prev) => ({ ...prev, [friendId]: data }));
    } catch (error) {
      setFormStatus(error.message || 'Failed to fetch summary');
    }
  }

  async function toggleTransactions(friendId) {
    if (expandedFriendId === friendId) {
      setExpandedFriendId(null);
      return;
    }

    setExpandedFriendId(friendId);
    if (!transactionsByFriend[friendId]) {
      await loadTransactions(friendId);
    }
  }

  async function loadTransactions(friendId) {
    setTransactionsStatusByFriend((prev) => ({
      ...prev,
      [friendId]: 'Loading transactions...',
    }));
    try {
      const res = await fetch(`${API_BASE}/friends/${friendId}/transactions`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactionsByFriend((prev) => ({ ...prev, [friendId]: data.data || [] }));
      setTransactionsStatusByFriend((prev) => ({ ...prev, [friendId]: '' }));
    } catch (error) {
      setTransactionsStatusByFriend((prev) => ({
        ...prev,
        [friendId]: error.message || 'Failed to fetch transactions',
      }));
    }
  }

  const friendTaggedColumns = [
    {
      id: 'date',
      header: 'Date',
      defaultWidth: 120,
      minWidth: 88,
      sortable: true,
      accessor: (tag) => new Date(tag.transaction?.transactionDate).getTime(),
      trim: true,
      title: (tag) => formatDate(tag.transaction?.transactionDate),
      cellClassName: 'data-table-cell--span-mobile',
      cell: (tag) => (
        <strong className="transaction-date">{formatDate(tag.transaction?.transactionDate)}</strong>
      ),
    },
    {
      id: 'upiName',
      header: 'UPI name',
      defaultWidth: 200,
      sortable: true,
      accessor: (tag) => tag.transaction?.upiName || '',
      trim: true,
      title: (tag) => tag.transaction?.upiName || '—',
      cellClassName: 'data-table-cell--span-mobile',
      cell: (tag) => <strong>{tag.transaction?.upiName || '—'}</strong>,
    },
    {
      id: 'upiDescription',
      header: 'UPI description',
      defaultWidth: 220,
      sortable: true,
      accessor: (tag) => tag.transaction?.upiDescription || '',
      trim: true,
      title: (tag) => tag.transaction?.upiDescription || '—',
      cellClassName: 'data-table-cell--span-mobile',
      cell: (tag) => <strong>{tag.transaction?.upiDescription || '—'}</strong>,
    },
    {
      id: 'upiBank',
      header: 'UPI bank',
      defaultWidth: 160,
      sortable: true,
      accessor: (tag) => tag.transaction?.upiBank || '',
      trim: true,
      title: (tag) => tag.transaction?.upiBank || '—',
      cellClassName: 'data-table-cell--span-mobile',
      cell: (tag) => <strong>{tag.transaction?.upiBank || '—'}</strong>,
    },
    {
      id: 'direction',
      header: 'Direction',
      defaultWidth: 140,
      sortable: true,
      accessor: (tag) => tag.direction || '',
      trim: true,
      title: (tag) => ledgerDirectionPhrase(tag.direction, tag._friendName),
      cellClassName: 'data-table-cell--span-mobile',
      cell: (tag) => <strong>{ledgerDirectionPhrase(tag.direction, tag._friendName)}</strong>,
    },
    {
      id: 'amount',
      header: 'Amount',
      defaultWidth: 120,
      sortable: true,
      accessor: (tag) => Number(tag.amount) || 0,
      trim: true,
      title: (tag) => formatNumber(tag.amount),
      cellClassName: 'data-table-cell--span-mobile',
      cell: (tag) => <FriendTagAmountCell tag={tag} />,
    },
    {
      id: 'note',
      header: 'Note',
      defaultWidth: 160,
      sortable: true,
      accessor: (tag) => tag.note || '',
      trim: true,
      title: (tag) => tag.note || '—',
      cellClassName: 'data-table-cell--span-mobile',
      cell: (tag) => <strong>{tag.note || '—'}</strong>,
    },
    {
      id: 'settles',
      header: 'Settles',
      defaultWidth: 200,
      sortable: false,
      trim: true,
      title: (tag) =>
        tag.settlesTransactions?.length
          ? tag.settlesTransactions
              .map(
                (s) =>
                  `${formatDate(s.transaction?.transactionDate)} — ₹${formatNumber(s.amount)}`,
              )
              .join('; ')
          : '',
      cellClassName: 'data-table-cell--span-mobile',
      cell: (tag) => (
        <strong>
          {tag.settlesTransactions?.length
            ? tag.settlesTransactions.map((settled, idx) => (
                <span key={settled.id}>
                  {idx > 0 && ', '}
                  {formatDate(settled.transaction?.transactionDate)} —{' '}
                  {ledgerDirectionPhrase(settled.direction, tag._friendName)} — ₹
                  {formatNumber(settled.amount)}
                </span>
              ))
            : '—'}
        </strong>
      ),
    },
    {
      id: 'settledBy',
      header: 'Settled by',
      defaultWidth: 200,
      sortable: false,
      trim: true,
      title: (tag) =>
        tag.settledBy?.length
          ? tag.settledBy
              .map(
                (s) =>
                  `${formatDate(s.transaction?.transactionDate)} — ₹${formatNumber(s.amount)}`,
              )
              .join('; ')
          : '',
      cellClassName: 'data-table-cell--span-mobile',
      cell: (tag) => (
        <strong>
          {tag.settledBy?.length
            ? tag.settledBy.map((settlement, idx) => (
                <span key={settlement.id}>
                  {idx > 0 && ', '}
                  {formatDate(settlement.transaction?.transactionDate)} - ₹{formatNumber(settlement.amount)}
                </span>
              ))
            : '—'}
        </strong>
      ),
    },
  ];

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
      <FriendLedgerExportModal
        friend={ledgerExportFriend}
        open={Boolean(ledgerExportFriend)}
        onClose={() => setLedgerExportFriend(null)}
      />
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Friends</h2>
          <p>Create, update, and track balances per friend.</p>
        </div>
        <div className="select-wrap">
          <input
            className="text-input"
            type="search"
            placeholder="Search by name or email"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
          />
        </div>
      </div>

      <form className="friend-form" onSubmit={editFriendId ? handleUpdate : handleCreate}>
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={editFriendId ? editForm.name : createForm.name}
              onChange={(event) =>
                editFriendId
                  ? setEditForm((prev) => ({ ...prev, name: event.target.value }))
                  : setCreateForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Full name"
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={editFriendId ? editForm.email : createForm.email}
              onChange={(event) =>
                editFriendId
                  ? setEditForm((prev) => ({ ...prev, email: event.target.value }))
                  : setCreateForm((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="friend@email.com"
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              type="tel"
              value={editFriendId ? editForm.phone : createForm.phone}
              onChange={(event) =>
                editFriendId
                  ? setEditForm((prev) => ({ ...prev, phone: event.target.value }))
                  : setCreateForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="+91 9xxxxxxx"
            />
          </label>
        </div>
        <label className="field">
          <span>Note</span>
          <textarea
            rows="2"
            value={editFriendId ? editForm.note : createForm.note}
            onChange={(event) =>
              editFriendId
                ? setEditForm((prev) => ({ ...prev, note: event.target.value }))
                : setCreateForm((prev) => ({ ...prev, note: event.target.value }))
            }
            placeholder="Optional context"
          />
        </label>
        <div className="friend-actions">
          <button className="primary" type="submit" disabled={editFriendId ? false : !canCreate}>
            {editFriendId ? 'Update friend' : 'Add friend'}
          </button>
          {editFriendId && (
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setEditFriendId(null);
                setEditForm({ name: '', email: '', phone: '', note: '' });
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      {formStatus && <p className="status">{formStatus}</p>}
      {status && <p className="status">{status}</p>}

      <div className="friends-grid">
        {friends.length === 0 ? (
          <p className="empty">No friends found.</p>
        ) : (
          friends.map((friend) => {
            const summary = summaries[friend.id];
            const friendTransactions = transactionsByFriend[friend.id] || [];
            return (
              <article className="friend-card" key={friend.id}>
                <div className="friend-header">
                  <div>
                    <button
                      className="friend-link"
                      type="button"
                      onClick={() => toggleTransactions(friend.id)}
                      aria-expanded={expandedFriendId === friend.id}
                    >
                      {friend.name}
                    </button>
                    <p>{friend.email || 'No email'}</p>
                  </div>
                  <div className="tag">#{friend.id}</div>
                </div>
                <div className="friend-meta">
                  <div>
                    <span>Phone</span>
                    <strong>{friend.phone || '—'}</strong>
                  </div>
                  <div>
                    <span>Note</span>
                    <strong>{friend.note || '—'}</strong>
                  </div>
                </div>
                <div className="friend-row-actions">
                  <button className="secondary" type="button" onClick={() => startEdit(friend)}>
                    Edit
                  </button>
                  <button className="ghost" type="button" onClick={() => handleDelete(friend.id)}>
                    Delete
                  </button>
                  <button className="ghost" type="button" onClick={() => loadSummary(friend.id)}>
                    {summary ? 'Refresh summary' : 'Show summary'}
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setLedgerExportFriend(friend)}
                  >
                    Export PDF ledger
                  </button>
                </div>
                {transactionsStatusByFriend[friend.id] && (
                  <p className="status">{transactionsStatusByFriend[friend.id]}</p>
                )}
                {expandedFriendId === friend.id && (
                  <div className="friend-transactions">
                    <div className="friend-transactions-header">
                      <h3>Tagged transactions</h3>
                      <p>All transactions linked to {friend.name}.</p>
                    </div>
                    {friendTransactions.length === 0 ? (
                      <p className="empty">No tagged transactions yet.</p>
                    ) : isNarrow ? (
                      <div className="txn-mobile-stack friend-tagged-mobile">
                        <div className="txn-mobile-list">
                          {[...friendTransactions]
                            .map((t) => ({ ...t, _friendName: friend.name }))
                            .sort(
                              (a, b) =>
                                new Date(b.transaction?.transactionDate || 0).getTime() -
                                new Date(a.transaction?.transactionDate || 0).getTime(),
                            )
                            .map((tag) => (
                              <MobileTransactionCard
                                key={tag.id}
                                row={rowForFriendTagCard(tag)}
                                expanded
                                onToggleExpand={() => {}}
                                formatDateCompact={formatDateCompact}
                                formatNumber={formatNumber}
                                nonInteractive
                                hideBalance
                                cardAriaLabel={`Tagged transaction ${formatDateCompact(tag.transaction?.transactionDate)}`}
                              >
                                <FriendTagMobileDetails tag={tag} friendName={friend.name} />
                              </MobileTransactionCard>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <DataTable
                        storageKey={`fintrack-friend-tags-${friend.id}`}
                        columns={friendTaggedColumns}
                        rows={friendTransactions.map((t) => ({
                          ...t,
                          _friendName: friend.name,
                        }))}
                        getRowKey={(row) => row.id}
                        mobileHeroColumnIds={['date', 'amount', 'direction']}
                        scrollClassName="data-table-scroll transactions-table"
                        rowClassName={tagTransactionRowClassName}
                        aria-label={`Tagged transactions for ${friend.name}`}
                      />
                    )}
                  </div>
                )}
                {summary && (
                  <div className="friend-summary">
                    <div>
                      <span>I owe</span>
                      <strong>{formatNumber(summary.totalIOwe)}</strong>
                    </div>
                    <div>
                      <span>They owe me</span>
                      <strong>{formatNumber(summary.totalOwesMe)}</strong>
                    </div>
                    <div>
                      <span>Settlements</span>
                      <strong>{formatNumber(summary.totalSettlements)}</strong>
                    </div>
                    <div>
                      <span>Net</span>
                      <strong>{formatNumber(summary.net)}</strong>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
    </>
  );
}
