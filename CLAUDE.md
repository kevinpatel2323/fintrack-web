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
| `/` | `pages/Dashboard.jsx` | Stats, needs-attention list, charts (`pages/dashboard/`) |
| `/transactions` | `pages/Transactions.jsx` | Filterable list; filters live in the URL (`utils/transactionsListParams.js`) |
| `/transactions/:id` | `pages/TransactionDetail.jsx` | Record page: summary, split, card bill, details panel |
| `/calendar` | `pages/Calendar.jsx` | Month grid + day panel; `?view=subscriptions` for subscriptions (`pages/calendar/`) |
| `/subscriptions` | — | Redirects to `/calendar?view=subscriptions` |
| `/cards`, `/cards/:id` | `pages/Cards.jsx`, `pages/CardDetail.jsx` | Card list and record page (`pages/cards/`, `components/cards/`) |
| `/friends`, `/friends/:id` | `pages/Friends.jsx`, `pages/FriendDetail.jsx` | People and the friend ledger (`pages/people/`, `components/people/`) |
| `/categories` | `pages/Categories.jsx` | Category list, month split, create/edit (`components/categories/`) |
| `/import` | `pages/StatementImport.jsx` | Upload → review → confirm (`pages/import/`) |
| `/you` | `pages/You.jsx` | "You" on phones (from the header's leading button): categories, imports, security, appearance (`pages/you/YouPhone.jsx`) |
| `/security` | `pages/Security.jsx` | Passkeys and sign-out (hidden when auth is disabled) |
| `/login`, `/setup` | `pages/Login.jsx`, `pages/Setup.jsx` | Shell-less passkey screens (`pages/auth/AuthLayout.jsx`) |
| `/ui-kit` | `pages/dev/UiKit.jsx` | Dev only: every kit component, light and dark |

The app shell (`components/shell/`) wraps every signed-in route: the Frappe-style sidebar on desktop (collapses to a 48px rail below 1100px, toggle remembered) and, on phones (< 768px, `styles/breakpoints.js`), frappe-ui's MobileShell: a fixed header slot, five tabs (Home, Activity, Calendar, Cards, People) shown only on a tab's own page, and pushed pages with Back. Destinations and their attention badges are defined once in `components/shell/nav.js`.

Phones have their own layouts, not the desktop squeezed: pages render a phone component when `useIsCompact()` is true (`pages/TransactionsPhone.jsx`, `pages/people/FriendsPhone.jsx`, `pages/cards/CardDetailPhone.jsx`, …) and phone CSS lives in `@media (max-width: 767.98px)`. The desktop markup and styles must not change for a phone fix. Rules: `DESIGN.md#phone`; phone kit (`MobileSection`, `MobileList`, `MobileField`, `MobileActionBar`, `ActionSheet`, and what ListView, Dialog, Dropdown and the pickers do on phones): `components/ui/docs/phone.md`.

## Design system

Fintrack follows Frappe UI (the library behind Frappe CRM/Helpdesk). Read `src/components/ui/docs/DESIGN.md` before changing any screen.

- **Tokens**: `styles/espresso.css` is generated from frappe-ui 1.0.2's tokens (surface/ink/outline scales, elevation, focus, radius; light on `:root`, dark on `[data-theme='dark']`). `styles/theme.css` adds Fintrack roles (money colours, chart and category hues, layout sizes). `styles/base.css` holds Inter, page defaults and text utilities.
- **Kit**: `components/ui/` — React ports of frappe-ui components (Button, TextInput, Select, Combobox, DatePicker, Dialog, Sheet, Dropdown, Toast, Tabs, ListView, PageHeader, Sidebar, …). Import from `components/ui`. API docs in `components/ui/docs/`.
- **Charts**: `components/charts/` — SVG BarChart, LineChart, DonutChart, CategoryBars, Sparkline in Frappe's chart style (README inside).
- **Tables**: every list of records is the kit `ListView` — the one table component, with sorting, column resizing, saved column choices (`useListSettings`, `ListColumnsMenu`), the pager, sub-rows, loading and empty states; its rules live in `components/ui/internal/listModel.js`. Transactions go through `components/TransactionTable.jsx`, which only defines the transaction columns. `ui/__tests__/oneTable.test.ts` fails on table markup outside `ListView` and the exceptions in `DESIGN.md`. List pages use `components/common/ListToolbar.jsx` for the pinned search/filters/summary band. People show as `AvatarGroup` stacks.
- **Shared**: `components/common/Category.jsx` (`CategoryBadge`, `CategoryIcon`); category colours in `utils/categoryColors.js` (palette hex → theme tokens, including older stored colours).
- Theme: `hooks/useTheme.js` (light / dark / system); `<html data-theme>` always holds the resolved theme.

## API service layer

API calls go through `src/services/*` (`dashboardApi`, `cardsApi`, `friendsApi`, `categoriesApi`, `authApi`) on top of `services/http.js` (`apiFetch`, same-origin `/api` prefix). Base URL from `import.meta.env.VITE_API_BASE_URL`.

- `fetchDashboardData(startDate, endDate, accountNumber?)` — one request for everything the dashboard shows (`hooks/useDashboardData.js`).

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
| `TransactionTable` / `TransactionMobileList` | The transaction columns on the kit `ListView`, and the phone list; shared by Transactions, the card page, a calendar day, a statement's breakdown and a bill payment's covered transactions |
| `TransactionManageSheet` | Side/bottom sheet to recategorise, split or tag a transaction (Transactions, Calendar, card page) |
| `SplitTransactionForm` | Form for splitting transaction amounts |
| `FriendTagLedgerDisplay` | Shows ledger entries for a friend |
| `FriendLedgerExportModal` | Exports friend ledger to PDF via `jspdf` |
| `Portal` | Renders children into document.body (used by the kit's overlays) |
| `StatementQueue` | "Card statements · up next" panel on the import page: next statement per card, month strip, file-name hint |
| `SettlementAllocator` | Bill-wise settlement picker: applies one settlement across a friend's open entries (any amount each, "Fill oldest first"), nets in the other side ("Net all off"), refunds money on account; the rest stays on account. Shows the reconciled balance on top. Used by `SplitTransactionForm` and `SettlementAllocationModal` |
| `SettlementAllocationModal` | Re-applies an existing settlement (e.g. on-account money later, or a refund); opened from `FriendTagCard` and the friend page |
| `NetOffModal` | Nets what a friend owes against what the user owes them, no money moving |
| `WriteOffModal` | Writes off a leftover (round-off) on an entry or a settlement |
| `LegacyReviewModal` | Reviews a friend's settlements saved before amounts existed, with suggested amounts; opened from the friend page or People (`?review=1`) |
| `EntryGroups` | Entry groups on the friend page ("Ketul's wedding"): the name/rename dialog and the "tick entries to group" bar (the group itself is a row in `pages/people/PersonLedgerTable.jsx` that expands to its entries). Groups also show as one row in `SettlementAllocator` (tick to settle the group; its smaller side is netted in), as a pick in `SplitTransactionForm`, and as one row plus "Group details" in the ledger export |
| `UnbilledPasteModal` | "Paste unbilled" on a credit card's page: paste HDFC's Unbilled Transactions list, preview new vs already-added rows, add the new ones |
| `ui/Dialog`, `ui/ConfirmDialog`, `ui/Sheet` | The modal frames every dialog above is built on |

## Utility modules

| File | Purpose |
|------|---------|
| `utils/dateUtils.js` | Date formatting helpers |
| `utils/ledgerParties.js` | Friend-ledger maths and **all ledger text** (`ledgerRs`, `ledgerDate`, `ledgerImpactText`, `ledgerOpenText`, `ledgerSettledEntryParts`, `ledgerSettlementCheck`, `ledgerSettlementRefLines`). The export preview (`FriendLedgerExportModal`) and the PDF must both render from these — never format ledger amounts or settlement lines locally, or the two drift apart |
| `utils/ledgerPdf.js` | jsPDF-based ledger PDF export |
| `utils/entryGroups.js` | Entry groups: collapsing a group into one row (`groupLedgerRows`), its totals from its entries (`groupTotals`, same sums as the API's `groupFigures`), settling it as one (`fillGroup`), and `ledgerStatement` — the numbered rows the export preview and PDF both print, with settlement links to grouped entries pointing at the group's row |
| `utils/settlementAllocation.js` | Bill-wise settlement maths in paise: oldest-first fill, draft checks, API shape. Settlement direction for balances lives in `ledgerBalanceDelta` (`settlementSide: 'paid'` adds) |
| `hooks/useMediaQuery.js` | Responsive breakpoint hook |
| `hooks/useImportSchedule.js` | Shared card import schedule (one request for nav badges + pages); call `refreshImportSchedule()` after anything that changes imports or a card's statement day |
| `hooks/useReviewSummary.js` | Shared count of older settlements to review (People badge); call `refreshReviewSummary()` after reviewing |
| `hooks/createSharedResource.js` | The one-request-for-every-view store both hooks above are built on |

## Styling

No CSS framework. Each component or page has a CSS file next to it, using Espresso variables only (no hex values, no inline styles beyond computed values). Class names are prefixed per component (`ui-` for the kit, a page prefix such as `txn-`, `cal-`, `people-` for pages). `src/index.css` imports only the tokens, theme roles and base.

## Testing

Vitest. Test files at `src/**/__tests__/`.  
Tests are `*.test.ts` (see `vitest.config.ts`) and cover the pure logic: split engine, ledger maths, settlement allocation, list/calendar params, dashboard and calendar models, the table rules (`listModel`), chart scales and date helpers. `oneTable.test.ts` guards that tables are only built with `ListView`.

Run `npm test` (single pass) or add `--watch` for interactive mode.
