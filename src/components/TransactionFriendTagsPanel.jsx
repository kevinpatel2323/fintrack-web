import { useCallback, useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import '../styles/txn-manage-forms.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function SettlementSelect({
  rowId,
  friendId,
  linkableTransactions,
  linkableTransactionsLoading,
  selectedIds,
  onChange,
}) {
  const key = `${rowId}_${friendId}`;
  const transactions = linkableTransactions[key] || [];
  const loading = linkableTransactionsLoading[key];

  const handleToggle = (tagId) => {
    const newSelected = selectedIds.includes(tagId)
      ? selectedIds.filter((id) => id !== tagId)
      : [...selectedIds, tagId];
    onChange(newSelected);
  };

  if (loading) {
    return <p className="status">Loading linkable entries…</p>;
  }

  if (transactions.length === 0) {
    return <p className="empty">No linkable transactions found</p>;
  }

  return (
    <div className="settlement-link-list">
      {transactions.map((tag) => {
        const isSelected = selectedIds.includes(String(tag.id));
        const dirClass =
          tag.direction === 'I_OWE'
            ? 'settlement-dir-pill--owe'
            : tag.direction === 'OWES_ME'
              ? 'settlement-dir-pill--me'
              : 'settlement-dir-pill--none';
        return (
          <label
            key={tag.id}
            className={`settlement-link-item${isSelected ? ' settlement-link-item--selected' : ''}`}
          >
            <input
              type="checkbox"
              className="settlement-link-item__check"
              checked={isSelected}
              onChange={() => handleToggle(String(tag.id))}
            />
            <div className="settlement-link-item__body">
              <div className="settlement-link-item__top">
                <span className="settlement-link-item__date">
                  {formatDateInner(tag.transaction?.transactionDate)}
                </span>
                <span className={`settlement-dir-pill ${dirClass}`}>
                  {tag.direction === 'I_OWE'
                    ? 'I owe'
                    : tag.direction === 'OWES_ME'
                      ? 'They owe me'
                      : 'Nothing'}
                </span>
                <span className="settlement-link-item__amount">₹{formatNumberInner(tag.amount)}</span>
              </div>
              {tag.transaction?.upiName ? (
                <span className="settlement-link-item__upi">{tag.transaction.upiName}</span>
              ) : null}
            </div>
          </label>
        );
      })}
    </div>
  );
}

