import SpendingOverviewWidget from '../components/widgets/SpendingOverviewWidget';
import CategoryBreakdownWidget from '../components/widgets/CategoryBreakdownWidget';
import FriendBalancesWidget from '../components/widgets/FriendBalancesWidget';
import MonthlyTrendsWidget from '../components/widgets/MonthlyTrendsWidget';
import RecentTransactionsWidget from '../components/widgets/RecentTransactionsWidget';
import AccountSummaryWidget from '../components/widgets/AccountSummaryWidget';
import TopCategoriesWidget from '../components/widgets/TopCategoriesWidget';
import IncomeVsExpensesWidget from '../components/widgets/IncomeVsExpensesWidget';
import { WidgetType } from '../types/dashboard';

/**
 * Widget registry configuration
 * Maps widget types to their components and metadata
 */
export const WIDGET_REGISTRY = {
  [WidgetType.SPENDING_OVERVIEW]: {
    component: SpendingOverviewWidget,
    title: 'Spending Overview',
    size: 'large',
    dataKey: 'spendingOverview',
    minWidth: 600,
  },
  [WidgetType.CATEGORY_BREAKDOWN]: {
    component: CategoryBreakdownWidget,
    title: 'Category Breakdown',
    size: 'medium',
    dataKey: 'categoryBreakdown',
    minWidth: 400,
  },
  [WidgetType.FRIEND_BALANCES]: {
    component: FriendBalancesWidget,
    title: 'Friend Balances',
    size: 'medium',
    dataKey: 'friendBalances',
    minWidth: 350,
  },
  [WidgetType.MONTHLY_TRENDS]: {
    component: MonthlyTrendsWidget,
    title: 'Monthly Trends',
    size: 'large',
    dataKey: 'monthlyTrends',
    minWidth: 600,
  },
  [WidgetType.RECENT_TRANSACTIONS]: {
    component: RecentTransactionsWidget,
    title: 'Recent Transactions',
    size: 'medium',
    dataKey: 'recentTransactions',
    minWidth: 400,
  },
  [WidgetType.ACCOUNT_SUMMARY]: {
    component: AccountSummaryWidget,
    title: 'Account Summary',
    size: 'medium',
    dataKey: 'accountSummary',
    minWidth: 350,
  },
  [WidgetType.TOP_CATEGORIES]: {
    component: TopCategoriesWidget,
    title: 'Top Categories',
    size: 'small',
    dataKey: 'topCategories',
    minWidth: 300,
  },
  [WidgetType.INCOME_VS_EXPENSES]: {
    component: IncomeVsExpensesWidget,
    title: 'Income vs Expenses',
    size: 'small',
    dataKey: 'incomeVsExpenses',
    minWidth: 300,
  },
};

/**
 * Default enabled widgets for dashboard
 */
export const DEFAULT_ENABLED_WIDGETS = [
  WidgetType.SPENDING_OVERVIEW,
  WidgetType.CATEGORY_BREAKDOWN,
  WidgetType.MONTHLY_TRENDS,
  WidgetType.RECENT_TRANSACTIONS,
  WidgetType.ACCOUNT_SUMMARY,
  WidgetType.TOP_CATEGORIES,
  WidgetType.INCOME_VS_EXPENSES,
  WidgetType.FRIEND_BALANCES,
];
