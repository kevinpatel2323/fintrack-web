import { useNavigate } from 'react-router-dom';
import BaseWidget from '../BaseWidget';
import './FriendBalancesWidget.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function FriendBalancesWidget({ data, loading, error }) {
  const navigate = useNavigate();
  if (loading || error) {
    return <BaseWidget title="Friend Balances" loading={loading} error={error} />;
  }

  if (!data || data.length === 0) {
    return (
      <BaseWidget title="Friend Balances">
        <div className="friend-balances-empty">
          <p className="empty">All settled up! 🎉</p>
        </div>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget title="Friend Balances">
      <div className="friend-balances-list">
        {data.map((balance) => (
          <div 
            key={balance.friendId} 
            className="friend-balance-item clickable"
            onClick={() => navigate(`/friends/${balance.friendId}`)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate(`/friends/${balance.friendId}`);
              }
            }}
          >
            <div className="friend-info">
              <span className="friend-name">{balance.friendName}</span>
              {balance.lastTransactionDate && (
                <span className="friend-last-date">
                  Last: {new Date(balance.lastTransactionDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </div>
            <div className={`balance-amount ${balance.netBalance >= 0 ? 'owes-me' : 'i-owe'}`}>
              <span className="balance-label">
                {balance.netBalance >= 0 ? 'Owes you' : 'You owe'}
              </span>
              <span className="balance-value">
                {formatCurrency(Math.abs(balance.netBalance))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </BaseWidget>
  );
}
