# UI kit: Overlays & navigation

React ports of frappe-ui 1.0.2 overlays and navigation on Espresso tokens. Import from the barrel:

```jsx
import { Popover, Dropdown, Dialog, ConfirmDialog, Sheet, toast, Toaster, Tabs, TabButtons, Breadcrumbs, ListView } from '../components/ui';
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
| `autoFocus` | bool | `true` | Focus the first `[autofocus]`/`[data-autofocus]` or tabbable element on open. |

Focus returns to the trigger after Escape or `close()`, but not after an outside click.

```jsx
<Popover trigger={<Button iconLeft={SlidersHorizontal} label="Filter" />}>
  {({ close }) => <FilterForm onApply={() => { apply(); close(); }} />}
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

A modal dialog (frappe-ui Dialog). It has a black-overlay scrim and a rounded-7 card. The title is 18px semibold, with an optional icon badge in a tone. The body scrolls between a fixed header and a fixed action row, and a hairline marks the edge when content is scrolled out of view. On phones the card spans the width minus 16px on each side.

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

A side panel or drawer. `right` is a full-height panel that slides in from the right, with a hairline header (title, description, ×) and footer. `bottom` is frappe-ui's BottomSheet: a 36px top radius, a grab handle, a centred 20px title, a 90dvh cap, and swipe-down on the handle area to dismiss.

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

The tabs use tablist/tab roles with roving tabindex. ←/→ move and select, and Home/End jump to the ends. When the tabs don't fit, they scroll sideways inside their own box and keep the selected tab in view.

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

A list or table (frappe-ui's list molecule) driven by `columns`. One CSS grid template drives the header and every row. It has a 32px header with a hairline, 40px rows, hairlines between rows, and rounded hover surfaces from `sm` up. It also has a checkbox column, group headers, sort arrows and frappe's floating "N selected" banner.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `columns` | `[{ key, label, width, align, render?(row), sortable?, className?, headerClassName?, hideBelow? }]` | `[]` | `width`: a CSS track (`'2fr'`, `'minmax(120px,1fr)'`) or px number. A bare `Nfr` becomes `minmax(96px, Nfr)`, and no width means `minmax(96px, 1fr)`. `align`: `'left' \| 'right' \| 'center'`. `hideBelow`: `'sm' \| 'md' \| 'lg'` (640 / 768 / 1024px) drops the track and the cell. |
| `rows` | array | `[]` | Ignored when `groups` is set. |
| `rowKey` | string or `(row, index) => key` | `'id'` | |
| `onRowClick` | `(row, event) => void` | | Clicks on buttons, links or inputs inside a cell don't trigger it. |
| `rowHref` | `(row) => to` | | The row is a router `Link` (Cmd-click opens a new tab). `onRowClick` still runs first. |
| `selectable` | bool | `false` | Shows the checkbox column and a select-all checkbox in the header. Shift-click selects a range. Without `onRowClick`/`rowHref`, a row click toggles the row. |
| `selection` / `onSelectionChange` | keys / `(keys) => void` | | Controlled. Leave out `selection` to let the list manage it. |
| `selectionActions` | `(selectedKeys, clearSelection) => node` | | Buttons in the banner, before "Select all" and ×. Style them with `ui-list-banner__btn` to match. |
| `sort` / `onSortChange` | `{ key, direction }` / `(sort \| null) => void` | | Sortable headers cycle asc → desc → none (`null`). You sort the rows. |
| `loading` | bool | `false` | Skeleton rows: `skeletonRows` (5) when empty, 2 more after existing rows. |
| `emptyState` | node | "No results" | |
| `groups` | `[{ key, label, count?, rows, collapsed? }]` | | Collapsible sections. `collapsed` is the starting state. `onGroupToggle(key, collapsed)`. |
| `stickyHeader` | bool | `false` | Pins the header (and its white background) while the list scrolls. |
| `rowClassName` | `(row) => string` | | |
| `footer` | node | | Below the rows, e.g. "Load more". |
| `aria-label` | string | | Names the table. |

Keyboard: interactive rows are focusable. Enter activates a row. Space toggles it when `selectable` (otherwise it activates), and ↑/↓ move between rows.

Layout: if the tracks need more width than there is, the list scrolls sideways inside its own box and the page never scrolls sideways. Styling hooks, set on the list or any parent: `--list-gap` (8px), `--list-row-padding-x` (12px), `--ui-list-row-height` (40px), `--ui-list-sticky-top` (0) and `--ui-list-header-bg`.

`stickyHeader` sticks to the page while the list fits its width. A list that scrolls sideways becomes its own scroll container. In that case, put it in a box with a height (for example `max-height: 60vh; overflow: auto`) and the header sticks inside that box.

```jsx
<ListView
  aria-label="Transactions"
  columns={[
    { key: 'date', label: 'Date', width: 90, sortable: true, hideBelow: 'sm', render: (t) => fmtDate(t.date) },
    { key: 'description', label: 'Description', width: 'minmax(160px, 2fr)', sortable: true },
    { key: 'category', label: 'Category', width: 140, hideBelow: 'md' },
    { key: 'amount', label: 'Amount', width: 120, align: 'right', sortable: true, render: (t) => <Amount value={t.amount} /> },
  ]}
  rows={rows}
  rowHref={(t) => `/transactions/${t.id}`}
  selectable
  selection={selected}
  onSelectionChange={setSelected}
  selectionActions={(keys, clear) => <button className="ui-list-banner__btn" onClick={() => { bulkDelete(keys); clear(); }}>Delete</button>}
  sort={sort}
  onSortChange={setSort}
  loading={loading}
/>
```
