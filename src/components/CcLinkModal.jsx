import { useEffect, useMemo, useState } from 'react';
import Portal from './Portal.jsx';
import { GhostBtn, Overline, PrimaryBtn } from './ui/primitives.jsx';
import { IcClose } from './ui/Icon.jsx';
import { inr } from '../utils/inr.js';
import { signedPaise, toPaise } from '../utils/ccMatch.js';
import {
  linkCcBillPayment,
  listCardStatements,
  listCardTransactions,
  listCards,
  listUnpaidCardTransactions,
} from '../services/cardsApi.js';

// The bank debit rarely equals the sum of the rows it covers — a statement
// carries the previous cycle's balance forward and includes "payment received"
// credits. Rather than block on that, name the difference.
function remainderLabel(remainderPaise) {
  if (remainderPaise > 0) return 'Carried forward / other charges';
  return 'Not covered by this payment';
}

export default function CcLinkModal({ transaction, onClose, onLinked }) {
  const targetAmount = Number(transaction.withdrawal || 0);

  const [cards, setCards] = useState([]);
  const [cardId, setCardId] = useState('');
  const [mode, setMode] = useState('statement');

  const [statements, setStatements] = useState([]);
  const [statementId, setStatementId] = useState('');
  const [preview, setPreview] = useState([]);

  const [unpaid, setUnpaid] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Credit cards only — the API refuses to link a bill payment to anything else.
  useEffect(() => {
    let cancelled = false;
    listCards()
      .then((res) => {
        if (cancelled) return;
        const credit = (res.data || res || []).filter((c) => c.kind === 'credit');
        setCards(credit);
        if (credit.length > 0) setCardId(String(credit[0].id));
        if (credit.length === 0) setError('No credit cards yet. Add one from Cards first.');
      })
      .catch((e) => !cancelled && setError(e.message || 'Failed to load cards'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // Load both selectors up front so switching modes is instant.
  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    setStatementId('');
    setSelectedIds(new Set());
    setPreview([]);

    Promise.all([listCardStatements(cardId), listUnpaidCardTransactions(cardId)])
      .then(([stmtRes, txnRes]) => {
        if (cancelled) return;
        const stmts = stmtRes.data || stmtRes || [];
        setStatements(stmts);
        setUnpaid(txnRes.data || txnRes || []);
        // One-click case: the statement whose total is exactly what was paid.
        const exact = stmts.find(
          (s) => toPaise(s.totalAmount) === toPaise(targetAmount),
        );
        if (exact) setStatementId(String(exact.id));
        else if (stmts.length > 0) setStatementId(String(stmts[0].id));
      })
      .catch((e) => !cancelled && setError(e.message || 'Failed to load card data'));
    return () => { cancelled = true; };
  }, [cardId, targetAmount]);

  // Preview the rows a statement link would cover.
  useEffect(() => {
    if (mode !== 'statement' || !cardId || !statementId) return;
    let cancelled = false;
    listCardTransactions(cardId, { statementId })
      .then((res) => !cancelled && setPreview(res.data || res || []))
      .catch(() => !cancelled && setPreview([]));
    return () => { cancelled = true; };
  }, [mode, cardId, statementId]);

  const covered = useMemo(() => {
    if (mode === 'statement') return preview.filter((t) => !t.paidByPaymentId);
    return unpaid.filter((t) => selectedIds.has(String(t.id)));
  }, [mode, preview, unpaid, selectedIds]);

  const matchedPaise = useMemo(
    () => covered.reduce((sum, t) => sum + signedPaise(t), 0),
    [covered],
  );
  const remainderPaise = toPaise(targetAmount) - matchedPaise;

  const canSubmit =
    !submitting &&
    !!cardId &&
    (mode === 'statement' ? !!statementId && covered.length > 0 : selectedIds.size > 0);

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await linkCcBillPayment(
        transaction.id,
        mode === 'statement'
          ? { cardId: Number(cardId), statementId: Number(statementId) }
          : { cardId: Number(cardId), cardTransactionIds: [...selectedIds].map(Number) },
      );
      onLinked?.(result);
    } catch (err) {
      setError(err.message || 'Failed to link');
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
            maxWidth: 560,
            maxHeight: 'calc(100dvh - 32px)',
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
              <Overline>Credit card bill</Overline>
              <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 600 }}>
                Link {inr(targetAmount)}
              </h2>
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

          <form
            onSubmit={submit}
            style={{ padding: 20, display: 'grid', gap: 14, overflowY: 'auto' }}
          >
            {loading ? (
              <p className="status">Loading cards…</p>
            ) : (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={fieldLabelStyle}>Card</span>
                  <select
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    style={controlStyle}
                  >
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · ····{c.last4}
                      </option>
                    ))}
                  </select>
                </label>

                <div role="group" aria-label="Link mode" style={{ display: 'flex', gap: 8 }}>
                  <ModeBtn active={mode === 'statement'} onClick={() => setMode('statement')}>
                    Whole statement
                  </ModeBtn>
                  <ModeBtn active={mode === 'manual'} onClick={() => setMode('manual')}>
                    Pick transactions
                  </ModeBtn>
                </div>

                {mode === 'statement' ? (
                  statements.length === 0 ? (
                    <p className="empty">No statements on this card yet. Import one first.</p>
                  ) : (
                    <>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={fieldLabelStyle}>Statement</span>
                        <select
                          value={statementId}
                          onChange={(e) => setStatementId(e.target.value)}
                          style={controlStyle}
                        >
                          {statements.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.cycleStart} → {s.cycleEnd} · {inr(s.totalAmount)}
                              {toPaise(s.totalAmount) === toPaise(targetAmount) ? ' · exact match' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <RowList
                        rows={covered}
                        empty="Every transaction on this statement is already covered."
                      />
                    </>
                  )
                ) : unpaid.length === 0 ? (
                  <p className="empty">No unpaid transactions on this card.</p>
                ) : (
                  <div style={listStyle}>
                    {unpaid.map((t) => (
                      <label key={t.id} style={{ ...rowStyle, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(String(t.id))}
                          onChange={() => toggle(t.id)}
                        />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={merchantStyle}>{t.merchant}</span>
                          <span style={metaStyle}>{t.txnDate}</span>
                        </span>
                        <span style={{ color: t.isRefund ? 'var(--ft-income)' : 'var(--ft-text)', fontSize: 13, fontWeight: 600 }}>
                          {t.isRefund ? '−' : ''}{inr(t.amount)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Reconciliation summary — 2dp here even though rows round to
                    whole rupees, so a small remainder is never hidden. */}
                <div style={{ borderTop: '1px solid var(--ft-border)', paddingTop: 12, display: 'grid', gap: 6 }}>
                  <Totals
                    label={`Matched · ${covered.length} item${covered.length === 1 ? '' : 's'}`}
                    value={inr(matchedPaise / 100, { decimals: 2 })}
                  />
                  {remainderPaise !== 0 && (
                    <Totals
                      label={remainderLabel(remainderPaise)}
                      value={inr(remainderPaise / 100, { decimals: 2 })}
                      dim
                    />
                  )}
                  <Totals label="Bill payment" value={inr(targetAmount, { decimals: 2 })} strong />
                </div>

                {error && <div style={{ color: 'var(--ft-spend)', fontSize: 13 }}>{error}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <GhostBtn onClick={onClose} type="button">Cancel</GhostBtn>
                  <PrimaryBtn type="submit" disabled={!canSubmit}>
                    {submitting ? 'Linking…' : 'Link'}
                  </PrimaryBtn>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </Portal>
  );
}

const fieldLabelStyle = {
  color: 'var(--ft-text-dim)',
  fontSize: 11.5,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const controlStyle = {
  background: 'var(--ft-surface-2)',
  border: '1px solid var(--ft-border)',
  color: 'var(--ft-text)',
  borderRadius: 10,
  padding: '10px 12px',
  fontFamily: 'var(--ft-font-ui)',
  fontSize: 13.5,
  outline: 'none',
};

const listStyle = {
  maxHeight: 260,
  overflowY: 'auto',
  border: '1px solid var(--ft-border)',
  borderRadius: 12,
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 12px',
  borderBottom: '1px solid var(--ft-border)',
};

const merchantStyle = {
  display: 'block',
  color: 'var(--ft-text)',
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const metaStyle = { display: 'block', color: 'var(--ft-text-dim)', fontSize: 11.5 };

function RowList({ rows, empty }) {
  if (rows.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div style={listStyle}>
      {rows.map((t) => (
        <div key={t.id} style={rowStyle}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={merchantStyle}>{t.merchant}</span>
            <span style={metaStyle}>{t.txnDate}</span>
          </span>
          <span style={{ color: t.isRefund ? 'var(--ft-income)' : 'var(--ft-text)', fontSize: 13, fontWeight: 600 }}>
            {t.isRefund ? '−' : ''}{inr(t.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Totals({ label, value, dim, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: dim ? 'var(--ft-text-faint)' : 'var(--ft-text-dim)', fontSize: 12.5 }}>
        {label}
      </span>
      <span
        style={{
          color: strong ? 'var(--ft-text)' : 'var(--ft-text-dim)',
          fontFamily: 'var(--ft-font-mono)',
          fontSize: 13,
          fontWeight: strong ? 700 : 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        background: active ? 'var(--ft-surface-2)' : 'transparent',
        border: `1px solid ${active ? 'var(--ft-accent)' : 'var(--ft-border)'}`,
        color: active ? 'var(--ft-text)' : 'var(--ft-text-dim)',
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
