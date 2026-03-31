/**
 * Widget type definitions for dashboard
 */

export const WidgetType = {
  SPENDING_OVERVIEW: 'spending-overview',
  CATEGORY_BREAKDOWN: 'category-breakdown',
  FRIEND_BALANCES: 'friend-balances',
  MONTHLY_TRENDS: 'monthly-trends',
  RECENT_TRANSACTIONS: 'recent-transactions',
  ACCOUNT_SUMMARY: 'account-summary',
  TOP_CATEGORIES: 'top-categories',
  INCOME_VS_EXPENSES: 'income-vs-expenses',
};

/**
 * @typedef {Object} SpendingOverview
 * @property {number} totalSpent
 * @property {number} totalIncome
 * @property {number} netChange
 * @property {number} transactionCount
 * @property {number} averageTransaction
 * @property {Object} comparisonPeriod
 * @property {number} comparisonPeriod.totalSpent
 * @property {number} comparisonPeriod.totalIncome
 * @property {number} comparisonPeriod.percentageChange
 */

/**
 * @typedef {Object} CategoryItem
 * @property {string|null} categoryId
 * @property {string} categoryName
 * @property {string|null} categoryColor
 * @property {number} totalAmount
 * @property {number} transactionCount
 * @property {number} percentage
 */

/**
 * @typedef {Object} CategoryBreakdown
 * @property {CategoryItem[]} categories
 * @property {number} totalSpent
 * @property {number} uncategorizedAmount
 * @property {number} uncategorizedPercentage
 */

/**
 * @typedef {Object} FriendBalance
 * @property {string} friendId
 * @property {string} friendName
 * @property {number} totalIOwe
 * @property {number} totalOwesMe
 * @property {number} totalSettlements
 * @property {number} netBalance
 * @property {string|null} lastTransactionDate
 */

/**
 * @typedef {Object} MonthlyTrend
 * @property {string} month
 * @property {string} monthLabel
 * @property {number} totalSpent
 * @property {number} totalIncome
 * @property {number} netChange
 * @property {number} transactionCount
 */

/**
 * @typedef {Object} AccountSummary
 * @property {string} accountId
 * @property {string} accountNumber
 * @property {number} currentBalance
 * @property {string|null} lastTransactionDate
 * @property {number} transactionCount
 * @property {number} totalDeposits
 * @property {number} totalWithdrawals
 */

/**
 * @typedef {Object} TopCategory
 * @property {string|null} categoryId
 * @property {string} categoryName
 * @property {string|null} categoryColor
 * @property {number} totalAmount
 * @property {number} transactionCount
 * @property {number} percentage
 */

/**
 * @typedef {Object} IncomeVsExpenses
 * @property {number} totalIncome
 * @property {number} totalExpenses
 * @property {number} netSavings
 * @property {number} savingsRate
 * @property {number} incomePercentage
 * @property {number} expensesPercentage
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} transactionDate
 * @property {string} narration
 * @property {number} withdrawal
 * @property {number} deposit
 * @property {number} balance
 * @property {string} accountNumber
 */

/**
 * @typedef {Object} DashboardSummary
 * @property {SpendingOverview} spendingOverview
 * @property {CategoryBreakdown} categoryBreakdown
 * @property {FriendBalance[]} friendBalances
 * @property {MonthlyTrend[]} monthlyTrends
 * @property {AccountSummary[]} accountSummary
 * @property {TopCategory[]} topCategories
 * @property {IncomeVsExpenses} incomeVsExpenses
 * @property {Transaction[]} recentTransactions
 */

/**
 * @typedef {Object} DateRange
 * @property {string} startDate
 * @property {string} endDate
 */
