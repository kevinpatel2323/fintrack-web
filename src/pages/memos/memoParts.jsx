import {
  Banknote, CreditCard, Landmark, MessageSquareText, Receipt, Repeat, Smartphone,
} from 'lucide-react';
import { Amount, Badge } from '../../components/ui';
import { memoAmount } from './memoModel.js';

const CHANNEL_ICONS = {
  upi: Smartphone,
  card: CreditCard,
  atm: Banknote,
  charge: Receipt,
  mandate: Repeat,
  imps: Landmark,
  neft: Landmark,
  rtgs: Landmark,
  netbanking: Landmark,
};

/**
 * The leading tile of a memo (phone rows, the record's summary): how the
 * money moved, as a gray square with a 16px icon — the memo's stand-in for a
 * category tile.
 */
export function MemoTile({ memo, size = 32 }) {
  const Icon = CHANNEL_ICONS[memo?.channel] || MessageSquareText;
  return (
    <span className={`memos-tile memos-tile--${size}`} aria-hidden="true">
      <Icon size={size >= 40 ? 20 : 16} strokeWidth={1.5} />
    </span>
  );
}

/**
 * The memo's amount through the kit `Amount` (−₹67 ink, +₹6,265 green, plain
 * with no direction); a currency other than rupees prints with its code.
 */
export function MemoAmount({ memo, className }) {
  const amount = memoAmount(memo);
  const currency = typeof memo?.currency === 'string' ? memo.currency.trim().toUpperCase() : '';
  if (amount.value != null && currency && currency !== 'INR') {
    const sign = amount.sign === 'always' ? (amount.value < 0 ? '−' : '+') : '';
    return (
      <span className={`tabular-nums ${className || ''}`.trim()}>
        {sign}
        {currency}{' '}
        {Math.abs(amount.value).toLocaleString('en-IN', {
          minimumFractionDigits: amount.decimals,
          maximumFractionDigits: 2,
        })}
      </span>
    );
  }
  return (
    <Amount
      className={className}
      value={amount.value}
      sign={amount.sign}
      tone={amount.tone}
      decimals={amount.decimals}
    />
  );
}

/**
 * "Unverified" when the SMS sender isn't a bank's known sender id; small next
 * to a row's title, as the ledger's title badges are.
 */
export function UnverifiedBadge({ size = 'sm' }) {
  return <Badge theme="amber" size={size} label="Unverified" title="The SMS sender could not be verified as a bank" />;
}
