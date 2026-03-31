import { Link } from 'react-router-dom';
import BaseWidget from '../BaseWidget';
import './RecentTransactionsWidget.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export default function RecentTransactionsWidget({ data, loading, error, limit = 10 }) {
  if (loading || error) {
    return <BaseWidget title="Recent Transactions" loading={loading} error={error} />;
  }

  if (!data || data.length === 0) {
    return (
      <BaseWidget title="Recent Transactions">
        <p className="empty">No recent transactions</p>
      </BaseWidget>
    );
  }

  const transactions = data.slice(0, limit);

  return (
    <BaseWidget title="Recent Transactions">
      <div className="recent-transactions">
        <div className="transactions-list">
          {transactions.map((txn) => {
            const isWithdrawal = txn.withdrawal > 0;
            const amount = isWithdrawal ? txn.withdrawal : txn.deposit;
            
            return (
              <div key={txn.id} className="transaction-item">
                <div className="transaction-date">{formatDate(txn.transactionDate)}</div>
                <div className="transaction-details">
                  <div className="transaction-narration" title={txn.narration}>
                    {txn.narration || 'No description'}
                  </div>
                  <div className="transaction-account">{txn.accountNumber}</div>
                </div>
                <div className={`transaction-amount ${isWithdrawal ? 'withdrawal' : 'deposit'}`}>
                  {isWithdrawal ? '-' : '+'}
                  {formatCurrency(amount)}
                </div>
              </div>
            );
          })}
        </div>
        <Link to="/transactions" className="view-all-link">
          View All Transactions →
        </Link>
      </div>
    </BaseWidget>
  );
}
