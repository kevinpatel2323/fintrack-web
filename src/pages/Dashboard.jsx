import { useState } from 'react';
import DateRangePicker from '../components/DateRangePicker.jsx';
import WidgetContainer from '../components/WidgetContainer.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { DEFAULT_ENABLED_WIDGETS } from '../config/widgetRegistry.js';
import './Dashboard.css';

function getDefaultDateRange() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: formatDate(thirtyDaysAgo),
    endDate: formatDate(today),
  };
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError, refresh: refreshDashboard } =
    useDashboardData(dateRange, '');

  return (
    <section className="dashboard-widgets-section">
      <header className="dashboard-widgets-intro">
        <h2 className="dashboard-widgets-title">Financial Dashboard</h2>
        <p className="dashboard-widgets-lead">Spending, trends, and account insights for the range you choose.</p>
      </header>

      <div className="dashboard-widgets-toolbar glass-panel">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          className="date-range-picker--dashboard"
        />
        <button
          type="button"
          className="secondary dashboard-refresh-btn"
          onClick={refreshDashboard}
          disabled={dashboardLoading}
          title="Refresh dashboard data"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
            className={dashboardLoading ? 'dashboard-refresh-icon--spinning' : ''}
          >
            <path
              d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C9.84871 2 11.5 2.84871 12.6 4.2M12.6 4.2V1M12.6 4.2H9.4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Refresh
        </button>
      </div>

      {dashboardError && (
        <div className="widget-container-error" role="alert">
          <p>{dashboardError}</p>
          <button type="button" onClick={refreshDashboard} className="retry-button">
            Retry
          </button>
        </div>
      )}

      <WidgetContainer
        dateRange={dateRange}
        enabledWidgets={DEFAULT_ENABLED_WIDGETS}
        data={dashboardData}
        loading={dashboardLoading}
        error={dashboardError}
      />
    </section>
  );
}
