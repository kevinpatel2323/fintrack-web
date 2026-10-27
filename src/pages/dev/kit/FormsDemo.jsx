import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Car,
  CreditCard,
  FileText,
  Film,
  HeartPulse,
  House,
  Landmark,
  Mail,
  Plane,
  Receipt,
  Search,
  ShoppingCart,
  Tag,
  Users,
  Utensils,
  Wallet,
  Zap,
} from 'lucide-react';
import TextInput from '../../../components/ui/TextInput.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Select from '../../../components/ui/Select.jsx';
import FormLabel from '../../../components/ui/FormLabel.jsx';
import FormControl from '../../../components/ui/FormControl.jsx';
import Checkbox from '../../../components/ui/Checkbox.jsx';
import Switch from '../../../components/ui/Switch.jsx';
import { Radio, RadioGroup } from '../../../components/ui/Radio.jsx';
import Combobox from '../../../components/ui/Combobox.jsx';
import DatePicker, { addDays, addMonths, isoFromParts, parseISO, todayISO } from '../../../components/ui/DatePicker.jsx';
import DateRangePicker from '../../../components/ui/DateRangePicker.jsx';
import FileUploader from '../../../components/ui/FileUploader.jsx';
import KeyboardShortcut from '../../../components/ui/KeyboardShortcut.jsx';

// Dev gallery for the Forms group: every component in every size, variant
// and state, wired to local state. Inline widths are demo layout only.

const INPUT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
const TOGGLE_SIZES = ['xs', 'sm', 'md'];
const VARIANTS = ['subtle', 'outline', 'ghost'];

const W = { width: 220 };
const W_WIDE = { width: 320 };
const COL = { display: 'flex', flexDirection: 'column', gap: 8, width: 320 };

const CATEGORY_OPTIONS = [
  { label: 'Groceries', value: 'groceries', icon: ShoppingCart },
  { label: 'Food & dining', value: 'food', icon: Utensils, description: 'Restaurants, delivery, cafés' },
  { label: 'Transport', value: 'transport', icon: Car },
  { label: 'Rent', value: 'rent', icon: House },
  { label: 'Entertainment', value: 'entertainment', icon: Film },
  { label: 'Health', value: 'health', icon: HeartPulse },
  { label: 'Bills & utilities', value: 'bills', icon: Zap },
  { label: 'Travel', value: 'travel', icon: Plane, disabled: true },
];

const GROUPED_ACCOUNTS = [
  {
    group: 'Bank accounts',
    items: [
      { label: 'HDFC Savings', value: 'hdfc-sav', icon: Landmark, description: '•• 4821' },
      { label: 'ICICI Salary', value: 'icici-sal', icon: Landmark, description: '•• 1190' },
    ],
  },
  {
    group: 'Credit cards',
    items: [
      { label: 'HDFC Regalia', value: 'hdfc-cc', icon: CreditCard, description: '•• 2209' },
      { label: 'Amex Platinum', value: 'amex', icon: CreditCard, description: '•• 3005' },
    ],
  },
  { group: 'Wallets', items: [{ label: 'Paytm', value: 'paytm', icon: Wallet }] },
];

const SELECT_OPTIONS = ['Daily', 'Weekly', 'Monthly', { label: 'Yearly (disabled)', value: 'yearly', disabled: true }];

const GROUPED_SELECT = [
  { group: 'Spending', options: ['Groceries', 'Food & dining', 'Transport'] },
  { group: 'Income', options: [{ label: 'Salary', value: 'salary' }, { label: 'Refunds', value: 'refunds' }] },
];

