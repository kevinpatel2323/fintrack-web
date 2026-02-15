import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const MIN_COL_WIDTH = 80;
const FRIEND_COL_WIDTHS = [120, 200, 220, 140, 140, 120, 180];

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
  const [friendColWidths, setFriendColWidths] = useState(FRIEND_COL_WIDTHS);
  const [friendResizeLineX, setFriendResizeLineX] = useState(null);
  const friendColWidthsRef = useRef(friendColWidths);
  const friendResizeStateRef = useRef(null);
  const friendGridTemplate = useMemo(
    () => friendColWidths.map((width) => `${width}px`).join(' '),
    [friendColWidths],
  );
  const [expandedFriendId, setExpandedFriendId] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });

  const canCreate = useMemo(() => createForm.name.trim().length > 0, [createForm]);

  useEffect(() => {
    friendColWidthsRef.current = friendColWidths;
  }, [friendColWidths]);

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

  function handleFriendResizeStart(index, event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const widths = friendColWidthsRef.current;
    const nextIndex = index + 1;
    if (nextIndex >= widths.length) return;

    friendResizeStateRef.current = {
      index,
      startX: event.clientX,
      startWidth: widths[index],
      nextStartWidth: widths[nextIndex],
    };
    setFriendResizeLineX(event.clientX);

    window.addEventListener('mousemove', handleFriendResizeMove);
    window.addEventListener('mouseup', handleFriendResizeEnd);
  }

  function handleFriendResizeMove(event) {
    const state = friendResizeStateRef.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const total = state.startWidth + state.nextStartWidth;
    const newWidth = Math.max(MIN_COL_WIDTH, state.startWidth + dx);
    const newNextWidth = Math.max(MIN_COL_WIDTH, total - newWidth);

    setFriendResizeLineX(event.clientX);
    setFriendColWidths((prev) => {
      const updated = [...prev];
      updated[state.index] = newWidth;
      updated[state.index + 1] = newNextWidth;
      return updated;
    });
  }

  function handleFriendResizeEnd() {
    friendResizeStateRef.current = null;
    setFriendResizeLineX(null);
    window.removeEventListener('mousemove', handleFriendResizeMove);
    window.removeEventListener('mouseup', handleFriendResizeEnd);
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
                    {friendResizeLineX !== null && (
                      <>
                        <div className="table-resize-overlay" />
                        <div className="table-resize-line" style={{ left: friendResizeLineX }} />
                      </>
                    )}
                    {friendTransactions.length === 0 ? (
                      <p className="empty">No tagged transactions yet.</p>
                    ) : (
                      <div
                        className="friend-transactions-list"
                        style={{ '--friend-tx-grid-columns': friendGridTemplate }}
                      >
                        <div className="friend-transaction-head" aria-hidden="true">
                          {[
                            'Date',
                            'UPI name',
                            'UPI description',
                            'UPI bank',
                            'Direction',
                            'Amount',
                            'Note',
                          ].map((label, index) => (
                            <span className="table-head-cell" key={label}>
                              {label}
                              {index < friendColWidths.length - 1 && (
                                <button
                                  type="button"
                                  className="col-resizer"
                                  aria-label="Resize column"
                                  onMouseDown={(event) => handleFriendResizeStart(index, event)}
                                />
                              )}
                            </span>
                          ))}
                        </div>
                        {friendTransactions.map((tag) => (
                          <div className="friend-transaction-row" key={tag.id}>
                            <div className="friend-transaction-cell">
                              <span className="friend-cell-label">Date</span>
                              <strong>{formatDate(tag.transaction?.transactionDate)}</strong>
                            </div>
                            <div className="friend-transaction-cell friend-transaction-upi-name">
                              <span className="friend-cell-label">UPI name</span>
                              <strong>{tag.transaction?.upiName || '—'}</strong>
                            </div>
                            <div className="friend-transaction-cell friend-transaction-upi-desc">
                              <span className="friend-cell-label">UPI description</span>
                              <strong title={tag.transaction?.upiDescription || '—'}>
                                {tag.transaction?.upiDescription || '—'}
                              </strong>
                            </div>
                            <div className="friend-transaction-cell friend-transaction-upi-bank">
                              <span className="friend-cell-label">UPI bank</span>
                              <strong>{tag.transaction?.upiBank || '—'}</strong>
                            </div>
                            <div className="friend-transaction-cell">
                              <span className="friend-cell-label">Direction</span>
                              <strong
                                className={
                                  tag.direction === 'I_OWE'
                                    ? 'friend-direction-owe'
                                    : tag.direction === 'OWES_ME'
                                      ? 'friend-direction-receivable'
                                      : undefined
                                }
                              >
                                {tag.direction === 'I_OWE'
                                  ? 'I owe'
                                  : tag.direction === 'OWES_ME'
                                    ? 'They owe me'
                                    : tag.direction === 'SETTLEMENT'
                                      ? 'Settlement'
                                    : 'Nothing outstanding'}
                              </strong>
                            </div>
                            <div className="friend-transaction-cell">
                              <span className="friend-cell-label">Amount</span>
                              <strong
                                className={
                                  tag.direction === 'I_OWE'
                                    ? 'friend-amount-owe'
                                    : tag.direction === 'OWES_ME'
                                      ? 'friend-amount-receivable'
                                      : undefined
                                }
                              >
                                {formatNumber(tag.amount)}
                              </strong>
                            </div>
                            <div className="friend-transaction-cell friend-transaction-note">
                              <span className="friend-cell-label">Note</span>
                              <strong title={tag.note || '—'}>{tag.note || '—'}</strong>
                            </div>
                            {tag.settlesTransactions && tag.settlesTransactions.length > 0 && (
                              <div className="friend-transaction-cell friend-transaction-linked">
                                <span className="friend-cell-label">Settles</span>
                                <strong>
                                  {tag.settlesTransactions.map((settled, idx) => (
                                    <span key={settled.id}>
                                      {idx > 0 && ', '}
                                      {formatDate(settled.transaction?.transactionDate)} -
                                      {settled.direction === 'I_OWE' ? ' I owe' :
                                       settled.direction === 'OWES_ME' ? ' They owe me' : ' Nothing'} -
                                      ₹{formatNumber(settled.amount)}
                                    </span>
                                  ))}
                                </strong>
                              </div>
                            )}
                            {tag.settledBy && tag.settledBy.length > 0 && (
                              <div className="friend-transaction-cell friend-transaction-settled">
                                <span className="friend-cell-label">Settled by</span>
                                <strong>
                                  {tag.settledBy.map((settlement, idx) => (
                                    <span key={settlement.id}>
                                      {idx > 0 && ', '}
                                      {formatDate(settlement.transaction?.transactionDate)} - ₹{formatNumber(settlement.amount)}
                                    </span>
                                  ))}
                                </strong>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
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
