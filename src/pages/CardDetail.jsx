import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Banknote, ClipboardPaste, CreditCard, FileText, MoreHorizontal, Pencil, Plus, Receipt, Search, Star, Trash2, Upload,
} from 'lucide-react';
import {
  Alert, Amount, Badge, Button, ConfirmDialog, Dropdown, EmptyState, ListColumnsMenu, ListView, PageBody, PageHeader,
  Select, Skeleton, StatCard, Tabs, TextInput, toast,
} from '../components/ui';
import CardFormModal from '../components/CardFormModal.jsx';
import { categoryOptions as buildCategoryOptions } from '../components/common/Category.jsx';
import CardTransactionModal from '../components/CardTransactionModal.jsx';
import UnbilledPasteModal from '../components/UnbilledPasteModal.jsx';
import CardPaymentModal from '../components/CardPaymentModal.jsx';
import CardStatementModal from '../components/CardStatementModal.jsx';
import TransactionTable, { transactionColumnChoices, useTransactionColumns } from '../components/TransactionTable.jsx';
import TransactionManageSheet from '../components/TransactionManageSheet.jsx';
import TransactionMobileList from '../components/TransactionMobileList.jsx';
import CardDetailsPanel from './cards/CardDetailsPanel.jsx';
import StatementBreakdownDialog from './cards/StatementBreakdownDialog.jsx';
import {
  deleteCard,
  deleteCardPayment,
  deleteCardStatement,
  deleteCardTransaction,
  fetchStatementBreakdown,
  getCard,
  listCardPayments,
  listCardStatements,
  listCardTransactions,
  setCardPrimary,
} from '../services/cardsApi.js';
import { cardTxnStatus, toCardTableRow } from '../utils/cardTransactionRow.jsx';
import { useCardTransactionManager } from '../hooks/useCardTransactionManager.js';
import { refreshImportSchedule, useImportSchedule } from '../hooks/useImportSchedule.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useIsCompact } from '../styles/breakpoints.js';
import {
  STATEMENT_STATUS, cardLabel, dayLabel, dueBadge, formatPct, rangeLabel, relativeDays,
} from '../components/cards/cardFormat.js';
import './cards/card-detail.css';

import { API_BASE, apiFetch } from '../services/http.js';

const shortDay = (iso) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(
    new Date(`${iso}T00:00:00`),
  );

// Below this the side panel folds into a "Details" tab.
const QUERY_STACKED = '(max-width: 1023.98px)';

const BILLING_OPTIONS = [
  { label: 'Billed and unbilled', value: '' },
  { label: 'Unbilled only', value: 'unbilled' },
  { label: 'Billed only', value: 'billed' },
];

