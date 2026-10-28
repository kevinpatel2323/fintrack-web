import { useState } from 'react';
import {
  Banknote, Ellipsis, FileText, ListFilter, Plus, Receipt, Search, Trash2, Upload,
} from 'lucide-react';
import {
  Alert, Amount, Badge, Button, Dropdown, EmptyState, FormControl, FormLabel, ListView, MobileActionBar,
  PageBody, Sheet, Skeleton, TabButtons, Tabs, TextInput,
} from '../../components/ui';
import CardFace from '../../components/cards/CardFace.jsx';
import TransactionMobileList from '../../components/TransactionMobileList.jsx';
import CardDetailsPhone from './CardDetailsPhone.jsx';
import {
  STATEMENT_STATUS, dayLabel, dueBadge, formatPct, rangeLabel, relativeDays,
} from '../../components/cards/cardFormat.js';
import './card-detail-phone.css';

const BILLING_SEGMENTS = [
  { label: 'All', value: '' },
  { label: 'Unbilled', value: 'unbilled' },
  { label: 'Billed', value: 'billed' },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ── Statements and payments: ListView's phone rows ──
// The title column carries the facts of the hidden columns on a second line;
// the hidden ones stay in the "Sorted by" sheet.

const statementStatus = (s) => STATEMENT_STATUS[s.status] || { label: s.status, theme: 'gray' };

const STATEMENT_COLUMNS = [
  {
    key: 'cycle',
    label: 'Cycle',
    width: 'minmax(0, 1fr)',
    flex: true,
    sortable: true,
    sortFirst: 'desc',
    sortValue: (s) => s.cycleEnd || s.cycleStart || '',
    render: (s) => {
      const total = Number(s.totalAmount) || 0;
      const paid = Number(s.paidAmount) || 0;
      return (
        <span className="carddm-cell">
          <span className="carddm-cell__title">{rangeLabel(s.cycleStart, s.cycleEnd)}</span>
          <span className="carddm-cell__sub">
            Due {dayLabel(s.dueDate)}
            {paid > 0 && paid < total && (
              <>
                {' · '}
                <Amount value={paid} tone="inherit" /> paid
              </>
            )}
          </span>
        </span>
      );
    },
  },
  {
    key: 'due',
    label: 'Due',
    hideBelow: 'md',
    sortable: true,
    sortFirst: 'desc',
    sortValue: (s) => s.dueDate || '',
    render: (s) => dayLabel(s.dueDate, { year: true }),
  },
  {
    key: 'paid',
    label: 'Paid',
    hideBelow: 'md',
    sortable: true,
    sortValue: (s) => Number(s.paidAmount) || 0,
    render: (s) => <Amount value={Number(s.paidAmount)} tone="inherit" />,
  },
  {
    key: 'status',
    label: 'Status',
    hideBelow: 'md',
    sortable: true,
    sortValue: (s) => statementStatus(s).label,
    render: (s) => statementStatus(s).label,
  },
  {
    key: 'total',
    label: 'Total',
    width: 'max-content',
    align: 'right',
    sortable: true,
    sortValue: (s) => Number(s.totalAmount) || 0,
    render: (s) => (
      <span className="carddm-cell carddm-cell--end">
        <Amount className="carddm-cell__amount" value={Number(s.totalAmount)} tone="inherit" />
        <Badge size="sm" theme={statementStatus(s).theme} label={statementStatus(s).label} />
      </span>
    ),
  },
];

function paymentColumns(onDelete) {
  return [
    {
      key: 'via',
      label: 'Paid from',
      width: 'minmax(0, 1fr)',
      flex: true,
      sortable: true,
      sortValue: (p) => p.viaLabel || 'Manual payment',
      render: (p) => (
        <span className="carddm-cell">
          <span className="carddm-cell__title">{p.viaLabel || 'Manual payment'}</span>
          <span className="carddm-cell__sub">
            {dayLabel(p.paidOn)}
            {p.notes ? ` · ${p.notes}` : ''}
          </span>
        </span>
      ),
    },
    {
      key: 'paidOn',
      label: 'Date',
      hideBelow: 'md',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (p) => p.paidOn || '',
      render: (p) => dayLabel(p.paidOn, { year: true }),
    },
    {
      key: 'notes',
      label: 'Notes',
      hideBelow: 'md',
      sortable: true,
      sortValue: (p) => p.notes || '',
      render: (p) => p.notes || '',
    },
    {
      key: 'amount',
      label: 'Amount',
      width: 'max-content',
      align: 'right',
      sortable: true,
      sortValue: (p) => Number(p.amount) || 0,
      render: (p) => <Amount className="carddm-cell__amount" value={Number(p.amount)} tone="in" />,
    },
    {
      key: 'actions',
      label: <span className="sr-only">Actions</span>,
      width: 36,
      align: 'right',
      render: (p) => (
        <Dropdown
          label={`Payment on ${dayLabel(p.paidOn)}`}
          options={[{ label: 'Delete payment', icon: Trash2, theme: 'red', onClick: () => onDelete(p) }]}
        >
          <Button variant="ghost" size="md" icon={Ellipsis} label="Payment actions" />
        </Dropdown>
      ),
    },
  ];
}

// ── Hero ──

function Tile({ label, value, hint }) {
  return (
    <div className="carddm-tile">
      <span className="carddm-tile__label">{label}</span>
      <span className="carddm-tile__value">{value}</span>
      {hint && <span className="carddm-tile__hint">{hint}</span>}
    </div>
  );
}

/** The card face, the outstanding as the hero figure, then the cycle and the bill. */
function Hero({ card, isCredit, due, cycleRange }) {
  const unbilled = Number(card.unbilledTotal ?? 0);
  const pct = card.utilizationPct;
  const badge = dueBadge(due);

  if (!isCredit) {
    return (
      <section className="carddm-hero" aria-label="Summary">
        <CardFace card={card} className="carddm-hero__face" />
        <div className="carddm-hero__figure">
          <span className="carddm-hero__label">Spent this month</span>
          <Amount className="carddm-hero__amount" value={Number(card.thisMonthSpend ?? 0)} tone="inherit" />
          {card.linkedAccountNumber && (
            <span className="carddm-hero__line">Linked to {card.linkedAccountNumber}</span>
          )}
        </div>
      </section>
    );
  }

  const hasUnbilled = unbilled !== 0;
  const hasPct = pct != null;

  return (
    <section className="carddm-hero" aria-label="Summary">
      <CardFace card={card} className="carddm-hero__face" />
      <div className="carddm-hero__figure">
        <span className="carddm-hero__label">Outstanding</span>
        <Amount className="carddm-hero__amount" value={Number(card.outstanding || 0)} tone="inherit" />
        {(hasUnbilled || hasPct) && (
          <span className="carddm-hero__line">
            {hasUnbilled && (
              <>
                <Amount value={unbilled} tone="inherit" /> not yet billed
              </>
            )}
            {hasUnbilled && hasPct && ' · '}
            {hasPct && `${formatPct(pct)} of limit used`}
          </span>
        )}
      </div>
      <div className="carddm-tiles">
        <Tile
          label="Spent this cycle"
          value={<Amount value={Number(card.thisCycleSpend ?? 0)} tone="inherit" />}
          hint={cycleRange || 'Set a statement day'}
        />
        {due ? (
          <Tile
            label={`Due ${dayLabel(due.dueDate)}`}
            value={<Amount value={Number(due.amount)} tone={due.status === 'overdue' ? 'due' : 'inherit'} />}
            hint={
              <span className="carddm-tile__due">
                {badge && <Badge size="sm" theme={badge.theme} label={badge.label} />}
                {due.status !== 'due-today' && due.status !== 'due-tomorrow' && <span>{relativeDays(due.daysAway)}</span>}
              </span>
            }
          />
        ) : (
          <Tile label="Amount due" value={<Amount value={0} tone="inherit" />} hint="No bill due" />
        )}
      </div>
    </section>
  );
}

// ── Transactions tab ──

function FilterSheet({
  open, onClose, isCredit, categoryOptions, category, onCategoryChange, billing, onBillingChange, resultCount,
}) {
  const active = (category ? 1 : 0) + (billing ? 1 : 0);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      title="Filter"
      className="carddm-filter-sheet"
      footer={(
        <>
          <Button
            size="lg"
            label="Clear"
            disabled={!active}
            onClick={() => { onCategoryChange(''); onBillingChange(''); }}
          />
          <Button size="lg" variant="solid" label={`Show ${plural(resultCount, 'result')}`} onClick={onClose} />
        </>
      )}
    >
      <div className="carddm-filters">
        <FormControl
          type="select"
          label="Category"
          options={categoryOptions}
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        />
        {isCredit && (
          <div className="carddm-filters__field">
            <FormLabel as="div" label="Billing" />
            <TabButtons fluid aria-label="Billing" options={BILLING_SEGMENTS} value={billing} onChange={onBillingChange} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

function TransactionsPanel({ isCredit, ledger, onAddTransaction }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const {
    transactions, rows, categories, search, onSearchChange, categoryFilter, onCategoryChange, billingFilter,
    onBillingChange, categoryOptions, filtersActive, filteredCount, filteredSpend, totalSpend, clearFilters,
    onAssignCategory, onOpenDetail, loading,
  } = ledger;
  const activeCount = (categoryFilter ? 1 : 0) + (billingFilter ? 1 : 0);

  if (transactions.length === 0 && !loading) {
    return (
      <EmptyState
        className="carddm-empty"
        icon={Receipt}
        title="No transactions yet"
        description={
          isCredit
            ? 'Import a statement, paste unbilled spends, or add one by hand.'
            : 'Add a transaction by hand.'
        }
        action={
          isCredit ? (
            <Button iconLeft={Upload} label="Import statement" to="/import" />
          ) : (
            <Button iconLeft={Plus} label="Add transaction" onClick={onAddTransaction} />
          )
        }
      />
    );
  }

  return (
    <>
      <div className="carddm-search">
        <TextInput
          type="search"
          size="md"
          prefix={Search}
          placeholder="Search transactions"
          aria-label="Search transactions"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="carddm-bar">
        <span className="carddm-bar__summary" aria-live="polite">
          {filtersActive ? (
            <>
              {filteredCount} of {transactions.length} · <Amount value={filteredSpend} tone="inherit" />
            </>
          ) : (
            <>
              {plural(transactions.length, 'transaction')} · <Amount value={totalSpend} tone="inherit" /> spent
            </>
          )}
        </span>
        <Button
          iconLeft={ListFilter}
          active={activeCount > 0}
          aria-label={activeCount ? `Filter, ${activeCount} active` : 'Filter'}
          aria-haspopup="dialog"
          onClick={() => setFiltersOpen(true)}
        >
          Filter
          {activeCount > 0 && <span className="carddm-bar__count">{activeCount}</span>}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Search}
          title="No transactions match"
          action={<Button label="Clear filters" onClick={clearFilters} />}
        />
      ) : (
        <TransactionMobileList
          bleed
          rows={rows}
          categories={categories}
          onAssignCategory={onAssignCategory}
          onOpenDetail={onOpenDetail}
        />
      )}

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        isCredit={isCredit}
        categoryOptions={categoryOptions}
        category={categoryFilter}
        onCategoryChange={onCategoryChange}
        billing={billingFilter}
        onBillingChange={onBillingChange}
        resultCount={filteredCount}
      />
    </>
  );
}

// ── Page ──

/**
 * The card page on phones: the card face with the outstanding as the hero,
 * the cycle's spend and the bill as a pair of tiles, then underline tabs for
 * Transactions, Statements, Payments and Details. The page's state, data and
 * handlers all come from `pages/CardDetail.jsx`; the header's `+` and `…`
 * are set there too. A bill that is due puts "Record payment" in the bottom
 * action bar.
 */
export default function CardDetailPhone({
  card,
  isCredit,
  loading,
  error,
  onRetry,
  importReady,
  onImport,
  schedule,
  due,
  cycleRange,
  tabs,
  activeTab,
  onTabChange,
  ledger,
  statements,
  payments,
  paidTotal,
  onOpenStatement,
  onDeletePayment,
  onAddTransaction,
  onAddStatement,
  onRecordPayment,
  onEdit,
}) {
  return (
    <PageBody className="carddm">
      {error && (
        <Alert
          theme="red"
          title="Couldn't refresh this card"
          description={error}
          primaryAction={{ label: 'Try again', onClick: onRetry }}
        />
      )}
      {importReady && (
        <Alert
          theme="blue"
          title={`${importReady.label} statement is ready to import`}
          primaryAction={{ label: 'Import', onClick: onImport }}
        />
      )}

      <Hero card={card} isCredit={isCredit} due={due} cycleRange={cycleRange} />

      <div className="carddm-tabs" data-spread={tabs.length > 2 ? '' : undefined}>
        {/* Counts stay in each panel's summary line, so all four tabs fit a 375px screen. */}
        <Tabs
          idPrefix="carddm"
          aria-label="Card sections"
          tabs={tabs.map(({ count, ...t }) => t)}
          value={activeTab}
          onChange={onTabChange}
        />
      </div>
      <div
        className="carddm-panel"
        role="tabpanel"
        id={`carddm-panel-${activeTab}`}
        aria-labelledby={`carddm-tab-${activeTab}`}
      >
        {activeTab === 'transactions' && (
          <TransactionsPanel isCredit={isCredit} ledger={ledger} onAddTransaction={onAddTransaction} />
        )}

        {activeTab === 'statements' && isCredit && (
          <>
            <div className="carddm-bar">
              <span className="carddm-bar__summary">{plural(statements.length, 'statement')}</span>
              <Button iconLeft={Plus} label="Add statement" onClick={onAddStatement} />
            </div>
            <ListView
              className="phone-bleed"
              aria-label="Statements"
              columns={STATEMENT_COLUMNS}
              rows={statements}
              defaultSort={{ key: 'cycle', direction: 'desc' }}
              pagination
              onRowClick={onOpenStatement}
              loading={loading && statements.length === 0}
              emptyState={
                <EmptyState
                  size="sm"
                  icon={FileText}
                  title="No statements yet"
                  description="Import the card's statement, or add one by hand."
                  action={<Button iconLeft={Upload} label="Import statement" to="/import" />}
                />
              }
            />
          </>
        )}

        {activeTab === 'payments' && isCredit && (
          <>
            <div className="carddm-bar">
              <span className="carddm-bar__summary">
                {plural(payments.length, 'payment')}
                {payments.length > 0 && (
                  <>
                    {' · '}
                    <Amount value={paidTotal} tone="inherit" /> paid
                  </>
                )}
              </span>
              <Button iconLeft={Plus} label="Record payment" onClick={onRecordPayment} />
            </div>
            <ListView
              className="phone-bleed"
              aria-label="Payments"
              columns={paymentColumns(onDeletePayment)}
              rows={payments}
              defaultSort={{ key: 'paidOn', direction: 'desc' }}
              pagination
              loading={loading && payments.length === 0}
              emptyState={
                <EmptyState
                  size="sm"
                  icon={Banknote}
                  title="No payments yet"
                  description="Record a bill payment to keep the outstanding right."
                />
              }
            />
          </>
        )}

        {activeTab === 'details' && <CardDetailsPhone card={card} schedule={schedule} onEdit={onEdit} />}
      </div>

      {isCredit && due && (
        <MobileActionBar>
          <Button size="lg" variant="solid" iconLeft={Banknote} label="Record payment" onClick={onRecordPayment} />
        </MobileActionBar>
      )}
    </PageBody>
  );
}

/** First load on phones: the hero's shape, then a few rows. */
export function CardDetailPhoneSkeleton() {
  return (
    <PageBody className="carddm" aria-busy="true">
      <div className="carddm-hero">
        <Skeleton className="carddm-hero__face carddm-skeleton__face" />
        <div className="carddm-hero__figure carddm-skeleton__figure">
          <Skeleton height={13} width={80} />
          <Skeleton height={30} width={120} />
        </div>
        <div className="carddm-tiles">
          <Skeleton className="carddm-skeleton__tile" />
          <Skeleton className="carddm-skeleton__tile" />
        </div>
      </div>
      <div className="carddm-skeleton__rows">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={16} width={`${90 - i * 10}%`} />
        ))}
      </div>
    </PageBody>
  );
}
