import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, RotateCw, Trash2 } from 'lucide-react';
import {
  Amount, Badge, Button, ConfirmDialog, ErrorMessage, FormControl, Sheet, Skeleton, toast,
} from '../../components/ui';
import { deleteMemo, fetchMemo, reparseMemo } from '../../services/memosApi.js';
import {
  CHANNELS, MEMO_MAX_LENGTH, fmtMemoTime, fmtRelative, fmtTxnDate, mapLink, memoAccount, memoAmount,
  memoPayee, memoTime, normaliseMemo, parseStatusOf,
} from './memoModel.js';

const muted = (value = '—') => <span className="memos-field__empty">{value}</span>;

function Field({ label, children }) {
  return (
    <div className="memos-field">
      <dt className="memos-field__label">{label}</dt>
      <dd className="memos-field__value">{children}</dd>
    </div>
  );
}

/** The amount as the bank sent it; a currency other than rupees prints as its code. */
function AmountValue({ memo }) {
  const amount = memoAmount(memo);
  if (amount.value == null) return muted();
  const currency = typeof memo.currency === 'string' ? memo.currency.trim().toUpperCase() : '';
  if (currency && currency !== 'INR') {
    const sign = amount.sign === 'always' ? (amount.value < 0 ? '−' : '+') : '';
    return (
      <span className="tabular-nums">
        {sign}
        {currency} {Math.abs(amount.value).toLocaleString('en-IN', { minimumFractionDigits: amount.decimals, maximumFractionDigits: 2 })}
      </span>
    );
  }
  return <Amount value={amount.value} sign={amount.sign} tone={amount.tone} decimals={amount.decimals} />;
}

/**
 * One captured SMS (side panel on desktop, bottom sheet on phones): the memo
 * to write or edit, the message exactly as it arrived, what was read from it,
 * and Re-parse / Delete. The list row shows at once; the message text,
 * location and parse error load when the sheet opens.
 */
