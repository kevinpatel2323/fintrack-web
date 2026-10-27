# UI kit: Forms

React ports of frappe-ui 1.0.2 form controls on Espresso tokens. Import from the barrel:

```jsx
import { FormControl, TextInput, Select, Combobox, DatePicker, Checkbox, Switch, RadioGroup } from '../components/ui';
```

- [TextInput](#textinput) · [Textarea](#textarea) · [Select](#select) · [FormLabel](#formlabel) · [FormControl](#formcontrol)
- [Checkbox](#checkbox) · [Switch](#switch) · [Radio / RadioGroup](#radio--radiogroup)
- [Combobox](#combobox) · [DatePicker](#datepicker) · [DateRangePicker](#daterangepicker) · [FileUploader](#fileuploader)

Gallery: `/ui-kit` in dev (`pages/dev/kit/FormsDemo.jsx`).

---

## Conventions

**`onChange` comes in two shapes.**

| Gives you | Components |
|---|---|
| the native **event** (`e.target.value`, `e.target.checked`) | `TextInput`, `Textarea`, `Select`, `Checkbox` |
| the **value** | `Switch` (boolean), `RadioGroup`, `Combobox`, `DatePicker` (`'YYYY-MM-DD'`), `DateRangePicker` (`{ start, end }`), `FileUploader` (`onFiles(File[])`) |

`FormControl` passes `onChange` straight to the control its `type` picks, so the shape follows that control.

**Sizes.** Text-like controls take `'xs' | 'sm' | 'md' | 'lg' | 'xl'`, with heights 24 / 28 / 32 / 40 / 40px. `sm` is the default and the app's standard. `xl` is `lg` with an 18px font: frappe-ui 1.0 dropped it, and the kit keeps it for older call sites. Toggles (Checkbox, Switch, Radio) take `'xs' | 'sm' | 'md'`.

**Variants.** `'subtle'` (gray fill, the default), `'outline'` (white with a border) and `'ghost'` (no box).

**Props and refs.** Every control takes `className`, `id` and `disabled`. Unknown props (`name`, `aria-*`, `onBlur`, `autoFocus` …) go to the focusable element, which is also what the ref points at. The table for each component says which element gets `className`.

**Icons.** Pass lucide components (`prefix={Search}`). The kit draws them at 16px with `strokeWidth={1.5}`. Any React node works too.

**Errors.** Pass `invalid` to a bare control for `aria-invalid` and a red border. Inside `FormControl`, pass `error="…"` instead: it shows the message under the field and sets `invalid` and `aria-errormessage` for you.

---

## TextInput

Port of `TextInput.vue`. A fixed-height, single-line field. It turns white with a darker border and a small shadow on focus, and draws no focus ring.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `type` | string | `'text'` | Any input type: `number`, `email`, `password`, `search`, `tel` … |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'sm'` | |
| `variant` | `'subtle' \| 'outline' \| 'ghost'` | `'subtle'` | |
| `prefix`, `suffix` | lucide component or node | | Laid over the input with padding reserved for 16px. Icons are `--ink-gray-5` and let clicks through to the input. Nodes stay clickable. |
| `value`, `onChange(event)` | | | Native, controlled or uncontrolled. |
| `placeholder`, `disabled` | | | |
| `invalid` | bool | `false` | `aria-invalid` and a red border. |
| `className` | string | | On the wrapper `div`. |
| `inputClassName` | string | | On the `<input>`. |
| `autoComplete` | string | `'off'` | As in Frappe. |

The ref points at the `<input>`. For a keyboard hint in a search box, put `KeyboardShortcut` in the suffix.

```jsx
<TextInput prefix={Search} suffix={<KeyboardShortcut combo="Mod+K" />} placeholder="Search" aria-label="Search"
  value={q} onChange={(e) => setQ(e.target.value)} />
<TextInput type="number" prefix={<span className="text-ink-gray-5">₹</span>} value={amt} onChange={(e) => setAmt(e.target.value)} />
```

## Textarea

Port of `Textarea.vue`. It has the same look as TextInput. The text is a flat 13px (`text-p-sm`) at every size; `size` only changes the padding, radius and minimum height.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'sm'` | `xl` renders as `lg`. |
| `variant` | `'subtle' \| 'outline' \| 'ghost'` | `'subtle'` | |
| `rows` | number | `3` | Resizes vertically. |
| `value`, `onChange(event)`, `placeholder`, `disabled`, `invalid` | | | |
| `className` | string | | On the `<textarea>` (the ref target). |

```jsx
<Textarea rows={4} placeholder="Notes" value={note} onChange={(e) => setNote(e.target.value)} />
```

## Select

A native `<select>` styled as frappe-ui's Select trigger: same heights and variants as TextInput, an `--ink-gray-7` value, an `--ink-gray-4` placeholder and a 16px chevron. The menu is the browser's own. For search, icons or descriptions, use `Combobox`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `options` | array | `[]` | Strings or numbers; `{ label, value, disabled }`; or groups `{ group, options }` (rendered as `<optgroup>`). |
| `placeholder` | string | | A disabled `value=""` first option. The control shows it in gray while the value is `''`. |
| `value`, `onChange(event)` | | | Native. `e.target.value` is always a string. `defaultValue` works for uncontrolled use. |
| `size`, `variant` | | `'sm'`, `'subtle'` | |
| `prefix` | lucide component or node | | Before the value, `--ink-gray-6`. |
| `disabled`, `invalid` | bool | | |
| `className` | string | | On the wrapper. The wrapper is `inline-flex` and as wide as the longest option; give it a width or put it in a `FormControl` to fill the row. |
| `selectClassName` | string | | On the `<select>` (the ref target). |

```jsx
<Select placeholder="Frequency" options={['Weekly', 'Monthly', { label: 'Yearly', value: 'yearly' }]}
  value={freq} onChange={(e) => setFreq(e.target.value)} />
```

## FormLabel

Port of `FormLabel.vue` / `InputLabel.vue`: a 13px `--ink-gray-6` label. Its size never follows the control's.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` / `children` | node | | |
| `id` (or `htmlFor`) | string | | The **control's** id, wired to `for` (Frappe's naming). |
| `labelId` | string | | The label's own id, for `aria-labelledby`. |
| `required` | bool | `false` | Red `*` (hidden from screen readers) plus an sr-only "(required)". |
| `disabled` | bool | `false` | `--ink-gray-4`. |
| `color` | `'gray-6' \| 'gray-7'` | `'gray-6'` | `gray-7` is the darker label used beside a checkbox or switch. |
| `as` | element | `'label'` | Use `'div'` to label a group. |

```jsx
<FormLabel id="amount" label="Amount" required />
<TextInput id="amount" … />
```

## FormControl

Port of `FormControl.vue`. It puts the label above, the control below it, then the description; the error replaces the description when set. It generates an id if you don't pass one and wires `for`, `aria-describedby`, `aria-invalid`, `aria-errormessage` and `required` / `aria-required`. Every other prop goes to the control.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `type` | see below | `'text'` | Picks the control. |
| `label` | node | | |
| `description` | node | | `text-p-sm`, `--ink-gray-6`. Hidden while there's an error. |
| `error` | string or string[] | | `--ink-red-5`, `role="alert"`, one line per message. Also sets `invalid` on the control. |
| `required` | bool | `false` | Asterisk on the label, `required` on the control. |
| `size`, `variant`, `disabled`, `id` | | `'sm'`, `'subtle'` | Passed to the control. Toggles clamp `lg`/`xl` to `md`. |
| `className` | string | | On the field wrapper. |
| `controlClassName` | string | | The control's `className`. |

| `type` | Renders | `onChange` gets |
|---|---|---|
| `'text'` (default), `'number'`, `'email'`, `'password'`, `'search'`, `'tel'`, `'url'` … | `TextInput` | event |
| `'textarea'` | `Textarea` | event |
| `'select'` | `Select`, full width | event |
| `'checkbox'` | `Checkbox`, label beside it | event |
| `'switch'` | `Switch`, label beside it | boolean |
| `'combobox'` | `Combobox`, full width | value |
| `'date'` | `DatePicker` (as in Frappe, not `<input type="date">`) | `'YYYY-MM-DD'` |
| `'daterange'` | `DateRangePicker` | `{ start, end }` |

For the browser's own date input, use `<TextInput type="date">`.

```jsx
<FormControl label="Merchant" description="As it appears on the statement" value={m} onChange={(e) => setM(e.target.value)} />
<FormControl label="Amount" type="number" required error={amtError} value={amt} onChange={(e) => setAmt(e.target.value)} />
<FormControl label="Category" type="combobox" options={categories} value={cat} onChange={setCat} />
<FormControl label="Date" type="date" value={date} onChange={setDate} />
<FormControl type="checkbox" label="Reimbursable" checked={r} onChange={(e) => setR(e.target.checked)} />
```

---

## Checkbox

Port of `Checkbox.vue`, built on a native checkbox. Unchecked, it's an `--outline-gray-4` ring on white. Checked or indeterminate, it fills `--surface-gray-10` with a check or a dash. Hover and press step the colours. Keyboard focus shows the focus ring.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `checked` / `defaultChecked` | bool | | |
| `onChange(event)` | | | `e.target.checked`. |
| `indeterminate` | bool | `false` | Dash. Use it for a partial "select all". |
| `label` | node | | Beside the box, 13px `--ink-gray-7`. Clicking it toggles. |
| `description`, `error` | node | | Under the label. |
| `size` | `'xs' \| 'sm' \| 'md'` | `'sm'` | 13 / 14 / 16px box. |
| `padded` (alias `padding`) | bool | `false` | The whole row (24/28/32px) is the click target, with hover, press and a focus ring. Use it in menus and lists. |
| `disabled`, `required` | bool | | |
| `className` | string | | On the wrapper. The ref and other props go to the `<input>`. |

Without a label (selecting a list row), pass `aria-label`:

```jsx
<Checkbox aria-label="Select all" checked={all} indeterminate={some && !all} onChange={toggleAll} />
<Checkbox label="Recurring" description="Repeats every month" checked={rec} onChange={(e) => setRec(e.target.checked)} />
```

## Switch

Port of `Switch.vue`, a `role="switch"` button. The track is `--surface-gray-4` when off and `--surface-gray-10` when on, with a white thumb.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `checked` | bool | `false` | Controlled. |
| `onChange(checked)` | | | Gets the **new boolean**. |
| `label` | node | | Label and switch share a full-width row, with the switch at the end. |
| `description` | node | | Makes a settings row: label and switch on top, description below. |
| `error` | node | | |
| `size` | `'xs' \| 'sm' \| 'md'` | `'sm'` | Tracks 24×14 / 26×16 / 32×20px. |
| `controlPosition` | `'end' \| 'start'` | `'end'` | `'start'` puts the switch before the label. |
| `padded` | bool | `false` | Row surface with hover, press and a focus ring, for menus and settings lists. |
| `icon` | lucide component or node | | 16px, before the label. |
| `disabled`, `required` | bool | | |

The ref and other props go to the `<button>`. Without a label, pass `aria-label`.

```jsx
<Switch label="Weekly summary" description="Every Monday at 9 am" checked={on} onChange={setOn} />
<Switch aria-label="Include settled" checked={inc} onChange={setInc} />
```

## Radio / RadioGroup

Port of `Radio.vue` + `RadioGroup.vue`. The whole row is the option: circle, label and description. Native radio inputs sit underneath, so the arrow keys, Tab-to-the-selected-option and form `name` all work. The row shows the focus ring.

`RadioGroup`:

| Prop | Type | Default | Notes |
|---|---|---|---|
| `options` | `[{ label, value, description?, disabled? }]` or strings | | Or compose `<Radio>` children instead. |
| `value`, `onChange(value)` | | | Gets the option's **value**, with its original type (number, boolean …). `defaultValue` works for uncontrolled use. |
| `name` | string | auto | Native `name`. |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Vertical: 6px gaps. Horizontal: wraps, 16px gaps. |
| `size` | `'xs' \| 'sm' \| 'md'` | `'sm'` | |
| `padded` | bool | `false` | Flush rows (24/28/32px) with hover. |
| `label`, `description`, `error` | node | | Group heading (`aria-labelledby`) and the text under the group. Without `label`, pass `aria-label`. |
| `disabled`, `required` | bool | | |

`Radio` (inside a `RadioGroup`): `value`, `label` (or children), `description`, `disabled`.

```jsx
<RadioGroup label="Split method" value={method} onChange={setMethod}
  options={[{ label: 'Equally', value: 'equal', description: 'Everyone pays the same' }, { label: 'By amount', value: 'exact' }]} />

<RadioGroup orientation="horizontal" aria-label="Period" value={p} onChange={setP}>
  <Radio value="week" label="Week" />
  <Radio value="month" label="Month" />
</RadioGroup>
```

---

## Combobox

Port of `Combobox.vue` in its button-trigger mode, with `ComboboxResults.vue`. The trigger is styled like a Select. The popover has a search box above a listbox. Typing filters by label or value and ranks the matches: exact, then starts-with, then word-starts-with, then anywhere.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `options` | array | `[]` | Strings; `{ label, value, description?, icon?, disabled? }`; or groups `{ group, items }` (`{ group, options }` works too). `icon`: lucide component, node or emoji. |
| `value` | any | | Compared with `===`. A value not in `options` is kept and shown as-is. |
| `onChange(value)` | | | Gets the picked option's **value**, or `null` when cleared. Not called if the value is unchanged. |
| `placeholder` | string | `'Select option'` | Trigger text when empty. |
| `searchPlaceholder` | string | `'Search'` | |
| `size`, `variant` | | `'sm'`, `'subtle'` | |
| `prefix` | lucide component or node | | Shown in the trigger while nothing is selected. A selected option's `icon` replaces it. |
| `emptyText` | node | `'No results'` | |
| `renderOption(option, { active, selected })` | function | | Custom row content. The kit keeps the row shell, icon and check. `option` is your original object. |
| `onCreate(query)` | function | | Turns on the create row: when the query doesn't match any label exactly, a `Create “query”` row appears last. Enter picks it. You add the option and set the value. |
| `createLabel(query)` | function | | Custom create-row text. |
| `clearable` | bool | `false` | × button on the trigger, plus Backspace/Delete on the trigger. Calls `onChange(null)`. |
| `disabled`, `invalid` | bool | | |
| `className` | string | | On the `inline-flex` wrapper. Give it a width, or use `FormControl` to fill the row. |

The ref and other props go to the trigger `<button>`. Keyboard: on the trigger, ↓/↑/Enter/Space opens it, and typing a letter opens it with the search started. In the search box, ↑/↓ move, PageUp/PageDown jump to the first/last, Enter picks, Escape closes, and Tab leaves. Focus goes back to the trigger. ARIA: the search box is a `combobox` with `aria-activedescendant` on a `listbox` of `option`s.

```jsx
<Combobox options={categories} value={cat} onChange={setCat} placeholder="Category" clearable />

<Combobox options={tags} value={tag} onChange={setTag} placeholder="Tag"
  onCreate={(q) => { const t = { label: q, value: slug(q) }; setTags((ts) => [...ts, t]); setTag(t.value); }} />

<Combobox options={[{ group: 'Cards', items: cards }, { group: 'Banks', items: banks }]} value={acct} onChange={setAcct} />
```

## DatePicker

Port of `DatePicker.vue` + `CalendarPanel.vue`. A text input you can type into, with a chevron that opens a 224px calendar. The calendar has a month/year button (click it for year and month lists), ‹ Today › buttons, and a 6-week grid that starts on Sunday, as in Frappe.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `'YYYY-MM-DD'` or `''` | `''` | |
| `onChange(iso)` | | | `'YYYY-MM-DD'`, or `''` when cleared. Built from local date parts; it never goes through `toISOString()`. |
| `format` | string | `'D MMM YYYY'` | Display only ("28 Oct 2026"). Tokens: `YYYY YY MMMM MMM MM M DD D dddd ddd`, `[literal]`. |
| `placeholder` | string | `'Select date'` | |
| `min`, `max` | `'YYYY-MM-DD'` | | Days outside are dimmed and skipped by the keyboard. |
| `isDateUnavailable(iso)` | function | | Blocks more days. |
| `clearable` | bool | `false` | Shows an × button. Emptying the input clears the date; without `clearable`, it puts the old value back. |
| `size`, `variant`, `disabled`, `invalid` | | | As TextInput. |
| `className` | string | | On the wrapper. `inputClassName` on the `<input>`. |

**Typing.** The text is read on Enter or blur, in this order: the display `format`; ISO (`2026-10-28`); day-first numbers (`28/10/2026`, `28-10-26`, `28.10`; month-first only if `format` puts the month first); month names in either order (`Oct 28`, `28th october 2026`); and `today`, `yesterday`, `tomorrow`. If it can't be read, the old text comes back.

**Keyboard.** In the input, ↓ moves into the grid. In the grid, the arrows move by a day or a week, Home/End go to the start/end of the week, PageUp/PageDown change the month (with Shift, the year), and Enter/Space pick. Escape closes and returns to the input.

The ref and other props go to the `<input>`. The pure helpers are exported from `DatePicker.jsx` for other code: `formatDate`, `parseDateInput`, `todayISO`, `toISODate`, `addDays`, `addMonths`, `buildMonthGrid` …

```jsx
<DatePicker value={date} onChange={setDate} />
<DatePicker value={due} onChange={setDue} clearable min={todayISO()} format="ddd, D MMM" />
```

## DateRangePicker

Port of `DateRangePicker.vue` + `DateRangeCalendar.vue`. The first click sets the start, and the second sets the end (in either order) and closes. In between, the day under the mouse or the keyboard shows a preview of the range. `presets` appear as a column of buttons beside the calendar (Frappe's `#actions` slot).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | `{ start, end }` | | ISO strings, or `''`. |
| `onChange({ start, end })` | | | Always in order. `{ start: '', end: '' }` when cleared. |
| `presets` | `[{ label, value: { start, end } }]` | | The preset that matches the current value is highlighted. Picking one applies it and closes. |
| `placeholder` | string | `'Select range'` | |
| `format` | string | `'D MMM YYYY'` | Shown as "1 Oct 2026 to 28 Oct 2026". |
| `min`, `max`, `isDateUnavailable` | | | As DatePicker. |
| `clearable` | bool | `false` | × button. Emptying the input always clears, as in Frappe. |
| `size`, `variant`, `disabled`, `invalid`, `className`, `inputClassName` | | | As DatePicker. |

**Typing.** Separate the two dates with `to`, ` - `, `–` or `,`. A single date makes a one-day range. Today gives `[today, today]`.

```jsx
const today = todayISO();
<DateRangePicker value={range} onChange={setRange} clearable presets={[
  { label: 'Last 7 days', value: { start: addDays(today, -6), end: today } },
  { label: 'Last 30 days', value: { start: addDays(today, -29), end: today } },
]} />
```

## FileUploader

A dropzone. (frappe-ui's FileUploader has no look of its own, so this is built from Frappe's tokens.) It has a dashed `--outline-gray-2` border on an 8px radius, `--surface-gray-1` on hover and drag-over, an icon disc, a title with a link-style "browse", and a description. Click it, press Enter/Space, or drop files on it.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `onFiles(files)` | | | `File[]` that match `accept`, for both picks and drops. Only the first if not `multiple`. |
| `onReject(files)` | | | Dropped files that don't match `accept`. |
| `accept` | string | | As the input attribute: `.pdf`, `image/*`, `text/csv`, comma-separated. |
| `multiple` | bool | `false` | |
| `title` | node | "Drop a file here or browse" | |
| `description` | node | | `text-p-sm`, `--ink-gray-5`. |
| `icon` | lucide component or node | `CloudUpload` | |
| `uploading` | bool | `false` | Spinner instead of the icon, "Uploading…", `aria-busy`. Ignores clicks and drops. |
| `progress` | 0–100 | | With `uploading`: "Uploading 45%" and a progress bar. |
| `size` | `'md' \| 'sm'` | `'md'` | `md` is a centred stack; `sm` is a compact row. |
| `error` | node | | Red message and border. |
| `disabled` | bool | `false` | |

It has `role="button"`. The ref, `className` and other props go to that element.

```jsx
<FileUploader accept=".pdf,.csv" onFiles={upload} uploading={busy} progress={pct}
  description="HDFC statement PDF or CSV" />
<FileUploader size="sm" accept="image/*" icon={Receipt} title="Attach a receipt" onFiles={attach} />
```
