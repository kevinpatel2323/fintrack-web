import { useState } from 'react';
import Portal from './Portal.jsx';
import { GhostBtn, Overline, PrimaryBtn } from './ui/primitives.jsx';
import { IcClose } from './ui/Icon.jsx';
import { createCardPayment } from '../services/cardsApi.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function CardPaymentModal({ cardId, statementId = null, suggestedAmount = '', onClose, onSaved }) {
  const [amount, setAmount] = useState(suggestedAmount ? String(suggestedAmount) : '');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [viaLabel, setViaLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        amount: Number(amount),
        paidOn,
        viaLabel: viaLabel.trim() || null,
        notes: notes.trim() || null,
      };
      if (statementId) payload.statementId = statementId;
      const saved = await createCardPayment(cardId, payload);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Failed to record payment');
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
              <Overline>Card payment</Overline>
              <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 600 }}>Record payment</h2>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Amount (₹)" required>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} required type="number" min="0" step="0.01" placeholder="48420.00" />
              </Field>
              <Field label="Paid on" required>
                <Input value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required type="date" />
              </Field>
            </div>
            <Field label="Paid via">
              <Input value={viaLabel} onChange={(e) => setViaLabel(e.target.value)} maxLength={200} placeholder="HDFC · Savings" />
            </Field>
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
                {submitting ? 'Saving…' : 'Record payment'}
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
