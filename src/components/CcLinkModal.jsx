import { useEffect, useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import {
  Amount, Button, Checkbox, Dialog, EmptyState, ErrorMessage, FormControl, LoadingIndicator, TabButtons, toast,
} from './ui';
import { inr } from '../utils/inr.js';
import { signedPaise, toPaise } from '../utils/ccMatch.js';
import {
  linkCcBillPayment,
  listCardStatements,
  listCardTransactions,
  listCards,
  listUnpaidCardTransactions,
} from '../services/cardsApi.js';
import './transaction-detail/CcLinkModal.css';

// The bank debit rarely equals the sum of the rows it covers — a statement
// carries the previous cycle's balance forward and includes "payment received"
// credits. Rather than block on that, name the difference.
function remainderLabel(remainderPaise) {
  if (remainderPaise > 0) return 'Carried forward / other charges';
  return 'Not covered by this payment';
}

function formatDate(value, withYear = true) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(d);
}

const MODES = [
  { label: 'Whole statement', value: 'statement' },
  { label: 'Pick transactions', value: 'manual' },
];

/** A card transaction as a refund-aware signed amount: refunds read as money in. */
function RowAmount({ txn }) {
  const amount = Number(txn.amount || 0);
  return (
    <Amount
      className="ccl-row__amount"
      value={txn.isRefund ? -amount : amount}
      tone={txn.isRefund ? 'in' : 'out'}
    />
  );
}

function RowText({ txn }) {
  return (
    <span className="ccl-row__text">
      <span className="ccl-row__merchant truncate">{txn.merchant}</span>
      <span className="ccl-row__date">{formatDate(txn.txnDate)}</span>
    </span>
  );
}

/**
 * Link a bank debit to the credit-card bill it paid: either a whole statement
 * or hand-picked unpaid card transactions. Calls `onLinked(result)` with the
 * API's link payload. Callers mount it while open (`open` defaults to true).
 */
export default function CcLinkModal({ transaction, onClose, onLinked, open = true }) {
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

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await linkCcBillPayment(
        transaction.id,
        mode === 'statement'
          ? { cardId: Number(cardId), statementId: Number(statementId) }
          : { cardId: Number(cardId), cardTransactionIds: [...selectedIds].map(Number) },
      );
      toast.success('Card bill linked');
      onLinked?.(result);
    } catch (err) {
      setError(err.message || 'Failed to link');
    } finally {
      setSubmitting(false);
    }
  };

  const picked = selectedIds.size;
  const submitLabel = mode === 'statement'
    ? 'Link statement'
    : picked > 0
      ? `Link ${picked} ${picked === 1 ? 'transaction' : 'transactions'}`
      : 'Link transactions';

  const noCards = !loading && cards.length === 0;

  const statementOptions = statements.map((s) => {
    const exact = toPaise(s.totalAmount) === toPaise(targetAmount);
    return {
      value: String(s.id),
      label: `${formatDate(s.cycleStart, false)} → ${formatDate(s.cycleEnd)} · ${inr(s.totalAmount)}${exact ? ' · exact match' : ''}`,
    };
  });

  let body;
  if (loading) {
    body = <LoadingIndicator text="Loading cards…" />;
  } else if (noCards) {
    body = error ? null : (
      <EmptyState
        size="sm"
        icon={CreditCard}
        title="No credit cards yet"
        description="Add one from Cards first."
        action={<Button label="Go to Cards" to="/cards" />}
      />
    );
  } else {
    body = (
      <>
        <FormControl
          type="select"
          label="Card"
          options={cards.map((c) => ({ value: String(c.id), label: `${c.name} · ····${c.last4}` }))}
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
        />

        <TabButtons fluid aria-label="Link mode" options={MODES} value={mode} onChange={setMode} />

        {mode === 'statement' ? (
          statements.length === 0 ? (
            <p className="ccl-empty">No statements on this card yet. Import one first.</p>
          ) : (
            <>
              <FormControl
                type="select"
                label="Statement"
                options={statementOptions}
                value={statementId}
                onChange={(e) => setStatementId(e.target.value)}
              />
              {covered.length === 0 ? (
                <p className="ccl-empty">Every transaction on this statement is already covered.</p>
              ) : (
                <ul className="ccl-list" aria-label="Transactions this statement covers">
                  {covered.map((t) => (
                    <li key={t.id} className="ccl-row">
                      <RowText txn={t} />
                      <RowAmount txn={t} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        ) : unpaid.length === 0 ? (
          <p className="ccl-empty">No unpaid transactions on this card.</p>
        ) : (
          <ul className="ccl-list" aria-label="Unpaid card transactions">
            {unpaid.map((t) => {
              const checked = selectedIds.has(String(t.id));
              return (
                <li key={t.id}>
                  <label className={`ccl-row ccl-row--pick${checked ? ' is-checked' : ''}`}>
                    <Checkbox
                      checked={checked}
                      onChange={() => toggle(t.id)}
                      aria-label={`${t.merchant} · ${formatDate(t.txnDate)}`}
                    />
                    <RowText txn={t} />
                    <RowAmount txn={t} />
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {/* Reconciliation summary — 2dp here even though rows round to
            whole rupees, so a small remainder is never hidden. */}
        <dl className="ccl-totals">
          <div className="ccl-totals__row">
            <dt>Matched · {covered.length} {covered.length === 1 ? 'item' : 'items'}</dt>
            <dd><Amount value={matchedPaise / 100} decimals={2} tone="inherit" /></dd>
          </div>
          {remainderPaise !== 0 && (
            <div className="ccl-totals__row is-muted">
              <dt>{remainderLabel(remainderPaise)}</dt>
              <dd><Amount value={remainderPaise / 100} decimals={2} tone="inherit" /></dd>
            </div>
          )}
          <div className="ccl-totals__row is-total">
            <dt>Bill payment</dt>
            <dd><Amount value={targetAmount} decimals={2} tone="inherit" /></dd>
          </div>
        </dl>
      </>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Link to card bill"
      description={`Pick the credit card statement or transactions this ${inr(targetAmount)} payment paid off.`}
      actions={[
        { label: 'Cancel' },
        {
          label: submitLabel,
          variant: 'solid',
          disabled: !canSubmit || noCards,
          loading: submitting,
          loadingText: 'Linking…',
          onClick: () => submit(),
        },
      ]}
    >
      {body}
      <ErrorMessage message={error} />
    </Dialog>
  );
}
