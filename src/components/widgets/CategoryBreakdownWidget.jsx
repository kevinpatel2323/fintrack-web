import { useNavigate } from 'react-router-dom';
import BaseWidget from '../BaseWidget';
import './CategoryBreakdownWidget.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CategoryBreakdownWidget({ data, loading, error, dateRange }) {
  const navigate = useNavigate();
  if (loading || error) {
    return <BaseWidget title="Category Breakdown" loading={loading} error={error} />;
  }

  if (!data || !data.categories || data.categories.length === 0) {
    return (
      <BaseWidget title="Category Breakdown">
        <p className="empty">No category data available</p>
      </BaseWidget>
    );
  }

  const topCategories = data.categories.slice(0, 7);

  const handleCategoryClick = (category) => {
    if (!dateRange) return;
    
    const params = new URLSearchParams({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    
    if (category.categoryId) {
      params.set('category', category.categoryId);
    }
    
    navigate(`/transactions?${params.toString()}`);
  };

  return (
    <BaseWidget title="Category Breakdown">
      <div className="category-breakdown">
        <div className="category-chart">
          {topCategories.map((category, index) => (
            <div 
              key={category.categoryId || `uncategorized-${index}`} 
              className="category-bar clickable"
              onClick={() => handleCategoryClick(category)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleCategoryClick(category);
                }
              }}
            >
              <div className="category-info">
                <span
                  className="category-color"
                  style={{ backgroundColor: category.categoryColor || 'var(--ft-cat-transfer)' }}
                />
                <span className="category-name" title={category.categoryName}>
                  {category.categoryName}
                </span>
                <span className="category-percentage">{category.percentage.toFixed(1)}%</span>
              </div>
              <div className="category-bar-container">
                <div
                  className="category-bar-fill"
                  style={{
                    width: `${category.percentage}%`,
                    backgroundColor: category.categoryColor || 'var(--ft-cat-transfer)',
                  }}
                />
              </div>
              <span className="category-amount">{formatCurrency(category.totalAmount)}</span>
            </div>
          ))}
        </div>
        
        <div className="category-summary">
          <div className="summary-item">
            <span>Total Spent</span>
            <strong>{formatCurrency(data.totalSpent)}</strong>
          </div>
          {data.uncategorizedAmount > 0 && (
            <div className="summary-item">
              <span>Uncategorized</span>
              <strong>{formatCurrency(data.uncategorizedAmount)} ({data.uncategorizedPercentage.toFixed(1)}%)</strong>
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