function Group({ title, children }) {
  return (
    <div className="uikit-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Row({ children, style }) {
  return (
    <div className="uikit-row" style={style}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function TextInputDemo() {
  const [text, setText] = useState('Swiggy order');
  const [query, setQuery] = useState('');
  const [amount, setAmount] = useState('1250');
  return (
    <>
      {VARIANTS.map((variant) => (
        <Group key={variant} title={`TextInput · ${variant} · xs / sm / md / lg / xl`}>
          <Row style={{ alignItems: 'flex-end' }}>
            {INPUT_SIZES.map((size) => (
              <TextInput
                key={size}
                size={size}
                variant={variant}
                placeholder={`Size ${size}`}
                style={{ width: 150 }}
                aria-label={`${variant} ${size}`}
              />
            ))}
          </Row>
        </Group>
      ))}
      <Group title="TextInput · prefix / suffix (search with ⌘K hint, ₹ amount, icon)">
        <Row>
          <TextInput
            style={W}
            prefix={Search}
            suffix={<KeyboardShortcut combo="Mod+K" />}
            placeholder="Search transactions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search transactions"
          />
          <TextInput
            style={W}
            type="number"
            prefix={<span className="text-ink-gray-5">₹</span>}
            suffix={<span className="text-sm text-ink-gray-5">INR</span>}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
          />
          <TextInput style={W} variant="outline" prefix={Mail} placeholder="you@example.com" type="email" aria-label="Email" />
          <TextInput style={W} size="lg" prefix={Search} placeholder="Large search" aria-label="Large search" />
        </Row>
      </Group>
      <Group title="TextInput · states">
        <Row>
          <TextInput style={W} value={text} onChange={(e) => setText(e.target.value)} aria-label="Filled" />
          <TextInput style={W} placeholder="Invalid" invalid aria-label="Invalid" />
          <TextInput style={W} variant="outline" placeholder="Invalid outline" invalid aria-label="Invalid outline" />
          <TextInput style={W} placeholder="Disabled subtle" disabled aria-label="Disabled subtle" />
          <TextInput style={W} variant="outline" placeholder="Disabled outline" disabled aria-label="Disabled outline" />
          <TextInput style={W} variant="ghost" value="Disabled ghost" disabled readOnly aria-label="Disabled ghost" />
          <TextInput style={W} prefix={Search} placeholder="Disabled with icon" disabled aria-label="Disabled icon" />
        </Row>
      </Group>
      <Group title="TextInput · types">
        <Row>
          <TextInput style={W} type="password" placeholder="Password" aria-label="Password" />
          <TextInput style={W} type="search" placeholder="type=search" aria-label="Search type" />
          <TextInput style={W} type="tel" placeholder="+91 98765 43210" aria-label="Phone" />
          <TextInput style={W} type="date" aria-label="Native date" />
        </Row>
      </Group>
    </>
  );
}

function TextareaDemo() {
  const [note, setNote] = useState('Split with Ketul and Riya — settle after the trip.');
  return (
    <>
      {VARIANTS.map((variant) => (
        <Group key={variant} title={`Textarea · ${variant} · xs / sm / md / lg`}>
          <Row style={{ alignItems: 'flex-start' }}>
            {['xs', 'sm', 'md', 'lg'].map((size) => (
              <Textarea
                key={size}
                size={size}
                variant={variant}
                rows={2}
                placeholder={`Size ${size}`}
                style={{ width: 200 }}
                aria-label={`${variant} textarea ${size}`}
              />
            ))}
          </Row>
        </Group>
      ))}
      <Group title="Textarea · states">
        <Row style={{ alignItems: 'flex-start' }}>
          <Textarea style={W_WIDE} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <Textarea style={W} placeholder="Invalid" invalid aria-label="Invalid textarea" />
          <Textarea style={W} placeholder="Disabled" disabled aria-label="Disabled textarea" />
        </Row>
      </Group>
    </>
  );
}

function SelectDemo() {
  const [freq, setFreq] = useState('Monthly');
  const [cat, setCat] = useState('');
  return (
    <>
      {VARIANTS.map((variant) => (
        <Group key={variant} title={`Select · ${variant} · xs / sm / md / lg / xl`}>
          <Row style={{ alignItems: 'flex-end' }}>
            {INPUT_SIZES.map((size) => (
              <Select
                key={size}
                size={size}
                variant={variant}
                options={SELECT_OPTIONS}
                value={freq}
                onChange={(e) => setFreq(e.target.value)}
                aria-label={`${variant} select ${size}`}
              />
            ))}
          </Row>
        </Group>
      ))}
      <Group title="Select · placeholder, grouped, prefix, states">
        <Row>
          <Select
            style={W}
            placeholder="Pick a category"
            options={GROUPED_SELECT}
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Category"
          />
          <Select style={W} prefix={Tag} options={SELECT_OPTIONS} defaultValue="Weekly" aria-label="With prefix" />
          <Select style={W} options={SELECT_OPTIONS} defaultValue="Daily" invalid aria-label="Invalid select" />
          <Select style={W} options={SELECT_OPTIONS} defaultValue="Daily" disabled aria-label="Disabled select" />
          <Select
            style={W}
            variant="outline"
            placeholder="Disabled outline"
            options={SELECT_OPTIONS}
            disabled
            aria-label="Disabled outline select"
          />
        </Row>
      </Group>
    </>
  );
}

function FormLabelDemo() {
  return (
    <Group title="FormLabel">
      <Row style={{ gap: 24 }}>
        <FormLabel label="Merchant" />
        <FormLabel label="Amount" required />
        <FormLabel label="Disabled field" disabled />
        <FormLabel label="Beside a toggle (gray-7)" color="gray-7" />
      </Row>
    </Group>
  );
}

function FormControlDemo() {
  const [form, setForm] = useState({
    merchant: '',
    amount: '',
    email: 'kevin@',
    note: '',
    freq: 'Monthly',
    category: null,
    date: todayISO(),
    range: { start: '', end: '' },
    agree: false,
    notify: true,
    password: '',
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const emailError = form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) ? 'Enter a valid email address' : '';

  return (
    <Group title="FormControl · label above, description / error below">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
        <FormControl
          label="Merchant"
          description="As it appears on the statement"
          placeholder="e.g. Swiggy"
          value={form.merchant}
          onChange={set('merchant')}
        />
        <FormControl
          label="Amount"
          type="number"
          required
          prefix={<span className="text-ink-gray-5">₹</span>}
          value={form.amount}
          onChange={set('amount')}
          error={form.amount === '' ? 'Amount is required' : ''}
        />
        <FormControl label="Email" type="email" value={form.email} onChange={set('email')} error={emailError} />
        <FormControl label="Password" type="password" value={form.password} onChange={set('password')} />
        <FormControl label="Search" type="search" prefix={Search} placeholder="Search…" />
        <FormControl label="Phone" type="tel" size="md" variant="outline" placeholder="+91" />
        <FormControl
          label="Frequency"
          type="select"
          options={SELECT_OPTIONS}
          value={form.freq}
          onChange={set('freq')}
          description="Native select"
        />
        <FormControl
          label="Category"
          type="combobox"
          options={CATEGORY_OPTIONS}
          value={form.category}
          onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          placeholder="Choose category"
          clearable
        />
        <FormControl
          label="Date"
          type="date"
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
          required
        />
        <FormControl
          label="Statement period"
          type="daterange"
          value={form.range}
          onChange={(v) => setForm((f) => ({ ...f, range: v }))}
          description="Type “1 Oct 2026 to 31 Oct 2026” or pick"
        />
        <FormControl label="Notes" type="textarea" value={form.note} onChange={set('note')} rows={2} />
        <FormControl label="Disabled" placeholder="Can't touch this" disabled description="Disabled field" />
        <FormControl
          type="checkbox"
          label="Mark as reimbursable"
          description="Shows up in the reimbursements report"
          checked={form.agree}
          onChange={(e) => setForm((f) => ({ ...f, agree: e.target.checked }))}
        />
        <FormControl
          type="switch"
          label="Email me a weekly summary"
          description="Every Monday at 9 am"
          checked={form.notify}
          onChange={(v) => setForm((f) => ({ ...f, notify: v }))}
        />
      </div>
    </Group>
  );
}

function CheckboxDemo() {
  const [rows, setRows] = useState({ a: true, b: false, c: true });
  const [flags, setFlags] = useState({ recurring: true, shared: false, hidden: false });
  const all = Object.values(rows).every(Boolean);
  const some = Object.values(rows).some(Boolean);
  const toggleAll = () => setRows({ a: !all, b: !all, c: !all });

  return (
    <>
      <Group title="Checkbox · xs / sm / md · unchecked, checked, indeterminate, disabled, disabled checked">
        {TOGGLE_SIZES.map((size) => (
          <Row key={size} style={{ gap: 20 }}>
            <Checkbox size={size} label={`Unchecked ${size}`} defaultChecked={false} />
            <Checkbox size={size} label="Checked" defaultChecked />
            <Checkbox size={size} label="Indeterminate" indeterminate checked readOnly />
            <Checkbox size={size} label="Disabled" disabled />
            <Checkbox size={size} label="Disabled checked" disabled checked readOnly />
          </Row>
        ))}
      </Group>
      <Group title="Checkbox · description, error, required">
        <Row style={{ gap: 32, alignItems: 'flex-start' }}>
          <Checkbox
            label="Recurring"
            description="Repeats every month"
            checked={flags.recurring}
            onChange={(e) => setFlags((f) => ({ ...f, recurring: e.target.checked }))}
          />
          <Checkbox label="Accept terms" required error="You need to accept the terms" />
          <Checkbox label="Disabled with description" description="Not available" disabled />
        </Row>
      </Group>
      <Group title="Checkbox · padded rows (menu / list)">
        <div style={{ width: 280 }}>
          {[
            ['recurring', 'Recurring'],
            ['shared', 'Shared with friends'],
            ['hidden', 'Hidden from reports'],
          ].map(([key, text]) => (
            <Checkbox
              key={key}
              padded
              label={text}
              checked={flags[key]}
              onChange={(e) => setFlags((f) => ({ ...f, [key]: e.target.checked }))}
            />
          ))}
          <Checkbox padded size="md" label="Padded md with description" description="Grows with padding" />
          <Checkbox padded label="Padded disabled" disabled />
        </div>
      </Group>
      <Group title="Checkbox · bare (list-row selection, aria-label)">
        <div style={{ width: 360, border: '1px solid var(--outline-gray-1)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--outline-gray-1)' }}>
            <Checkbox aria-label="Select all" checked={all} indeterminate={some && !all} onChange={toggleAll} />
            <span className="text-sm text-ink-gray-5">Select all</span>
          </div>
          {[
            ['a', 'Swiggy · ₹420'],
            ['b', 'Uber · ₹186'],
            ['c', 'BigBasket · ₹2,140'],
          ].map(([key, text]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px' }}>
              <Checkbox
                aria-label={`Select ${text}`}
                checked={rows[key]}
                onChange={(e) => setRows((r) => ({ ...r, [key]: e.target.checked }))}
              />
              <span className="text-base text-ink-gray-8">{text}</span>
            </div>
          ))}
        </div>
      </Group>
    </>
  );
}

function SwitchDemo() {
  const [state, setState] = useState({ a: true, b: false, c: true, d: false, e: true });
  const flip = (key) => (v) => setState((s) => ({ ...s, [key]: v }));
  return (
    <>
      <Group title="Switch · xs / sm / md · off, on, disabled off, disabled on">
        {TOGGLE_SIZES.map((size) => (
          <Row key={size} style={{ gap: 24 }}>
            <SwitchBare size={size} initial={false} />
            <SwitchBare size={size} initial />
            <Switch size={size} checked={false} disabled aria-label="Disabled off" />
            <Switch size={size} checked disabled aria-label="Disabled on" />
          </Row>
        ))}
      </Group>
      <Group title="Switch · label row, settings row, leading control, error">
        <div style={COL}>
          <Switch label="Round up spends" checked={state.a} onChange={flip('a')} />
          <Switch
            label="Monthly budget alerts"
            description="Get notified at 80% of a category budget"
            checked={state.b}
            onChange={flip('b')}
          />
          <Switch label="Leading switch" controlPosition="start" checked={state.c} onChange={flip('c')} />
          <Switch label="Sync with bank" checked={false} error="Reconnect HDFC to enable sync" />
          <Switch label="Disabled with label" disabled checked />
          <Switch label="Icon + md" icon={Receipt} size="md" checked={state.e} onChange={flip('e')} />
        </div>
      </Group>
      <Group title="Switch · padded rows">
        <div style={{ ...COL, gap: 0 }}>
          <Switch padded label="Show settled entries" checked={state.d} onChange={flip('d')} />
          <Switch padded label="Group by merchant" checked={state.a} onChange={flip('a')} />
          <Switch padded size="md" label="Padded md with description" description="Rows grow with padding" checked={state.c} onChange={flip('c')} />
          <Switch padded label="Padded disabled" disabled />
        </div>
      </Group>
    </>
  );
}

function SwitchBare({ size, initial }) {
  const [on, setOn] = useState(initial);
  return <Switch size={size} checked={on} onChange={setOn} aria-label={`Switch ${size}`} />;
}

function RadioDemo() {
  const [split, setSplit] = useState('equal');
  const [view, setView] = useState('month');
  const [padded, setPadded] = useState('hdfc');
  const [sizes, setSizes] = useState({ xs: 'a', sm: 'a', md: 'a' });
  return (
    <>
      <Group title="RadioGroup · vertical with label, descriptions and a disabled option">
        <RadioGroup
          label="Split method"
          value={split}
          onChange={setSplit}
          options={[
            { label: 'Equally', value: 'equal', description: 'Everyone pays the same' },
            { label: 'By exact amounts', value: 'exact' },
            { label: 'By percentage', value: 'percent' },
            { label: 'By shares', value: 'shares', disabled: true, description: 'Coming soon' },
          ]}
        />
      </Group>
      <Group title="RadioGroup · horizontal, error">
        <RadioGroup
          orientation="horizontal"
          value={view}
          onChange={setView}
          aria-label="Period"
          options={[
            { label: 'Week', value: 'week' },
            { label: 'Month', value: 'month' },
            { label: 'Year', value: 'year' },
          ]}
        />
        <RadioGroup
          label="Account type"
          orientation="horizontal"
          error="Pick an account type"
          options={['Savings', 'Current']}
        />
      </Group>
      <Group title="RadioGroup · xs / sm / md">
        <Row style={{ gap: 40, alignItems: 'flex-start' }}>
          {TOGGLE_SIZES.map((size) => (
            <RadioGroup
              key={size}
              size={size}
              label={`Size ${size}`}
              value={sizes[size]}
              onChange={(v) => setSizes((s) => ({ ...s, [size]: v }))}
              options={[
                { label: 'Option A', value: 'a' },
                { label: 'Option B', value: 'b' },
              ]}
            />
          ))}
        </Row>
      </Group>
      <Group title="RadioGroup · padded, composed with <Radio>, disabled group">
        <Row style={{ gap: 40, alignItems: 'flex-start' }}>
          <div style={{ width: 260 }}>
            <RadioGroup padded value={padded} onChange={setPadded} aria-label="Pay from">
              <Radio value="hdfc" label="HDFC Savings" />
              <Radio value="icici" label="ICICI Salary" />
              <Radio value="cash" label="Cash" description="Not tracked by a bank" />
            </RadioGroup>
          </div>
          <RadioGroup label="Disabled group" disabled value="one" options={['one', 'two']} />
        </Row>
      </Group>
    </>
  );
}

function ComboboxDemo() {
  const [category, setCategory] = useState('food');
  const [account, setAccount] = useState(null);
  const [tags, setTags] = useState([
    { label: 'Trip to Goa', value: 'goa' },
    { label: 'Office', value: 'office' },
    { label: 'Gifts', value: 'gifts' },
  ]);
  const [tag, setTag] = useState(null);
  const [bySize, setBySize] = useState({});
  return (
    <>
      {VARIANTS.map((variant) => (
        <Group key={variant} title={`Combobox · ${variant} · xs / sm / md / lg / xl`}>
          <Row style={{ alignItems: 'flex-end' }}>
            {INPUT_SIZES.map((size) => (
              <Combobox
                key={size}
                size={size}
                variant={variant}
                options={CATEGORY_OPTIONS}
                value={bySize[`${variant}-${size}`] ?? null}
                onChange={(v) => setBySize((s) => ({ ...s, [`${variant}-${size}`]: v }))}
                placeholder={`Size ${size}`}
                aria-label={`${variant} combobox ${size}`}
              />
            ))}
          </Row>
        </Group>
      ))}
      <Group title="Combobox · icons + descriptions, grouped, creatable, clearable">
        <Row style={{ alignItems: 'flex-start' }}>
          <Combobox
            style={W}
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={setCategory}
            clearable
            aria-label="Category"
          />
          <Combobox
            style={W}
            options={GROUPED_ACCOUNTS}
            value={account}
            onChange={setAccount}
            placeholder="Pay from…"
            prefix={Building2}
            aria-label="Account"
          />
          <Combobox
            style={W}
            options={tags}
            value={tag}
            onChange={setTag}
            placeholder="Add a tag"
            searchPlaceholder="Search or create a tag"
            onCreate={(q) => {
              const value = q.toLowerCase().replace(/\s+/g, '-');
              setTags((t) => [...t, { label: q, value }]);
              setTag(value);
            }}
            clearable
            aria-label="Tag"
          />
        </Row>
      </Group>
      <Group title="Combobox · renderOption, free-text value, empty, disabled, invalid">
        <Row>
          <Combobox
            style={W}
            options={GROUPED_ACCOUNTS}
            value="amex"
            onChange={() => {}}
            renderOption={(o, { active }) => (
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span className="truncate">{o.label}</span>
                <span className={active ? 'text-ink-gray-7' : 'text-ink-gray-4'}>{o.description}</span>
              </span>
            )}
            aria-label="Custom rows"
          />
          <Combobox style={W} options={CATEGORY_OPTIONS} value="Unlisted merchant" onChange={() => {}} aria-label="Free text" />
          <Combobox style={W} options={[]} value={null} emptyText="No friends yet" placeholder="Empty list" aria-label="Empty" prefix={Users} />
          <Combobox style={W} options={CATEGORY_OPTIONS} value="rent" disabled aria-label="Disabled" />
          <Combobox style={W} options={CATEGORY_OPTIONS} value={null} invalid placeholder="Invalid" aria-label="Invalid" />
        </Row>
      </Group>
    </>
  );
}

function DateDemo() {
  const today = todayISO();
  const t = parseISO(today);
  const [dates, setDates] = useState({});
  const [due, setDue] = useState(addDays(today, 5));
  const [bounded, setBounded] = useState('');
  const [range, setRange] = useState({ start: addDays(today, -6), end: today });
  const [plain, setPlain] = useState({ start: '', end: '' });

  const presets = [
    { label: 'Today', value: { start: today, end: today } },
    { label: 'Last 7 days', value: { start: addDays(today, -6), end: today } },
    { label: 'Last 30 days', value: { start: addDays(today, -29), end: today } },
    { label: 'This month', value: { start: isoFromParts(t.year, t.month, 1), end: today } },
    {
      label: 'Last month',
      value: { start: addMonths(isoFromParts(t.year, t.month, 1), -1), end: addDays(isoFromParts(t.year, t.month, 1), -1) },
    },
    { label: 'This year', value: { start: isoFromParts(t.year, 0, 1), end: today } },
  ];

  return (
    <>
      {VARIANTS.map((variant) => (
        <Group key={variant} title={`DatePicker · ${variant} · xs / sm / md / lg / xl`}>
          <Row style={{ alignItems: 'flex-end' }}>
            {INPUT_SIZES.map((size) => (
              <DatePicker
                key={size}
                size={size}
                variant={variant}
                value={dates[`${variant}-${size}`] ?? ''}
                onChange={(v) => setDates((d) => ({ ...d, [`${variant}-${size}`]: v }))}
                style={{ width: 170 }}
                aria-label={`${variant} date ${size}`}
              />
            ))}
          </Row>
        </Group>
      ))}
      <Group title="DatePicker · clearable, min/max (±14 days), custom format, disabled, invalid">
        <Row>
          <DatePicker style={W} value={due} onChange={setDue} clearable aria-label="Due date" />
          <DatePicker
            style={W}
            value={bounded}
            onChange={setBounded}
            min={addDays(today, -14)}
            max={addDays(today, 14)}
            placeholder="Within two weeks"
            aria-label="Bounded"
          />
          <DatePicker style={W} value={due} onChange={setDue} format="ddd, DD/MM/YYYY" aria-label="Custom format" />
          <DatePicker style={W} value={today} disabled aria-label="Disabled date" />
          <DatePicker style={W} value="" invalid placeholder="Invalid" aria-label="Invalid date" />
        </Row>
      </Group>
      <Group title="DateRangePicker · presets + clearable, plain, disabled">
        <Row>
          <DateRangePicker style={{ width: 280 }} value={range} onChange={setRange} presets={presets} clearable aria-label="Range" />
          <DateRangePicker style={{ width: 280 }} value={plain} onChange={setPlain} variant="outline" aria-label="Plain range" />
          <DateRangePicker style={{ width: 280 }} value={range} disabled aria-label="Disabled range" />
        </Row>
        <p className="text-sm text-ink-gray-5">
          Value: <code>{JSON.stringify(range)}</code>
        </p>
      </Group>
    </>
  );
}

function FileUploaderDemo() {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const startUpload = (picked) => {
    setFiles(picked);
    setProgress(0);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        const next = (p ?? 0) + 8;
        if (next >= 100) {
          window.clearInterval(timer.current);
          return null;
        }
        return next;
      });
    }, 250);
  };

  return (
    <>
      <Group title="FileUploader · md (click, Enter/Space, or drop a PDF/CSV)">
        <div style={{ width: 420 }}>
          <FileUploader
            accept=".pdf,.csv,text/csv,application/pdf"
            multiple
            onFiles={startUpload}
            uploading={progress !== null}
            progress={progress ?? undefined}
            description="HDFC statement PDF or CSV, up to 10 MB"
          />
        </div>
        {files.length > 0 && (
          <p className="text-sm text-ink-gray-5">
            Picked: {files.map((f) => f.name).join(', ')}
          </p>
        )}
      </Group>
      <Group title="FileUploader · sm, uploading, disabled, error">
        <div style={COL}>
          <FileUploader size="sm" accept="image/*" icon={FileText} title="Attach a receipt" description="PNG or JPG" onFiles={() => {}} />
          <FileUploader size="sm" uploading progress={45} description="receipt-oct.png" />
          <FileUploader size="md" uploading description="Reading statement…" />
          <FileUploader size="sm" disabled description="Uploads are paused" />
          <FileUploader size="sm" error="That file is not a PDF" description="PDF only" accept=".pdf" onFiles={() => {}} />
        </div>
      </Group>
    </>
  );
}

export default function FormsDemo() {
  return (
    <section className="uikit-section">
      <h2>Forms</h2>
      <TextInputDemo />
      <TextareaDemo />
      <SelectDemo />
      <FormLabelDemo />
      <FormControlDemo />
      <CheckboxDemo />
      <SwitchDemo />
      <RadioDemo />
      <ComboboxDemo />
      <DateDemo />
      <FileUploaderDemo />
    </section>
  );
}
