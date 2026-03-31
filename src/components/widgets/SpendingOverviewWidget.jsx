import BaseWidget from '../BaseWidget';
import './SpendingOverviewWidget.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SpendingOverviewWidget({ data, loading, error }) {
  if (loading || error) {
    return <BaseWidget title="Spending Overview" loading={loading} error={error} />;
  }

  if (!data) {
    return <BaseWidget title="Spending Overview"><p className="empty">No data available</p></BaseWidget>;
  }

  return (
    <BaseWidget title="Spending Overview">
      <div className="spending-overview">
        <div className="spending-stats">
          <div className="stat">
            <span className="stat-label">Total Spent</span>
            <span className="stat-value amount-withdrawal">
              {formatCurrency(data.totalSpent)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Total Income</span>
            <span className="stat-value amount-deposit">
              {formatCurrency(data.totalIncome)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Net Change</span>
            <span className={`stat-value ${data.netChange >= 0 ? 'positive' : 'negative'}`}>
              {data.netChange >= 0 ? '+' : ''}{formatCurrency(data.netChange)}
            </span>
          </div>
        </div>
        
        <div className="spending-details">
          <div className="detail-item">
            <span className="detail-label">Transactions</span>
            <span className="detail-value">{data.transactionCount}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Average</span>
            <span className="detail-value">{formatCurrency(data.averageTransaction)}</span>
          </div>
        </div>

        {data.comparisonPeriod && (
          <div className="comparison">
            <span className="comparison-label">vs previous period:</span>
            <span className={`comparison-value ${data.comparisonPeriod.percentageChange >= 0 ? 'increase' : 'decrease'}`}>
              {data.comparisonPeriod.percentageChange >= 0 ? '+' : ''}
              {data.comparisonPeriod.percentageChange.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </BaseWidget>
  );
}
