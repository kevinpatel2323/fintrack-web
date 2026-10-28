# UI kit: Basics

React ports of frappe-ui 1.0.2 components (plus a few Fintrack pieces) on Espresso tokens. Import from the barrel:

```jsx
import { Button, Badge, Card, StatCard, Amount } from '../components/ui';
```

Every component takes `className` (merged onto the root) and spreads unknown props onto its root element. Ref-forwarding: all except `Tooltip`. Icons are lucide-react components passed as props (`icon={Plus}`); the kit renders them at Frappe's size with `strokeWidth={1.5}`. Gallery: `/ui-kit` in dev.

- [Button](#button) · [Badge](#badge) · [Avatar](#avatar) · [Spinner](#spinner) · [LoadingIndicator](#loadingindicator) · [Skeleton](#skeleton) · [Divider](#divider) · [Progress](#progress) · [Tooltip](#tooltip)
- [Alert](#alert) · [ErrorMessage](#errormessage) · [KeyboardShortcut](#keyboardshortcut) · [EmptyState](#emptystate) · [Card](#card) · [StatCard](#statcard) · [Amount](#amount)

---

## Button

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `'solid' \| 'subtle' \| 'outline' \| 'ghost'` | `'subtle'` | Solid gray (black) is the one primary action on a screen. |
| `theme` | `'gray' \| 'blue' \| 'green' \| 'red'` | `'gray'` | Red for destructive actions only. |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'sm'` | Heights 24 / 28 / 32 / 40px. md and lg are medium weight. |
| `label` | string | | Text. With `icon`, it becomes the `aria-label` instead. |
| `children` | node | | Replaces `label` as the visible text. |
| `icon` | lucide component | | Icon-only square button. Always give it a `label`. |
| `iconLeft`, `iconRight` | lucide component or element | | Before / after the label. |
| `loading` | bool | `false` | Spinner in place of `iconLeft`, keeps its colours, not clickable, `aria-busy`. |
| `loadingText` | string | | Label shown while loading. |
| `disabled` | bool | `false` | Dimmed look, no hover. |
| `active` | bool | `false` | Held "pressed" look. Also applied when `data-state` is `'open'` or `'active'` (Dropdown/Popover triggers set this for you). For a toggle, also pass `aria-pressed`. |
| `to` | router `to` | | Renders a react-router `Link`. |
| `href` | string | | Renders `<a target="_blank" rel="noreferrer noopener">`. Pass `target`/`rel` to override. |
| `type` | string | `'button'` | Native button type (`'submit'` in forms). |
| `tooltip` | string or node | | Wraps the button in `Tooltip`. Icon buttons without a `label` use it as their `aria-label`. |

A disabled or loading button with `to`/`href` renders as a `<button disabled>`, as in Frappe.

```jsx
<Button variant="solid" iconLeft={Plus} label="New transaction" onClick={openNew} />
<Button icon={MoreHorizontal} label="More actions" variant="ghost" />
<Button variant="outline" theme="red" label="Delete" loading={deleting} onClick={remove} />
<Button to="/transactions" variant="ghost" label="View all" iconRight={ArrowRight} />
```

## Badge

| Prop | Type | Default |
|---|---|---|
| `theme` | `'gray' \| 'blue' \| 'green' \| 'amber' \| 'red' \| 'violet'` | `'gray'` |
| `variant` | `'solid' \| 'subtle' \| 'outline' \| 'ghost'` | `'subtle'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` (heights 16 / 20 / 24px) |
| `label` | string or number | |
| `children` | node | replaces `label` |
| `prefix`, `suffix` | lucide component or node | sized 10px (12px at `lg`) |

Unknown values fall back to the defaults.

```jsx
<Badge theme="green" label="Paid" prefix={Check} />
<Badge theme="red" variant="solid" label={3} />
```

## Avatar

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | | The person's full name. Initials come from `initialsOf` (`utils/categoryColors.js`): "Het Patel (Sankalp)" gives HP. xs and sm show the first letter only. Also the image's alt text and the avatar's accessible name. |
| `image` | URL | | Falls back to initials if it fails to load. |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl' \| '3xl'` | `'md'` | 16 / 20 / 24 / 28 / 32 / 40 / 46px |
| `shape` | `'circle' \| 'square'` | `'circle'` | |
| `theme` | `'gray' \| 'blue' \| 'green' \| 'amber' \| 'red' \| 'violet'` | `'gray'` | Initials only. |
| `indicator` | `'green' \| 'amber' \| 'red' \| 'blue' \| 'gray'` or node | | Dot on the bottom-right corner. |
| `children` | node | | Replaces the initials (an icon). |

Next to a visible name, pass `aria-hidden` so the name isn't read twice.

```jsx
<Avatar label={friend.name} size="lg" />
<Avatar label="Yash Patel" image={photoUrl} indicator="green" aria-hidden />
```

## AvatarGroup

People involved in something, as Jira shows assignees: overlapping initials avatars (a stable colour per person), each named on hover and linking to `to`. The group measures its own width and shows as many faces as fit, up to `max`. When not everyone fits, the last slot is a "+N" chip that opens a menu of the rest.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `people` | `[{ id, name, to? }]` | `[]` | Renders nothing when empty. |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | 16–32px faces. |
| `max` | number | `5` | Most faces shown even when there's room. |
| `label` | string | `'People'` | Prefix of the group's accessible name ("Split with: Yash, Kevin"). |
| `interactive` | bool | `true` | `false` draws plain markup (no links, hover names or menu), for use inside a button such as a list row. |

The ring around each face is the page surface; set `--ui-avatar-group-ring` where the group sits on another colour (a hovered or selected row).

```jsx
<AvatarGroup people={peopleFromTags(tx.friendTags)} label="Split with" />
```

## Spinner

| Prop | Type | Default | Notes |
|---|---|---|---|
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | | 12 / 14 / 16 / 20px. Omit it to size with CSS (16px by default). |
| `theme` | `'gray' \| 'red'` | | Omit it to inherit the text colour. |
| `track` | bool | `false` | Faint full ring behind the arc. |

`role="status"`, `aria-label="Loading"` (override with `aria-label`).

```jsx
<Spinner size="sm" />
```

## LoadingIndicator

Frappe's older name for `Spinner`, with the same props. With `text`, it is frappe-ui's LoadingText instead: a 12px spinner and 14px `--ink-gray-4` text.

| Prop | Type | Notes |
|---|---|---|
| `text` | string or `true` | `true` shows "Loading...". |
| Spinner props | | `size` applies only without `text`. |

```jsx
{loading && <LoadingIndicator text="Loading statements..." />}
```

## Skeleton

A pulsing `--surface-gray-3` block (`aria-hidden`). Set `aria-busy` on the region that is loading.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `width`, `height` | number (px) or CSS length | | Or size it with a class. |
| `circle` | bool | `false` | Otherwise 8px corners. |
| `as` | element type | `'div'` | Use `'span'` inside inline or button content. |

```jsx
<div aria-busy="true">
  <Skeleton height={14} width="60%" />
  <Skeleton circle width={32} height={32} />
</div>
```

## Divider

| Prop | Type | Default | Notes |
|---|---|---|---|
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | 1px `--outline-gray-2`. |
| `flexItem` | bool | `false` | Stretch to the flex row's height (vertical rule between items). |
| `action` | `{ label, onClick, ...Button props }` | | A button on the rule. Defaults to sm outline. |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | Where the action sits. |

```jsx
<Divider />
<div className="row"><span>Left</span><Divider orientation="vertical" flexItem /><span>Right</span></div>
<Divider action={{ label: 'Load older entries', onClick: loadMore }} />
```

## Progress

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | number 0–100 | `0` | Clamped. |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'sm'` | Bar height 2 / 4 / 8 / 12px. |
| `label` | string | | Shown top-left. Also the accessible name (otherwise "Progress"). |
| `hint` | `true` or node | | `true` shows "{value}%" top-right. A node replaces that text. |
| `intervals` | number | | Segmented bar. Fills whole segments only. |

```jsx
<Progress value={pct} size="md" label="Statements imported" hint />
```

## Tooltip

| Prop | Type | Default | Notes |
|---|---|---|---|
| `text` | string or node | | Nothing renders without it. |
| `children` | one element | | The trigger. It is cloned with the ref and handlers, not wrapped, so it must be focusable and forward its ref (all kit components do). Text children get a focusable `<span>`. |
| `placement` | `'top' \| 'bottom' \| 'left' \| 'right'`, optionally `-start`/`-end` | `'top'` | Flips and shifts to stay on screen. |
| `hoverDelay` | ms | `500` | Delay before opening on hover. Hovering the next trigger within 300ms of a close opens it at once. |
| `offset` | px | `4` | Gap between the arrow tip and the trigger. |
| `disabled` | bool | `false` | Renders only the trigger. |

Opens on hover and on keyboard focus (`:focus-visible`). Closes on leave, blur, pointer-down and Escape. Wires `aria-describedby` while open. The bubble is hoverable. A plain `Button` can use its `tooltip` prop instead.

```jsx
<Tooltip text="Includes 3 pending transactions">
  <Button variant="ghost" icon={Info} label="About this total" />
</Tooltip>
```

## Alert

An in-page status message. The layout follows the content: a 40px row when there is only a title, and a banner when there is a `description` or a `secondaryAction`. The surface is the same for every theme. `theme` colours only the icon and the row action's label. For short, transient feedback use `toast` instead.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | node | | |
| `description` | node | | Switches to the banner layout. |
| `theme` | `'gray' \| 'blue' \| 'green' \| 'amber' \| 'red'` | `'gray'` | Red and amber get `role="alert"`. The others get `role="status"`. |
| `icon` | `true \| false \|` lucide component or element | `true` | `true` uses the theme's status glyph. |
| `prefix` | node | | Replaces the icon area (e.g. `<Spinner size="sm" />`). |
| `primaryAction` | `{ label, onClick({ dismiss }), ...Button props }` | | Ghost button in a row. Elevated outline button in a banner. An async `onClick` shows a spinner until it settles. |
| `secondaryAction` | same | | Ghost button. Switches to the banner layout. |
| `actions` | node or `({ dismiss }) => node` | | Replaces both buttons. |
| `dismissible` | bool | `false` | Shows ×. |
| `onDismiss` | function | | Called by × and by an action's `dismiss()`. The parent hides the alert. |

```jsx
<Alert theme="blue" title="Statement ready to import" primaryAction={{ label: 'Import', onClick: startImport }} />
<Alert
  theme="amber"
  title="3 settlements need review"
  description="Review them so People balances stay correct."
  primaryAction={{ label: 'Review now', onClick: openReview }}
  secondaryAction={{ label: 'Later', onClick: ({ dismiss }) => dismiss() }}
  onDismiss={() => setShowReview(false)}
/>
```

## ErrorMessage

13px `--ink-red-7` text with `role="alert"`. Renders nothing when there is no error. Messages are shown as plain text, one line each.

| Prop | Type | Notes |
|---|---|---|
| `message` | string, string[], or Error | An Error shows its `messages` (string or array) if it has any, otherwise its `message`. |

```jsx
<ErrorMessage message={saveError} />
```

## KeyboardShortcut

Display only. It does not bind the key.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `combo` | string | | `Mod+Ctrl+Alt+Shift+<Key>`. `Mod` is ⌘ on Apple devices and Ctrl elsewhere. Keys: letters, F1–F12, `Enter`, `Escape`, `ArrowUp`…, `Slash`, `Comma`, `Digit1`… |
| `bg` | bool | `false` | Grey key chips instead of muted inline text. |
| `showPlus` | `'auto' \| bool` | `'auto'` | Plain mode only. `'auto'` draws `+` only between two text keys. |
| `altCombos` | string[] | `[]` | Shown after a `/`. |
| `useIcons` | bool | `true` | Arrows, Enter, Backspace and Delete as icons. |
| `children` | node | | Fallback when there's no `combo`. |

```jsx
<KeyboardShortcut combo="Mod+K" />
<KeyboardShortcut bg combo="Mod+Enter" />
```

## EmptyState

| Prop | Type | Default | Notes |
|---|---|---|---|
| `icon` | lucide component or element | | 32px (24px at sm), `--ink-gray-4`. |
| `title` | node | | Says what's missing ("No transactions this month"). |
| `description` | node | | One line with the next step. |
| `action` | node | | Usually a `Button`. |
| `size` | `'md' \| 'sm'` | `'md'` | `sm` for use inside cards and lists. |

```jsx
<EmptyState
  icon={Inbox}
  title="No transactions this month"
  description="Import a statement or add one by hand."
  action={<Button variant="solid" iconLeft={Upload} label="Import statement" to="/import" />}
/>
```

**On phones** the md state uses body-size text (16px title, 15px description) with 48px of air above and below, at most 320px wide; `sm` keeps a 15px title and 13px description.

## Card

The panel for dashboard widgets and detail-page sections: base surface, 1px `--outline-gray-1`, 10px corners, no shadow.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | node | | `text-base` medium, `--ink-gray-9`. |
| `description` | node | | `text-sm`, `--ink-gray-5`. |
| `actions` | node | | Right of the title, centred on the title line (a 28px button doesn't push the body down). |
| `footer` | node | | Full-width strip under a hairline (e.g. "View all"). |
| `padding` | `'none' \| 'sm' \| 'md'` | `'md'` | md: 12px × 16px. sm: 8px × 12px. none: the body is flush and clipped to the corners (lists, tables), while the header and footer keep a 16px inset. |
| `as` | element type | `'div'` | With `section`, `article` or `aside` and a `title`, the root is labelled by the title. |
| `titleAs` | element type | `'h2'` | Heading level for the title. |

```jsx
<Card
  title="Spending by category"
  description="October 2026"
  actions={<Button variant="ghost" icon={MoreHorizontal} label="More" />}
  footer={<Button variant="ghost" label="View all" iconRight={ArrowRight} to="/categories" />}
>
  <CategoryChart data={data} />
</Card>
```

## StatCard

One figure on the Card surface, like frappe-ui's NumberCard (the Insights number widget).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | node | | `text-sm`, `--ink-gray-5`. |
| `value` | node, string or number | | 20px semibold, tabular. Numbers get en-IN grouping. `null` shows a muted "—" and "No data". For money, pass `<Amount value={n} tone="inherit" />` so the figure stays `--ink-gray-9`. |
| `delta` | number (percent) | | ↗ or ↙ arrow plus the unsigned percent. 0 shows no arrow. |
| `deltaLabel` | node | | e.g. "vs last month". |
| `positiveIsGood` | bool | `true` | `false` makes a rise red and a fall green (spend, dues). |
| `hint` | node | | Muted line under the figure. |
| `loading` | bool | `false` | Skeletons the figure and the delta at the same height. |
| `to` / `onClick` | | | The whole card becomes a `Link` / `button` with a hover state. |

```jsx
<StatCard
  label="Spent this month"
  value={<Amount value={spent} tone="inherit" />}
  delta={12.4}
  deltaLabel="vs last month"
  positiveIsGood={false}
  to="/transactions?month=2026-10"
/>
```

**On phones** a StatCard is a compact tile: 12px padding, 13px label, 20px semibold value, 13px muted lines under it, so two fit side by side at 375px (`grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px`). A long hint or caption truncates.

## Amount

The only way to print money. It uses `utils/inr.js`, en-IN grouping, tabular figures and a true minus sign (−).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | number (rupees, signed) | | Not a number → muted "—". |
| `sign` | `'auto' \| 'always' \| 'never'` | `'auto'` | auto: `−₹500` / `₹500`. always: `−₹500` / `+₹500` (zero unsigned). never: `₹500`. |
| `tone` | `'auto' \| 'in' \| 'out' \| 'due' \| 'muted' \| 'inherit'` | `'auto'` | auto: positive is `in` (green), otherwise `out` (ink). `due` is red. |
| `compact` | bool | `false` | `₹1.2L`, `₹3.4Cr`, `₹12k`. The full figure goes in the `title`. |
| `decimals` | number | `0` | Full format only. |

```jsx
<Amount value={txn.amount} sign="always" />      {/* −₹67 in ink, +₹6,265 in green */}
<Amount value={balance} tone="due" />
<Amount value={total} compact />
```
