import { forwardRef, useMemo, useState } from 'react';
import {
  Archive,
  Calendar,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Folder,
  House,
  LayoutGrid,
  List as ListIcon,
  Pencil,
  Receipt,
  Settings,
  Share2,
  SlidersHorizontal,
  Tag,
  Trash2,
  Wallet,
} from 'lucide-react';
import Popover from '../../../components/ui/Popover.jsx';
import Dropdown from '../../../components/ui/Dropdown.jsx';
import Dialog from '../../../components/ui/Dialog.jsx';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.jsx';
import Sheet from '../../../components/ui/Sheet.jsx';
import { toast, Toaster } from '../../../components/ui/Toast.jsx';
import Tabs from '../../../components/ui/Tabs.jsx';
import TabButtons from '../../../components/ui/TabButtons.jsx';
import Breadcrumbs from '../../../components/ui/Breadcrumbs.jsx';
import ListView from '../../../components/ui/ListView.jsx';

// Demo triggers are plain <button>s (the kit's Button is built separately);
// they borrow the Dialog action-button styles so the page reads like Frappe.
const DemoButton = forwardRef(function DemoButton({ variant = 'outline', theme = 'gray', children, ...rest }, ref) {
  return (
    <button ref={ref} type="button" className="ui-dialog-btn" data-variant={variant} data-tone={theme} data-size="sm" {...rest}>
      {children}
    </button>
  );
});

