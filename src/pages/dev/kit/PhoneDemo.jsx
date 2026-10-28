import { useMemo, useState } from 'react';
import {
  Bell,
  Car,
  CreditCard,
  Info,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  Utensils,
  Users,
  Wallet,
} from 'lucide-react';
import {
  ActionSheet,
  Amount,
  Button,
  Checkbox,
  Dropdown,
  EmptyState,
  FormControl,
  MobileActionBar,
  MobileField,
  MobileList,
  MobileListItem,
  MobileSection,
  PageHeader,
  Popover,
  StatCard,
  Switch,
  TabButtons,
  Tabs,
  toast,
} from '../../../components/ui';
import { useIsCompact } from '../../../styles/breakpoints.js';

// Dev gallery for the phone kit (docs/phone.md). Phones only: below 768px the
// /ui-kit page opens with this section, the way a phone page is built — a
// PageHeader in the shell's header slot, MobileSections, lists, a details
// block, the pickers as bottom sheets, menus as action sheets and an
// optional MobileActionBar.

const CATEGORIES = [
  { group: 'Everyday', items: [
    { label: 'Groceries', value: 'groceries', icon: ShoppingCart },
    { label: 'Food and dining', value: 'food', icon: Utensils, description: 'Restaurants, delivery, cafés' },
    { label: 'Transport', value: 'transport', icon: Car },
  ] },
  { group: 'Money', items: [
    { label: 'Card bill', value: 'card', icon: CreditCard },
    { label: 'Transfer', value: 'transfer', icon: Wallet },
    { label: 'Uncategorised', value: 'none', icon: Tag },
  ] },
];

const ACCOUNTS = ['All accounts', 'HDFC ••6001', 'ICICI ••2209', 'Wallet'];

const RANGE_PRESETS = [
  { label: 'This month', value: { start: '2026-10-01', end: '2026-10-31' } },
  { label: 'Last month', value: { start: '2026-09-01', end: '2026-09-30' } },
  { label: 'Last 30 days', value: { start: '2026-09-29', end: '2026-10-28' } },
];

const ROWS = [
  { id: 1, title: 'Swiggy', subtitle: 'Food · 28 Oct', amount: -486, icon: Utensils },
  { id: 2, title: 'Salary', subtitle: 'Transfer · 27 Oct', amount: 182500, icon: Wallet },
  { id: 3, title: 'Uber trip to the airport, terminal 2 departures', subtitle: 'Transport · 26 Oct', amount: -1312, icon: Car },
];

function Tile({ icon: Icon }) {
  return (
    <span className="uikit-phone__tile" aria-hidden="true">
      <Icon size={18} strokeWidth={1.5} />
    </span>
  );
}

