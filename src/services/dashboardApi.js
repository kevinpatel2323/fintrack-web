const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * Fetch complete dashboard summary data
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 * @param {string} [accountNumber] - Optional account filter
 * @returns {Promise<import('../types/dashboard').DashboardSummary>}
 */
export async function fetchDashboardData(startDate, endDate, accountNumber) {
  try {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    
    if (accountNumber) {
      params.append('accountNumber', accountNumber);
    }
    
    const response = await fetch(`${API_BASE}/dashboard/summary?${params}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to fetch dashboard data: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    if (error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check your connection.');
    }
    throw error;
  }
}

/**
 * Fetch spending overview data
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} [accountNumber]
 * @returns {Promise<import('../types/dashboard').SpendingOverview>}
 */
export async function fetchSpendingOverview(startDate, endDate, accountNumber) {
  try {
    const params = new URLSearchParams({ startDate, endDate });
    if (accountNumber) params.append('accountNumber', accountNumber);
    
    const response = await fetch(`${API_BASE}/dashboard/spending-overview?${params}`);
    if (!response.ok) throw new Error('Failed to fetch spending overview');
    
    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch spending overview');
  }
}

/**
 * Fetch category breakdown data
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} [accountNumber]
 * @returns {Promise<import('../types/dashboard').CategoryBreakdown>}
 */
export async function fetchCategoryBreakdown(startDate, endDate, accountNumber) {
  try {
    const params = new URLSearchParams({ startDate, endDate });
    if (accountNumber) params.append('accountNumber', accountNumber);
    
    const response = await fetch(`${API_BASE}/dashboard/category-breakdown?${params}`);
    if (!response.ok) throw new Error('Failed to fetch category breakdown');
    
    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch category breakdown');
  }
}

/**
 * Fetch friend balances data
 * @returns {Promise<import('../types/dashboard').FriendBalance[]>}
 */
export async function fetchFriendBalances() {
  try {
    const response = await fetch(`${API_BASE}/dashboard/friend-balances`);
    if (!response.ok) throw new Error('Failed to fetch friend balances');
    
    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch friend balances');
  }
}

/**
 * Fetch monthly trends data
 * @param {number} [monthsBack=6]
 * @param {string} [accountNumber]
 * @returns {Promise<import('../types/dashboard').MonthlyTrend[]>}
 */
export async function fetchMonthlyTrends(monthsBack = 6, accountNumber) {
  try {
    const params = new URLSearchParams({ monthsBack: monthsBack.toString() });
    if (accountNumber) params.append('accountNumber', accountNumber);
    
    const response = await fetch(`${API_BASE}/dashboard/monthly-trends?${params}`);
    if (!response.ok) throw new Error('Failed to fetch monthly trends');
    
    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch monthly trends');
  }
}

/**
 * Fetch account summary data
 * @returns {Promise<import('../types/dashboard').AccountSummary[]>}
 */
export async function fetchAccountSummary() {
  try {
    const response = await fetch(`${API_BASE}/dashboard/account-summary`);
    if (!response.ok) throw new Error('Failed to fetch account summary');
    
    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch account summary');
  }
}

/**
 * Fetch top categories data
 * @param {string} startDate
 * @param {string} endDate
 * @param {number} [limit=5]
 * @param {string} [accountNumber]
 * @returns {Promise<import('../types/dashboard').TopCategory[]>}
 */
export async function fetchTopCategories(startDate, endDate, limit = 5, accountNumber) {
  try {
    const params = new URLSearchParams({ 
      startDate, 
      endDate,
      limit: limit.toString()
    });
    if (accountNumber) params.append('accountNumber', accountNumber);
    
    const response = await fetch(`${API_BASE}/dashboard/top-categories?${params}`);
    if (!response.ok) throw new Error('Failed to fetch top categories');
    
    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch top categories');
  }
}

/**
 * Fetch income vs expenses data
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} [accountNumber]
 * @returns {Promise<import('../types/dashboard').IncomeVsExpenses>}
 */
export async function fetchIncomeVsExpenses(startDate, endDate, accountNumber) {
  try {
    const params = new URLSearchParams({ startDate, endDate });
    if (accountNumber) params.append('accountNumber', accountNumber);
    
    const response = await fetch(`${API_BASE}/dashboard/income-vs-expenses?${params}`);
    if (!response.ok) throw new Error('Failed to fetch income vs expenses');
    
    return await response.json();
  } catch (error) {
    throw new Error(error.message || 'Failed to fetch income vs expenses');
  }
}
