import { useId, useState } from 'react';
import { Dialog, ErrorMessage, FormControl, toast } from './ui';
import { createCardPayment } from '../services/cardsApi.js';
import './cards/cards.css';
import { getTodayIso } from '../utils/dateUtils.js';
import { useIsCompact } from '../styles/breakpoints.js';

/**
 * Record a payment against a credit card. `statementId` ties it to that bill;
 * `description` (optional) says which bill in the dialog.
 */
export default function CardPaymentModal({
  cardId,
  statementId = null,
  suggestedAmount = '',
  description,
  onClose,
  onSaved,
  open = true,
}) {
  const formId = useId();
  // No autofocus on phones: the keyboard would cover the sheet as it opens.
  const isMobile = useIsCompact();
  const [amount, setAmount] = useState(suggestedAmount ? String(suggestedAmount) : '');
  const [paidOn, setPaidOn] = useState(getTodayIso());
  const [viaLabel, setViaLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const n = Number(amount);
    if (amount === '' || !Number.isFinite(n) || n <= 0) errs.amount = 'Enter the amount paid';
    if (!paidOn) errs.paidOn = 'Pick the payment date';
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
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
      toast.success('Payment recorded');
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Record payment"
      description={description}
      actions={[
        { label: 'Cancel', onClick: () => onClose?.() },
        { label: 'Record payment', variant: 'solid', type: 'submit', form: formId, loading: submitting },
      ]}
    >
      <form id={formId} className="cardform" onSubmit={submit} noValidate>
        <div className="cardform__grid cardform__grid--keep">
          <FormControl
            type="number"
            label="Amount"
            required
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setFieldErrors((f) => ({ ...f, amount: undefined }));
            }}
            min="0"
            step="0.01"
            placeholder="48420"
            prefix={<span className="cardform__currency">₹</span>}
            error={fieldErrors.amount}
            autoFocus={!isMobile}
          />
          <FormControl
            type="date"
            label="Paid on"
            required
            value={paidOn}
            onChange={(v) => {
              setPaidOn(v);
              setFieldErrors((f) => ({ ...f, paidOn: undefined }));
            }}
            error={fieldErrors.paidOn}
          />
        </div>
        <FormControl
          label="Paid from"
          value={viaLabel}
          onChange={(e) => setViaLabel(e.target.value)}
          maxLength={200}
          placeholder="HDFC Savings"
        />
        <FormControl
          type="textarea"
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={2}
        />
        <ErrorMessage message={error} />
      </form>
    </Dialog>
  );
}
