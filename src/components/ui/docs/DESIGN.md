# Fintrack design guide

Fintrack looks and behaves like a Frappe app (Frappe CRM, Helpdesk, Gameplan): calm, dense, neutral, built for repeated daily use. These are the rules every screen follows.

## Building blocks

| Need | Use |
|---|---|
| Page frame | `PageHeader` + `PageBody` (`components/ui/PageHeader.jsx`). The shell (sidebar, phone tab bar) is already around every page. |
| Components | `import { Button, Dialog, ListView, … } from '../components/ui'`. API: `components/ui/docs/basics.md`, `forms.md`, `overlays.md` |
| Charts | `components/charts` (see its README) |
| Category display | `CategoryBadge` (tile + name, for tables and rows), `CategoryIcon` (the tile alone: emoji or icon, for lists and pickers), from `components/common/Category.jsx` |
| Money | `<Amount value={…} />`, never hand-formatted. Utilities live in `utils/inr.js`. |
| Tokens | Espresso CSS variables (`styles/espresso.css`) and Fintrack roles (`styles/theme.css`) |
| Text utilities | `.text-sm`, `.text-base`, `.font-medium`, `.text-ink-gray-5`, `.tabular-nums`, `.truncate` (`styles/base.css`) |

Page and feature CSS goes in a file next to the component (`Transactions.css`). Use Espresso variables only, and prefix classes with the page name (`.txn-…`, `.people-…`). Don't use inline styles except for truly dynamic values (computed widths, a category colour).

The pre-redesign layer (`primitives.jsx`, `Icon.jsx`, the `--ft-*` variables and the global `button.primary` / `.field` styles) has been removed. Build everything from the kit and tokens above.

## Look

- **Flat and quiet.**
  - Base surface (`--surface-base`) and hairline borders (`--outline-gray-1` for dividers, `--outline-gray-2` for control borders).
  - Shadows only on things that float: menus, dialogs, toasts.
  - No gradients, glows, neon, glass, blurred backdrops, or decorative illustrations.
  - One deliberate exception: the credit card picture (`components/cards/CardFace.jsx`) is drawn as a physical card — its own palette with a soft gradient, chip, network mark and the small uppercase labels printed on real cards. It is the card's visual identity, not decoration; nothing else borrows its styling.
