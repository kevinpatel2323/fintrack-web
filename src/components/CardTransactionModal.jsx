import { useEffect, useId, useMemo, useState } from 'react';
import { Checkbox, Dialog, ErrorMessage, FormControl, toast } from './ui';
import { categoryOptions as buildCategoryOptions } from './common/Category.jsx';
import { createCardTransaction, updateCardTransaction } from '../services/cardsApi.js';
import './cards/cards.css';
import { getTodayIso } from '../utils/dateUtils.js';
import { useIsCompact } from '../styles/breakpoints.js';

/**
 * Add or edit a card transaction. Pass `initial` (an existing card
 * transaction) to switch the modal into edit mode.
 */
export default function CardTransactionModal({
  cardId,
  statementId = null,
  categories = [],
  initial = null,
  onClose,
  onSaved,
  open = true,
}) {
  const formId = useId();
  const isEdit = Boolean(initial);
  // No autofocus on phones: the keyboard would cover the sheet as it opens.
  const isMobile = useIsCompact();
  const [merchant, setMerchant] = useState(initial?.merchant ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount ?? '') : '');
  const [txnDate, setTxnDate] = useState(initial?.txnDate ?? getTodayIso());
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId != null ? String(initial.categoryId) : '',
  );
  const [isRefund, setIsRefund] = useState(Boolean(initial?.isRefund));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    setError('');
  }, [merchant, amount, txnDate]);

  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);

  const clear = (k) => setFieldErrors((f) => (f[k] ? { ...f, [k]: undefined } : f));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!merchant.trim()) errs.merchant = 'Enter the merchant';
    const n = Number(amount);
    if (amount === '' || !Number.isFinite(n) || n <= 0) errs.amount = 'Enter the amount';
    if (!txnDate) errs.txnDate = 'Pick the date';
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        merchant: merchant.trim(),
        amount: Number(amount),
        txnDate,
        isRefund,
        notes: notes.trim() || null,
        // An edit must be able to clear the category, so send null rather
        // than omitting the key.
        categoryId: categoryId || null,
      };
      const saved = isEdit
        ? await updateCardTransaction(initial.id, payload)
        : await createCardTransaction(cardId, {
            ...payload,
            ...(statementId ? { statementId } : {}),
          });
      toast.success(isEdit ? 'Transaction updated' : 'Transaction added');
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'add'} transaction`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={isEdit ? 'Edit transaction' : 'Add transaction'}
      actions={[
        { label: 'Cancel', onClick: () => onClose?.() },
        {
          label: isEdit ? 'Save changes' : 'Add transaction',
          variant: 'solid',
          type: 'submit',
          form: formId,
          loading: submitting,
        },
      ]}
    >
      <form id={formId} className="cardform" onSubmit={submit} noValidate>
        <FormControl
          label="Merchant"
          required
          value={merchant}
          onChange={(e) => { setMerchant(e.target.value); clear('merchant'); }}
          maxLength={200}
          placeholder="Amazon India"
          error={fieldErrors.merchant}
          autoFocus={!isEdit && !isMobile}
        />
        <div className="cardform__grid cardform__grid--keep">
          <FormControl
            type="number"
            label="Amount"
            required
            value={amount}
            onChange={(e) => { setAmount(e.target.value); clear('amount'); }}
            min="0"
            step="0.01"
            placeholder="1248"
            prefix={<span className="cardform__currency">₹</span>}
            error={fieldErrors.amount}
          />
          <FormControl
            type="date"
            label="Date"
            required
            value={txnDate}
            onChange={(v) => { setTxnDate(v); clear('txnDate'); }}
            error={fieldErrors.txnDate}
          />
        </div>
        <FormControl
          type="combobox"
          label="Category"
          options={categoryOptions}
          value={categoryId || null}
          onChange={(v) => setCategoryId(v ?? '')}
          placeholder="Uncategorised"
          searchPlaceholder="Search categories"
          clearable
        />
        <Checkbox
          label="Refund"
          description="Money credited back to the card"
          checked={isRefund}
          onChange={(e) => setIsRefund(e.target.checked)}
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