/** The card's next bill in the same shape /cards/dues uses, for its badge. */
function cardDue(card) {
  if (!card || !(card.currentDue > 0) || !card.currentDueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${card.currentDueDate}T00:00:00`);
  const daysAway = Math.round((due.getTime() - today.getTime()) / 86400000);
  let status = 'upcoming';
  if (daysAway < 0) status = 'overdue';
  else if (daysAway === 0) status = 'due-today';
  else if (daysAway === 1) status = 'due-tomorrow';
  return { status, daysAway, amount: card.currentDue, dueDate: card.currentDueDate };
}

const CARD_COLUMN_LABELS = { description: 'Merchant', method: 'Status' };
const CARD_COLUMN_CHOICES = transactionColumnChoices(CARD_COLUMN_LABELS);

export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsCompact();
  const columnSettings = useTransactionColumns('fintrack.ledger.card');
  const isStacked = useMediaQuery(QUERY_STACKED);

  const [card, setCard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [statements, setStatements] = useState([]);
  const [payments, setPayments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState('transactions');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [txnOpen, setTxnOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [stmtOpen, setStmtOpen] = useState(false);
  const [activeBreakdown, setActiveBreakdown] = useState(null);

  // ── Transactions tab: same ledger controls as the bank transactions page ──
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // '' | 'unbilled' | 'billed' — spend made after the last statement closed has
  // no statement yet, and this is how you pull it up on its own.
  const [billingFilter, setBillingFilter] = useState('');
  // The table picks the next sort (and goes back to page 1); the phone list
  // shows the same order, so the rows are sorted here.
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editTxn, setEditTxn] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });

  const { data: schedule } = useImportSchedule();
  const cardSchedule = useMemo(
    () => (schedule?.cards ?? []).find((s) => String(s.card.id) === String(id)) ?? null,
    [schedule, id],
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, t, s, p, cats, frs] = await Promise.all([
        getCard(id),
        listCardTransactions(id),
        listCardStatements(id),
        listCardPayments(id),
        apiFetch(`${API_BASE}/categories`).then((r) => r.json()).catch(() => ({ data: [] })),
        apiFetch(`${API_BASE}/friends`).then((r) => r.json()).catch(() => ({ data: [] })),
      ]);
      const rows = t.data ?? [];
      setCard(c);
      setTransactions(rows);
      setStatements(s.data ?? []);
      setPayments(p.data ?? []);
      setCategories(cats.data ?? cats ?? []);
      setFriends(frs.data ?? frs ?? []);
      // The list payload carries each row's friend tags inline, so seed the
      // split column from it instead of fetching per row.
      seedTags(rows, { replace: true });
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load card.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  const isCredit = card?.kind === 'credit';

  // ── Confirmations: one kit ConfirmDialog for every destructive action ──
  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false }));
  const askConfirm = ({ action, ...opts }) =>
    setConfirmState({
      open: true,
      confirmLabel: 'Delete',
      ...opts,
      // A rejection stays in the dialog as its error; success closes it.
      onConfirm: async () => {
        await action();
        closeConfirm();
      },
    });

  const onMakePrimary = async () => {
    if (!card || card.isPrimary) return;
    try {
      await setCardPrimary(card.id);
      toast.success(`${cardLabel(card)} is now your primary card`);
      await loadAll();
    } catch (e) {
      toast.error(e.message || 'Failed to update');
    }
  };

  const onDeleteCard = () => {
    if (!card) return;
    askConfirm({
      title: `Delete ${cardLabel(card)}?`,
      message: 'Its statements, transactions and payments are deleted too. This can’t be undone.',
      confirmLabel: 'Delete card',
      action: async () => {
        await deleteCard(card.id);
        refreshImportSchedule();
        toast.success('Card deleted');
        navigate('/cards');
      },
    });
  };

  const onDeleteTxn = (txnId) => {
    askConfirm({
      title: 'Delete transaction?',
      message: 'This removes the card transaction and any friend tags on it.',
      action: async () => {
        await deleteCardTransaction(txnId);
        setManageSheetId((current) => (current === txnId ? null : current));
        toast.success('Transaction deleted');
        await loadAll();
      },
    });
  };

  // Managing a card transaction (category, splits, friend tags) is shared with
  // every other place a card ledger is rendered.
  const manager = useCardTransactionManager({
    categories,
    onRowPatched: (txnId, patch) =>
      setTransactions((prev) =>
        prev.map((t) => (String(t.id) === String(txnId) ? { ...t, ...patch } : t)),
      ),
  });
  const {
    tagsByTransaction, manageSheetId,
    setManageSheetId, seedTags, assignCategory, openManage, manageSheetPropsFor,
  } = manager;

  const deleteTag = useCallback((txnId, tagId) => {
    askConfirm({
      title: 'Remove tag?',
      message: 'This will remove the friend tag from this transaction.',
      confirmLabel: 'Remove',
      action: () => manager.removeTag(txnId, tagId),
    });
  }, [manager]);

  const onDeletePayment = (payment) => {
    askConfirm({
      title: 'Delete payment?',
      message: (
        <>
          The <Amount value={Number(payment.amount)} tone="inherit" /> payment on {dayLabel(payment.paidOn)} is
          removed from this card.
        </>
      ),
      action: async () => {
        await deleteCardPayment(payment.id);
        toast.success('Payment deleted');
        await loadAll();
      },
    });
  };

  const onDeleteStatement = (stmt) => {
    askConfirm({
      title: 'Delete statement?',
      message: `Transactions on the ${rangeLabel(stmt.cycleStart, stmt.cycleEnd)} statement are unlinked, not deleted.`,
      action: async () => {
        await deleteCardStatement(stmt.id);
        setActiveBreakdown((b) => (b?.statement?.id === stmt.id ? null : b));
        toast.success('Statement deleted');
        await loadAll();
      },
    });
  };

  const openBreakdown = async (stmt) => {
    // Open straight away with what the row knows; the breakdown fills in.
    setActiveBreakdown({ loading: true, statement: stmt });
    try {
      const data = await fetchStatementBreakdown(stmt.id);
      setActiveBreakdown((b) => (b?.statement?.id === stmt.id ? data : b));
    } catch (e) {
      setActiveBreakdown(null);
      toast.error(e.message || 'Failed to load breakdown');
    }
  };

  // "Spent 17 Aug–16 Sep" reads better than a bare "this cycle" when the point
  // is precisely which days are still open.
  const cycleRange = useMemo(() => {
    const start = card?.currentCycle?.start;
    const end = card?.currentCycle?.end;
    if (!start || !end) return null;
    return `${shortDay(start)}–${shortDay(end)}`;
  }, [card]);

  const totalSpend = useMemo(
    () => transactions.reduce((s, t) => s + (t.isRefund ? -Number(t.amount) : Number(t.amount)), 0),
    [transactions],
  );

  // -- Transactions tab derived state --
  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (categoryFilter) {
      list = categoryFilter === '__none__'
        ? list.filter((t) => !t.categoryId)
        : list.filter((t) => String(t.categoryId) === categoryFilter);
    }
    if (billingFilter === 'unbilled') list = list.filter((t) => !t.statementId);
    if (billingFilter === 'billed') list = list.filter((t) => Boolean(t.statementId));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) =>
        [t.merchant, t.notes, t.category?.name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [transactions, categoryFilter, billingFilter, search]);

  const filteredSpend = useMemo(
    () => filteredTransactions.reduce((s, t) => s + (t.isRefund ? -Number(t.amount) : Number(t.amount)), 0),
    [filteredTransactions],
  );

  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];
    sorted.sort((a, b) => {
      let va, vb;
      switch (sort.key) {
        case 'date':
          va = a.txnDate || ''; vb = b.txnDate || ''; break;
        case 'description':
          va = (a.merchant || '').toLowerCase();
          vb = (b.merchant || '').toLowerCase(); break;
        case 'note':
          va = (a.notes || '').toLowerCase();
          vb = (b.notes || '').toLowerCase(); break;
        case 'category':
          va = (a.category?.name || '').toLowerCase();
          vb = (b.category?.name || '').toLowerCase(); break;
        case 'method':
          va = cardTxnStatus(a); vb = cardTxnStatus(b); break;
        case 'tags':
          va = (tagsByTransaction[a.id] || []).length;
          vb = (tagsByTransaction[b.id] || []).length; break;
        case 'amount':
          // Sort on the signed ledger effect, matching the bank ledger.
          va = a.isRefund ? -Number(a.amount || 0) : Number(a.amount || 0);
          vb = b.isRefund ? -Number(b.amount || 0) : Number(b.amount || 0); break;
        default:
          return 0;
      }
      if (va < vb) return sort.direction === 'asc' ? -1 : 1;
      if (va > vb) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredTransactions, sort, tagsByTransaction]);

  const tableRows = useMemo(
    () => sortedTransactions.map((row) => toCardTableRow(row, tagsByTransaction)),
    [sortedTransactions, tagsByTransaction],
  );

  const manageRow = useMemo(
    () => (manageSheetId ? transactions.find((t) => t.id === manageSheetId) : null),
    [manageSheetId, transactions],
  );

  useEffect(() => {
    if (manageSheetId && !transactions.some((t) => t.id === manageSheetId)) {
      setManageSheetId(null);
    }
  }, [transactions, manageSheetId]);

  const categoryOptions = useMemo(
    () => [
      { label: 'All categories', value: '' },
      ...buildCategoryOptions(categories, { label: 'Uncategorised', value: '__none__' }),
    ],
    [categories],
  );

  const filtersActive = Boolean(search.trim() || categoryFilter || billingFilter);
  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setBillingFilter('');
    setPage(1);
  };

  // ── Header ──
  const title = card ? cardLabel(card) : 'Card';
  const breadcrumbs = [{ label: 'Cards', to: '/cards' }, { label: title }];

  const menuOptions = card
    ? [
        {
          items: [
            ...(isMobile && isCredit
              ? [{ label: 'Paste unbilled', icon: ClipboardPaste, onClick: () => setPasteOpen(true) }]
              : []),
            { label: 'Edit card', icon: Pencil, onClick: () => setEditOpen(true) },
            ...(!card.isPrimary ? [{ label: 'Make primary', icon: Star, onClick: onMakePrimary }] : []),
          ],
        },
        ...(isCredit
          ? [
              {
                items: [
                  { label: 'Record payment', icon: Banknote, onClick: () => setPayOpen(true) },
                  { label: 'Add statement', icon: FileText, onClick: () => setStmtOpen(true) },
                ],
              },
            ]
          : []),
        { items: [{ label: 'Delete card', icon: Trash2, theme: 'red', onClick: onDeleteCard }] },
      ]
    : [];

  const header = (
    <PageHeader
      title={title}
      breadcrumbs={breadcrumbs}
      back="/cards"
      actions={
        card && (
          <>
            {isCredit && (
              <Button iconLeft={ClipboardPaste} label="Paste unbilled" onClick={() => setPasteOpen(true)} />
            )}
            <Button variant="solid" iconLeft={Plus} label="Add transaction" onClick={() => setTxnOpen(true)} />
            <Dropdown options={menuOptions} placement="bottom-end">
              <Button icon={MoreHorizontal} label="More actions" />
            </Dropdown>
          </>
        )
      }
      mobileActions={
        card && (
          <>
            <Button variant="ghost" size="md" icon={Plus} label="Add transaction" onClick={() => setTxnOpen(true)} />
            <Dropdown options={menuOptions} placement="bottom-end">
              <Button variant="ghost" size="md" icon={MoreHorizontal} label="More actions" />
            </Dropdown>
          </>
        )
      }
    />
  );

  // ── Not found / failed to load ──
  if (!card && !loading) {
    return (
      <>
        {header}
        <PageBody>
          <EmptyState
            icon={CreditCard}
            title="Couldn't open this card"
            description={error || 'It may have been deleted.'}
            action={
              <div className="cardd-empty-actions">
                {error && <Button label="Try again" onClick={() => loadAll()} />}
                <Button to="/cards" label="Back to cards" />
              </div>
            }
          />
        </PageBody>
      </>
    );
  }

  // ── First load ──
  if (!card) {
    return (
      <>
        {header}
        <PageBody className="cardd-body">
          <div className="cardd">
            <div className="cardd__main" aria-busy="true">
              <div className="cardd-summary">
                <StatCard label="Outstanding" loading />
                <StatCard label="Spent this cycle" loading />
                <StatCard label="Amount due" loading />
              </div>
              <div className="cardd-skeleton-rows">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} height={16} width={`${90 - i * 8}%`} />
                ))}
              </div>
            </div>
            {!isStacked && (
              <aside className="cardd__aside" aria-hidden="true">
                <div className="cardd__aside-inner cardd-skeleton-rows">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} height={14} width={`${85 - i * 6}%`} />
                  ))}
                </div>
              </aside>
            )}
          </div>
        </PageBody>
      </>
    );
  }

  // ── Summary figures ──
  const due = cardDue(card);
  const badge = dueBadge(due);
  const summary = isCredit ? (
    <div className="cardd-summary">
      <StatCard
        label="Outstanding"
        value={<Amount value={Number(card.outstanding || 0)} tone="inherit" />}
        hint={
          Number(card.unbilledTotal ?? 0) !== 0 ? (
            <span>
              <Amount value={Number(card.unbilledTotal)} tone="inherit" /> not yet billed
            </span>
          ) : card.utilizationPct != null ? (
            `${formatPct(card.utilizationPct)} of limit used`
          ) : undefined
        }
      />
      <StatCard
        label="Spent this cycle"
        value={<Amount value={Number(card.thisCycleSpend ?? 0)} tone="inherit" />}
        hint={cycleRange || 'Set a statement day to track cycles'}
      />
      {due ? (
        <StatCard
          label={`Due ${dayLabel(due.dueDate)}`}
          value={<Amount value={Number(due.amount)} tone={due.status === 'overdue' ? 'due' : 'inherit'} />}
          hint={
            <span className="cardd-summary__due">
              {badge && <Badge size="sm" theme={badge.theme} label={badge.label} />}
              {due.status !== 'due-today' && due.status !== 'due-tomorrow' && (
                <span>{relativeDays(due.daysAway)}</span>
              )}
            </span>
          }
        />
      ) : (
        <StatCard label="Amount due" value={<Amount value={0} tone="inherit" />} hint="No bill due" />
      )}
    </div>
  ) : (
    <div className="cardd-summary">
      <StatCard
        label="Spent this month"
        value={<Amount value={Number(card.thisMonthSpend ?? 0)} tone="inherit" />}
      />
      <StatCard
        label="Total spent"
        value={<Amount value={totalSpend} tone="inherit" />}
        hint={`${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`}
      />
    </div>
  );

  // ── Tabs ──
  const tabs = [
    { label: 'Transactions', value: 'transactions', count: transactions.length },
    ...(isCredit
      ? [
          { label: 'Statements', value: 'statements', count: statements.length },
          { label: 'Payments', value: 'payments', count: payments.length },
        ]
      : []),
    ...(isStacked ? [{ label: 'Details', value: 'details' }] : []),
  ];
  const activeTab = tabs.some((t) => t.value === tab) ? tab : 'transactions';

  const transactionsPanel =
    transactions.length === 0 && !loading ? (
      <EmptyState
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
            <Button iconLeft={Plus} label="Add transaction" onClick={() => setTxnOpen(true)} />
          )
        }
      />
    ) : (
      <>
        <div className="cardd-toolbar">
          <TextInput
            className="cardd-toolbar__search"
            type="search"
            prefix={Search}
            placeholder="Search transactions"
            aria-label="Search transactions"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <Select
            className="cardd-toolbar__filter"
            aria-label="Category"
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          />
          {isCredit && (
            <Select
              className="cardd-toolbar__filter"
              aria-label="Billing status"
              options={BILLING_OPTIONS}
              value={billingFilter}
              onChange={(e) => { setBillingFilter(e.target.value); setPage(1); }}
            />
          )}
          <span className="cardd-toolbar__summary" aria-live="polite">
            {filtersActive ? (
              <>
                {filteredTransactions.length} of {transactions.length} ·{' '}
                <Amount value={filteredSpend} tone="inherit" />
              </>
            ) : (
              <>
                {transactions.length} transaction{transactions.length === 1 ? '' : 's'} ·{' '}
                <Amount value={totalSpend} tone="inherit" /> spent
              </>
            )}
          </span>
          {!isMobile && <ListColumnsMenu columns={CARD_COLUMN_CHOICES} settings={columnSettings} />}
        </div>

        {isMobile ? (
          tableRows.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Search}
              title="No transactions match"
              action={<Button label="Clear filters" onClick={clearFilters} />}
            />
          ) : (
            <TransactionMobileList
              rows={tableRows}
              categories={categories}
              onAssignCategory={assignCategory}
              onOpenDetail={(row) => openManage(row.id)}
            />
          )
        ) : (
          <div className="cardd-ledger">
            <TransactionTable
              rows={tableRows}
              columnSettings={columnSettings}
              columnLabels={CARD_COLUMN_LABELS}
              categories={categories}
              onAssignCategory={assignCategory}
              onOpenManage={openManage}
              onOpenDetail={(row) => openManage(row.id)}
              sort={sort}
              onSortChange={setSort}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              loading={loading}
              emptyMessage="No transactions match."
            />
          </div>
        )}
      </>
    );

  const statementColumns = [
    {
      key: 'cycle',
      label: 'Cycle',
      // Floor sized so Cycle, Status and Total fit a 390px phone.
      width: 'minmax(120px, 2fr)',
      flex: true,
      sortable: true,
      sortFirst: 'desc',
      sortValue: (s) => s.cycleEnd || s.cycleStart || '',
      render: (s) => (
        <span className="cardd-cell">
          <span className="truncate">{rangeLabel(s.cycleStart, s.cycleEnd)}</span>
          <span className="cardd-cell__sub">Due {dayLabel(s.dueDate)}</span>
        </span>
      ),
    },
    {
      key: 'due',
      label: 'Due',
      width: 120,
      hideBelow: 'sm',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (s) => s.dueDate || '',
      render: (s) => dayLabel(s.dueDate, { year: true }),
    },
    {
      key: 'status',
      label: 'Status',
      width: 88,
      sortable: true,
      sortValue: (s) => (STATEMENT_STATUS[s.status] || { label: s.status }).label,
      render: (s) => {
        const st = STATEMENT_STATUS[s.status] || { label: s.status, theme: 'gray' };
        return <Badge theme={st.theme} label={st.label} />;
      },
    },
    {
      key: 'paid',
      label: 'Paid',
      width: 120,
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      sortValue: (s) => Number(s.paidAmount) || 0,
      render: (s) => <Amount value={Number(s.paidAmount)} tone="inherit" />,
    },
    {
      key: 'total',
      label: 'Total',
      width: 112,
      align: 'right',
      sortable: true,
      sortValue: (s) => Number(s.totalAmount) || 0,
      render: (s) => <Amount value={Number(s.totalAmount)} tone="inherit" />,
    },
    {
      key: 'actions',
      label: <span className="sr-only">Actions</span>,
      width: 40,
      align: 'right',
      hideBelow: 'sm',
      render: (s) => (
        <Button
          variant="ghost"
          icon={Trash2}
          label="Delete statement"
          tooltip="Delete statement"
          onClick={() => onDeleteStatement(s)}
        />
      ),
    },
  ];

  const paymentColumns = [
    {
      key: 'paidOn',
      label: 'Date',
      width: 120,
      hideBelow: 'sm',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (p) => p.paidOn || '',
      render: (p) => dayLabel(p.paidOn, { year: true }),
    },
    {
      key: 'via',
      label: 'Paid from',
      width: 'minmax(120px, 2fr)',
      flex: true,
      sortable: true,
      sortValue: (p) => p.viaLabel || 'Manual payment',
      render: (p) => (
        <span className="cardd-cell">
          <span className="truncate">{p.viaLabel || 'Manual payment'}</span>
          <span className="cardd-cell__sub">{dayLabel(p.paidOn)}</span>
        </span>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      width: 'minmax(120px, 2fr)',
      hideBelow: 'md',
      sortable: true,
      sortValue: (p) => p.notes || '',
      render: (p) => <span className="truncate text-ink-gray-5">{p.notes || ''}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      width: 112,
      align: 'right',
      sortable: true,
      sortValue: (p) => Number(p.amount) || 0,
      render: (p) => <Amount value={Number(p.amount)} tone="in" />,
    },
    {
      key: 'actions',
      label: <span className="sr-only">Actions</span>,
      width: 40,
      align: 'right',
      render: (p) => (
        <Button
          variant="ghost"
          icon={Trash2}
          label="Delete payment"
          tooltip="Delete payment"
          onClick={() => onDeletePayment(p)}
        />
      ),
    },
  ];

  const paidTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const statementsPanel = (
    <>
      <div className="cardd-toolbar">
        <span className="cardd-toolbar__summary cardd-toolbar__summary--start">
          {statements.length} statement{statements.length === 1 ? '' : 's'}
        </span>
        <Button iconLeft={Plus} label="Add statement" onClick={() => setStmtOpen(true)} />
      </div>
      <ListView
        aria-label="Statements"
        columns={statementColumns}
        rows={statements}
        defaultSort={{ key: 'cycle', direction: 'desc' }}
        storageKey="fintrack.card.statements"
        pagination
        onRowClick={(s) => openBreakdown(s)}
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
  );

  const paymentsPanel = (
    <>
      <div className="cardd-toolbar">
        <span className="cardd-toolbar__summary cardd-toolbar__summary--start">
          {payments.length} payment{payments.length === 1 ? '' : 's'}
          {payments.length > 0 && (
            <>
              {' · '}
              <Amount value={paidTotal} tone="inherit" /> paid
            </>
          )}
        </span>
        <Button iconLeft={Plus} label="Record payment" onClick={() => setPayOpen(true)} />
      </div>
      <ListView
        aria-label="Payments"
        columns={paymentColumns}
        rows={payments}
        defaultSort={{ key: 'paidOn', direction: 'desc' }}
        storageKey="fintrack.card.payments"
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
  );

  const readyToImport = isCredit && cardSchedule?.status === 'ready' && cardSchedule.next;

  return (
    <>
      {header}
      <PageBody className="cardd-body">
        <div className="cardd">
          <div className="cardd__main">
            {error && (
              <Alert
                theme="red"
                title="Couldn't refresh this card"
                description={error}
                primaryAction={{ label: 'Try again', onClick: () => loadAll() }}
              />
            )}
            {readyToImport && (
              <Alert
                theme="blue"
                title={`${cardSchedule.next.label} statement is ready to import`}
                primaryAction={{ label: 'Import', onClick: () => navigate('/import') }}
              />
            )}

            {summary}

            <div className="cardd-tabs">
              <Tabs idPrefix="cardd" aria-label="Card sections" tabs={tabs} value={activeTab} onChange={setTab} />
              <div
                className="cardd-tabpanel"
                role="tabpanel"
                id={`cardd-panel-${activeTab}`}
                aria-labelledby={`cardd-tab-${activeTab}`}
              >
                {activeTab === 'transactions' && transactionsPanel}
                {activeTab === 'statements' && isCredit && statementsPanel}
                {activeTab === 'payments' && isCredit && paymentsPanel}
                {activeTab === 'details' && (
                  <CardDetailsPanel card={card} schedule={cardSchedule} onEdit={() => setEditOpen(true)} />
                )}
              </div>
            </div>
          </div>

          {!isStacked && (
            <aside className="cardd__aside" aria-label="Card details">
              <div className="cardd__aside-inner">
                <CardDetailsPanel card={card} schedule={cardSchedule} onEdit={() => setEditOpen(true)} />
              </div>
            </aside>
          )}
        </div>
      </PageBody>

      {editOpen && (
        <CardFormModal
          initial={card}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false);
            await loadAll();
          }}
        />
      )}
      {txnOpen && (
        <CardTransactionModal
          cardId={card?.id}
          categories={categories}
          onClose={() => setTxnOpen(false)}
          onSaved={async () => {
            setTxnOpen(false);
            await loadAll();
          }}
        />
      )}
      {pasteOpen && (
        <UnbilledPasteModal
          card={card}
          onClose={() => setPasteOpen(false)}
          onSaved={async () => {
            setPasteOpen(false);
            await loadAll();
            refreshImportSchedule();
          }}
        />
      )}
      {editTxn && (
        <CardTransactionModal
          cardId={card?.id}
          categories={categories}
          initial={editTxn}
          onClose={() => setEditTxn(null)}
          onSaved={async () => {
            setEditTxn(null);
            await loadAll();
          }}
        />
      )}
      {manageRow && (
        <TransactionManageSheet
          {...manageSheetPropsFor(manageRow)}
          metaLine={[
            card ? `${card.nickname || card.issuer || 'Card'} ····${card.last4}` : null,
            cardTxnStatus(manageRow),
          ].filter(Boolean).join(' · ')}
          friends={friends}
          onDeleteTag={(tagId) => deleteTag(manageRow.id, tagId)}
          actions={
            <>
              <Button
                iconLeft={Pencil}
                label="Edit"
                onClick={() => { setManageSheetId(null); setEditTxn(manageRow); }}
              />
              <Button theme="red" iconLeft={Trash2} label="Delete" onClick={() => onDeleteTxn(manageRow.id)} />
            </>
          }
        />
      )}
      {payOpen && (
        <CardPaymentModal
          cardId={card?.id}
          statementId={card?.nextStatementId ?? null}
          suggestedAmount={card?.currentDue || ''}
          description={
            card?.currentDue > 0 && card?.currentDueDate
              ? `Counts towards the bill due ${dayLabel(card.currentDueDate)}.`
              : undefined
          }
          onClose={() => setPayOpen(false)}
          onSaved={async () => {
            setPayOpen(false);
            await loadAll();
          }}
        />
      )}
      {stmtOpen && (
        <CardStatementModal
          cardId={card?.id}
          onClose={() => setStmtOpen(false)}
          onSaved={async () => {
            setStmtOpen(false);
            await loadAll();
          }}
        />
      )}
      {activeBreakdown && (
        <StatementBreakdownDialog
          data={activeBreakdown}
          onClose={() => setActiveBreakdown(null)}
          onDelete={onDeleteStatement}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirmState.open)}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </>
  );
}