function formatDateInner(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatNumberInner(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN').format(num);
}

export default function TransactionFriendTagsPanel({ transaction, friends, formatDate, formatNumber }) {
  const transactionId = transaction.id;
  const [tags, setTags] = useState([]);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({
    friendId: '',
    amount: '',
    direction: 'NOTHING_OUTSTANDING',
    note: '',
    linkedTransactionIds: [],
  });
  const [linkableTransactions, setLinkableTransactions] = useState({});
  const [linkableTransactionsLoading, setLinkableTransactionsLoading] = useState({});
  const [confirmState, setConfirmState] = useState({ open: false });

  const fmtDate = formatDate || formatDateInner;
  const fmtNum = formatNumber || formatNumberInner;

  const fetchTags = useCallback(async () => {
    setStatus('Loading tags...');
    try {
      const res = await fetch(`${API_BASE}/transactions/${transactionId}/friends`);
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data = await res.json();
      setTags(data.data || []);
      setStatus('');
    } catch (error) {
      setStatus(error.message || 'Failed to fetch tags');
    }
  }, [transactionId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  async function fetchLinkableTransactions(friendId) {
    if (!friendId) return;
    const key = `${transactionId}_${friendId}`;
    setLinkableTransactionsLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${API_BASE}/friends/${friendId}/linkable-transactions`);
      if (!res.ok) throw new Error('Failed to fetch linkable transactions');
      const data = await res.json();
      setLinkableTransactions((prev) => ({ ...prev, [key]: data.data || [] }));
    } catch {
      setLinkableTransactions((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setLinkableTransactionsLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  function updateForm(patch) {
    setForm((current) => {
      const updated = { ...current, ...patch };
      if (patch.direction && patch.direction !== 'SETTLEMENT') {
        updated.linkedTransactionIds = [];
      }
      const needLinkable =
        (patch.direction === 'SETTLEMENT' && updated.friendId) ||
        (patch.friendId != null && patch.friendId !== '' && updated.direction === 'SETTLEMENT');
      if (needLinkable) {
        const fid = patch.friendId !== undefined ? patch.friendId : updated.friendId;
        if (fid) {
          setTimeout(() => fetchLinkableTransactions(fid), 0);
        }
      }
      return updated;
    });
  }

  async function addTag() {
    const direction = form.direction || 'NOTHING_OUTSTANDING';
    const rawAmount = form.amount;
    const amountValue = Number(rawAmount || 0);

    if (!form.friendId) {
      setStatus('Select a friend.');
      return;
    }

    if (direction !== 'NOTHING_OUTSTANDING' && (!rawAmount || amountValue <= 0)) {
      setStatus('Select friend and valid amount.');
      return;
    }

    setStatus('Adding tag...');
    try {
      const res = await fetch(`${API_BASE}/transactions/${transactionId}/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendId: Number(form.friendId),
          amount: direction === 'NOTHING_OUTSTANDING' ? 0 : amountValue,
          direction,
          note: form.note?.trim() || undefined,
          linkedTransactionIds:
            form.linkedTransactionIds && form.linkedTransactionIds.length > 0
              ? form.linkedTransactionIds.map(Number)
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add tag');
      setForm({
        friendId: '',
        amount: '',
        direction: 'NOTHING_OUTSTANDING',
        note: '',
        linkedTransactionIds: [],
      });
      setStatus('');
      await fetchTags();
    } catch (error) {
      setStatus(error.message || 'Failed to add tag');
    }
  }

  async function runDeleteTag(tagId) {
    setStatus('Removing tag...');
    try {
      const res = await fetch(`${API_BASE}/transactions/${transactionId}/friends/${tagId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete tag');
      setStatus('');
      await fetchTags();
    } catch (error) {
      setStatus(error.message || 'Failed to delete tag');
    }
  }

  function deleteTag(tagId) {
    setConfirmState({
      open: true,
      title: 'Remove tag?',
      message: 'This will remove the friend tag from this transaction.',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        setConfirmState({ open: false });
        await runDeleteTag(tagId);
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  useEffect(() => {
    const w = Number(transaction.withdrawal || 0);
    const d = Number(transaction.deposit || 0);
    const def = w > 0 ? w : d > 0 ? d : '';
    setForm({
      friendId: '',
      amount: def === '' ? '' : String(def),
      direction: 'NOTHING_OUTSTANDING',
      note: '',
      linkedTransactionIds: [],
    });
    setLinkableTransactions({});
    setLinkableTransactionsLoading({});
  }, [transactionId]);

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
      <div className="friend-tags-panel">
        <div className="friend-tags-header">
          <h3>Friend tags</h3>
          <p>Track who owes whom for this transaction.</p>
        </div>
        <div className="friend-tags-form txn-tag-form">
          <div className="tag-form-row txn-tag-form__primary">
            <select
              value={form.friendId}
              onChange={(event) => updateForm({ friendId: event.target.value })}
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
              value={form.amount}
              onChange={(event) => updateForm({ amount: event.target.value })}
            />
            <select
              value={form.direction}
              onChange={(event) => updateForm({ direction: event.target.value })}
            >
              <option value="NOTHING_OUTSTANDING">Nothing outstanding</option>
              <option value="I_OWE">I owe</option>
              <option value="OWES_ME">They owe me</option>
              <option value="SETTLEMENT">Settlement</option>
            </select>
          </div>
          {form.direction === 'SETTLEMENT' && form.friendId && (
            <div className="settlement-section">
              <label className="settlement-label">Select transactions to settle</label>
              <SettlementSelect
                rowId={transactionId}
                friendId={form.friendId}
                linkableTransactions={linkableTransactions}
                linkableTransactionsLoading={linkableTransactionsLoading}
                selectedIds={form.linkedTransactionIds || []}
                onChange={(selected) => updateForm({ linkedTransactionIds: selected })}
              />
            </div>
          )}
          <div className="tag-form-row txn-tag-form__note">
            <input
              type="text"
              placeholder="Note (optional)"
              value={form.note}
              onChange={(event) => updateForm({ note: event.target.value })}
              className="note-input"
            />
            <button className="secondary" type="button" onClick={addTag}>
              Add tag
            </button>
          </div>
        </div>
        {status && <p className="status">{status}</p>}
        <div className="friend-tags-list">
          {tags.length === 0 ? (
            <p className="empty">No friend tags for this transaction.</p>
          ) : (
            tags.map((tag) => (
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
                  <strong>{fmtNum(tag.amount)}</strong>
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
                          {fmtDate(linked.transaction?.transactionDate)} - ₹{fmtNum(linked.amount)}
                        </span>
                      ))}
                    </strong>
                  </div>
                )}
                <button className="ghost" type="button" onClick={() => deleteTag(tag.id)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