export default function MemoSheet({ open, row, onClose, onSaveMemo, onUpdated, onDeleted }) {
  const id = row?.id;
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [loadKey, setLoadKey] = useState(0);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !id) return undefined;
    const ctrl = new AbortController();
    setDetail(null);
    setDetailError('');
    fetchMemo(id, { signal: ctrl.signal })
      .then((data) => setDetail(data))
      .catch((e) => {
        if (e.name !== 'AbortError') setDetailError(e.message || 'Could not load the message');
      });
    return () => ctrl.abort();
  }, [open, id, loadKey]);

  // Each time a row opens, the memo box starts from its saved memo.
  useEffect(() => {
    if (open) setDraft(row?.memo ?? '');
  }, [open, id]);

  if (!row) return null;
  const memo = detail && detail.id === id ? { ...row, ...detail } : row;
  const dirty = normaliseMemo(draft) !== normaliseMemo(memo.memo);
  const account = memoAccount(memo);
  const status = parseStatusOf(memo.parseStatus);
  const loadingDetail = !detail && !detailError;
  const map = detail ? mapLink(detail.location) : null;

  async function saveMemo() {
    setSaving(true);
    try {
      const updated = await onSaveMemo(memo, normaliseMemo(draft));
      if (updated) {
        setDetail((d) => (d && d.id === updated.id ? { ...d, ...updated } : d));
        setDraft(updated.memo ?? '');
      }
    } catch {
      // The page showed the error; the typed memo stays in the box.
    } finally {
      setSaving(false);
    }
  }

  async function reparse() {
    setReparsing(true);
    try {
      const next = await reparseMemo(id);
      setDetail(next);
      setDetailError('');
      onUpdated(next);
      toast.success({ title: 'Message re-parsed', description: parseStatusOf(next?.parseStatus).label });
    } catch (e) {
      toast.error({ title: 'Could not re-parse the message', description: e.message });
    } finally {
      setReparsing(false);
    }
  }

  async function remove() {
    await deleteMemo(id);
    setConfirmDelete(false);
    onDeleted(id);
  }

  const description = (
    <span className="memos-sheet__summary">
      <AmountValue memo={memo} />
      <span>{fmtMemoTime(memoTime(memo))}</span>
      {account && <span>{account}</span>}
    </span>
  );

  let message;
  if (loadingDetail) {
    message = (
      <div className="memos-sms memos-sms--loading" aria-busy="true">
        <Skeleton height={12} width="92%" />
        <Skeleton height={12} width="80%" />
        <Skeleton height={12} width="54%" />
      </div>
    );
  } else if (detailError) {
    message = (
      <div className="memos-sheet__error">
        <ErrorMessage message={detailError} />
        <Button label="Try again" onClick={() => setLoadKey((k) => k + 1)} />
      </div>
    );
  } else if (detail.rawMessage) {
    // Text only: the SMS is shown exactly as it arrived, never as markup.
    message = <pre className="memos-sms">{detail.rawMessage}</pre>;
  } else {
    message = <p className="memos-sheet__note">No message text was stored for this row.</p>;
  }

  const direction = memo.direction === 'debit' ? 'Debit (money out)' : memo.direction === 'credit' ? 'Credit (money in)' : null;
  const instrument = memo.instrument === 'card' ? 'Card' : memo.instrument === 'account' ? 'Bank account' : null;

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        side="auto"
        title={memoPayee(memo)}
        description={description}
        bodyClassName="memos-sheet"
        footer={(
          <>
            <Button theme="red" iconLeft={Trash2} label="Delete" onClick={() => setConfirmDelete(true)} />
            <Button iconLeft={RotateCw} label="Re-parse" loading={reparsing} onClick={reparse} />
          </>
        )}
      >
        <section className="memos-sheet__section" aria-label="Memo">
          <FormControl
            type="textarea"
            label="Memo"
            rows={3}
            maxLength={MEMO_MAX_LENGTH}
            placeholder="What was this for?"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            description={memo.memoAt ? `Written ${fmtRelative(memo.memoAt)}` : undefined}
          />
          <div className="memos-sheet__memo-actions">
            <Button variant="solid" label="Save memo" loading={saving} disabled={!dirty} onClick={saveMemo} />
          </div>
        </section>

        <section className="memos-sheet__section" aria-labelledby="memos-sheet-message">
          <h3 id="memos-sheet-message" className="memos-sheet__heading">Message</h3>
          {message}
        </section>

        <section className="memos-sheet__section" aria-labelledby="memos-sheet-details">
          <h3 id="memos-sheet-details" className="memos-sheet__heading">What was read</h3>
          <dl className="memos-fields">
            <Field label="Amount"><AmountValue memo={memo} /></Field>
            <Field label="Direction">{direction || muted()}</Field>
            <Field label="Channel">{CHANNELS[memo.channel] || memo.channel || muted()}</Field>
            <Field label="Account">
              {account || instrument ? [account, instrument].filter(Boolean).join(' · ') : muted()}
              {memo.cardId && (
                <>
                  {' · '}
                  <Link className="memos-link" to={`/cards/${encodeURIComponent(memo.cardId)}`}>Open card</Link>
                </>
              )}
            </Field>
            <Field label="Merchant">{memo.merchant || muted()}</Field>
            <Field label="UPI ID">{memo.vpa || muted()}</Field>
            <Field label="Reference">
              {memo.reference ? <span className="memos-field__mono">{memo.reference}</span> : muted()}
            </Field>
            <Field label="Bank's date">{fmtTxnDate(memo.txnDate) || muted()}</Field>
            <Field label="Sender">
              <span className="memos-field__inline">
                {memo.sender || muted('Unknown')}
                {memo.senderVerified === false && <Badge size="sm" theme="amber" label="Unverified" />}
                {memo.senderVerified === true && <Badge size="sm" theme="green" label="Verified" />}
              </span>
            </Field>
            <Field label="Received">{fmtMemoTime(memo.receivedAt)}</Field>
            {memo.capturedAt && <Field label="Captured">{fmtMemoTime(memo.capturedAt)}</Field>}
            <Field label="Location">
              {map ? (
                <a className="memos-link memos-field__inline" href={map} target="_blank" rel="noopener noreferrer">
                  <MapPin size={14} strokeWidth={1.5} aria-hidden />
                  View on map
                </a>
              ) : (
                muted(loadingDetail ? '…' : 'Not recorded')
              )}
            </Field>
            <Field label="Parse status">
              <Badge size="sm" theme={status.theme} label={status.label} />
            </Field>
            {detail?.parseError && (
              <Field label="Parse error">
                <span className="memos-field__error">{detail.parseError}</span>
              </Field>
            )}
          </dl>
        </section>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this message?"
        message="The SMS, what was read from it and its memo are removed from Fintrack. This can't be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
