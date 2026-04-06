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
  categories,
  onAssignCategory,
  categoryStatus,
  /** When true, card is display-only (no expand toggle) — e.g. Friends tagged list */
  nonInteractive = false,
  /** Accessible name when nonInteractive (defaults to generic label) */
  cardAriaLabel,
  /** Hide running balance line (e.g. Friends tagged transactions) */
  hideBalance = false,
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

  const showCategory = Array.isArray(categories) && typeof onAssignCategory === 'function';
  const categoryBusy = categoryStatus === 'Saving…';
  const categoryTitle = row.category
    ? `${row.category.icon ? `${row.category.icon} ` : ''}${row.category.name}`
    : 'None';

  function handleKeyDown(e) {
    if (nonInteractive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleExpand();
    }
  }

  function stopCardToggle(e) {
    e.stopPropagation();
  }

  return (
    <article
      className={`mobile-txn-card glass-panel ${isWithdrawal ? 'mobile-txn-card--out' : 'mobile-txn-card--in'}`}
    >
      <div
        className={`mobile-txn-card__clickable${nonInteractive ? ' mobile-txn-card__clickable--static' : ''}`}
        role={nonInteractive ? 'group' : 'button'}
        tabIndex={nonInteractive ? undefined : 0}
        onClick={nonInteractive ? undefined : onToggleExpand}
        onKeyDown={nonInteractive ? undefined : handleKeyDown}
        aria-expanded={nonInteractive ? undefined : expanded}
        aria-label={
          nonInteractive
            ? cardAriaLabel || 'Transaction'
            : expanded
              ? 'Collapse friend tags for this transaction'
              : 'Expand friend tags for this transaction'
        }
      >
        <div className="mobile-txn-card__accent" aria-hidden />
        <div className="mobile-txn-card__shell">
          <div className="mobile-txn-card__left">
            <p className="mobile-txn-card__meta">
              <time dateTime={row.transactionDate}>{formatDateCompact(row.transactionDate)}</time>
              <span className="mobile-txn-card__meta-sep">·</span>
              <span>{counterpartyHint(row)}</span>
            </p>
            <h3 className="mobile-txn-card__title">{title}</h3>
            <p className="mobile-txn-card__account">{maskAccount(row.accountNumber)}</p>
            {row.isManual && <span className="mobile-txn-card__badge-manual">Manual</span>}
            {descLine ? <p className="mobile-txn-card__desc">{descLine}</p> : null}
          </div>
          <div className="mobile-txn-card__right">
            <div className="mobile-txn-card__amounts">
              <span className={`mobile-txn-card__amount ${isWithdrawal ? 'is-out' : 'is-in'}`}>
                {isWithdrawal ? '−' : '+'}
                {formatNumber(amount)}
              </span>
              {!hideBalance ? (
                <span className="mobile-txn-card__balance">Bal {formatNumber(row.balance)}</span>
              ) : null}
            </div>
            {showCategory ? (
              <div
                className="mobile-txn-card__category"
                onClick={stopCardToggle}
                onPointerDown={stopCardToggle}
                role="presentation"
              >
                <select
                  className={`mobile-txn-card__category-select${row.categoryId == null ? ' mobile-txn-card__category-select--empty' : ''}`}
                  value={row.categoryId != null ? String(row.categoryId) : ''}
                  onChange={(e) => onAssignCategory(row.id, e.target.value)}
                  aria-label={`Category for ${title}`}
                  title={categoryTitle}
                  disabled={categoryBusy}
                  onClick={stopCardToggle}
                  onPointerDown={stopCardToggle}
                >
                  <option value="">None</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}
                      {cat.name}
                    </option>
                  ))}
                </select>
                {categoryStatus ? (
                  <span className="mobile-txn-card__category-status">{categoryStatus}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {expanded ? <div className="mobile-txn-card__expanded">{children}</div> : null}
    </article>
  );
}
