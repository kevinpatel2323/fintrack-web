import { useEffect, useState } from 'react';
import Portal from './Portal.jsx';
import { GhostBtn, Overline, PrimaryBtn } from './ui/primitives.jsx';
import { IcClose } from './ui/Icon.jsx';
import { createCardTransaction } from '../services/cardsApi.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function CardTransactionModal({ cardId, statementId = null, categories = [], onClose, onSaved }) {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [txnDate, setTxnDate] = useState(todayIso());
  const [categoryId, setCategoryId] = useState('');
  const [isRefund, setIsRefund] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
  }, [merchant, amount, txnDate]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        merchant: merchant.trim(),
        amount: Number(amount),
        txnDate,
        isRefund,
        notes: notes.trim() || null,
      };
      if (categoryId) payload.categoryId = categoryId;
      if (statementId) payload.statementId = statementId;
      const saved = await createCardTransaction(cardId, payload);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8,9,12,0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 1000,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 500,
            background: 'var(--ft-surface)',
            border: '1px solid var(--ft-border)',
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--ft-border)',
            }}
          >
            <div>
              <Overline>Card transaction</Overline>
              <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 600 }}>Add transaction</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 0, color: 'var(--ft-text-dim)', cursor: 'pointer', padding: 6 }}
            >
              <IcClose size={18} />
            </button>
          </div>

          <form onSubmit={submit} style={{ padding: 20, display: 'grid', gap: 14 }}>
            <Field label="Merchant" required>
              <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} required maxLength={200} placeholder="Amazon India" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Amount (₹)" required>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} required type="number" min="0" step="0.01" placeholder="1248.00" />
              </Field>
              <Field label="Date" required>
                <Input value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required type="date" />
              </Field>
            </div>
            <Field label="Category">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{
                  background: 'var(--ft-surface-2)',
                  border: '1px solid var(--ft-border)',
                  color: 'var(--ft-text)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontFamily: 'var(--ft-font-ui)',
                  fontSize: 13.5,
                }}
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ft-text)', fontSize: 13.5 }}>
              <input type="checkbox" checked={isRefund} onChange={(e) => setIsRefund(e.target.checked)} />
              Refund (credits back to the card)
            </label>
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={2}
                style={{
                  width: '100%',
                  background: 'var(--ft-surface-2)',
                  border: '1px solid var(--ft-border)',
                  color: 'var(--ft-text)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontFamily: 'var(--ft-font-ui)',
                  fontSize: 13.5,
                  resize: 'vertical',
                }}
              />
            </Field>
            {error && <div style={{ color: 'var(--ft-spend)', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <GhostBtn onClick={onClose} type="button">Cancel</GhostBtn>
              <PrimaryBtn type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Add transaction'}
              </PrimaryBtn>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

function Field({ label, required, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
        {required && <span style={{ color: 'var(--ft-spend)', marginLeft: 4 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        background: 'var(--ft-surface-2)',
        border: '1px solid var(--ft-border)',
        color: 'var(--ft-text)',
        borderRadius: 10,
        padding: '10px 12px',
        fontFamily: 'var(--ft-font-ui)',
        fontSize: 13.5,
        outline: 'none',
        ...(props.style || {}),
      }}
    />
  );
}