// Frappe `form-input` look, inline so the demo doesn't lean on TextInput.
const demoInput = {
  height: 28,
  minWidth: 0,
  padding: '0 8px',
  border: '1px solid var(--surface-gray-2)',
  borderRadius: 'var(--radius-4)',
  background: 'var(--surface-gray-2)',
  color: 'var(--ink-gray-8)',
  fontSize: 14,
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const inr = (n) =>
  `${n < 0 ? '−' : '+'}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TRANSACTIONS = [
  { id: 't1', date: '2026-10-28', day: 'Today', description: 'Swiggy · Order 48213', category: 'Food', amount: -486 },
  { id: 't2', date: '2026-10-28', day: 'Today', description: 'Salary · Grip Invest Pvt Ltd', category: 'Salary', amount: 182500 },
  { id: 't3', date: '2026-10-27', day: 'Yesterday', description: 'Uber trip · Koramangala to HSR Layout', category: 'Transport', amount: -312.4 },
  { id: 't4', date: '2026-10-27', day: 'Yesterday', description: 'BigBasket', category: 'Grocery', amount: -2140.75 },
  { id: 't5', date: '2026-10-26', day: 'Earlier', description: 'Netflix subscription', category: 'Entertainment', amount: -649 },
  { id: 't6', date: '2026-10-25', day: 'Earlier', description: 'HDFC credit card bill payment', category: 'Bills', amount: -38412 },
  { id: 't7', date: '2026-10-24', day: 'Earlier', description: 'Amazon · Noise-cancelling headphones', category: 'Shopping', amount: -12999 },
  { id: 't8', date: '2026-10-23', day: 'Earlier', description: 'UPI from Ketul · Dinner split', category: 'Transfer', amount: 1250 },
];

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function OverlaysDemoInner() {
  // Dialogs & sheets
  const [dialog, setDialog] = useState(null); // 'basic' | 'icon' | 'tall' | 'legacy' | 'form'
  const [confirm, setConfirm] = useState(null); // 'ok' | 'fail' | 'gray'
  const [sheet, setSheet] = useState(null); // 'right' | 'bottom' | 'auto'

  // Navigation
  const [tab, setTab] = useState('all');
  const [view, setView] = useState('list');
  const [range, setRange] = useState('month');

  // List
  const [selection, setSelection] = useState([]);
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' });
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  const sortedRows = useMemo(() => {
    if (empty) return [];
    const rows = [...TRANSACTIONS];
    if (!sort) return rows;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (typeof x === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
  }, [sort, empty]);

  const groups = useMemo(
    () =>
      ['Today', 'Yesterday', 'Earlier'].map((day) => {
        const rows = TRANSACTIONS.filter((t) => t.day === day);
        return { key: day.toLowerCase(), label: day, rows, collapsed: day === 'Earlier' };
      }),
    [],
  );

  const columns = [
    { key: 'date', label: 'Date', width: 90, sortable: true, hideBelow: 'sm', render: (r) => fmtDate(r.date) },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(140px, 2fr)',
      sortable: true,
      render: (r) => <span className="ui-list__text font-medium">{r.description}</span>,
    },
    { key: 'category', label: 'Category', width: 140, hideBelow: 'md' },
    {
      key: 'amount',
      label: 'Amount',
      width: 120,
      align: 'right',
      sortable: true,
      render: (r) => (
        <span className={`ui-list__text tabular-nums ${r.amount > 0 ? 'text-ink-green-7' : 'text-ink-gray-8'}`}>
          {inr(r.amount)}
        </span>
      ),
    },
  ];

  const dropdownOptions = [
    {
      group: 'Transaction',
      items: [
        { label: 'Edit', icon: Pencil, shortcut: '⌘E', onClick: () => toast('Edit clicked') },
        { label: 'Duplicate', icon: Copy, shortcut: '⌘D', onClick: () => toast('Duplicated') },
        { label: 'Categorise', icon: Tag, description: 'Pick a category for this entry', onClick: () => toast('Categorise') },
        { label: 'Open transactions page', icon: ExternalLink, to: '/transactions' },
      ],
    },
    {
      group: 'Share',
      items: [
        { label: 'Export CSV', icon: Download, onClick: () => toast.success('Exported') },
        { label: 'Share link', icon: Share2, disabled: true },
        { label: 'Archive', icon: Archive, selected: true, onClick: () => toast('Archived') },
      ],
    },
    {
      items: [{ label: 'Delete', icon: Trash2, theme: 'red', shortcut: '⌫', onClick: () => setConfirm('ok') }],
      group: undefined,
    },
  ];

  return (
    <section className="uikit-section">
      <h2>Overlays &amp; navigation</h2>

      {/* ---------- Popover ---------- */}
      <div className="uikit-group">
        <h3>Popover</h3>
        <div className="uikit-row">
          <Popover
            trigger={
              <DemoButton>
                <SlidersHorizontal size={16} aria-hidden="true" />
                <span className="ui-dialog-btn__label">Filter</span>
              </DemoButton>
            }
          >
            {({ close }) => (
              <div style={{ width: 260, padding: 12, display: 'grid', gap: 10 }}>
                <div className="text-sm font-medium text-ink-gray-5">Amount between</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input aria-label="Minimum" placeholder="Min" style={{ ...demoInput, width: '50%' }} />
                  <input aria-label="Maximum" placeholder="Max" style={{ ...demoInput, width: '50%' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <DemoButton variant="ghost" onClick={close}>
                    Cancel
                  </DemoButton>
                  <DemoButton variant="solid" onClick={close}>
                    Apply
                  </DemoButton>
                </div>
              </div>
            )}
          </Popover>

          <Popover
            matchWidth
            placement="bottom-end"
            trigger={({ ref, props, open }) => (
              <DemoButton ref={ref} {...props}>
                <span className="ui-dialog-btn__label">Account: HDFC ••2209 {open ? '▴' : '▾'}</span>
              </DemoButton>
            )}
          >
            {({ close }) => (
              <div style={{ padding: 6 }}>
                {['HDFC ••2209', 'ICICI ••8812', 'Cash'].map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="ui-menu__item"
                    onClick={() => {
                      toast(`Switched to ${a}`);
                      close();
                    }}
                    style={{ border: 0, background: 'transparent' }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </Popover>
        </div>
      </div>

      {/* ---------- Dropdown ---------- */}
      <div className="uikit-group">
        <h3>Dropdown</h3>
        <div className="uikit-row">
          <Dropdown options={dropdownOptions}>
            <DemoButton>
              <span className="ui-dialog-btn__label">Actions</span>
            </DemoButton>
          </Dropdown>
          <Dropdown
            placement="bottom-end"
            options={[
              { label: 'Settings', icon: Settings, onClick: () => toast('Settings') },
              { label: 'Statements', icon: Receipt, onClick: () => toast('Statements') },
              { label: 'Sign out', theme: 'red', onClick: () => toast.warning('Signed out (not really)') },
            ]}
          >
            <DemoButton variant="ghost">
              <span className="ui-dialog-btn__label">Flat menu ▾</span>
            </DemoButton>
          </Dropdown>
        </div>
      </div>

      {/* ---------- Dialog ---------- */}
      <div className="uikit-group">
        <h3>Dialog &amp; ConfirmDialog</h3>
        <div className="uikit-row">
          <DemoButton onClick={() => setDialog('basic')}>Basic dialog</DemoButton>
          <DemoButton onClick={() => setDialog('icon')}>With icon</DemoButton>
          <DemoButton onClick={() => setDialog('form')}>Form (single action)</DemoButton>
          <DemoButton onClick={() => setDialog('tall')}>Tall content</DemoButton>
          <DemoButton onClick={() => setDialog('legacy')}>Legacy API</DemoButton>
          <DemoButton theme="red" onClick={() => setConfirm('ok')}>
            Confirm (async)
          </DemoButton>
          <DemoButton theme="red" onClick={() => setConfirm('fail')}>
            Confirm (fails)
          </DemoButton>
          <DemoButton onClick={() => setConfirm('gray')}>Confirm (gray)</DemoButton>
        </div>
      </div>

      <Dialog
        open={dialog === 'basic'}
        onClose={() => setDialog(null)}
        title="Link a credit card"
        description="Statements from this card will be matched to your bank transactions automatically."
        actions={[
          { label: 'Cancel' },
          {
            label: 'Link card',
            variant: 'solid',
            onClick: async (e, { close }) => {
              await wait(900);
              toast.success('Card linked');
              close();
            },
          },
        ]}
      />

      <Dialog
        open={dialog === 'icon'}
        onClose={() => setDialog(null)}
        size="md"
        icon={CreditCard}
        theme="blue"
        title="Statement ready"
        description="Your October statement for HDFC ••2209 has been imported: 42 transactions, ₹38,412 due on 14 Nov."
        actions={[
          { label: 'Later', variant: 'outline' },
          { label: 'Review', variant: 'solid', theme: 'blue', onClick: () => setDialog(null) },
        ]}
      />

      <Dialog
        open={dialog === 'form'}
        onClose={() => setDialog(null)}
        size="sm"
        title="Rename group"
        actions={[{ label: 'Save', variant: 'solid', type: 'submit', form: 'demo-rename' }]}
      >
        <form
          id="demo-rename"
          onSubmit={(e) => {
            e.preventDefault();
            toast.success('Renamed');
            setDialog(null);
          }}
          style={{ display: 'grid', gap: 6 }}
        >
          <label className="text-xs text-ink-gray-5" htmlFor="demo-rename-input">
            Group name
          </label>
          <input id="demo-rename-input" style={demoInput} defaultValue="Ketul's wedding" data-autofocus />
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'tall'}
        onClose={() => setDialog(null)}
        size="xl"
        title="Import summary"
        actions={[{ label: 'Close' }, { label: 'Import all', variant: 'solid' }]}
      >
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i} className="text-p-base text-ink-gray-7">
            Row {i + 1}: UPI/CR/{429381 + i}/Merchant {i + 1} — matched to an existing transaction, category kept.
          </p>
        ))}
      </Dialog>

      {dialog === 'legacy' && (
        <Dialog
          overline="Net off"
          title="Net off with Ketul"
          onClose={() => setDialog(null)}
          footer={
            <>
              <span style={{ marginRight: 'auto' }} className="text-sm text-ink-gray-5">
                ₹1,250 ↔ ₹1,250
              </span>
              <DemoButton variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </DemoButton>
              <DemoButton variant="solid" onClick={() => setDialog(null)}>
                Net off ₹1,250
              </DemoButton>
            </>
          }
        >
          <p className="text-p-sm text-ink-gray-5">
            The old prop set — overline, title, onClose, footer, children — rendered conditionally, no `open`.
          </p>
          <p className="text-p-base text-ink-gray-7">Clears what you owe Ketul against what Ketul owes you.</p>
        </Dialog>
      )}

      <ConfirmDialog
        open={confirm === 'ok'}
        title="Delete transaction?"
        message="This removes the entry and any friend splits attached to it. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          await wait(1200);
          setConfirm(null);
          toast.success('Transaction deleted');
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'fail'}
        title="Delete category?"
        message="Transactions in this category will become uncategorised."
        confirmLabel="Delete"
        onConfirm={async () => {
          await wait(800);
          throw new Error('Category is used by 12 rules. Remove the rules first.');
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'gray'}
        theme="gray"
        title="Discard changes?"
        message="You have unsaved edits on this split."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => setConfirm(null)}
        onCancel={() => setConfirm(null)}
      />

      {/* ---------- Sheet ---------- */}
      <div className="uikit-group">
        <h3>Sheet</h3>
        <div className="uikit-row">
          <DemoButton onClick={() => setSheet('right')}>Right panel</DemoButton>
          <DemoButton onClick={() => setSheet('bottom')}>Bottom sheet</DemoButton>
          <DemoButton onClick={() => setSheet('auto')}>Auto (resize me)</DemoButton>
        </div>
      </div>

      <Sheet
        open={sheet != null}
        side={sheet || 'auto'}
        onClose={() => setSheet(null)}
        title="Swiggy · Order 48213"
        description="28 Oct 2026 · HDFC ••2209"
        footer={
          <>
            <DemoButton variant="ghost" onClick={() => setSheet(null)}>
              Close
            </DemoButton>
            <DemoButton variant="solid" onClick={() => setSheet(null)}>
              Save
            </DemoButton>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="text-4xl font-semibold text-ink-gray-9 tabular-nums">−₹486.00</div>
          {Array.from({ length: 14 }, (_, i) => (
            <div
              key={i}
              style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--outline-gray-1)' }}
            >
              <span className="text-base text-ink-gray-5">Field {i + 1}</span>
              <span className="text-base text-ink-gray-8">Value {i + 1}</span>
            </div>
          ))}
        </div>
      </Sheet>

      {/* ---------- Toast ---------- */}
      <div className="uikit-group">
        <h3>Toast</h3>
        <div className="uikit-row">
          <DemoButton onClick={() => toast('Statement queued for import')}>Default</DemoButton>
          <DemoButton onClick={() => toast.success('Transaction saved')}>Success</DemoButton>
          <DemoButton onClick={() => toast.error({ title: 'Upload failed', description: 'The PDF is password protected.' })}>
            Error
          </DemoButton>
          <DemoButton onClick={() => toast.info('3 new transactions since your last visit')}>Info</DemoButton>
          <DemoButton onClick={() => toast.warning('Card bill due in 2 days')}>Warning</DemoButton>
          <DemoButton
            onClick={() =>
              toast({
                title: 'Transaction deleted',
                action: { label: 'Undo', onClick: () => toast.success('Restored') },
                duration: 8000,
              })
            }
          >
            With action
          </DemoButton>
          <DemoButton variant="ghost" onClick={() => toast.dismiss()}>
            Dismiss all
          </DemoButton>
        </div>
      </div>

      {/* ---------- Tabs ---------- */}
      <div className="uikit-group">
        <h3>Tabs</h3>
        <Tabs
          aria-label="Transaction filters"
          value={tab}
          onChange={setTab}
          tabs={[
            { label: 'All', value: 'all', icon: ListIcon, count: 128 },
            { label: 'Uncategorised', value: 'uncat', count: 7 },
            { label: 'Credit cards', value: 'cards', icon: CreditCard },
            { label: 'Friends', value: 'friends', count: 3 },
            { label: 'Archived', value: 'archived', disabled: true },
          ]}
        />
        <p className="text-sm text-ink-gray-5">Selected: {tab}</p>
        <div style={{ maxWidth: 300 }}>
          <Tabs
            aria-label="Narrow tabs"
            value={tab}
            onChange={setTab}
            tabs={[
              { label: 'All', value: 'all' },
              { label: 'Uncategorised', value: 'uncat' },
              { label: 'Credit cards', value: 'cards' },
              { label: 'Friends', value: 'friends' },
              { label: 'Subscriptions', value: 'subs' },
            ]}
          />
        </div>
      </div>

      {/* ---------- TabButtons ---------- */}
      <div className="uikit-group">
        <h3>TabButtons</h3>
        <div className="uikit-row">
          <TabButtons
            aria-label="Range"
            value={range}
            onChange={setRange}
            options={[
              { label: 'Week', value: 'week' },
              { label: 'Month', value: 'month' },
              { label: 'Year', value: 'year' },
            ]}
          />
          <TabButtons
            aria-label="View"
            value={view}
            onChange={setView}
            options={[
              { label: 'List', value: 'list', icon: ListIcon, hideLabel: true },
              { label: 'Grid', value: 'grid', icon: LayoutGrid, hideLabel: true },
              { label: 'Calendar', value: 'calendar', icon: Calendar, hideLabel: true },
            ]}
          />
          <TabButtons
            aria-label="Range (md)"
            size="md"
            value={range}
            onChange={setRange}
            options={[
              { label: 'Week', value: 'week', icon: Calendar },
              { label: 'Month', value: 'month' },
              { label: 'Year', value: 'year' },
            ]}
          />
        </div>
      </div>

      {/* ---------- Breadcrumbs ---------- */}
      <div className="uikit-group">
        <h3>Breadcrumbs</h3>
        <Breadcrumbs items={[{ label: 'Cards', to: '/ui-kit' }, { label: 'HDFC ••2209' }]} />
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/ui-kit', icon: House },
            { label: 'Friends', to: '/ui-kit' },
            { label: 'Ketul', onClick: () => toast('Ketul') },
            { label: 'Groups', to: '/ui-kit', icon: Folder },
            { label: "Ketul's wedding" },
          ]}
        />
        <div style={{ maxWidth: 260, border: '1px dashed var(--outline-gray-2)', borderRadius: 8, padding: '0 6px' }}>
          <Breadcrumbs
            items={[
              { label: 'Accounts', to: '/ui-kit', icon: Wallet },
              { label: 'HDFC Savings ••4410', to: '/ui-kit' },
              { label: 'October 2026 statement' },
            ]}
          />
        </div>
      </div>

      {/* ---------- ListView ---------- */}
      <div className="uikit-group">
        <h3>ListView</h3>
        <div className="uikit-row">
          <DemoButton variant="ghost" onClick={() => setLoading((v) => !v)}>
            {loading ? 'Stop loading' : 'Show loading'}
          </DemoButton>
          <DemoButton variant="ghost" onClick={() => setEmpty((v) => !v)}>
            {empty ? 'Show rows' : 'Show empty'}
          </DemoButton>
          <span className="text-sm text-ink-gray-5">
            Sort: {sort ? `${sort.key} ${sort.direction}` : 'none'} · {selection.length} selected
          </span>
        </div>
        <ListView
          aria-label="Transactions"
          columns={columns}
          rows={loading ? [] : sortedRows}
          loading={loading}
          selectable
          selection={selection}
          onSelectionChange={setSelection}
          sort={sort}
          onSortChange={setSort}
          onRowClick={(row) => toast(row.description)}
          emptyState={
            <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
              <span className="text-base font-medium text-ink-gray-7">No transactions</span>
              <span className="text-sm text-ink-gray-5">Import a statement to see it here.</span>
            </div>
          }
          selectionActions={(keys, clear) => (
            <>
              <Dropdown
                placement="top-start"
                options={['Food', 'Transport', 'Bills', 'Shopping'].map((c) => ({
                  label: c,
                  onClick: () => {
                    toast.success(`${keys.length} moved to ${c}`);
                    clear();
                  },
                }))}
              >
                <button type="button" className="ui-list-banner__btn">
                  <Tag size={16} aria-hidden="true" />
                  Categorise
                </button>
              </Dropdown>
              <button
                type="button"
                className="ui-list-banner__btn"
                style={{ color: 'var(--ink-red-7)' }}
                onClick={() => {
                  toast(`${keys.length} deleted`, { action: { label: 'Undo', onClick: () => {} } });
                  clear();
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            </>
          )}
          footer={
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DemoButton variant="ghost" onClick={() => toast.info('Loading more…')}>
                Load more
              </DemoButton>
            </div>
          }
        />

        <h3>ListView · grouped, row links, sticky header in a scroll box</h3>
        <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--outline-gray-1)', borderRadius: 12 }}>
          <ListView
            aria-label="Transactions by day"
            stickyHeader
            columns={columns.filter((c) => c.key !== 'date')}
            groups={groups}
            rowHref={(r) => `/ui-kit?txn=${r.id}`}
          />
        </div>
      </div>
    </section>
  );
}

export default function OverlaysDemo() {
  return (
    <>
      <OverlaysDemoInner />
      <Toaster />
    </>
  );
}
