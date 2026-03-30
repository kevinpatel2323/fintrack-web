import './MobileTransactionCard.css';

function maskAccount(accountNumber) {
  const s = String(accountNumber || '').trim();
  if (!s) return '—';
  if (s.length <= 8) return s;
  return `…${s.slice(-4)}`;
}

function counterpartyHint(row) {
  if (row.isManual) return 'Manual';
  const bank = (row.upiBank || '').trim();
  if (bank) return bank.length > 18 ? `${bank.slice(0, 16)}…` : bank;
  const desc = (row.upiDescription || '').trim();
  if (!desc) return 'UPI';
  const at = desc.split('@')[0];
  return at.length > 16 ? `${at.slice(0, 14)}…` : at;
}

export default function MobileTransactionCard({
  row,
  expanded,
  onToggleExpand,
  formatDateCompact,
  formatNumber,
  children,
}) {
  const withdrawal = Number(row.withdrawal || 0);
  const deposit = Number(row.deposit || 0);
  const isWithdrawal = withdrawal > 0;
  const amount = withdrawal > 0 ? withdrawal : deposit;

  const title =
    (row.upiName && String(row.upiName).trim()) ||
    (row.isManual ? (row.narration || '').trim() : '') ||
    'Transaction';

  const descLine = row.isManual
    ? [row.upiDescription, row.upiBank].filter(Boolean).join(' · ')
    : row.upiDescription || '';

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleExpand();
    }
  }

  return (
    <article
      className={`mobile-txn-card glass-panel ${isWithdrawal ? 'mobile-txn-card--out' : 'mobile-txn-card--in'}`}
    >
      <div
        className="mobile-txn-card__clickable"
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? 'Collapse friend tags for this transaction'
            : 'Expand friend tags for this transaction'
        }
      >
        <div className="mobile-txn-card__accent" aria-hidden />
        <div className="mobile-txn-card__shell">
          <div className="mobile-txn-card__top">
            <div className="mobile-txn-card__main">
              <p className="mobile-txn-card__meta">
                <time dateTime={row.transactionDate}>{formatDateCompact(row.transactionDate)}</time>
                <span className="mobile-txn-card__meta-sep">·</span>
                <span>{counterpartyHint(row)}</span>
              </p>
              <h3 className="mobile-txn-card__title">{title}</h3>
              <p className="mobile-txn-card__account">{maskAccount(row.accountNumber)}</p>
              {row.isManual && (
                <span className="mobile-txn-card__badge-manual">Manual</span>
              )}
            </div>
            <div className="mobile-txn-card__amounts">
              <span
                className={`mobile-txn-card__amount ${isWithdrawal ? 'is-out' : 'is-in'}`}
              >
                {isWithdrawal ? '−' : '+'}
                {formatNumber(amount)}
              </span>
              <span className="mobile-txn-card__balance">
                Bal {formatNumber(row.balance)}
              </span>
            </div>
          </div>
          {descLine ? <p className="mobile-txn-card__desc">{descLine}</p> : null}
        </div>
      </div>
      {expanded ? <div className="mobile-txn-card__expanded">{children}</div> : null}
    </article>
  );
}
