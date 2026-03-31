import BaseWidget from '../BaseWidget';
import './IncomeVsExpensesWidget.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function IncomeVsExpensesWidget({ data, loading, error }) {
  if (loading || error) {
    return <BaseWidget title="Income vs Expenses" loading={loading} error={error} />;
  }

  if (!data) {
    return (
      <BaseWidget title="Income vs Expenses">
        <p className="empty">No data available</p>
      </BaseWidget>
    );
  }

  const isSaving = data.netSavings >= 0;

  return (
    <BaseWidget title="Income vs Expenses">
      <div className="income-vs-expenses">
        <div className="comparison-bars">
          <div className="comparison-item income">
            <div className="comparison-label">Income</div>
            <div className="comparison-bar">
              <div
                className="comparison-bar-fill income-fill"
                style={{ width: '100%' }}
              />
            </div>
            <div className="comparison-value">{formatCurrency(data.totalIncome)}</div>
          </div>
          
          <div className="comparison-item expenses">
            <div className="comparison-label">Expenses</div>
            <div className="comparison-bar">
              <div
                className="comparison-bar-fill expenses-fill"
                style={{ width: `${data.expensesPercentage}%` }}
              />
            </div>
            <div className="comparison-value">{formatCurrency(data.totalExpenses)}</div>
          </div>
        </div>

        <div className={`net-savings ${isSaving ? 'positive' : 'negative'}`}>
          <div className="savings-label">
            {isSaving ? 'Net Savings' : 'Net Deficit'}
          </div>
          <div className="savings-value">
            {isSaving ? '+' : ''}{formatCurrency(data.netSavings)}
          </div>
          {data.totalIncome > 0 && (
            <div className="savings-rate">
              {data.savingsRate.toFixed(1)}% savings rate
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
