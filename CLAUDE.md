# fintrack-web

React 18 + Vite frontend. Runs on port 3001. Talks to the API at `VITE_API_BASE_URL` (default `http://localhost:3000`).

## Commands

```bash
npm run dev      # Vite dev server on :3001
npm run build    # production build → dist/
npm test         # Vitest
```

## Route map

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `pages/Dashboard.jsx` | Widget dashboard |
| `/import` | `pages/StatementImport.jsx` | Upload HDFC statement |
| `/transactions` | `pages/Transactions.jsx` | Filterable transaction list |
| `/calendar` | `pages/Calendar.jsx` | Subscriptions calendar (also via `?view=subscriptions`) |
| `/friends` | `pages/Friends.jsx` | Friend ledger + balance tracking |
| `/categories` | `pages/Categories.jsx` | Category management |
| `/subscriptions` | — | Redirects to `/calendar?view=subscriptions` |

Mobile navigation via `MobileBottomNav` component (rendered outside `<Routes>`).

## Dashboard widget system

Widgets are registered in `src/config/widgetRegistry.js` via `WIDGET_REGISTRY`.  
Each entry maps a `WidgetType` enum value to `{ component, title, size, dataKey, minWidth }`.

**All 8 widgets:**

| WidgetType | Component | dataKey | size |
|------------|-----------|---------|------|
| SPENDING_OVERVIEW | SpendingOverviewWidget | `spendingOverview` | large (≥600px) |
| CATEGORY_BREAKDOWN | CategoryBreakdownWidget | `categoryBreakdown` | medium (≥400px) |
| FRIEND_BALANCES | FriendBalancesWidget | `friendBalances` | medium (≥350px) |
| MONTHLY_TRENDS | MonthlyTrendsWidget | `monthlyTrends` | large (≥600px) |
| RECENT_TRANSACTIONS | RecentTransactionsWidget | `recentTransactions` | medium (≥400px) |
| ACCOUNT_SUMMARY | AccountSummaryWidget | `accountSummary` | medium (≥350px) |
| TOP_CATEGORIES | TopCategoriesWidget | `topCategories` | small (≥300px) |
| INCOME_VS_EXPENSES | IncomeVsExpensesWidget | `incomeVsExpenses` | small (≥300px) |

`DEFAULT_ENABLED_WIDGETS` includes all 8. Dashboard data is fetched via `src/hooks/useDashboardData.js` calling `src/services/dashboardApi.js`.

`WidgetContainer` wraps every widget with consistent header, loading, and error states. `BaseWidget` is the lower-level primitive.

## API service layer

All API calls go through `src/services/dashboardApi.js`. Base URL from `import.meta.env.VITE_API_BASE_URL`.

Key functions:
- `fetchDashboardData(startDate, endDate, accountNumber?)` — single request for all widget data
- Individual fetchers: `fetchSpendingOverview`, `fetchCategoryBreakdown`, `fetchFriendBalances`, `fetchMonthlyTrends`, `fetchAccountSummary`, `fetchTopCategories`, `fetchIncomeVsExpenses`

## Split engine (`src/utils/splitEngine.ts`)

Pure TypeScript, integer minor-unit math (100 minor = 1 major) — no float accumulation.

**Split methods:**
- `calculateEqualSplit(total, participantIds)` — even split, deterministic remainder (+1 to earlier slots)
- `calculateExactSplit(total, entries)` — each participant has explicit amount
- `calculatePercentageSplit(total, entries)` — basis points (10,000 = 100%), floor+remainder
- `calculateSharesSplit(total, entries)` — weighted shares (stored as integers scaled by 1e6)
- `calculateAdjustmentSplit(total, participants, adjustedEntries)` — pin some amounts, distribute remainder evenly

Serialization: `serializeSplitPayload` / `parseSplitPayload` encode `SerializedSplitPayloadV1` as a prefixed JSON string (prefix defined in `splitTypes.ts`).

## Key shared components

| Component | Purpose |
|-----------|---------|
| `DataTable` | Sortable table used across transaction/friend views |
| `DateRangePicker` | Date range selector used by dashboard + transactions |
| `ConfirmDialog` | Modal confirmation dialog |
| `TransactionFriendTagsPanel` | Side panel to tag a transaction with friends |
| `SplitTransactionForm` | Form for splitting transaction amounts |
| `FriendTagLedgerDisplay` | Shows ledger entries for a friend |
| `FriendLedgerExportModal` | Exports friend ledger to PDF via `jspdf` |
| `Portal` | Renders children into document.body |
| `MobileTransactionCard` | Mobile-optimized transaction row |

## Utility modules

| File | Purpose |
|------|---------|
| `utils/dateUtils.js` | Date formatting helpers |
| `utils/tableSort.js` | Column sort logic for DataTable |
| `utils/stringUtils.js` | Text helpers |
| `utils/ledgerParties.js` | Summarize ledger participants |
| `utils/ledgerPdf.js` | jsPDF-based ledger PDF export |
| `hooks/useMediaQuery.js` | Responsive breakpoint hook |

## Styling

No CSS framework — raw CSS files colocated with components (`ComponentName.css`).  
Global styles in `src/index.css`. Transaction sheet styles in `src/styles/transactionSheet.css`.

## Testing

Vitest. Test files at `src/**/__tests__/`.  
Current coverage: `CategoryBreakdownWidget`, `SpendingOverviewWidget`, `WidgetContainer`, `splitEngine`, `splitValidation`.

Run `npm test` (single pass) or add `--watch` for interactive mode.
