# Phone components

The phone layout (< 768px) rules are in `DESIGN.md#phone`. This page is the API for the pieces built for it, and for what the rest of the kit does on its own on a phone.

```jsx
import {
  ActionSheet, MobileActionBar, MobileField, MobileList, MobileListItem, MobileSection,
} from '../components/ui';
import { useIsCompact } from '../styles/breakpoints.js';
```

`useIsCompact()` is true below 768px. Render phone components only when it is true. They assume the phone shell around them.

## The shell

`components/shell/AppShell.jsx` renders frappe-ui's `MobileShell` on phones. It is a fixed column:

1. Header slot
2. Scrolling content
3. Footer slot
4. Tab bar, on a tab's own page only (`isTabRoot` in `shell/nav.js`)

Inside the scroll area `--header-height` is `0px`, so anything sticky inside the page pins at the top of the scroll area: a `ListToolbar`, a list header, a date header.

The shell also publishes how much of the bottom of the screen it covers (a `MobileActionBar`, the tab bar, each with its home-indicator inset) as `--phone-chrome-bottom` on `<html>`. Toasts use it to sit just above; use it for anything else that floats at the bottom of the screen outside the scroll area.

Tapping the tab you are on scrolls its page back to the top. Installed to the home screen, the header pads the status bar (`env(safe-area-inset-top)`); a screen without a `PageHeader` still keeps that strip clear.

## PageHeader on phones

Pass `title`, `back` (a path, `true` or a handler) and `mobileActions` (one or two `variant="ghost"` icon buttons). On phones it renders into the shell's fixed header slot. The leading control is chosen in this order:
1. Back, when `back` is given.
2. The You button, on a tab's own page.
3. Otherwise Back.

Back returns to the previous screen when the app has one, otherwise to `back` (or `/you` for pages under You, `/` elsewhere).

```jsx
<PageHeader
  title="Regalia ••4242"
  back="/cards"
  actions={desktopActions}
  mobileActions={
    <>
      <Button variant="ghost" icon={Plus} label="Add transaction" onClick={add} />
      <Dropdown options={more} label="Card actions">
        <Button variant="ghost" icon={Ellipsis} label="More actions" />
      </Dropdown>
    </>
  }
/>
```

## MobileSection

A titled block on a phone page. It is a heading with content under it, not a boxed card.

| Prop | |
|---|---|
| `title` | 17px semibold heading |
| `description` | muted 13px line under the title |
| `action` | `{ label, to }` (a "View all ›" link) or `{ label, onClick }` |
| `aside` | any control on the right of the heading (e.g. a `TabButtons`) |

Consecutive sections are 28px apart. The title shares its row with `aside` or `action`, centred on each other; the description runs under the title only.

## MobileList, MobileListItem

Lists that aren't tables of records: an overview's short lists, a settings hub, menus. Records stay in `ListView`.

`MobileList` runs edge to edge (it cancels the page gutter and pads its rows by it). `variant="inset"` is a rounded grouped block inside the gutter (`surface-gray-1`), for settings-style lists.

`MobileListItem`:

| Prop | |
|---|---|
| `leading` | 32px tile, avatar or icon |
| `title`, `subtitle` | 16px `ink-gray-8` over 13px `ink-gray-5`, each one line |
| `value`, `valueSub` | right side: 16px medium tabular figures, with a 13px line under them |
| `to` / `href` / `onClick` | makes the row a link or a button (pressed state, no hover) |
| `state`, `replace` | passed to the router `Link` |
| `chevron` | drill-in arrow |
| `actions` | Dropdown options; adds a trailing `…` that opens them as an action sheet |
| `disabled`, `tone="red"` | |
| `children` | extra content under the subtitle (e.g. a progress bar) |
| `role`, `aria-*` | passed to the row's link or button, so a list can act as a picker (`role="radio"` with `aria-checked`, or `aria-current`) |

Rows are at least 48px tall, with inset hairlines between them (starting at the text when the rows have a leading tile).

## MobileField

A label/value row: the label is muted on the left, the value on the right and allowed to wrap. Put the rows in a `MobileList` (`variant="inset"` for a grouped block) to show a record's fields: a desktop side panel on a phone.

```jsx
<MobileList variant="inset" aria-label="Details">
  <MobileField label="Date">31 Oct 2026</MobileField>
  <MobileField label="Method">UPI · OKICICI</MobileField>
</MobileList>
```

## MobileActionBar

A pushed page's main actions, pinned at the bottom of the screen in place of the tab bar (frappe-ui MailMobile, HRMS forms). Use one or two `size="lg"` buttons; they share the width, with the main one last and `variant="solid"`. It renders into the shell's footer slot, clear of the home indicator. To let a secondary button keep its natural width while the main one takes the rest ("Import 22 transactions"), give it `data-shrink` (or the class `ui-mactionbar__secondary`).

```jsx
{isMobile && (
  <MobileActionBar>
    <Button size="lg" iconLeft={Users} label="Split" onClick={openSplit} />
    <Button size="lg" variant="solid" label="Settle up" onClick={settle} />
  </MobileActionBar>
)}
```

