import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, ErrorMessage, FormControl } from '../../components/ui';
import { categoryOptions as buildCategoryOptions } from '../../components/common/Category.jsx';
import FormFrame from './FormFrame.jsx';
import { CADENCE_OPTIONS, buildRRule, parseCadence } from './cadence.js';
import { parseExdatesText, toLocalIso } from './calendarModel.js';

const FORM_ID = 'cal-subscription-form';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Cancelled', value: 'cancelled' },
];

const emptyForm = () => ({
  name: '', amount: '', rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
  dtstart: toLocalIso(new Date()), exdatesText: '', status: 'active',
  isTrial: false, trialStartedOn: '', trialEndsOn: '',
  notes: '', merchantLabel: '', categoryId: '', remindDaysBefore: '',
});

function formFromRow(row) {
  return {
    name: row.name || '', amount: String(row.amount ?? ''),
    rrule: row.rrule || 'FREQ=MONTHLY;BYMONTHDAY=1',
    dtstart: typeof row.dtstart === 'string' ? row.dtstart.slice(0, 10) : toLocalIso(new Date()),
    exdatesText: Array.isArray(row.exdates) ? row.exdates.join('\n') : '',
    status: row.status || 'active', isTrial: Boolean(row.isTrial),
    trialStartedOn: row.trialStartedOn ? String(row.trialStartedOn).slice(0, 10) : '',
    trialEndsOn: row.trialEndsOn ? String(row.trialEndsOn).slice(0, 10) : '',
    notes: row.notes || '', merchantLabel: row.merchantLabel || '',
    categoryId: row.categoryId != null ? String(row.categoryId) : '',
    remindDaysBefore: row.remindDaysBefore != null ? String(row.remindDaysBefore) : '',
  };
}

function cadenceFor(form) {
  const { mode, day } = parseCadence(form.rrule);
  const startDay = Number(form.dtstart.slice(8, 10)) || 1;
  return { mode, day: String(day ?? startDay) };
}

function cadenceHint(mode, day) {
  if (mode === 'weekly') return 'Every week on the start date’s weekday';
  if (mode === 'yearly') return 'Every year on the start date';
  if (mode === 'monthly' && Number(day) > 28) return 'Months without this day are skipped';
  return null;
}

/**
 * Create or edit a subscription. Every stored field is here: name, amount,
 * start date, the recurrence rule (picked as Monthly / Weekly / Yearly, or
 * written by hand), status, category, merchant label, reminder, trial dates,
 * exception dates and notes. `onSubmit(body, id)` saves and closes; a thrown
 * error is shown in the form.
 */
