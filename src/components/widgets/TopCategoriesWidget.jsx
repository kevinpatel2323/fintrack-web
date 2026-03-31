import BaseWidget from '../BaseWidget';
import './TopCategoriesWidget.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function TopCategoriesWidget({ data, loading, error }) {
  if (loading || error) {
    return <BaseWidget title="Top Categories" loading={loading} error={error} />;
  }

  if (!data || data.length === 0) {
    return (
      <BaseWidget title="Top Categories">
        <p className="empty">No category data available</p>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget title="Top Categories">
      <div className="top-categories">
        {data.map((category, index) => (
          <div key={category.categoryId || `uncategorized-${index}`} className="top-category-item">
            <div className="category-rank">{index + 1}</div>
            <div className="category-details">
              <div className="category-header">
                <span
                  className="category-indicator"
                  style={{ backgroundColor: category.categoryColor || '#999' }}
                />
                <span className="category-name">{category.categoryName}</span>
              </div>
              <div className="category-bar-wrapper">
                <div
                  className="category-bar-fill"
                  style={{
                    width: `${category.percentage}%`,
                    backgroundColor: category.categoryColor || '#999',
                  }}
                />
              </div>
            </div>
            <div className="category-stats">
              <div className="category-amount">{formatCurrency(category.totalAmount)}</div>
              <div className="category-percentage">{category.percentage.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
    </BaseWidget>
  );
}
