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

Consecutive sections are 28px apart.

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

A pushed page's main actions, pinned at the bottom of the screen in place of the tab bar (frappe-ui MailMobile, HRMS forms). Use one or two `size="lg"` buttons; they share the width, with the main one last and `variant="solid"`. It renders into the shell's footer slot, clear of the home indicator.

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
  - Rows are 56px with 15px text.
  - A paged list shows "N of M · Show 25 more" instead of the pager.
  - Add `className="phone-bleed"` to run it edge to edge inside the page gutter.
- **Dialog** docks as a bottom sheet below 768px: grab handle, 17px title, action buttons sharing the width at 44px. `mobile="center"` keeps a centred card (ConfirmDialog does this).
- **Sheet** with `side="auto"` is a bottom sheet with swipe-to-dismiss.
- **Dropdown** becomes an `ActionSheet`.
- **Button, TextInput, Select, TabButtons** are one size up: sm 32px, md 36px, lg 44px.
- **ListToolbar** pins at the top of the scroll area as a full-width band. Its filters wrap and its summary moves under them.
