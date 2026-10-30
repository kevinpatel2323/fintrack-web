import { useEffect, useId, useMemo, useState } from 'react';
import {
  Checkbox, Dialog, ErrorMessage, FormControl, FormLabel, TabButtons, toast,
} from './ui';
import CardMark from './cards/CardMark.jsx';
import CardFace from './cards/CardFace.jsx';
import { BANK_OPTIONS, NETWORK_OPTIONS } from './cards/cardFormat.js';
import { CARD_PALETTES, createCard, updateCard } from '../services/cardsApi.js';
import { useAccountNames } from '../hooks/useAccounts.js';
import { refreshImportSchedule } from '../hooks/useImportSchedule.js';
import { accountChoices, accountLast4, linkedAccountMatch } from '../utils/accounts.js';
import { useIsCompact } from '../styles/breakpoints.js';
import './cards/cards.css';

const emptyForm = {
  kind: 'credit',
  bank: 'hdfc',
  network: 'visa',
  name: '',
  nickname: '',
  last4: '',
  expiryMonth: '',
  expiryYear: '',
  holder: '',
  palette: 'obsidian',
  creditLimit: '',
  statementDay: '',
  dueDay: '',
  linkedAccountNumber: '',
  dailyLimit: '',
  atmLimit: '',
  pointsLabel: '',
  pointsBalance: '',
  pointsValue: '',
  isPrimary: false,
  notes: '',
};

const KIND_OPTIONS = [
  { value: 'credit', label: 'Credit card' },
  { value: 'debit', label: 'Debit card' },
];

const PALETTE_OPTIONS = Object.entries(CARD_PALETTES).map(([value, p]) => ({ value, label: p.label }));

const isBlank = (v) => v === '' || v === null || v === undefined;

function intIn(value, min, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max;
}

