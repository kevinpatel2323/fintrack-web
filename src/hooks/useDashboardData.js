import { useCallback, useEffect, useState } from 'react';
import { fetchDashboardData } from '../services/dashboardApi';

export function useDashboardData(dateRange, accountNumber) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!dateRange?.startDate || !dateRange?.endDate) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dashboardData = await fetchDashboardData(
        dateRange.startDate,
        dateRange.endDate,
        accountNumber
      );
      setData(dashboardData);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startDate, dateRange?.endDate, accountNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    if (dateRange?.startDate && dateRange?.endDate) {
      load();
    }
  }, [dateRange?.startDate, dateRange?.endDate, load]);

  return { data, loading, error, refresh };
}
