import { useNavigate } from 'react-router-dom';
import BaseWidget from '../BaseWidget';
import './AccountSummaryWidget.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function AccountSummaryWidget({ data, loading, error }) {
  const navigate = useNavigate();
  if (loading || error) {
    return <BaseWidget title="Account Summary" loading={loading} error={error} />;
  }

  if (!data || data.length === 0) {
    return (
      <BaseWidget title="Account Summary">
        <p className="empty">No accounts found</p>
      </BaseWidget>
    );
  }

  const totalBalance = data.reduce((sum, account) => sum + account.currentBalance, 0);

  const handleAccountClick = (account) => {
    const params = new URLSearchParams({
      account: account.accountNumber,
    });
    navigate(`/transactions?${params.toString()}`);
  };

  return (
    <BaseWidget title="Account Summary">
      <div className="account-summary">
        <div className="accounts-list">
          {data.map((account) => (
            <div 
              key={account.accountId} 
              className="account-item clickable"
              onClick={() => handleAccountClick(account)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleAccountClick(account);
                }
              }}
            >
              <div className="account-info">
                <div className="account-number">{account.accountNumber}</div>
                <div className="account-meta">
                  <span>{account.transactionCount} transactions</span>
                  {account.lastTransactionDate && (
                    <span>Last: {formatDate(account.lastTransactionDate)}</span>
                  )}
                </div>
              </div>
              <div className="account-balance">
                {formatCurrency(account.currentBalance)}
              </div>
            </div>
          ))}
        </div>
        
        <div className="total-balance">
          <span>Total Balance</span>
          <strong>{formatCurrency(totalBalance)}</strong>
        </div>
      </div>
    </BaseWidget>
  );
}
