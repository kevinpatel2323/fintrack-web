import { ledgerDirectionPhrase } from '../utils/ledgerParties.js';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN').format(num);
}

/** Feed MobileTransactionCard: tagged amount with same in/out as the parent txn. */
export function rowForFriendTagCard(tag, fallbackTransaction) {
  const tx = tag.transaction ?? fallbackTransaction;
  if (!tx) return {};
  const w = Number(tx.withdrawal || 0);
  const isW = w > 0;
  const n = Number(tag.amount) || 0;
  return {
    ...tx,
    withdrawal: isW ? n : 0,
    deposit: isW ? 0 : n,
  };
}

export function FriendTagAmountCell({ tag }) {
  const tx = tag.transaction;
  const withdrawal = Number(tx?.withdrawal || 0);
  const isWithdrawal = withdrawal > 0;
  const n = Number(tag.amount) || 0;
  return (
    <strong className={`transaction-amount ${isWithdrawal ? 'amount-withdrawal' : 'amount-deposit'}`}>
      {isWithdrawal ? '-' : '+'}
      {formatNumber(n)}
    </strong>
  );
}

export function FriendTagMobileDetails({ tag, friendName }) {
  const phrase = ledgerDirectionPhrase(tag.direction, friendName);
  const settles =
    tag.settlesTransactions?.length > 0
      ? tag.settlesTransactions.map((s, idx) => (
          <span key={s.id}>
            {idx > 0 ? '; ' : ''}
            {formatDate(s.transaction?.transactionDate)} — {ledgerDirectionPhrase(s.direction, friendName)} — ₹
            {formatNumber(s.amount)}
          </span>
        ))
      : null;
  const settledBy =
    tag.settledBy?.length > 0
      ? tag.settledBy.map((s, idx) => (
          <span key={s.id}>
            {idx > 0 ? '; ' : ''}
            {formatDate(s.transaction?.transactionDate)} — ₹{formatNumber(s.amount)}
          </span>
        ))
      : null;
  return (
    <table className="friend-tag-mini-table">
      <tbody>
        <tr>
          <th scope="row">Direction</th>
          <td>{phrase}</td>
        </tr>
        {tag.note ? (
          <tr>
            <th scope="row">Note</th>
            <td>{tag.note}</td>
          </tr>
        ) : null}
        {settles ? (
          <tr>
            <th scope="row">Settles</th>
            <td>{settles}</td>
          </tr>
        ) : null}
        {settledBy ? (
          <tr>
            <th scope="row">Settled by</th>
            <td>{settledBy}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
