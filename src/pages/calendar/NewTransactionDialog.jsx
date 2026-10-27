import { useEffect, useState } from 'react';
import { Button, ErrorMessage, FormControl } from '../../components/ui';
import FormFrame from './FormFrame.jsx';

const FORM_ID = 'cal-manual-form';

const TYPE_OPTIONS = [
  { label: 'Paid', value: 'PAID' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'I owe', value: 'I_OWE' },
  { label: 'Settlement', value: 'SETTLEMENT' },
];

const DIRECTION_OPTIONS = [
  { label: 'Withdrawal', value: 'WITHDRAWAL' },
  { label: 'Deposit', value: 'DEPOSIT' },
];

const emptyForm = (date) => ({
  transactionDate: date,
  narration: '',
  type: 'PAID',
  settlementDirection: 'WITHDRAWAL',
  amount: '',
  balance: '',
  upiName: '',
  upiDescription: '',
  upiBank: '',
});

/**
 * Add a manual (cash / wallet) transaction, dated to the selected day.
 * `onSubmit(body)` posts it; a thrown error is shown in the form.
 */
export default function NewTransactionDialog({ open, defaultDate, compact, onClose, onSubmit }) {
  const [form, setForm] = useState(() => emptyForm(defaultDate));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(defaultDate));
    setErrors({});
    setFormError('');
  }, [open, defaultDate]);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    const narration = form.narration.trim();
    const amountValue = Number(form.amount);
    const balanceValue = form.balance === '' ? undefined : Number(form.balance);

    const nextErrors = {};
    if (!form.transactionDate) nextErrors.transactionDate = 'Select a transaction date.';
    if (!narration) nextErrors.narration = 'Enter a narration.';
    if (!form.amount || Number.isNaN(amountValue) || amountValue <= 0) nextErrors.amount = 'Enter a valid amount.';
    if (form.type === 'SETTLEMENT' && !form.settlementDirection) nextErrors.settlementDirection = 'Select settlement direction.';
    if (balanceValue !== undefined && (Number.isNaN(balanceValue) || balanceValue < 0)) nextErrors.balance = 'Balance must be zero or positive.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await onSubmit({
        transactionDate: form.transactionDate,
        narration,
        type: form.type,
        settlementDirection: form.type === 'SETTLEMENT' ? form.settlementDirection : undefined,
        amount: amountValue,
        balance: balanceValue,
        upiName: form.upiName.trim() || undefined,
        upiDescription: form.upiDescription.trim() || undefined,
        upiBank: form.upiBank.trim() || undefined,
      });
    } catch (error) {
      setFormError(error.message || 'Failed to add manual transaction.');
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="cal-form__footer">
      <Button label="Cancel" onClick={onClose} disabled={saving} />
      <Button variant="solid" type="submit" form={FORM_ID} label="Add transaction" loading={saving} loadingText="Adding…" />
    </div>
  );

  return (
    <FormFrame
      compact={compact}
      open={open}
      onClose={onClose}
      busy={saving}
      title="New transaction"
      description="Manual entries are posted to the Wallet account."
      footer={footer}
    >
      <form id={FORM_ID} className="cal-form" onSubmit={submit} noValidate>
        <FormControl
          className="cal-form__full"
          label="Narration"
          required
          autoFocus
          placeholder="What was this for?"
          value={form.narration}
          onChange={set('narration')}
          error={errors.narration}
        />
        <FormControl
          label="Amount"
          type="number"
          required
          min="0"
          step="0.01"
          placeholder="0.00"
          prefix={<span className="text-ink-gray-5">₹</span>}
          value={form.amount}
          onChange={set('amount')}
          error={errors.amount}
        />
        <FormControl
          label="Date"
          type="date"
          required
          value={form.transactionDate}
          onChange={(value) => setForm((p) => ({ ...p, transactionDate: value }))}
          error={errors.transactionDate}
        />
        <FormControl label="Type" type="select" options={TYPE_OPTIONS} value={form.type} onChange={set('type')} />
        {form.type === 'SETTLEMENT' && (
          <FormControl
            label="Settlement direction"
            type="select"
            options={DIRECTION_OPTIONS}
            value={form.settlementDirection}
            onChange={set('settlementDirection')}
            error={errors.settlementDirection}
          />
        )}
        <FormControl
          className={form.type === 'SETTLEMENT' ? 'cal-form__full' : undefined}
          label="Balance"
          type="number"
          min="0"
          step="0.01"
          placeholder="Optional"
          prefix={<span className="text-ink-gray-5">₹</span>}
          value={form.balance}
          onChange={set('balance')}
          error={errors.balance}
        />
        <FormControl label="UPI name" placeholder="Optional" value={form.upiName} onChange={set('upiName')} />
        <FormControl label="UPI bank" placeholder="Optional" value={form.upiBank} onChange={set('upiBank')} />
        <FormControl
          className="cal-form__full"
          label="UPI description"
          placeholder="Optional"
          value={form.upiDescription}
          onChange={set('upiDescription')}
        />
        {formError && <ErrorMessage className="cal-form__full" message={formError} />}
      </form>
    </FormFrame>
  );
}