## ActionSheet

A menu as a bottom sheet: 52px rows with 20px icons, red destructive items, a check on the selected item, and Cancel at the bottom. It takes Dropdown's `options`, and picking an item runs it and closes the sheet.

```jsx
<ActionSheet open={open} onClose={() => setOpen(false)} title="Sort by" options={options} />
```

`Dropdown` switches to an `ActionSheet` by itself on phones. Its `label` becomes the sheet's title, so give a menu a `label`.

## What the kit does on its own on a phone

- **ListView**
  - The header row is hidden; it stays for screen readers.
  - A "Sorted by …" control opens the sortable columns as an action sheet. Picking the current column again reverses it.
  - No column resizing; saved desktop widths don't apply.
  - Rows are 56px with 15px text. Style your own cell content (16px title, 13px second line) — the 15px is only the default for plain text cells.
  - A paged list shows "N of M · Show 25 more" under the rows while there are more to show, instead of the pager. Once every row is showing there is no footer.
  - Group headers are 40px with a 36px fold button. Sub-rows (`subRows`) are flattened under their parent as they are on desktop; indent or mark them with `rowClassName`.
  - The selection banner spans the width inside the gutter and floats 12px above the tab bar or action bar (or the home indicator), with 36px buttons.
  - Add `className="phone-bleed"` to run it edge to edge inside the page gutter.
  - Row hairlines span the row's tracks. Set `--ui-list-divider-inset` on the list (e.g. `44px` for a 32px leading tile plus the 12px gap) to start them at the text, iOS-style.
- **Select, Combobox** open their options in a bottom sheet: grab handle, a title (`sheetTitle`, else the field's label, `aria-labelledby`, `title`, `aria-label` or a specific placeholder), the search box pinned on top, 48px rows, a check on the selected one, the create row and the empty text. The sheet takes focus, not the search box, so the keyboard comes up only when the search box is tapped. `renderTrigger` pickers (a category tile in a row) open the same sheet; give them a `title` or `sheetTitle` ("Change category"), since their `aria-label` is usually a sentence.
- **DatePicker, DateRangePicker** open the calendar in a bottom sheet with 44px day cells; the range picker's `presets` are chips above the grid and a line says which end to pick next. The field is read-only on phones (no keyboard), and still shows the formatted value. `sheetTitle` overrides the title (default: the field's label).
- **Popover** opens as a bottom sheet (`mobile="sheet"`, the default; title with `sheetTitle`). Pass `mobile="popover"` for a small info panel that should stay floating; it is kept inside the viewport.
- **Dialog and Sheet** never put focus in a text field on phones when they open (React `autoFocus` or `[autofocus]` included): the panel takes focus, so the keyboard doesn't come up over the sheet. Focus trap and restore are unchanged.
- **Dialog** docks as a bottom sheet below 768px: grab handle, a centred 17px title (the × stays on the right, balanced by an empty column on the left), action buttons sharing the width at 44px, swipe down on the handle or header to dismiss. A custom `footer`'s kit Buttons (straight in it or in one wrapper row) share the width at 44px; any other footer content takes its own row above them. `mobile="center"` keeps a centred card (ConfirmDialog does this), with its two buttons sharing the width.
- **Sheet** with `side="auto"` is a bottom sheet with swipe-to-dismiss. Bottom-sheet titles are 17px on phones, and the `footer`'s kit Buttons share the width at 44px like a docked Dialog's (the rule has low specificity, so a page can still make the main button wider).
- **Dropdown** becomes an `ActionSheet`.
- **Tabs** are 44px tall with 15px labels and scroll sideways without a scrollbar, keeping the selected tab in view. `className="phone-bleed"` runs them edge to edge with the gutter inside.
- **TabButtons** are 30px pills in a 32px track; with `fluid` they split the row evenly with tighter insets so a label and a count fit three to a row at 375px.
- **Toasts** run the width of the screen inside the gutter, 12px above the tab bar, a `MobileActionBar` or the home indicator.
- **StatCard** is a compact tile (12px padding, 13px label, 20px semibold value, 13px lines under it): two fit side by side at 375px.
- **EmptyState** uses body-size text (16px title, 15px description) on phones.
- **Button, TextInput, Select, TabButtons** are one size up: sm 32px, md 36px, lg 44px. **Checkbox** gets a 16px box (18px at md) and a 15px label, padded rows 40/44px; **Switch** labels are 15px. Below 768px text fields and picker triggers use 16px text, so iOS never zooms.
- **ListToolbar** pins at the top of the scroll area as a full-width band. Its filters wrap and its summary moves under them.

## The gallery

`/ui-kit` on a phone-width viewport opens with a **Phone** section (`pages/dev/kit/PhoneDemo.jsx`): MobileSection, StatCard tiles, MobileList (plain and inset), MobileListItem with actions, MobileField, the pickers as sheets, Popover in both phone modes, ActionSheet, Dropdown, Tabs with `phone-bleed`, fluid TabButtons with counts, EmptyState and a MobileActionBar toggle.
