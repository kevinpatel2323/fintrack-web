import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Dialog, ErrorMessage, FormControl, Sheet } from '../ui';
import { useIsCompact } from '../../styles/breakpoints.js';
import {
  MANUAL_TYPES,
  SETTLEMENT_DIRECTIONS,
  emptyManualForm,
  manualFormToPayload,
  validateManualForm,
} from './transactionListModel.js';
import './transactions.css';

const OPTIONAL_FIELDS = ['balance', 'upiName', 'upiDescription', 'upiBank'];

/**
 * "New transaction": a manual entry on the Wallet account. A dialog on wide
 * screens, a bottom sheet on phones. Validates inline; `onSubmit(payload)`
 * gets the request body and should throw to keep the form open with an error.
 * The draft survives Cancel, as it always has; a successful save clears it
 * but keeps the date (entries tend to be added a few at a time).
 */
export default function ManualTransactionDialog({ open, onClose, onSubmit }) {
  const isMobile = useIsCompact();
  const formId = useId();
  const [form, setForm] = useState(() => emptyManualForm());
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const setField = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };
  const onText = (field) => (e) => setField(field, e.target.value);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateManualForm(form);
    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length) {
      if (OPTIONAL_FIELDS.some((f) => nextErrors[f])) setShowMore(true);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(manualFormToPayload(form));
      setForm((p) => emptyManualForm(p.transactionDate));
      setShowMore(false);
    } catch (error) {
      setSubmitError(error?.message || 'Failed to add manual transaction.');
    } finally {
      setSubmitting(false);
    }
  }

  const body = (
    <form id={formId} className="txl-form" onSubmit={handleSubmit} noValidate>
      <FormControl
        type="date"
        label="Date"
        required
        value={form.transactionDate}
        onChange={(iso) => setField('transactionDate', iso)}
        error={errors.transactionDate}
      />
      <FormControl
        type="select"
        label="Type"
        options={MANUAL_TYPES}
        value={form.type}
        onChange={onText('type')}
      />
      {form.type === 'SETTLEMENT' && (
        <FormControl
          type="select"
          label="Settlement direction"
          options={SETTLEMENT_DIRECTIONS}
          value={form.settlementDirection}
          onChange={onText('settlementDirection')}
          error={errors.settlementDirection}
        />
      )}
      <FormControl
        type="number"
        label="Amount"
        required
        min="0"
        step="0.01"
        inputMode="decimal"
        placeholder="0.00"
        prefix={<span className="txl-form__currency">₹</span>}
        value={form.amount}
        onChange={onText('amount')}
        error={errors.amount}
      />
      <FormControl
        className="txl-form__wide"
        label="Narration"
        required
        placeholder="What was this for?"
        value={form.narration}
        onChange={onText('narration')}
        error={errors.narration}
      />

      <div className="txl-form__wide">
        <Button
          variant="ghost"
          iconRight={<ChevronDown size={16} strokeWidth={1.5} className={showMore ? 'txl-form__chevron is-open' : 'txl-form__chevron'} aria-hidden />}
          label={showMore ? 'Fewer details' : 'More details'}
          aria-expanded={showMore}
          className="txl-form__more"
          onClick={() => setShowMore((v) => !v)}
        />
      </div>

      {showMore && (
        <>
          <FormControl
            type="number"
            label="Balance"
            description="Optional. Account balance after this entry."
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={form.balance}
            onChange={onText('balance')}
            error={errors.balance}
          />
          <FormControl label="UPI name" placeholder="Optional" value={form.upiName} onChange={onText('upiName')} />
          <FormControl
            label="UPI description"
            placeholder="Optional"
            value={form.upiDescription}
            onChange={onText('upiDescription')}
          />
          <FormControl label="UPI bank" placeholder="Optional" value={form.upiBank} onChange={onText('upiBank')} />
        </>
      )}

      {submitError && <ErrorMessage className="txl-form__wide" message={submitError} />}
    </form>
  );

  const title = 'New transaction';
  const description = 'Manual entries are posted to the Wallet account.';

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        side="bottom"
        title={title}
        description={description}
        footer={(
          <>
            <Button label="Cancel" onClick={onClose} />
            <Button variant="solid" type="submit" form={formId} label="Add transaction" loading={submitting} />
          </>
        )}
      >
        {body}
      </Sheet>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={title}
      description={description}
      actions={[
        { label: 'Cancel' },
        { label: 'Add transaction', variant: 'solid', type: 'submit', form: formId, loading: submitting },
      ]}
    >
      {body}
    </Dialog>
  );
}