export default function SubscriptionDialog({
  open,
  subscription,
  categories,
  compact,
  onClose,
  onSubmit,
  onDelete,
}) {
  const editingId = subscription ? String(subscription.id) : null;
  const [form, setForm] = useState(emptyForm);
  const [cadence, setCadence] = useState({ mode: 'monthly', day: '1' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = subscription ? formFromRow(subscription) : emptyForm();
    setForm(next);
    setCadence(cadenceFor(next));
    setErrors({});
    setFormError('');
  }, [open, subscription]);

  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const setValue = (key) => (value) => setForm((p) => ({ ...p, [key]: value ?? '' }));

  function changeMode(mode) {
    setCadence((c) => ({ ...c, mode }));
    if (mode !== 'custom') setForm((p) => ({ ...p, rrule: buildRRule(mode, { day: cadence.day }) }));
  }

  function changeDay(value) {
    setCadence((c) => ({ ...c, day: value }));
    setForm((p) => ({ ...p, rrule: buildRRule('monthly', { day: value }) }));
  }

  async function submit(e) {
    e.preventDefault();
    const name = form.name.trim();
    const amount = Number(form.amount);
    const nextErrors = {};
    if (!name) nextErrors.name = 'Enter a name.';
    if (form.amount === '' || Number.isNaN(amount) || amount < 0) nextErrors.amount = 'Enter a valid amount.';
    if (!ISO_DATE.test(form.dtstart)) nextErrors.dtstart = 'Pick a valid start date.';
    if (!form.rrule.trim()) nextErrors.rrule = 'Enter an RRULE.';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    const body = {
      name, amount, rrule: form.rrule.trim(), dtstart: form.dtstart,
      exdates: parseExdatesText(form.exdatesText), status: form.status, isTrial: form.isTrial,
      notes: form.notes.trim() || null, merchantLabel: form.merchantLabel.trim() || null,
      trialStartedOn: ISO_DATE.test(form.trialStartedOn) ? form.trialStartedOn : null,
      trialEndsOn: ISO_DATE.test(form.trialEndsOn) ? form.trialEndsOn : null,
      categoryId: form.categoryId ? String(form.categoryId) : null,
      remindDaysBefore: form.remindDaysBefore !== '' ? Number(form.remindDaysBefore) : null,
    };
    setSaving(true);
    try {
      await onSubmit(body, editingId);
    } catch (err) {
      setFormError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const footer = compact ? (
    // Phone: Cancel and the main action share the width; Delete sits at the
    // foot of the form instead of crowding them.
    <div className="cal-form__footer">
      <Button size="lg" label="Cancel" onClick={onClose} disabled={saving} />
      <Button
        size="lg"
        variant="solid"
        type="submit"
        form={FORM_ID}
        label={editingId ? 'Save' : 'Add subscription'}
        loading={saving}
        loadingText="Saving…"
      />
    </div>
  ) : (
    <div className="cal-form__footer">
      {editingId && (
        <Button
          variant="ghost"
          theme="red"
          iconLeft={Trash2}
          label="Delete"
          disabled={saving}
          onClick={() => onDelete(subscription)}
          className="cal-form__delete"
        />
      )}
      <Button label="Cancel" onClick={onClose} disabled={saving} />
      <Button
        variant="solid"
        type="submit"
        form={FORM_ID}
        label={editingId ? 'Save' : 'Add subscription'}
        loading={saving}
        loadingText="Saving…"
      />
    </div>
  );

  const nameField = (
    <FormControl
      className="cal-form__full"
      label="Name"
      required
      placeholder="Netflix"
      maxLength={200}
      // Phones open the sheet without the keyboard (frappe-ui BottomSheet).
      autoFocus={!editingId && !compact}
      value={form.name}
      onChange={set('name')}
      error={errors.name}
    />
  );
  const amountField = (
    <FormControl
      label="Amount"
      type="number"
      required
      min="0"
      step="0.01"
      placeholder="0.00"
      prefix={<span className="text-ink-gray-5">₹</span>}
      inputMode={compact ? 'decimal' : undefined}
      value={form.amount}
      onChange={set('amount')}
      error={errors.amount}
    />
  );
  const startField = (
    <FormControl
      label="Start date"
      type="date"
      required
      value={form.dtstart}
      onChange={setValue('dtstart')}
      error={errors.dtstart}
    />
  );
  const repeatsField = (
    <FormControl
      label="Repeats"
      type="select"
      options={CADENCE_OPTIONS}
      value={cadence.mode}
      onChange={(e) => changeMode(e.target.value)}
      description={compact ? undefined : cadenceHint(cadence.mode, cadence.day)}
    />
  );
  const dayField = cadence.mode === 'monthly' && (
    <FormControl
      label="Day of month"
      type="number"
      min="1"
      max="31"
      step="1"
      inputMode={compact ? 'numeric' : undefined}
      value={cadence.day}
      onChange={(e) => changeDay(e.target.value)}
      onBlur={() => changeDay(String(parseCadence(form.rrule).day ?? 1))}
    />
  );
  const customField = cadence.mode === 'custom' && (
    <FormControl
      className="cal-form__full"
      label="Recurrence rule (RRULE)"
      required
      placeholder="FREQ=MONTHLY;BYMONTHDAY=15"
      inputClassName="cal-form__mono"
      value={form.rrule}
      onChange={set('rrule')}
      error={errors.rrule}
      description="RFC 5545 rule, for example FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15"
    />
  );
  const statusField = (
    <FormControl
      label="Status"
      type="select"
      options={STATUS_OPTIONS}
      value={form.status}
      onChange={set('status')}
    />
  );
  const categoryField = (
    <FormControl
      label="Category"
      type="combobox"
      options={categoryOptions}
      value={form.categoryId || null}
      onChange={setValue('categoryId')}
      placeholder="No category"
      searchPlaceholder="Search categories"
      clearable
    />
  );
  const merchantField = (
    <FormControl
      label="Merchant label"
      placeholder="As it appears on the statement"
      maxLength={200}
      value={form.merchantLabel}
      onChange={set('merchantLabel')}
    />
  );
  const remindField = (
    <FormControl
      label="Remind days before"
      type="number"
      min="0"
      step="1"
      placeholder="No reminder"
      inputMode={compact ? 'numeric' : undefined}
      value={form.remindDaysBefore}
      onChange={set('remindDaysBefore')}
    />
  );
  const trialField = (
    <FormControl
      className="cal-form__full"
      type="checkbox"
      label="Free trial"
      checked={form.isTrial}
      onChange={(e) => setForm((p) => ({ ...p, isTrial: e.target.checked }))}
    />
  );
  const trialDates = form.isTrial && (
    <>
      <FormControl
        label="Trial started on"
        type="date"
        clearable
        placeholder="Not set"
        value={form.trialStartedOn}
        onChange={setValue('trialStartedOn')}
      />
      <FormControl
        label="Trial ends on"
        type="date"
        clearable
        placeholder="Not set"
        value={form.trialEndsOn}
        onChange={setValue('trialEndsOn')}
      />
    </>
  );
  const exdatesField = (
    <FormControl
      className="cal-form__full"
      label="Exception dates"
      type="textarea"
      rows={2}
      placeholder="2026-12-01"
      value={form.exdatesText}
      onChange={set('exdatesText')}
      description="Dates with no bill, one per line (YYYY-MM-DD)"
    />
  );
  const notesField = (
    <FormControl
      className="cal-form__full"
      label="Notes"
      type="textarea"
      rows={2}
      value={form.notes}
      onChange={set('notes')}
    />
  );
  const errorField = formError && <ErrorMessage className="cal-form__full" message={formError} />;

  // Phone: one column in the order a bill is thought about (what, how much,
  // how often, from when), with the repeat controls side by side.
  const hint = cadenceHint(cadence.mode, cadence.day);
  const fields = compact ? (
    <>
      {nameField}
      {amountField}
      <div className="cal-form__pair">
        {repeatsField}
        {dayField}
      </div>
      {hint && <p className="cal-form__hint">{hint}</p>}
      {customField}
      {startField}
      {categoryField}
      {statusField}
      {merchantField}
      {remindField}
      {trialField}
      {form.isTrial && <div className="cal-form__pair">{trialDates}</div>}
      {exdatesField}
      {notesField}
      {errorField}
      {editingId && (
        <Button
          size="lg"
          variant="ghost"
          theme="red"
          iconLeft={Trash2}
          label="Delete subscription"
          disabled={saving}
          onClick={() => onDelete(subscription)}
          className="cal-form__delete-row"
        />
      )}
    </>
  ) : (
    <>
      {nameField}
      {amountField}
      {startField}
      {repeatsField}
      {dayField}
      {customField}
      {statusField}
      {categoryField}
      {merchantField}
      {remindField}
      {trialField}
      {trialDates}
      {exdatesField}
      {notesField}
      {errorField}
    </>
  );

  return (
    <FormFrame
      compact={compact}
      open={open}
      onClose={onClose}
      busy={saving}
      title={editingId ? 'Edit subscription' : 'New subscription'}
      description="A recurring bill. It shows on the calendar on each date it repeats."
      footer={footer}
    >
      <form id={FORM_ID} className="cal-form" onSubmit={submit} noValidate>
        {fields}
      </form>
    </FormFrame>
  );
}
