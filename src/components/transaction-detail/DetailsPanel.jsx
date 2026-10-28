import { useMemo } from 'react';
import { Amount, Card, Combobox, MobileField, MobileList, Spinner } from '../ui';
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
 * The facts the details show, worked out once for the desktop panel and the
 * phone list: the note, how it was paid, the raw statement line and the UPI
 * name when the title doesn't already show them, and the running balance.
 */
export function txnDetailFacts(tx, title) {
  const note = tx.upiDescription || tx.narration || '—';
  const method = tx.upiBank ? `UPI · ${tx.upiBank}` : tx.isManual ? 'Manual' : 'Bank';
  // The raw statement line, when the title and note don't already show it.
  const narration = tx.narration && tx.narration !== note && tx.narration !== title ? tx.narration : null;
  const upiName = tx.upiName && tx.upiName !== title ? tx.upiName : null;
  const balance = tx.balance === null || tx.balance === undefined || tx.balance === '' ? NaN : Number(tx.balance);
  const showBalance = !tx.isManual && Number.isFinite(balance);
  return { note, method, narration, upiName, balance, showBalance };
}

/**
 * The record's side panel: key fields as label/value rows, Frappe CRM style.
 * Category is the one editable field.
 */
export default function DetailsPanel({ tx, title, categories, onAssignCategory, categorySaving }) {
  const options = useMemo(() => categoryOptions(categories), [categories]);
  const { note, method, narration, upiName, balance, showBalance } = txnDetailFacts(tx, title);

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

/**
 * The same fields on a phone: label/value rows in an inset group. Category
 * is a tappable row that opens a picker sheet, passed in as `leading` (the
 * first row). Long free text (a note, the statement line, a UPI name) stacks
 * under its label, so it wraps across the full width instead of in a narrow
 * right-aligned column.
 */
export function DetailsList({ tx, title, leading }) {
  const { note, method, narration, upiName, balance, showBalance } = txnDetailFacts(tx, title);
  // Short values stay on the label's line; long ones get the full width.
  const fit = (value) => (String(value).length > 24 ? 'txd-m-field--stack' : undefined);
  return (
    <MobileList variant="inset" className="txd-m-details" aria-label="Details">
      {leading}
      <MobileField label="Date">{formatTxnDate(tx.transactionDate)}</MobileField>
      <MobileField label="Note" className={fit(note)}>{note}</MobileField>
      <MobileField label="Method">{method}</MobileField>
      {upiName && <MobileField label="UPI name" className={fit(upiName)}>{upiName}</MobileField>}
      {narration && <MobileField label="Narration" className={fit(narration)}>{narration}</MobileField>}
      <MobileField label="Account" className="txd-m-field--mono">{tx.accountNumber || '—'}</MobileField>
      {showBalance && (
        <MobileField label="Balance">
          <Amount value={balance} decimals={2} tone="inherit" />
        </MobileField>
      )}
      <MobileField label="Reference" className="txd-m-field--mono">{tx.id}</MobileField>
    </MobileList>
  );
}
