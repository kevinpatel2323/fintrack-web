import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import {
  Badge, Button, Card, ErrorMessage, MobileField, MobileList, Skeleton, Textarea,
} from '../../components/ui';
import { MemoAmount } from './memoParts.jsx';
import {
  ENCRYPTED_TEXT, MEMO_MAX_LENGTH, fmtMemoTime, fmtRelative, fmtTxnDate, memoAccount, memoDirection,
  memoLocationState, memoMessageState, memoMethod, memoTime, parseStatusOf,
} from './memoModel.js';

const muted = (value = '—') => <span className="memos-field__empty">{value}</span>;

const INSTRUMENTS = { card: 'Card', account: 'Bank account' };

// Long free text stacks under its label on phones, as on the transaction page.
const isLong = (value) => typeof value === 'string' && value.length > 24;

/**
 * The record's fields, worked out once for the desktop side panel and the
 * phone's Details list: `[{ key, label, value, mono?, long? }]`. `detail` is
 * the loaded record (null while it loads or after `detailError`, which only
 * the location needs);
 * `accountNames` shows a bank account by its holder's name.
 */
export function memoDetailFields(memo, detail, accountNames, { phone = false, detailError = '' } = {}) {
  const account = memoAccount(memo, accountNames);
  const instrument = INSTRUMENTS[memo.instrument] || null;
  const accountText = [account, instrument].filter(Boolean).join(' · ');
  const status = parseStatusOf(memo.parseStatus);
  const location = memoLocationState(detail);
  const badgeSize = phone ? 'md' : 'sm';

  let locationValue;
  if (location.kind === 'loading') locationValue = muted(detailError ? '—' : '…');
  else if (location.kind === 'map') {
    locationValue = (
      <a className="memos-link memos-field__inline" href={location.href} target="_blank" rel="noopener noreferrer">
        <MapPin size={14} strokeWidth={1.5} aria-hidden="true" />
        View on map
      </a>
    );
  } else if (location.kind === 'encrypted') locationValue = muted(ENCRYPTED_TEXT);
  else locationValue = muted('Not recorded');

  const fields = [
    { key: 'amount', label: 'Amount', value: <MemoAmount memo={memo} /> },
    { key: 'direction', label: 'Direction', value: memoDirection(memo) || muted() },
    { key: 'method', label: 'Method', value: memoMethod(memo) || muted() },
    {
      key: 'account',
      label: 'Account',
      long: isLong(accountText),
      value: accountText ? (
        memo.cardId ? (
          <Link className="memos-link" to={`/cards/${encodeURIComponent(memo.cardId)}`}>{accountText}</Link>
        ) : accountText
      ) : muted(),
    },
    { key: 'payee', label: 'Payee', value: memo.merchant || muted(), long: isLong(memo.merchant) },
    { key: 'vpa', label: 'UPI ID', value: memo.vpa || muted(), long: isLong(memo.vpa) },
    { key: 'reference', label: 'Reference', value: memo.reference || muted(), mono: Boolean(memo.reference) },
    { key: 'date', label: 'Date', value: fmtTxnDate(memo.txnDate) || muted() },
    { key: 'received', label: 'Received', value: memoTime(memo) ? fmtMemoTime(memoTime(memo)) : muted() },
    {
      key: 'sender',
      label: 'Sender',
      value: (
        <span className="memos-field__inline">
          {memo.sender || muted('Unknown')}
          {memo.senderVerified === true && <Badge size={badgeSize} theme="green" label="Verified" />}
          {memo.senderVerified === false && <Badge size={badgeSize} theme="amber" label="Unverified" />}
        </span>
      ),
    },
    { key: 'location', label: 'Location', value: locationValue, long: location.kind === 'encrypted' },
    { key: 'parse', label: 'Parse status', value: <Badge size={badgeSize} theme={status.theme} label={status.label} /> },
  ];
  if (detail?.parseError) {
    fields.push({
      key: 'parseError',
      label: 'Parse error',
      value: <span className="memos-field__error">{detail.parseError}</span>,
      long: isLong(detail.parseError),
    });
  }
  return fields;
}

/** The desktop side panel: the fields as label/value rows, Frappe CRM style. */
export function MemoDetailsPanel({ memo, detail, detailError, accountNames }) {
  return (
    <Card as="aside" title="Details" className="memos-details">
      <dl className="memos-fields">
        {memoDetailFields(memo, detail, accountNames, { detailError }).map((f) => (
          <div className="memos-field" key={f.key}>
            <dt className="memos-field__label">{f.label}</dt>
            <dd className={`memos-field__value${f.mono ? ' is-mono' : ''}`}>{f.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** The same fields on a phone: an inset group of label/value rows; long text stacks under its label. */
export function MemoDetailsList({ memo, detail, detailError, accountNames }) {
  return (
    <MobileList variant="inset" className="memos-dm-details" aria-label="Details">
      {memoDetailFields(memo, detail, accountNames, { phone: true, detailError }).map((f) => (
        <MobileField
          key={f.key}
          label={f.label}
          className={[f.mono && 'memos-dm-field--mono', f.long && 'memos-dm-field--stack'].filter(Boolean).join(' ') || undefined}
        >
          {f.value}
        </MobileField>
      ))}
    </MobileList>
  );
}

/**
 * The SMS as it arrived: plain text (`pre-wrap`, never markup), or why it
 * can't be shown — still loading, failed to load, stored encrypted with a key
 * this server doesn't hold, or never stored.
 */
export function MemoMessage({ detail, error, onRetry, phone = false }) {
  if (error) {
    return (
      <div className="memos-message__error">
        <ErrorMessage message={error} />
        <Button size={phone ? 'md' : undefined} label="Try again" onClick={onRetry} />
      </div>
    );
  }
  const state = memoMessageState(detail);
  if (state === 'loading') {
    return (
      <div className="memos-sms memos-sms--loading" aria-busy="true">
        <Skeleton height={12} width="92%" />
        <Skeleton height={12} width="80%" />
        <Skeleton height={12} width="54%" />
      </div>
    );
  }
  if (state === 'text') return <pre className="memos-sms">{detail.rawMessage}</pre>;
  if (state === 'encrypted') return <p className="memos-message__note">{ENCRYPTED_TEXT}.</p>;
  return <p className="memos-message__note">No message text was stored for this memo.</p>;
}

/**
 * The memo box: a textarea, "Written …" under it, and — on desktop — Save on
 * the right (phones put Save in the action bar). ⌘/Ctrl+Enter saves.
 */
export function MemoEditor({ value, onChange, onSave, memoAt, saving, dirty, phone = false }) {
  const written = memoAt ? fmtRelative(memoAt) : null;
  return (
    <div className="memos-editor">
      <Textarea
        className="memos-editor__input"
        size={phone ? 'md' : 'sm'}
        rows={3}
        maxLength={MEMO_MAX_LENGTH}
        placeholder="What was this for?"
        aria-label="Memo"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && dirty && !saving) {
            e.preventDefault();
            onSave();
          }
        }}
      />
      <div className="memos-editor__foot">
        <span className="memos-editor__written">{written ? `Written ${written}` : 'No memo yet'}</span>
        {!phone && <Button variant="solid" label="Save" loading={saving} disabled={!dirty} onClick={onSave} />}
      </div>
    </div>
  );
}