- **Neutral by default.**
  - Black solid button (`variant="solid"`, gray theme) for the one primary action on a screen; subtle or outline gray for the rest.
  - Blue only for links and focus. Green for money coming in. Red only for destructive actions and money that's overdue or owed.
  - Category colour appears in the category tile (`CategoryIcon`: the category's icon or emoji on a gray square, tinted in its colour), a bar or a chart slice — never as a filled card. Every category picker and table cell shows the tile and the name (`CategoryBadge`, `categoryOptions` in `components/common/Category.jsx`).
- **Type.**
  - Inter. Body 14px (`text-base`), secondary 13px (`text-sm`) in `--ink-gray-5`.
  - Titles live in the PageHeader (16px semibold). Section headings are `text-base font-medium` (`--ink-gray-9`).
  - Only `StatCard` values go large (~20–24px).
  - No uppercase letter-spaced "overline" labels: use sentence-case `text-sm` `--ink-gray-5` labels instead.
- **Numbers.** Use `tabular-nums` and right-align them in tables. Transaction amounts use `<Amount value={signed} sign="always" />`, which gives `−₹67` (ink) and `+₹6,265` (green). For balances, pair a neutral amount with words ("Owes you", "You owe") rather than relying on colour alone.
- **Icons.** lucide-react, 16px, `strokeWidth={1.5}`, in `--ink-gray-5`/`-6`. No emoji in the interface itself. Category emoji are user data, so they show only through `CategoryIcon`.
- **Density.**
  - Controls are 28px (`size="sm"`, the default).
  - List rows are about 40px; header bar 48px.
  - Spacing comes from a 4px scale: gaps of 8, 12, 16 or 20; page gutter 20px (12px on phones).
- **Radius.** 8px for controls (`--radius-4`), 10–12px for cards and dialogs, 999px only for pills and avatars.

## Layout patterns

**One table for every list of records.** Anything that lists records — transactions, people, a person's ledger, categories, statements, payments, imports, subscriptions, an import or paste preview — is the kit `ListView` (transactions through `components/TransactionTable.jsx`, which only adds the transaction columns). It brings the Transactions table's behaviour to every table: header, 44px rows, hover, sorting, column resizing, saved column choices, the pager, loading and empty states, keyboard. Pages describe columns; they don't re-implement any of it. API: `docs/overlays.md#listview`.

- Every named column is sortable (`sortable`, plus `sortValue` when the cell isn't the raw value); dates and amounts start descending (`sortFirst: 'desc'`).
- The title column is `flex`; the rest can be dragged. Give each table a `storageKey` (or `columnSettings` shared with a `ListColumnsMenu` where columns are optional) so widths and choices stick.
- Paginate lists that grow without end: transactions, a ledger, people, statements, payments. Bounded lists — categories, subscriptions, recent imports, a calendar day, an import preview — show every row.
- People show as `AvatarGroup` stacks. On phones a table becomes a list of rows (see **Phone**): the less important columns drop out (`hideBelow`) and their facts fold into a second line under the title. Ledger pages may swap the table for the phone row list (`TransactionMobileList`).
- List pages put their search, filters and summary in `components/common/ListToolbar.jsx`, which pins under the page header; the table header pins under it.

Not tables, on purpose (each is listed in `ui/__tests__/oneTable.test.ts`, which fails on table markup anywhere else):
- Short lists that aren't pages of records: the Cards page's grid of card pictures, the dashboard's short lists, a day's "Bills due", the passkeys on Security, and the phone row lists.
- Pick lists inside a dialog: a statement to link, rows for an export.
- The bill-wise allocation form (`components/people/AllocTable.jsx`, used by Settle up, Net off and settlement review): each row is a form field, the order is what "Fill oldest first" works through, and it reflows by the width of the dialog or sheet it sits in.
- The ledger export preview (`components/ledger-export/LedgerPaper.jsx`): a picture of the PDF page.
- The screen-reader table behind each chart, and the date picker's month grid.

**List page** (Transactions, People, Categories):
1. `PageHeader`: title on the left; primary action ("New transaction") as a solid button on the right, with secondary actions as subtle buttons or a `…` Dropdown.
2. Toolbar row under the header, in the style of Frappe CRM's view controls. On the left: a search `TextInput` with a `Search` prefix and filter controls (`Select`, `Combobox`, `DateRangePicker`, or a "Filter" `Dropdown`/`Popover` that shows active filters as removable chips). On the right: sort, columns, view switches (`TabButtons`), and a summary ("87 transactions · ₹1.27L spent").
3. `ListView` full width with `stickyHeader`, rows clickable to the detail page (`rowHref`), paged, with selection and bulk actions where bulk actions exist.
4. Empty state (`EmptyState`) and loading state (`loading` / `Skeleton`) instead of blank areas.

**Detail page** (Transaction, Card, Person):
- `PageHeader` with breadcrumbs (`People / Yash Patel`) and actions (Edit, `…` menu holding Delete in red).
- Two columns on wide screens: main content on the left (summary + `Tabs` such as Activity / Statements / Payments) and a ~320–360px side panel on the right with key fields as label/value rows, like Frappe CRM's side panel.
- Stack to one column below 1024px.

**Dashboard / overview:**
- A row of `StatCard`s, then `Card`s holding charts and short lists, each with a "View all" link to the full page.
- No marketing copy or invented insights.

**Forms:**
- Create/edit in a `Dialog`; use a `Sheet` for long or contextual flows (split a transaction, apply a settlement).
- `FormControl` labels above inputs; validation errors inline under the field.
- Dialog actions are bottom-right: primary solid + Cancel.
- Destructive actions confirm with `ConfirmDialog` (red).
- Report success and failure with `toast`, not banners that linger.

## Phone

Phones (< 768px, designed on an iPhone 17 at 402×874 and checked at 375px) get their own layout, the way Frappe's newer apps do it (Gameplan, frappe-ui's `MobileShell` and mobile recipes): a separate phone layout, not the desktop one squeezed. API for the phone components: `docs/phone.md`.

**The desktop is frozen.** Every phone change lives in a phone-only branch or in CSS inside `@media (max-width: 767.98px)`.
- Phone-only branch: `useIsCompact()` → render a phone component.
- Never edit a desktop rule or desktop markup to get a phone result.
- A page whose phone layout differs a lot renders a separate phone component that shares the page's hooks and state. Don't sprinkle `isMobile` through the desktop JSX.

**Shell** (`components/shell/`):
- **Tab bar.** Five tabs: Home, Activity, Calendar, Cards, People. It shows only on a tab's own page.
- **Pushed pages.** Everything else — a record, anything under You — has a Back button and no tab bar.
  - Back returns to the previous screen when there is one, so scroll position and filters survive. Otherwise it goes to the page's `back` path.
- **You.** Categories, Import statements, Security and appearance live on You. It opens from the round button at the left of every tab's header, which carries a dot when card statements wait to be imported.
- **Header.**
  - Fixed, 52px, centred one-line 17px title.
  - On the left: Back or You. On the right: at most two icon buttons (`mobileActions`).
  - The create action (`Plus`) and a `…` overflow menu holding the page's other actions. No text buttons in the header.
- **Main actions.** A pushed page's main actions go in `MobileActionBar` at the bottom: one or two `size="lg"` buttons, main one last and solid. Tab pages create from the header's `+`. No floating action buttons.

**Layout:**
- One column, a 16px gutter (`--page-gutter`).
- Lists run edge to edge, their rows padded by the gutter: `MobileList`, or a `ListView` with `className="phone-bleed"`.
- **Sections.**
  - Sections are `MobileSection`: a 17px semibold title with an optional "View all ›", 28px apart.
  - Sections are not boxed cards. Boxes are only for charts and summary tiles.
- **Summary figures.**
  - A record page leads with one hero figure (28px semibold) and a muted line under it.
  - An overview uses up to four compact tiles in a 2-column grid: label 13px, value 20px semibold.
- **Details.** A desktop side panel becomes a Details section of `MobileField` label/value rows.
- **Tabs and segments.**
  - Underline `Tabs` scroll sideways when they overflow.
  - Segments ("All · They owe · You owe") are `TabButtons`, `fluid` when they fill the row.

**Lists:**
- **Records** use `ListView`'s phone layout: no header row, a "Sorted by …" control, 56px rows and "Show more" in place of the pager.
  - Show the title column (with a muted second line carrying the facts of the hidden columns) and one trailing value.
  - Hide the other columns with `hideBelow="md"`.
- **Transactions** are grouped by day under sticky date headers (`TransactionMobileList`).
- **Rows.**
  - Text: a 16px title in `--ink-gray-8`, a 13px subtitle in `--ink-gray-5`, and the amount as 16px medium tabular figures.
  - A 32px leading tile or avatar, and inset hairlines between rows.
  - A pressed state and no hover. No selected-row highlight that lingers.
- **Overview lists, menus and settings** are `MobileList`/`MobileListItem`; the You hub uses `variant="inset"` groups.

**Controls:**
- **Search** is full width, pinned at the top of the scroll area (`ListToolbar`).
- **Filters.**
  - They sit behind a "Filter" button that shows the active count. It opens a bottom sheet of filter fields with Clear and a "Show N results" button.
  - One quick segment row may sit under the search.
- **Sizes.**
  - Kit controls are one size up on phones: sm 32px, md 36, lg 44.
  - Text fields use 16px text, so iOS never zooms the page.
- **Menus.** A `Dropdown` opens as an action sheet on its own. A row's actions go in a `…` on the row (`MobileListItem actions`) or on its record page.

**Overlays:**
- **Forms.** A `Dialog` docks as a bottom sheet: grab handle, centred title, 44px full-width buttons. A `Sheet` does too with `side="auto"`.
- **Confirmations.** `ConfirmDialog` stays a centred card.
- **Toasts** sit above the tab bar.

**Type on phones:**
- Header and section titles: 17px semibold.
- Row titles: 16px. Body: 15px. Secondary text: 13px.
- Hero amount: 28px semibold. Tile values: 20px semibold.

**Safe areas:**
- The header pads the top inset when the app is installed to the home screen.
- The tab bar, action bar, sheets and the last row all clear the home indicator.
- No horizontal page scrolling, ever.

## Writing

- Sentence case everywhere ("New transaction", not "New Transaction").
- Short, plain and specific. No exclamation marks, emoji, filler greetings ("Welcome back"), marketing tone, or made-up numbers or insights.
- Buttons say what they do ("Add card", "Import statement", "Mark as paid"). Empty states say what's missing and offer the next step ("No transactions this month · Import a statement").
- Keep the existing domain words the user knows: People, Cards, Statements, Settle up, Net off, Write off, Entry groups, Unbilled.

## Flows

- Every screen answers "what is this, what needs my attention, what can I do next".
- Attention items (statements to import, settlements to review, bills due) surface where the user already looks: sidebar counts, dashboard, the relevant page header. Make them clickable straight to the fix.
- One primary action per screen. Secondary actions go in a `…` menu.
- After an action, show its result in place (updated row, toast with Undo where the API supports it) rather than navigating away.
- Keep the user's place: filters live in the URL where they already do, back returns to the same scroll/filter state, and dialogs restore focus.

## Engineering rules

- **Redesign the presentation and the flow, never the data.** Keep:
  - API calls and request/response shapes
  - hooks, utils and maths (`ledgerParties`, `entryGroups`, `settlementAllocation`, `splitEngine`)
  - routes and URL params
- Every existing feature and action must stay reachable. If you move one, say where in your summary.
- Delete a page's old CSS file once nothing uses it, and drop its import. Remove dead code you replace.
- `npm test` must pass. Keep or update tests whose markup you change.
- Accessibility: real buttons and links, labelled icon buttons (`label` prop), focus visible, dialogs trap focus, colour is never the only signal.