export default function PhoneDemo() {
  const isPhone = useIsCompact();
  const [segment, setSegment] = useState('all');
  const [tab, setTab] = useState('activity');
  const [category, setCategory] = useState('food');
  const [extra, setExtra] = useState([]);
  const [account, setAccount] = useState('All accounts');
  const [date, setDate] = useState('2026-10-28');
  const [range, setRange] = useState({ start: '2026-10-01', end: '2026-10-31' });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState('date');
  const [showBar, setShowBar] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [withSplits, setWithSplits] = useState(false);

  const categoryOptions = useMemo(
    () => (extra.length ? [...CATEGORIES, { group: 'Added', items: extra }] : CATEGORIES),
    [extra],
  );

  if (!isPhone) return null;

  const rowActions = [
    { label: 'Edit', icon: Pencil, onClick: () => toast('Edit') },
    { label: 'Change category', icon: Tag, onClick: () => toast('Change category') },
    { group: 'Danger', items: [{ label: 'Delete', icon: Trash2, theme: 'red', onClick: () => toast.error('Deleted') }] },
  ];

  return (
    <section className="uikit-section uikit-phone">
      <PageHeader
        title="UI kit"
        back="/you"
        mobileActions={
          <Dropdown label="Kit actions" options={[{ label: 'Show a toast', icon: Bell, onClick: () => toast.success('Saved', { action: { label: 'Undo', onClick: () => {} } }) }]}>
            <Button variant="ghost" size="md" icon={Plus} label="More" />
          </Dropdown>
        }
      />
      <h2>Phone</h2>

      <MobileSection title="Summary" description="StatCard tiles, two to a row" aside={
        <TabButtons
          aria-label="Period"
          value={segment}
          onChange={setSegment}
          options={[{ label: 'Month', value: 'all' }, { label: 'Year', value: 'year' }]}
        />
      }>
        <div className="uikit-phone__tiles">
          <StatCard label="Spent" value="₹28,064" hint="15 transactions" />
          <StatCard label="Earned" value="₹96,750" delta={12.4} deltaLabel="vs last month" />
          <StatCard label="Owed to you" value="₹1,27,450" hint="From 3 people" to="/friends" />
          <StatCard label="You owe" value="₹850" hint="To 1 person" />
        </div>
      </MobileSection>

      <MobileSection title="Recent activity" action={{ label: 'View all', to: '/transactions' }}>
        <TabButtons
          aria-label="Show"
          fluid
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'all', label: <>All<span className="uikit-phone__count">12</span></> },
            { value: 'year', label: <>They owe<span className="uikit-phone__count">3</span></> },
            { value: 'you', label: <>You owe<span className="uikit-phone__count">1</span></> },
          ]}
        />
        <MobileList aria-label="Recent activity">
          {ROWS.map((r) => (
            <MobileListItem
              key={r.id}
              leading={<Tile icon={r.icon} />}
              title={r.title}
              subtitle={r.subtitle}
              value={<Amount value={r.amount} sign="always" />}
              onClick={() => toast(r.title)}
              actions={rowActions}
            />
          ))}
        </MobileList>
      </MobileSection>

      <MobileSection title="Tabs" description="Underline tabs scroll sideways; .phone-bleed runs them edge to edge">
        <Tabs
          className="phone-bleed"
          aria-label="Sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { label: 'Activity', value: 'activity', count: 24 },
            { label: 'Statements', value: 'statements', count: 3 },
            { label: 'Payments', value: 'payments', count: 2 },
            { label: 'Netted off', value: 'netted', count: 0 },
            { label: 'Details', value: 'details' },
          ]}
        />
      </MobileSection>

      <MobileSection title="Pickers" description="Select, Combobox and the date pickers open as bottom sheets">
        <div className="uikit-phone__form">
          <FormControl
            type="combobox"
            label="Category"
            options={categoryOptions}
            value={category}
            onChange={setCategory}
            clearable
            searchPlaceholder="Search categories"
            onCreate={(q) => {
              const v = q.toLowerCase().replace(/\s+/g, '-');
              setExtra((list) => [...list, { label: q, value: v, icon: Tag }]);
              setCategory(v);
            }}
          />
          <FormControl type="select" label="Account" options={ACCOUNTS} value={account} onChange={(e) => setAccount(e.target.value)} />
          <FormControl type="date" label="Date" value={date} onChange={setDate} clearable />
          <FormControl type="daterange" label="Period" value={range} onChange={setRange} presets={RANGE_PRESETS} />
          <div className="uikit-phone__row">
            <Popover
              sheetTitle="Filters"
              trigger={<Button iconLeft={SlidersHorizontal} label="Filter" />}
            >
              {({ close }) => (
                <div className="uikit-phone__filters">
                  <Checkbox padded label="Only open entries" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
                  <Checkbox padded label="Include splits" checked={withSplits} onChange={(e) => setWithSplits(e.target.checked)} />
                  <Button size="lg" variant="solid" label="Done" onClick={close} />
                </div>
              )}
            </Popover>
            <Popover mobile="popover" placement="bottom-start" trigger={<Button variant="ghost" icon={Info} label="What is unbilled?" />}>
              <p className="uikit-phone__note">Spends since the last statement. They move to the next bill when it is generated.</p>
            </Popover>
          </div>
        </div>
      </MobileSection>

      <MobileSection title="Menus" description="Dropdown and ActionSheet">
        <div className="uikit-phone__row">
          <Button label="Sort by" onClick={() => setSheetOpen(true)} />
          <Dropdown label="Card actions" options={rowActions}>
            <Button label="Dropdown" />
          </Dropdown>
        </div>
        <ActionSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Sort by"
          options={[
            { label: 'Date', selected: sort === 'date', onClick: () => setSort('date') },
            { label: 'Amount', selected: sort === 'amount', onClick: () => setSort('amount') },
            { label: 'Merchant', selected: sort === 'merchant', onClick: () => setSort('merchant') },
          ]}
        />
      </MobileSection>

      <MobileSection title="Settings" description="MobileList variant inset">
        <MobileList variant="inset" aria-label="Settings">
          <MobileListItem leading={<Tile icon={Tag} />} title="Categories" value="12" chevron to="/categories" />
          <MobileListItem leading={<Tile icon={Upload} />} title="Import statements" subtitle="1 card statement to import" chevron to="/import" />
          <MobileListItem leading={<Tile icon={ShieldCheck} />} title="Security" chevron onClick={() => toast('Security')} />
          <MobileListItem leading={<Tile icon={Users} />} title="Disabled row" disabled chevron onClick={() => {}} />
          <MobileListItem title="Sign out" tone="red" onClick={() => toast('Signed out')} />
        </MobileList>
      </MobileSection>

      <MobileSection title="Details" description="MobileField rows in an inset list">
        <MobileList variant="inset" aria-label="Details">
          <MobileField label="Date">28 Oct 2026</MobileField>
          <MobileField label="Method">UPI · OKICICI</MobileField>
          <MobileField label="Narration">UPI-SWIGGY-SWIGGY8@YBL-YESB0YBLUPI-429876543210-PAYMENT FROM PHONE</MobileField>
        </MobileList>
      </MobileSection>

      <MobileSection title="Empty state">
        <EmptyState icon={Wallet} title="No transactions this month" description="Import a statement or add one by hand." action={<Button label="Import statement" to="/import" />} />
      </MobileSection>

      <MobileSection title="Action bar" description="A pushed page's main actions, pinned at the bottom">
        <Switch label="Show MobileActionBar" checked={showBar} onChange={setShowBar} />
      </MobileSection>

      {showBar && (
        <MobileActionBar>
          <Button size="lg" iconLeft={Users} label="Split" onClick={() => toast('Split')} />
          <Button size="lg" variant="solid" label="Settle up" onClick={() => toast.success('Settled up')} />
        </MobileActionBar>
      )}
    </section>
  );
}