function nonNegative(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

/** Field errors for the form, in the same limits the API enforces. */
function validate(form) {
  const e = {};
  if (!form.name.trim()) e.name = 'Enter the card name';
  if (!/^\d{4}$/.test(form.last4.trim())) e.last4 = 'Enter the last 4 digits';
  if (!intIn(form.expiryMonth, 1, 12)) e.expiryMonth = 'Month from 1 to 12';
  if (!intIn(form.expiryYear, 2000, 2100)) e.expiryYear = 'Enter a 4-digit year';
  if (form.kind === 'credit') {
    if (!isBlank(form.creditLimit) && !nonNegative(form.creditLimit)) e.creditLimit = 'Enter an amount';
    if (!isBlank(form.statementDay) && !intIn(form.statementDay, 1, 31)) e.statementDay = 'Day from 1 to 31';
    if (!isBlank(form.dueDay) && !intIn(form.dueDay, 1, 31)) e.dueDay = 'Day from 1 to 31';
    if (!isBlank(form.pointsBalance) && !(intIn(form.pointsBalance, 0, Number.MAX_SAFE_INTEGER))) {
      e.pointsBalance = 'Enter a whole number';
    }
    if (!isBlank(form.pointsValue) && !nonNegative(form.pointsValue)) e.pointsValue = 'Enter an amount';
  } else {
    if (!isBlank(form.dailyLimit) && !nonNegative(form.dailyLimit)) e.dailyLimit = 'Enter an amount';
    if (!isBlank(form.atmLimit) && !nonNegative(form.atmLimit)) e.atmLimit = 'Enter an amount';
  }
  return e;
}

const rupee = <span className="cardform__currency">₹</span>;

/** The form's values for a card from the API (blank fields as ''), or a new card's. */
function toForm(initial) {
  if (!initial) return { ...emptyForm };
  return {
    ...emptyForm,
    ...initial,
    creditLimit: initial.creditLimit ?? '',
    statementDay: initial.statementDay ?? '',
    dueDay: initial.dueDay ?? '',
    dailyLimit: initial.dailyLimit ?? '',
    atmLimit: initial.atmLimit ?? '',
    pointsBalance: initial.pointsBalance ?? '',
    pointsValue: initial.pointsValue ?? '',
    nickname: initial.nickname ?? '',
    holder: initial.holder ?? '',
    linkedAccountNumber: initial.linkedAccountNumber ?? '',
    pointsLabel: initial.pointsLabel ?? '',
    notes: initial.notes ?? '',
  };
}

/**
 * Add or edit a card. Pass `initial` (a card from the API) to edit it.
 */
export default function CardFormModal({ initial = null, onClose, onSaved, open = true }) {
  const formId = useId();
  // Phones: one column with short fields paired, and no autofocus (the
  // keyboard would cover the sheet as it opens).
  const isMobile = useIsCompact();
  const [form, setForm] = useState(() => toForm(initial));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (initial) setForm(toForm(initial));
  }, [initial]);

  const setValue = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((errs) => (errs[k] ? { ...errs, [k]: undefined } : errs));
  };
  const set = (k) => (e) => setValue(k, e?.target ? e.target.value : e);

  // Linked account: a bank account picked by its holder's name, or typed.
  // Typed text that finds an account ("HDFC Savings ••4221") shows as that
  // account, and is saved as typed until another is picked; text that finds
  // none stays a choice of its own.
  const accountNames = useAccountNames();
  const linkedText = String(form.linkedAccountNumber ?? '').trim();
  const linkedMatch = linkedAccountMatch(linkedText, accountNames);
  const linkedAccountOptions = useMemo(() => {
    const options = accountChoices(accountNames).filter((o) => accountLast4(o.value));
    if (linkedText && !linkedMatch) options.unshift({ label: linkedText, value: linkedText });
    return options;
  }, [accountNames, linkedText, linkedMatch]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        kind: form.kind,
        bank: form.bank,
        network: form.network,
        name: form.name.trim(),
        nickname: form.nickname.trim() || null,
        last4: form.last4.trim(),
        expiryMonth: Number(form.expiryMonth),
        expiryYear: Number(form.expiryYear),
        holder: form.holder.trim() || null,
        palette: form.palette,
        isPrimary: !!form.isPrimary,
        notes: form.notes.trim() || null,
      };
      if (form.kind === 'credit') {
        payload.creditLimit = form.creditLimit === '' ? null : Number(form.creditLimit);
        payload.statementDay = form.statementDay === '' ? null : Number(form.statementDay);
        payload.dueDay = form.dueDay === '' ? null : Number(form.dueDay);
        payload.pointsLabel = form.pointsLabel.trim() || null;
        payload.pointsBalance = form.pointsBalance === '' ? 0 : Number(form.pointsBalance);
        payload.pointsValue = form.pointsValue === '' ? 0 : Number(form.pointsValue);
      } else {
        payload.linkedAccountNumber = String(form.linkedAccountNumber ?? '').trim() || null;
        payload.dailyLimit = form.dailyLimit === '' ? null : Number(form.dailyLimit);
        payload.atmLimit = form.atmLimit === '' ? null : Number(form.atmLimit);
      }
      const saved = initial?.id ? await updateCard(initial.id, payload) : await createCard(payload);
      // A new card or a changed statement day moves what is due for import.
      refreshImportSchedule();
      toast.success(initial?.id ? 'Card updated' : 'Card added');
      onSaved?.(saved);
    } catch (err) {
      setError(err.message || 'Failed to save card');
    } finally {
      setSubmitting(false);
    }
  };

  const isCredit = form.kind === 'credit';
  const fe = fieldErrors;

  // Each field once; the desktop and phone layouts below place them.
  const f = {
    bank: <FormControl type="select" label="Bank" options={BANK_OPTIONS} value={form.bank} onChange={set('bank')} />,
    network: (
      <FormControl
        type="select"
        label="Network"
        options={NETWORK_OPTIONS}
        value={form.network}
        onChange={set('network')}
      />
    ),
    name: (
      <FormControl
        label="Card name"
        required
        value={form.name}
        onChange={set('name')}
        maxLength={120}
        placeholder="Infinia Metal"
        error={fe.name}
        autoFocus={!initial && !isMobile}
      />
    ),
    nickname: (
      <FormControl
        label="Nickname"
        value={form.nickname}
        onChange={set('nickname')}
        maxLength={120}
        placeholder="HDFC Infinia"
        description="Shown instead of the card name"
      />
    ),
    last4: (
      <FormControl
        label="Last 4 digits"
        required
        value={form.last4}
        onChange={set('last4')}
        maxLength={4}
        inputMode="numeric"
        placeholder="4892"
        error={fe.last4}
      />
    ),
    holder: (
      <FormControl
        label="Cardholder"
        value={form.holder}
        onChange={set('holder')}
        maxLength={120}
        placeholder="Name on the card"
      />
    ),
    expiryMonth: (
      <FormControl
        type="number"
        label="Expiry month"
        required
        value={form.expiryMonth}
        onChange={set('expiryMonth')}
        min="1"
        max="12"
        placeholder="MM"
        error={fe.expiryMonth}
      />
    ),
    expiryYear: (
      <FormControl
        type="number"
        label="Expiry year"
        required
        value={form.expiryYear}
        onChange={set('expiryYear')}
        min="2000"
        max="2100"
        placeholder="YYYY"
        error={fe.expiryYear}
      />
    ),
    creditLimit: (
      <FormControl
        type="number"
        label="Credit limit"
        value={form.creditLimit}
        onChange={set('creditLimit')}
        min="0"
        placeholder="800000"
        prefix={rupee}
        error={fe.creditLimit}
      />
    ),
    statementDay: (
      <FormControl
        type="number"
        label="Statement day"
        value={form.statementDay}
        onChange={set('statementDay')}
        min="1"
        max="31"
        placeholder="25"
        error={fe.statementDay}
      />
    ),
    dueDay: (
      <FormControl
        type="number"
        label="Due day"
        value={form.dueDay}
        onChange={set('dueDay')}
        min="1"
        max="31"
        placeholder="14"
        error={fe.dueDay}
      />
    ),
    pointsLabel: (
      <FormControl
        label="Rewards name"
        value={form.pointsLabel}
        onChange={set('pointsLabel')}
        maxLength={80}
        placeholder="Reward points"
      />
    ),
    pointsBalance: (
      <FormControl
        type="number"
        label="Balance"
        value={form.pointsBalance}
        onChange={set('pointsBalance')}
        min="0"
        placeholder="0"
        error={fe.pointsBalance}
      />
    ),
    pointsValue: (
      <FormControl
        type="number"
        label="Value"
        value={form.pointsValue}
        onChange={set('pointsValue')}
        min="0"
        placeholder="0"
        prefix={rupee}
        error={fe.pointsValue}
      />
    ),
    linkedAccount: (
      <FormControl
        type="combobox"
        label="Linked account"
        options={linkedAccountOptions}
        value={linkedMatch || linkedText || null}
        onChange={(value) => setValue('linkedAccountNumber', value ?? '')}
        onCreate={(query) => setValue('linkedAccountNumber', query.trim().slice(0, 50))}
        createLabel={(query) => `Use “${query.trim().slice(0, 50)}”`}
        placeholder="Not set"
        searchPlaceholder="Search accounts or type one"
        clearable
      />
    ),
    dailyLimit: (
      <FormControl
        type="number"
        label="Daily limit"
        value={form.dailyLimit}
        onChange={set('dailyLimit')}
        min="0"
        placeholder="100000"
        prefix={rupee}
        error={fe.dailyLimit}
      />
    ),
    atmLimit: (
      <FormControl
        type="number"
        label="ATM limit"
        value={form.atmLimit}
        onChange={set('atmLimit')}
        min="0"
        placeholder="25000"
        prefix={rupee}
        error={fe.atmLimit}
      />
    ),
  };

  const kindField = (
    <div className="cardform__field">
      <FormLabel as="div" label="Type" />
      <TabButtons
        aria-label="Card type"
        options={KIND_OPTIONS}
        value={form.kind}
        onChange={(v) => setValue('kind', v)}
        fluid={isMobile || undefined}
      />
    </div>
  );

  const colourField = (
    <div className="cardform__field">
      <FormLabel as="div" label="Colour" labelId={`${formId}-colour`} />
      <div className="cardform__swatches" role="radiogroup" aria-labelledby={`${formId}-colour`}>
        {PALETTE_OPTIONS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={form.palette === p.value}
            aria-label={p.label}
            title={p.label}
            className="cardform__swatch"
            onClick={() => setValue('palette', p.value)}
          >
            <CardMark palette={p.value} />
          </button>
        ))}
      </div>
    </div>
  );

  const notesSection = (
    <div className="cardform__section">
      <FormControl
        type="textarea"
        label="Notes"
        value={form.notes}
        onChange={set('notes')}
        maxLength={2000}
        rows={2}
      />
      <Checkbox
        label="Primary card"
        description="Listed first on Cards"
        checked={!!form.isPrimary}
        onChange={(e) => setValue('isPrimary', e.target.checked)}
      />
    </div>
  );

  // Phones: what the card says first (name, bank, number, expiry), short
  // fields paired, the long ones on their own row.
  const phoneFields = (
    <>
      <div className="cardform__section">
        {kindField}
        {f.name}
        {f.nickname}
        <div className="cardform__grid cardform__grid--keep">
          {f.bank}
          {f.network}
        </div>
        <div className="cardform__grid cardform__grid--phone3">
          {f.last4}
          {f.expiryMonth}
          {f.expiryYear}
        </div>
        {f.holder}
        {colourField}
      </div>

      {isCredit ? (
        <>
          <div className="cardform__section">
            <h4 className="cardform__heading">Billing</h4>
            {f.creditLimit}
            <div className="cardform__grid cardform__grid--keep">
              {f.statementDay}
              {f.dueDay}
            </div>
          </div>
          <div className="cardform__section">
            <h4 className="cardform__heading">Rewards</h4>
            {f.pointsLabel}
            <div className="cardform__grid cardform__grid--keep">
              {f.pointsBalance}
              {f.pointsValue}
            </div>
          </div>
        </>
      ) : (
        <div className="cardform__section">
          <h4 className="cardform__heading">Account and limits</h4>
          {f.linkedAccount}
          <div className="cardform__grid cardform__grid--keep">
            {f.dailyLimit}
            {f.atmLimit}
          </div>
        </div>
      )}

      {notesSection}
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      title={initial ? 'Edit card' : 'Add card'}
      actions={[
        { label: 'Cancel', onClick: () => onClose?.() },
        {
          label: initial ? 'Save changes' : 'Add card',
          variant: 'solid',
          type: 'submit',
          form: formId,
          loading: submitting,
        },
      ]}
    >
      <form id={formId} className="cardform" onSubmit={submit} noValidate>
        {/* Live preview: the card updates as the fields are filled in. */}
        <div className="cardform__preview">
          <CardFace
            card={{
              ...form,
              last4: form.last4.trim(),
              holder: form.holder.trim(),
              name: form.name?.trim(),
              expiryYear: String(form.expiryYear || '').length === 4 ? form.expiryYear : '',
            }}
          />
        </div>
        {isMobile ? phoneFields : (
          <>
            <div className="cardform__section">
              {kindField}

              <div className="cardform__grid">
                {f.bank}
                {f.network}
                {f.name}
                {f.nickname}
                {f.last4}
                {f.holder}
              </div>

              <div className="cardform__grid cardform__grid--keep">
                {f.expiryMonth}
                {f.expiryYear}
              </div>

              {colourField}
            </div>

            {isCredit ? (
              <>
                <div className="cardform__section">
                  <h4 className="cardform__heading">Billing</h4>
                  <div className="cardform__grid cardform__grid--3">
                    {f.creditLimit}
                    {f.statementDay}
                    {f.dueDay}
                  </div>
                </div>
                <div className="cardform__section">
                  <h4 className="cardform__heading">Rewards</h4>
                  <div className="cardform__grid cardform__grid--3">
                    {f.pointsLabel}
                    {f.pointsBalance}
                    {f.pointsValue}
                  </div>
                </div>
              </>
            ) : (
              <div className="cardform__section">
                <h4 className="cardform__heading">Account and limits</h4>
                {f.linkedAccount}
                <div className="cardform__grid">
                  {f.dailyLimit}
                  {f.atmLimit}
                </div>
              </div>
            )}

            {notesSection}
          </>
        )}

        <ErrorMessage message={error} />
      </form>
    </Dialog>
  );
}
