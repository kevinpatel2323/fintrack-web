import { useMemo } from 'react';
import { Amount, Card, Combobox, Spinner } from '../ui';
import { categoryOptions } from '../common/Category.jsx';
import { formatTxnDate } from './formatTxnDate.js';

function Field({ label, children, mono = false }) {
  return (
    <div className="txd-field">
      <dt className="txd-field__label">{label}</dt>
      <dd className={`txd-field__value${mono ? ' is-mono' : ''}`}>{children}</dd>
    </div>
  );
}

/**
 * The record's side panel: key fields as label/value rows, Frappe CRM style.
 * Category is the one editable field.
 */
export default function DetailsPanel({ tx, title, categories, onAssignCategory, categorySaving }) {
  const options = useMemo(() => categoryOptions(categories), [categories]);
  const note = tx.upiDescription || tx.narration || '—';
  const method = tx.upiBank ? `UPI · ${tx.upiBank}` : tx.isManual ? 'Manual' : 'Bank';
  // The raw statement line, when the title and note don't already show it.
  const narration = tx.narration && tx.narration !== note && tx.narration !== title ? tx.narration : null;
  const upiName = tx.upiName && tx.upiName !== title ? tx.upiName : null;
  const balance = tx.balance === null || tx.balance === undefined || tx.balance === '' ? NaN : Number(tx.balance);
  const showBalance = !tx.isManual && Number.isFinite(balance);

  return (
    <Card as="aside" title="Details" className="txd-details">
      <dl className="txd-fields">
        <Field label="Date">{formatTxnDate(tx.transactionDate)}</Field>
        <Field label="Category">
          <span className="txd-field__control">
            <Combobox
              className="txd-category"
              variant="ghost"
              options={options}
              value={tx.categoryId != null && tx.categoryId !== '' ? String(tx.categoryId) : null}
              onChange={(value) => onAssignCategory(value ?? '')}
              placeholder="No category"
              searchPlaceholder="Search categories"
              aria-label="Category"
              clearable
              disabled={categorySaving}
            />
            {categorySaving && <Spinner size="sm" aria-label="Saving category" />}
          </span>
        </Field>
        <Field label="Note">{note}</Field>
        <Field label="Method">{method}</Field>
        {upiName && <Field label="UPI name">{upiName}</Field>}
        {narration && <Field label="Narration">{narration}</Field>}
        <Field label="Account" mono>{tx.accountNumber || '—'}</Field>
        {showBalance && (
          <Field label="Balance">
            <Amount value={balance} decimals={2} tone="inherit" />
          </Field>
        )}
        <Field label="Reference" mono>{tx.id}</Field>
      </dl>
    </Card>
  );
}
