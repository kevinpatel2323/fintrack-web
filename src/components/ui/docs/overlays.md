# UI kit: Overlays & navigation

React ports of frappe-ui 1.0.2 overlays and navigation on Espresso tokens. Import from the barrel:

```jsx
import { Popover, Dropdown, Dialog, ConfirmDialog, Sheet, toast, Toaster, Tabs, TabButtons, Breadcrumbs, ListView, ListColumnsMenu, useListSettings } from '../components/ui';
```

All overlays render through `Portal` and use `internal/floating.js` for placement and dismissal. Escape and outside clicks close only the top-most layer, so a dropdown inside a dialog closes before the dialog does. Dialog and Sheet also trap focus, return it on close, make `#root` inert and lock page scroll. Icons are lucide-react components passed as props. Unknown props spread onto the root element (on overlays, onto the panel), and `className` is merged. Gallery: `/ui-kit` in dev.

Layers: Dialog/Sheet `z-index: 1100`, Popover/Dropdown `1200` (the same as Combobox/DatePicker, so nested panels stack in the order they open), toasts `2200`.

- [Popover](#popover) · [Dropdown](#dropdown) · [Dialog](#dialog) · [ConfirmDialog](#confirmdialog) · [Sheet](#sheet) · [Toast](#toast)
- [Tabs](#tabs) · [TabButtons](#tabbuttons) · [Breadcrumbs](#breadcrumbs) · [ListView](#listview)

---

## Popover

A floating panel that opens on click: rounded-6, `surface-elevation-2`, shadow-2xl, an 80ms fade on open.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `trigger` | element or `({ ref, open, toggle, close, props }) => node` | | An element gets `ref`, `onClick`, `aria-expanded`, `aria-haspopup`, `aria-controls` and `data-state`. With a function, spread `props` and attach `ref` yourself. |
| `children` | node or `({ close }) => node` | | Panel content. |
| `open`, `onOpenChange` | bool, `(open) => void` | | Controlled. Leave `open` out to let the popover manage itself (`defaultOpen`). |
| `placement` | `'bottom-start'` etc. | `'bottom-start'` | `<side>-<align>`. Flips and shifts to stay on screen. |
| `offset` | number | `4` | Gap to the trigger, px. |
| `matchWidth` | bool | `false` | The panel is at least as wide as the trigger. |
| `panelClassName` | string | | Extra class on the panel (`className` lands there too). |
| `closeOnOutsideClick` | bool | `true` | Escape still closes. |
| `autoFocus` | bool | `true` | Focus the first `[autofocus]`/`[data-autofocus]` or tabbable element on open. Not on a phone sheet, which focuses itself so no field brings up the keyboard. |
| `mobile` | `'sheet'` \| `'popover'` | `'sheet'` | Phones (< 768px). `'sheet'`: the content opens in a bottom sheet (grab handle, scrim, swipe down or tap outside to close) — for filters and other form content. `'popover'`: a small floating panel kept inside the viewport — for a hint or a short read-only note. |
| `sheetTitle` | node | | Phones: the sheet's 17px title. Without it the sheet has only the grab handle (and is labelled by `aria-label` if given). |
| `sheetClassName` | string | | Phones: class on the sheet panel (`panelClassName` is not applied to the sheet). |

Focus returns to the trigger after Escape or `close()`, but not after an outside click.

```jsx
<Popover sheetTitle="Filters" trigger={<Button iconLeft={SlidersHorizontal} label="Filter" />}>
  {({ close }) => <FilterForm onApply={() => { apply(); close(); }} />}
</Popover>

<Popover mobile="popover" trigger={<Button variant="ghost" icon={Info} label="What is unbilled?" />}>
  <p className="x-note">Spends since the last statement.</p>
</Popover>
```

## Dropdown

An action menu (frappe-ui Dropdown + Menu): 28px rows, gray-6 icons, group labels, hairlines between groups, a red tone for destructive items, and shortcuts on the right.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `options` | items, groups, or both | `[]` | Item: `{ label, icon, onClick, to, theme: 'red', disabled, shortcut, description, selected, condition }`. Group: `{ group: 'Label' \| undefined, items: [...] }`. frappe's `options` key works in place of `items`. |
| `children` | element | `<button>Options</button>` | The trigger. It receives `data-state="open"` while open, which Button uses for its pressed look. |
| `placement` | string | `'bottom-start'` | |
| `className` | string | | On the menu panel. |
| `open`, `onOpenChange`, `offset`, `matchWidth`, `label` | | | `label` is the menu's `aria-label` (default: labelled by the trigger). |

- Items with `to` render a react-router `Link`, so Cmd-click opens a new tab. `onClick(event)` runs first.
- A group's `theme` applies to its items. `selected` gives the item the checked surface. Items whose `condition()` returns false are dropped.
- A mouse opens the menu on press, as in frappe-ui. Touch opens it on click.
- Keyboard: Enter, Space or ↓ opens the menu on the first item and ↑ on the last. ↑ and ↓ move between items, and Home/End jump to the ends. Typing a letter jumps to a matching item. Enter or Space activates the item. Escape closes the menu and focuses the trigger. Tab closes it and moves on.

```jsx
<Dropdown
  options={[
    { group: 'Transaction', items: [
      { label: 'Edit', icon: Pencil, shortcut: '⌘E', onClick: edit },
      { label: 'Open page', icon: ExternalLink, to: `/transactions/${id}` },
    ] },
    { items: [{ label: 'Delete', icon: Trash2, theme: 'red', onClick: askDelete }] },
  ]}
>
  <Button icon={MoreHorizontal} label="Actions" variant="ghost" />
</Dropdown>
```

## Dialog

A modal dialog (frappe-ui Dialog). It has a black-overlay scrim and a rounded-7 card. The title is 18px semibold, with an optional icon badge in a tone. The body scrolls between a fixed header and a fixed action row, and a hairline marks the edge when content is scrolled out of view. On phones (< 640px) the dialog docks to the bottom edge like a bottom Sheet: full width, 36px top corners, at most 90% of the screen high, sliding up. Pass `mobile="center"` to keep the centred card instead (ConfirmDialog does).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | bool | `true` | Defaults to `true`, so `{show && <Dialog …/>}` keeps working. Pass `open` to get the leave animation. |
| `onClose` | `() => void` | | Escape, outside click, the close button, and actions that have no `onClick`. |
| `title` | node | | Labels the dialog. |
| `description` | node | | `text-p-base ink-gray-7` paragraph at the top of the body. Set as `aria-describedby`. |
| `icon` | lucide component or element, or `{ icon, theme }` | | A 28px round badge before the title. |
| `theme` | `'amber' \| 'blue' \| 'red' \| 'green'` | gray | Tone of the icon badge. |
| `size` | `'xs'`…`'7xl'` | `'lg'` | Max widths: 320, 384, 448, 512, 576, 672, 768, 896, 1024, 1152, 1280px. |
| `actions` | `[{ label, variant, theme, onClick, loading, disabled, type, form, icon, size, loadingText }]` | | Rendered as frappe Buttons (default `subtle`, `gray`, `sm`), right-aligned. `onClick(event, { close })`. If it returns a promise, the button shows a spinner until it settles. An action without `onClick` (and not `type: 'submit'`) closes the dialog. With a single action on `xs`/`sm`/`md` dialogs, the button is full width. |
| `footer` | node | | Replaces `actions`. A flex row, right-aligned, 8px gap. |
| `children` | node | | Body. A one-column grid with a 12px gap. |
| `closeOnOutsideClick` | bool | `true` | |
| `dismissable` | bool | `true` | `false` hides the close button and ignores Escape and outside clicks. |
| `overline` | node | | *Legacy.* A small caption above the title. Used without `size`/`maxWidth`, the dialog keeps the old 560px width. |
| `maxWidth` | number or CSS length | | *Legacy.* Overrides `size`. |
| `label` | string | | *Legacy.* `aria-label`. Used when there is no title or you want a different name. |
| `bodyClassName` | string | | Class on the scrolling body. |
| `mobile` | `'sheet' \| 'center'` | `'sheet'` | Phone presentation: docked to the bottom edge, or the centred card. |

**On phones** (`mobile="sheet"`) the dialog docks to the bottom edge with a grab handle and a centred 17px title (× on the right), and swipes down to dismiss from the handle or the header (not from a button in it; `dismissable={false}` turns it off). Built-in `actions` share the width at 44px. A custom `footer` gets the same: kit `Button`s placed straight in it, or inside one wrapper row, share the width at 44px; anything else in it (a status line) takes a full row above them. `mobile="center"` keeps the centred card with 44px buttons sharing its width (ConfirmDialog).

Focus moves to an `[autofocus]`/`data-autofocus` element (React's `autoFocus` also works), or else to the dialog itself. Tab cycles inside the dialog, and focus returns to the opener on close.

```jsx
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Link a credit card"
  description="Statements will be matched to your bank transactions."
  actions={[
    { label: 'Cancel' },
    { label: 'Link card', variant: 'solid', onClick: async (e, { close }) => { await link(); close(); } },
  ]}
/>
```

## ConfirmDialog

frappe-ui's `dialog.confirm()`. A `md` Dialog with a theme icon (alert-triangle, info or check-circle) and the message. The confirm button is solid in the theme colour, with Cancel as an outline button to its left.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | bool | `false` | |
| `title` | node | `'Are you sure?'` | |
| `message` | node | | |
| `confirmLabel` / `cancelLabel` | string | `'Confirm'` / `'Cancel'` | |
| `theme` | `'red' \| 'gray' \| 'blue'` (also `'green'`, `'amber'`) | `'red'` | `gray` has no icon. |
| `onConfirm` | `() => void \| Promise` | | A promise shows a spinner and blocks dismissal until it settles. A rejection shows its message in red under the text, and the dialog stays open. Close it yourself on success. |
| `onCancel` | `() => void` | | Cancel, Escape, outside click, ×. |
| `icon`, `size`, `children` | | `size='md'` | `icon={null}` hides the icon. `children` goes under the message. |

```jsx
<ConfirmDialog
  open={!!pending}
  title="Delete transaction?"
  message="This also removes its friend splits."
  confirmLabel="Delete"
  onConfirm={async () => { await remove(pending.id); setPending(null); }}
  onCancel={() => setPending(null)}
/>
```

## Sheet

A side panel or drawer. `right` is a full-height panel that slides in from the right, with a hairline header (title, description, ×) and footer. `bottom` is frappe-ui's BottomSheet: a 36px top radius, a grab handle, a centred 20px title (17px on phones), a 90dvh cap, and swipe-down on the handle area to dismiss. The kit's phone pickers (Select, Combobox, DatePicker, DateRangePicker), `Popover` with `mobile="sheet"`, and `ActionSheet` are all built on it.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `open`, `onClose` | | `false` | |
| `title`, `description` | node | | |
| `side` | `'right' \| 'bottom' \| 'auto'` | `'auto'` | `auto` is right from 768px up and bottom below. |
| `width` | number or CSS length | `480` | Right side only. Capped at the viewport width. |
| `footer` | node | | Right-aligned row. |
| `dismissable` | bool | `true` | `false` hides × and turns off Escape, outside clicks and swiping. |
| `closeOnOutsideClick` | bool | `true` | |
| `label`, `bodyClassName` | | | |

The body scrolls and the right panel's body has 20px padding. Modal behaviour is the same as Dialog.

**On phones** a bottom sheet's title is 17px, and kit `Button`s in its `footer` (straight in it, or in one wrapper row) share the width at 44px; other footer content takes its own row above them. These rules are kept at low specificity, so a page can still give its main button more room (`flex-grow: 2`).

```jsx
<Sheet open={!!txn} onClose={() => setTxn(null)} title={txn?.description} footer={<Button variant="solid" label="Save" onClick={save} />}>
  <TransactionForm txn={txn} />
</Sheet>
```

## Toast

frappe-ui's ToastProvider (vue-sonner). Toasts sit bottom-right in a dark `surface-gray-9` card, 360px wide, and invert in dark mode. Up to 3 are visible in a collapsed stack that fans out on hover. Each has sonner's status glyph (red for error, amber for warning), an optional action, and a ×.

```jsx
toast('Statement queued');                                  // → id
toast.success('Saved');
toast.error({ title: 'Upload failed', description: 'The PDF is password protected.' });
toast.info('3 new transactions', { duration: 6000 });
toast.warning('Bill due in 2 days');
toast({ title: 'Deleted', action: { label: 'Undo', onClick: undo } });
toast.dismiss(id);   // toast.dismiss() dismisses all
```

| Option | Default | Notes |
|---|---|---|
| `title` (or the string message) | | |
| `description` | | Second line. |
| `variant` | `'default'` | `'success' \| 'error' \| 'info' \| 'warning'`. The helpers set it. |
| `action` | | `{ label, onClick(event) }`. Clicking it dismisses the toast unless you call `event.preventDefault()`. |
| `duration` | 4000ms (errors 6000ms) | `Infinity` keeps the toast until it is dismissed. |
| `id` | auto | Pass an existing id to update that toast in place. |
| `onDismiss` | | `(toast) => void` |

**On phones** the stack runs the width of the screen inside the page gutter, 12px above whatever the phone shell shows at the bottom: the tab bar, a `MobileActionBar`, or just the home indicator. The shell publishes that height as `--phone-chrome-bottom` on `<html>`. Rows are 48px with 15px text and a 32px close target.

Timers pause while the stack is hovered or focused, and while the tab is hidden. The region is an `aria-live="polite"` section labelled "Notifications". Mount `<Toaster />` once at the app root. Extra mounts render nothing, so a page that mounts its own `<Toaster />` (like the UI kit gallery) is harmless.

## Tabs

Underline tabs (frappe-ui Tabs, `underline` variant). Tabs sit 24px apart on a hairline rail, and a 1px `outline-gray-8` indicator slides to the selected one. Labels are muted and darken on hover and when selected. You render the panels.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tabs` | `[{ label, value, icon?, count?, disabled? }]` | `[]` | `count` shows as a small gray badge after the label. |
| `value` / `onChange` | any / `(value) => void` | | If `value` matches no enabled tab, the first enabled tab shows as selected. |
| `size` | `'sm' \| 'md'` | `'sm'` | 28 / 32px tall. |
| `idPrefix` | string | | Tab ids become `${idPrefix}-tab-${value}`, with `aria-controls="${idPrefix}-panel-${value}"`. |
| `aria-label` | string | | |

The tabs use tablist/tab roles with roving tabindex. ←/→ move and select, and Home/End jump to the ends. When the tabs don't fit, they scroll sideways inside their own box (no scrollbar) and keep the selected tab in view.

**On phones** tabs are 44px tall with 15px labels, 20px apart. Add `className="phone-bleed"` to run the rail edge to edge: the first and last tab keep the page gutter.

```jsx
<Tabs idPrefix="txn" value={tab} onChange={setTab} tabs={[{ label: 'All', value: 'all', count: 128 }, { label: 'Uncategorised', value: 'uncat', count: 7 }]} />
<div role="tabpanel" id={`txn-panel-${tab}`} aria-labelledby={`txn-tab-${tab}`}>…</div>
```

## TabButtons

A segmented control (frappe-ui TabButtons, `subtle` variant). It's a gray-2 track with an elevated pill that slides to the selected option, with 13px labels.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `options` | `[{ label, value, icon?, hideLabel?, disabled? }]` | `[]` | `hideLabel` makes the option icon-only, and `label` becomes its accessible name and tooltip. |
| `value` / `onChange` | | | |
| `size` | `'sm' \| 'md'` | `'sm'` | 26 / 28px buttons. |
| `fluid` | bool | `false` | Stretch to fill the width. |
| `aria-label` | string | | |

It uses radiogroup semantics: one tab stop, and the arrow keys move and select.

**On phones** pills are 30px in a 32px track. With `fluid` the options split the row evenly with tighter insets, so a label plus a small count (`label: <>They owe<span className="x-count">3</span></>`) fits three to a row at 375px; long labels truncate.

```jsx
<TabButtons value={range} onChange={setRange} options={[{ label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }]} />
```

## Breadcrumbs

frappe-ui Breadcrumbs. Crumbs are 16px medium and muted, with `/` separators. The last item is the current page (`aria-current="page"`, ink-gray-9) and truncates with a hover title.

| Prop | Type | Notes |
|---|---|---|
| `items` | `[{ label, to?, onClick?, icon? }]` | `to` renders a `Link` and `onClick` a button. An item with neither is plain text. |

With more than 3 items the middle ones fold into a "…" menu (first, …, last two). When even that doesn't fit, everything but the last two folds in, which is frappe's own overflow rule. The component grows to fill its row so it can measure the space it has.

```jsx
<Breadcrumbs items={[{ label: 'Friends', to: '/friends' }, { label: 'Ketul', to: `/friends/${id}` }, { label: "Ketul's wedding" }]} />
```

## ListView

**The one table component.** Every list of records — transactions, people, a person's ledger, categories, statements, payments, imports, subscriptions, an import preview — renders through `ListView`, so they all behave like the Transactions table: same header, 44px rows, hover, sorting, column resizing, saved column choices, pager, loading and empty states, keyboard. Pages only describe their columns. Don't build a table out of a `<table>` or a CSS grid of rows: `ui/__tests__/oneTable.test.ts` fails if one appears outside the exceptions listed in `DESIGN.md`.

Transactions wrap it in `components/TransactionTable.jsx`, which only adds the transaction columns and cells (category picker, card bill disclosure, row menu).

A list or table (frappe-ui's list molecule) driven by `columns`. One CSS grid template drives the header and every row. It has a 32px header with a hairline, 44px rows, hairlines between rows, and rounded hover surfaces from `sm` up. It also has a checkbox column, group headers, sort arrows, resize handles, a pager and frappe's floating "N selected" banner. The rules (tracks, handles, sorting, paging) are pure functions in `ui/internal/listModel.js`, tested in `ui/__tests__/listModel.test.ts`.

### Columns

| Field | Type | Notes |
|---|---|---|
| `key` | string | Unique per table; also the sort key and the saved-width key. |
| `label` | node | Header text. When it isn't a string, give `sortLabel` or `menuLabel` so the sort tooltip, the Columns menu and the resize handle have a name. |
| `width` | number (px) or CSS track | `'minmax(120px, 1fr)'`, `'2fr'`. A bare `Nfr` becomes `minmax(96px, Nfr)`; no width means `minmax(96px, 1fr)`. |
| `flex` | bool | The column that takes the leftover width (usually the title). It can't be resized. Without one, the first fractional column flexes. |
| `minWidth` | number | Narrowest the column can be dragged (default 64). |
| `resizable` | bool | Columns with a name are resizable by default; columns without one (row menus, checkboxes) aren't. `false` opts out, `true` opts in an unnamed one. |
| `sortable` | bool | Shows the sort button. |
| `sortValue` | `(row) => value` | What the list orders by when it sorts the rows itself (default `row[key]`). Numbers compare as numbers, text naturally and case-insensitively; blanks go last. |
| `sortFirst` | `'asc' \| 'desc'` | Direction of the first click (default `'asc'`; dates and amounts usually want `'desc'`). |
| `pinned` | bool | Can't be hidden from the Columns menu. |
| `defaultHidden` | bool | Hidden until turned on in the Columns menu. |
| `align` | `'left' \| 'right' \| 'center'` | Numbers are right-aligned. |
| `hideBelow` | `'sm' \| 'md' \| 'lg'` | Drops the track and the cell under 640 / 768 / 1024px. |
| `render` | `(row) => node` | Cell content; strings and numbers are truncated with an ellipsis. |
| `className` / `headerClassName` / `sortLabel` / `menuLabel` | | |

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `columns` | see above | `[]` | |
| `rows` | array | `[]` | Ignored when `groups` is set. |
| `rowKey` | string or `(row, index) => key` | `'id'` | Must also cover sub-rows. |
| `onRowClick` | `(row, event) => void` | | Clicks on buttons, links, inputs or resize handles inside the row don't trigger it. |
| `rowHref` | `(row) => to` | | The row is a router `Link` (Cmd-click opens a new tab). `onRowClick` still runs first. |
| `rowLinkState` | `(row) => state` | | Router `state` passed with a `rowHref` link. |
| `rowClassName` | `(row) => string` | | |
| `sort` / `onSortChange` | `{ key, direction }` / `(sort) => void` | | **Controlled**: the page orders the rows (needed when it also shows them elsewhere, e.g. a phone list, or keeps its own tie-breaks). |
| `defaultSort` | `{ key, direction }` or `null` | `null` | **Uncontrolled** (no `sort` prop): the list orders the rows by `sortValue`, starting here; `null` keeps the given order until a header is clicked. `onSortChange` still reports changes. |
| `resizable` | bool | `true` | Drag handles on the header. Turn off only for a table that must not change shape. |
| `storageKey` | string | | Saves hidden columns and dragged widths in localStorage (`{ hidden, colWidths }`). Without it they last while the table is mounted. |
| `columnSettings` | `useListSettings(…)` result | | Use instead of `storageKey` when a `ListColumnsMenu` outside the table shares the state. |
| `pagination` | `false \| true \| { page, pageSize, onPageChange, onPageSizeChange, defaultPageSize, pageSizes }` | `false` | Rows-per-page select (10/25/50/100, default 25), range and page buttons under the rows. Any field left out is kept by the list. Changing the sort goes back to page 1. Not with `groups`. |
| `subRows` | `(row) => rows \| null` | | Rows shown right under a row (an open entry group, a card bill's transactions). They follow their parent through sorting and paging and aren't counted as records. Keep the open/closed state in the page. |
| `selectable` | bool | `false` | Checkbox column and select-all in the header. Shift-click selects a range. Without `onRowClick`/`rowHref`, a row click toggles the row. Select all covers the rows on the current page. |
| `selection` / `onSelectionChange` | keys / `(keys) => void` | | Controlled. Leave out `selection` to let the list manage it. |
| `selectionActions` | `(selectedKeys, clearSelection) => node` | | Buttons in the banner, before "Select all" and ×. Style them with `ui-list-banner__btn`. |
| `loading` | bool | `false` | Skeleton rows: `skeletonRows` (5) when empty, 2 more after existing rows. |
| `emptyState` | node or string | "No results" | A string becomes `<EmptyState size="sm" title=… />`. |
| `groups` | `[{ key, label, count?, rows, collapsed? }]` | | Collapsible sections; sorting applies inside each group. `onGroupToggle(key, collapsed)`. |
| `stickyHeader` | bool | `false` | Pins the header under the page header and the list toolbar (`--list-toolbar-height`). In a scroll box set `--ui-list-sticky-top: 0px` on the box. |
| `footer` | node | | Below the rows (and the pager), e.g. "Show all". |
| `aria-label` | string | | Names the table. |

### Sorting

A header click sorts by that column in its `sortFirst` direction; clicking it again reverses. There is always an order, as on Transactions.

### Resizing

Every named, non-flexible column has an 8px handle in the gap beside its header. A hairline shows in every gap while the pointer is over the header. Left of the flexible column the handle sits on the column's right edge; right of it, on the left edge. Either way the edge you drag follows the pointer and the flexible column gives way. Double-click a handle to reset that column. Handles are focusable separators (`role="separator"`): ← / → move the edge 8px (Shift: 32px). They're hidden on touch screens. "Reset widths" in the Columns menu resets them all.

### Columns menu

```jsx
const settings = useListSettings('fintrack.people.columns', { pinned: ['name'], defaultHidden: ['email'] });
<ListColumnsMenu columns={columns} settings={settings} />   // in the toolbar
<ListView columns={columns} columnSettings={settings} … />
```

`ListColumnsMenu` lists every named, unpinned column, plus "Show all columns" and, once something was dragged, "Reset widths". The last visible optional column can't be hidden.

### Keyboard and accessibility

Interactive rows are focusable. ↑/↓ move between rows, Home/End jump to the first/last, Enter activates a row, Space toggles it when `selectable` (otherwise it activates). Headers are `columnheader`s with `aria-sort`; sort buttons are titled "Order by …"; resize handles are labelled "Resize … column".

### Layout

If the tracks need more width than there is, the list scrolls sideways inside its own box and the page never scrolls sideways. Size column floors so a table fits a 390px phone once its `hideBelow` columns drop out. Styling hooks, set on the list or any parent: `--list-gap` (8px), `--list-row-padding-x` (12px), `--ui-list-row-height` (44px; raise it on phones when a cell stacks two lines), `--ui-list-sticky-top` and `--ui-list-header-bg`.

`stickyHeader` sticks to the page while the list fits its width. A list that scrolls sideways becomes its own scroll container, and its header then stays in place.

```jsx
<ListView
  aria-label="Payments"
  columns={[
    { key: 'paidOn', label: 'Date', width: 120, sortable: true, sortFirst: 'desc', sortValue: (p) => p.paidOn, render: (p) => fmtDate(p.paidOn) },
    { key: 'via', label: 'Paid from', width: 'minmax(120px, 2fr)', flex: true, sortable: true },
    { key: 'amount', label: 'Amount', width: 112, align: 'right', sortable: true, sortValue: (p) => Number(p.amount), render: (p) => <Amount value={p.amount} /> },
    { key: 'actions', label: '', width: 40, align: 'right', render: (p) => <RowMenu payment={p} /> },
  ]}
  rows={payments}
  defaultSort={{ key: 'paidOn', direction: 'desc' }}
  storageKey="fintrack.card.payments"
  pagination
  loading={loading}
  emptyState={<EmptyState size="sm" title="No payments yet" />}
/>
```
