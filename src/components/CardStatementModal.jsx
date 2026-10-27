import { useId, useState } from 'react';
import { Dialog, ErrorMessage, FormControl, toast } from './ui';
import { createCardStatement } from '../services/cardsApi.js';
import './cards/cards.css';
import { getTodayIso } from '../utils/dateUtils.js';

/** Add a statement (billing cycle) to a credit card by hand. */
export default function CardStatementModal({ cardId, defaults = {}, onClose, onSaved, open = true }) {
  const formId = useId();
  const [cycleStart, setCycleStart] = useState(defaults.cycleStart || getTodayIso());
  const [cycleEnd, setCycleEnd] = useState(defaults.cycleEnd || getTodayIso());
  const [dueDate, setDueDate] = useState(defaults.dueDate || getTodayIso());
  const [minDue, setMinDue] = useState(defaults.minDue ? String(defaults.minDue) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const clear = (k) => setFieldErrors((f) => (f[k] ? { ...f, [k]: undefined } : f));

  const submit = async (e) => {
    e.preventDefault();
    // The same rules the API applies, caught before the round trip.
    const errs = {};
    if (!cycleStart) errs.cycleStart = 'Pick the first day of the cycle';
    if (!cycleEnd) errs.cycleEnd = 'Pick the statement date';
    else if (cycleStart && cycleEnd < cycleStart) errs.cycleEnd = 'Must be on or after the cycle start';
    if (!dueDate) errs.dueDate = 'Pick the due date';
    else if (cycleEnd && dueDate < cycleEnd) errs.dueDate = 'Must be on or after the cycle end';
    if (minDue !== '' && !(Number(minDue) >= 0)) errs.minDue = 'Enter an amount';
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
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
      toast.success('Statement added');
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Failed to create statement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Add statement"
      description="Card transactions in this cycle that aren't on a statement yet are added to it."
      actions={[
        { label: 'Cancel', onClick: () => onClose?.() },
        { label: 'Add statement', variant: 'solid', type: 'submit', form: formId, loading: submitting },
      ]}
    >
      <form id={formId} className="cardform" onSubmit={submit} noValidate>
        <div className="cardform__grid cardform__grid--keep">
          <FormControl
            type="date"
            label="Cycle start"
            required
            value={cycleStart}
            onChange={(v) => { setCycleStart(v); clear('cycleStart'); }}
            error={fieldErrors.cycleStart}
          />
          <FormControl
            type="date"
            label="Cycle end"
            required
            value={cycleEnd}
            onChange={(v) => { setCycleEnd(v); clear('cycleEnd'); }}
            error={fieldErrors.cycleEnd}
          />
          <FormControl
            type="date"
            label="Due date"
            required
            value={dueDate}
            onChange={(v) => { setDueDate(v); clear('dueDate'); }}
            error={fieldErrors.dueDate}
          />
          <FormControl
            type="number"
            label="Minimum due"
            value={minDue}
            onChange={(e) => { setMinDue(e.target.value); clear('minDue'); }}
            min="0"
            step="0.01"
            placeholder="2421"
            prefix={<span className="cardform__currency">₹</span>}
            error={fieldErrors.minDue}
          />
        </div>
        <ErrorMessage message={error} />
      </form>
    </Dialog>
  );
}
