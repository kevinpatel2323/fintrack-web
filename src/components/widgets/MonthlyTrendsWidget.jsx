import BaseWidget from '../BaseWidget';
import './MonthlyTrendsWidget.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function SimpleLineChart({ data }) {
  if (!data || data.length === 0) return null;

  const width = 600;
  const height = 250;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find max value for scaling
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.totalSpent, d.totalIncome))
  );
  const yScale = maxValue > 0 ? chartHeight / maxValue : 1;

  // Generate points for lines
  const spentPoints = data
    .map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - d.totalSpent * yScale;
      return `${x},${y}`;
    })
    .join(' ');

  const incomePoints = data
    .map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - d.totalIncome * yScale;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-chart">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartHeight * (1 - ratio);
        return (
          <g key={ratio}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="var(--ft-chart-grid)"
              strokeWidth="1"
            />
            <text
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--ft-chart-label)"
            >
              {formatCurrency(maxValue * ratio)}
            </text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        return (
          <text
            key={i}
            x={x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize="10"
            fill="var(--ft-chart-label)"
          >
            {d.monthLabel.split(' ')[0]}
          </text>
        );
      })}

      {/* Lines */}
      <polyline
        points={spentPoints}
        fill="none"
        stroke="var(--ft-spend)"
        strokeWidth="2"
      />
      <polyline
        points={incomePoints}
        fill="none"
        stroke="var(--ft-income)"
        strokeWidth="2"
      />

      {/* Points */}
      {data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const ySpent = padding.top + chartHeight - d.totalSpent * yScale;
        const yIncome = padding.top + chartHeight - d.totalIncome * yScale;
        return (
          <g key={i}>
            <circle cx={x} cy={ySpent} r="3" fill="var(--ft-spend)" />
            <circle cx={x} cy={yIncome} r="3" fill="var(--ft-income)" />
          </g>
        );
      })}
    </svg>
  );
}

export default function MonthlyTrendsWidget({ data, loading, error }) {
  if (loading || error) {
    return <BaseWidget title="Monthly Trends" loading={loading} error={error} />;
  }

  if (!data || data.length === 0) {
    return (
      <BaseWidget title="Monthly Trends">
        <p className="empty">No trend data available</p>
      </BaseWidget>
    );
  }

  return (
    <BaseWidget title="Monthly Trends">
      <div className="monthly-trends">
        <div className="chart-container">
          <SimpleLineChart data={data} />
        </div>
        <div className="legend">
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'var(--ft-spend)' }} />
            <span>Expenses</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'var(--ft-income)' }} />
            <span>Income</span>
          </div>
        </div>
      </div>
    </BaseWidget>
  );
}
