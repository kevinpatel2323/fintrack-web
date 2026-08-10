import { useState } from 'react';
import Portal from './Portal.jsx';
import { GhostBtn, Overline, PrimaryBtn } from './ui/primitives.jsx';
import { IcClose } from './ui/Icon.jsx';
import { createCardStatement } from '../services/cardsApi.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function CardStatementModal({ cardId, defaults = {}, onClose, onSaved }) {
  const [cycleStart, setCycleStart] = useState(defaults.cycleStart || todayIso());
  const [cycleEnd, setCycleEnd] = useState(defaults.cycleEnd || todayIso());
  const [dueDate, setDueDate] = useState(defaults.dueDate || todayIso());
  const [minDue, setMinDue] = useState(defaults.minDue ? String(defaults.minDue) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        cycleStart,
        cycleEnd,
        dueDate,
        minDue: minDue === '' ? 0 : Number(minDue),
      };
      const saved = await createCardStatement(cardId, payload);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Failed to create statement');
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
          background: 'var(--ft-scrim)',
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
              <Overline>Statement cycle</Overline>
              <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 600 }}>Generate statement</h2>
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
              <Field label="Cycle start" required>
                <Input value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} required type="date" />
              </Field>
              <Field label="Cycle end" required>
                <Input value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} required type="date" />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Due date" required>
                <Input value={dueDate} onChange={(e) => setDueDate(e.target.value)} required type="date" />
              </Field>
              <Field label="Minimum due (₹)">
                <Input value={minDue} onChange={(e) => setMinDue(e.target.value)} type="number" min="0" step="0.01" placeholder="2421.00" />
              </Field>
            </div>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>
              Transactions in this date range without a statement will be auto-linked.
            </div>
            {error && <div style={{ color: 'var(--ft-spend)', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <GhostBtn onClick={onClose} type="button">Cancel</GhostBtn>
              <PrimaryBtn type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Generate'}
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
