import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Dialog, ErrorMessage, FormControl, FormLabel, TabButtons } from '../ui';
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
 * screens; on phones the same Dialog docks as a bottom sheet, with the amount
 * first, Type as a segment, 16px fields and full-width buttons. Validates
 * inline; `onSubmit(payload)`
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
  // Phones: 44px fields with 16px text (iOS never zooms); desktop keeps sm.
  const fieldSize = isMobile ? 'lg' : 'sm';

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

  const dateField = (
    <FormControl
      type="date"
      label="Date"
      required
      size={fieldSize}
      value={form.transactionDate}
      onChange={(iso) => setField('transactionDate', iso)}
      error={errors.transactionDate}
    />
  );
  // Phones: the four types as a segment (one tap, no menu).
  const typeField = isMobile ? (
    <div className="txl-form__wide txl-form__segment">
      <FormLabel as="div" label="Type" />
      <TabButtons fluid size="md" aria-label="Type" options={MANUAL_TYPES} value={form.type} onChange={(v) => setField('type', v)} />
    </div>
  ) : (
    <FormControl
      type="select"
      label="Type"
      options={MANUAL_TYPES}
      value={form.type}
      onChange={onText('type')}
    />
  );
  const directionField = form.type !== 'SETTLEMENT' ? null : isMobile ? (
    <div className="txl-form__wide txl-form__segment">
      <FormLabel as="div" label="Settlement direction" />
      <TabButtons
        fluid
        size="md"
        aria-label="Settlement direction"
        options={SETTLEMENT_DIRECTIONS}
        value={form.settlementDirection}
        onChange={(v) => setField('settlementDirection', v)}
      />
      {errors.settlementDirection && <ErrorMessage message={errors.settlementDirection} />}
    </div>
  ) : (
    <FormControl
      type="select"
      label="Settlement direction"
      options={SETTLEMENT_DIRECTIONS}
      value={form.settlementDirection}
      onChange={onText('settlementDirection')}
      error={errors.settlementDirection}
    />
  );
  const amountField = (
    <FormControl
      type="number"
      label="Amount"
      required
      size={fieldSize}
      min="0"
      step="0.01"
      inputMode="decimal"
      placeholder="0.00"
      prefix={<span className="txl-form__currency">₹</span>}
      value={form.amount}
      onChange={onText('amount')}
      error={errors.amount}
    />
  );
  const narrationField = (
    <FormControl
      className="txl-form__wide"
      label="Narration"
      required
      size={fieldSize}
      placeholder="What was this for?"
      value={form.narration}
      onChange={onText('narration')}
      error={errors.narration}
    />
  );

  const body = (
    <form id={formId} className="txl-form" onSubmit={handleSubmit} noValidate>
      {isMobile ? (
        <>
          {amountField}
          {typeField}
          {directionField}
          {narrationField}
          {dateField}
        </>
      ) : (
        <>
          {dateField}
          {typeField}
          {directionField}
          {amountField}
          {narrationField}
        </>
      )}

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
            size={fieldSize}
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={form.balance}
            onChange={onText('balance')}
            error={errors.balance}
          />
          <FormControl label="UPI name" placeholder="Optional" size={fieldSize} value={form.upiName} onChange={onText('upiName')} />
          <FormControl
            label="UPI description"
            placeholder="Optional"
            size={fieldSize}
            value={form.upiDescription}
            onChange={onText('upiDescription')}
          />
          <FormControl label="UPI bank" placeholder="Optional" size={fieldSize} value={form.upiBank} onChange={onText('upiBank')} />
        </>
      )}

      {submitError && <ErrorMessage className="txl-form__wide" message={submitError} />}
    </form>
  );

  const title = 'New transaction';
  const description = 'Manual entries are posted to the Wallet account.';

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
