import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Plus, Tag } from 'lucide-react';
import {
  Alert, Amount, Button, ConfirmDialog, PageBody, PageHeader, Spinner, Switch, TabButtons, toast,
} from '../components/ui';
import TransactionManageSheet from '../components/TransactionManageSheet.jsx';
import { useCardTransactionManager } from '../hooks/useCardTransactionManager.js';
import { getCcLink, listCards } from '../services/cardsApi.js';
import { API_BASE, apiErrorMessage, apiFetch } from '../services/http.js';
import { useIsCompact } from '../styles/breakpoints.js';
import { cardTxnStatus } from '../utils/cardTransactionRow.jsx';
import {
  parseCalendarParams,
  parseCalendarView,
  patchCalendarParams,
} from '../utils/calendarParams.js';
import { BillsCard } from './calendar/Bills.jsx';
import CategorySpend from './calendar/CategorySpend.jsx';
import DayTransactions from './calendar/DayTransactions.jsx';
import MonthGrid, { CalendarLegend } from './calendar/MonthGrid.jsx';
import NewTransactionDialog from './calendar/NewTransactionDialog.jsx';
import SubscriptionDialog from './calendar/SubscriptionDialog.jsx';
import SubscriptionsView from './calendar/SubscriptionsView.jsx';
import {
  addDaysIso, buildCells, defaultDayForMonth, formatMonthName, formatMonthTitle,
  groupOccurrencesByDay, groupTransactionsByDay, isInMonth, monthBounds, monthPending, nextPendingDay,
  nextDateBySubscription, sumAmounts, sumEarned, sumSpent, toLocalIso, upcomingOccurrences,
} from './calendar/calendarModel.js';
import './Calendar.css';

const VIEW_OPTIONS = [
  { label: 'Transactions', value: 'transactions' },
  { label: 'Subscriptions', value: 'subscriptions' },
];

function errorMessage(data, fallback) {
  if (Array.isArray(data?.message)) {
    return data.message.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join('; ');
  }
  return typeof data?.message === 'string' ? data.message : fallback;
}

/**
 * Calendar (`/calendar`): the month's transactions on a grid with the
 * selected day beside it, and (`?view=subscriptions`) the recurring bills.
 * `month`, `day` and `view` live in the URL so the transaction page can
 * send you back to the same place.
 */
export default function Calendar() {
  const navigate = useNavigate();
  const isMobile = useIsCompact();
  const [searchParams, setSearchParams] = useSearchParams();

  const todayIso = toLocalIso(new Date());
  const calendarDefaults = useMemo(() => {
    const t = new Date(`${todayIso}T12:00:00`);
    return { viewYear: t.getFullYear(), viewMonth: t.getMonth(), selectedIso: todayIso };
  }, [todayIso]);
  const { viewYear, viewMonth, selectedIso } = useMemo(
    () => parseCalendarParams(searchParams, calendarDefaults),
    [searchParams, calendarDefaults],
  );
  const view = parseCalendarView(searchParams);
  // The day panel only ever describes a day the grid is showing.
  const activeIso = isInMonth(selectedIso, viewYear, viewMonth)
    ? selectedIso
    : defaultDayForMonth(viewYear, viewMonth, todayIso);

  const patchCalendar = useCallback((patch) => {
    setSearchParams((prev) => patchCalendarParams(prev, patch), { replace: true });
  }, [setSearchParams]);

  // ── Data ───────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  // True until the first load lands, so nothing reads as "no spending" first.
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState('');

  const [occurrences, setOccurrences] = useState([]);
  const [occLoading, setOccLoading] = useState(false);
  const [subs, setSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsError, setSubsError] = useState('');
  // A year of occurrences from today, for each subscription's next date.
  const [aheadOccurrences, setAheadOccurrences] = useState([]);
  const [categories, setCategories] = useState([]);
  // Card bill chips on the grid name the card's owner, which the payment
  // marker on a transaction does not carry — only the card id.
  const [cardsById, setCardsById] = useState({});
  const [friends, setFriends] = useState([]);
  // The cc-link payloads live here rather than in each row so that editing a
  // covered card transaction can write straight back into the rendered copy.
  const [ccDetailByTransaction, setCcDetailByTransaction] = useState({});

  // ── Dialogs ────────────────────────────────────────────────────────────
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState(todayIso);
  const [subDialog, setSubDialog] = useState({ open: false, sub: null });
  const [deleting, setDeleting] = useState(null);

  const { startIso, endIso } = useMemo(() => monthBounds(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthTitle = formatMonthTitle(viewYear, viewMonth);
  const monthName = formatMonthName(viewYear, viewMonth);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError('');
    try {
      const res = await apiFetch(`${API_BASE}/imports/transactions/range?start=${startIso}&end=${endIso}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load transactions');
      setTransactions(data.data || []);
    } catch (e) {
      setTxError(e.message || 'Failed to load transactions');
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [startIso, endIso]);

  const loadOccurrences = useCallback(async () => {
    setOccLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/subscriptions/calendar?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`);
      const data = await res.json();
      if (res.ok) setOccurrences(data.data || []);
    } catch {
      // Bills are secondary on this page; the grid still works without them.
    } finally {
      setOccLoading(false);
    }
  }, [startIso, endIso]);

  const loadSubs = useCallback(async () => {
    setSubsError('');
    try {
      const res = await apiFetch(`${API_BASE}/subscriptions`);
      const data = await res.json();
      if (res.ok) setSubs(data.data || []);
      else setSubsError(errorMessage(data, 'Failed to list subscriptions'));
    } catch (e) {
      setSubsError(e.message || 'Failed to list subscriptions');
    } finally {
      setSubsLoading(false);
    }
  }, []);

  const loadAhead = useCallback(async () => {
    const end = addDaysIso(todayIso, 366);
    try {
      const res = await apiFetch(`${API_BASE}/subscriptions/calendar?start=${encodeURIComponent(todayIso)}&end=${encodeURIComponent(end)}`);
      const data = await res.json();
      if (res.ok) setAheadOccurrences(data.data || []);
    } catch {
      // Without it the list shows "—" for the next date.
    }
  }, [todayIso]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadOccurrences(); }, [loadOccurrences]);
  useEffect(() => { loadSubs(); }, [loadSubs]);
  useEffect(() => { if (view === 'subscriptions') loadAhead(); }, [view, loadAhead]);
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/categories`);
        if (res.ok) { const d = await res.json(); setCategories(d.data || []); }
      } catch {}
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const res = await listCards();
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setCardsById(Object.fromEntries(list.map((c) => [String(c.id), c])));
      } catch {}
    })();
  }, []);
  useEffect(() => {
    apiFetch(`${API_BASE}/friends`)
      .then((r) => r.json())
      .then((d) => setFriends(d.data || []))
      .catch(() => {});
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────
  const txByDay = useMemo(() => groupTransactionsByDay(transactions), [transactions]);
  const subByDay = useMemo(() => groupOccurrencesByDay(occurrences), [occurrences]);
  const cells = useMemo(() => buildCells(viewYear, viewMonth), [viewYear, viewMonth]);
  // The month's categorising to-do, for the bar above the grid.
  const pending = useMemo(
    () => monthPending(cells.filter((c) => c.inMonth).map((c) => c.iso), txByDay, ccDetailByTransaction),
    [cells, txByDay, ccDetailByTransaction],
  );
  const [focusPending, setFocusPending] = useState(false);
  // Nothing left to find: leave focus mode on its own.
  useEffect(() => {
    if (pending.pending === 0) setFocusPending(false);
  }, [pending.pending]);
  const monthSpent = useMemo(() => sumSpent(transactions), [transactions]);
  const monthEarned = useMemo(() => sumEarned(transactions), [transactions]);
  const monthBillsTotal = useMemo(() => sumAmounts(occurrences), [occurrences]);
  const selectedTxs = txByDay.get(activeIso) || [];
  const selectedBills = subByDay.get(activeIso) || [];
  const subsById = useMemo(() => new Map(subs.map((s) => [String(s.id), s])), [subs]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [String(c.id), c])), [categories]);
  const upcoming = useMemo(() => upcomingOccurrences(occurrences, todayIso), [occurrences, todayIso]);
  const monthBills = useMemo(
    () => [...occurrences].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)),
    [occurrences],
  );
  const nextById = useMemo(() => nextDateBySubscription(aheadOccurrences, todayIso), [aheadOccurrences, todayIso]);

  // The side panel scrolls on its own; a new day starts at its top.
  const asideRef = useRef(null);
  const dayRef = useRef(null);
  useEffect(() => {
    if (asideRef.current) asideRef.current.scrollTop = 0;
  }, [activeIso]);

  // ── Navigation ─────────────────────────────────────────────────────────
  function goToMonth(year, month) {
    patchCalendar({ viewYear: year, viewMonth: month, selectedIso: defaultDayForMonth(year, month, todayIso) });
  }
  function goPrev() {
    if (viewMonth === 0) goToMonth(viewYear - 1, 11);
    else goToMonth(viewYear, viewMonth - 1);
  }
  function goNext() {
    if (viewMonth === 11) goToMonth(viewYear + 1, 0);
    else goToMonth(viewYear, viewMonth + 1);
  }
  function goToday() {
    const t = new Date();
    patchCalendar({ viewYear: t.getFullYear(), viewMonth: t.getMonth(), selectedIso: todayIso });
  }
  const selectDay = useCallback((iso) => patchCalendar({ selectedIso: iso }), [patchCalendar]);
  const setView = useCallback((v) => patchCalendar({ view: v }), [patchCalendar]);

  const openTransactionDetail = useCallback((tx) => {
    const qs = searchParams.toString();
    navigate(`/transactions/${tx.id}`, {
      state: { tx, ...(qs ? { calendarSearch: qs } : {}) },
    });
  }, [navigate, searchParams]);

  // ── Manual transaction ─────────────────────────────────────────────────
  function openManual() {
    setManualDate(activeIso || todayIso);
    setManualOpen(true);
  }

  const addManualTransaction = useCallback(async (body) => {
    const res = await apiFetch(`${API_BASE}/transactions/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to add manual transaction.'));
    setManualOpen(false);
    toast.success('Transaction added');
    await loadTransactions();
  }, [loadTransactions]);

  // ── Subscriptions ──────────────────────────────────────────────────────
  const openNewSubscription = useCallback(() => setSubDialog({ open: true, sub: null }), []);
  const openSubscription = useCallback((sub) => setSubDialog({ open: true, sub }), []);
  const closeSubscription = useCallback(() => setSubDialog((d) => ({ ...d, open: false })), []);

  const reloadSubscriptions = useCallback(async () => {
    await loadOccurrences();
    await loadSubs();
    if (view === 'subscriptions') await loadAhead();
  }, [loadOccurrences, loadSubs, loadAhead, view]);

  const saveSubscription = useCallback(async (body, editingId) => {
    const url = editingId ? `${API_BASE}/subscriptions/${editingId}` : `${API_BASE}/subscriptions`;
    const res = await apiFetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(errorMessage(data, 'Request failed'));
    closeSubscription();
    toast.success(editingId ? 'Subscription saved' : 'Subscription added');
    await reloadSubscriptions();
  }, [closeSubscription, reloadSubscriptions]);

  async function confirmDelete() {
    const target = deleting;
    if (!target) return;
    const res = await apiFetch(`${API_BASE}/subscriptions/${target.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    setDeleting(null);
    setSubDialog((d) => (d.sub && String(d.sub.id) === String(target.id) ? { ...d, open: false } : d));
    toast.success('Subscription deleted');
    await reloadSubscriptions();
  }

  // ── Categories ─────────────────────────────────────────────────────────
  const assignCategory = useCallback(
    async (transactionId, categoryId) => {
      try {
        const res = categoryId
          ? await apiFetch(`${API_BASE}/transactions/${transactionId}/category`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: Number(categoryId) }),
          })
          : await apiFetch(`${API_BASE}/transactions/${transactionId}/category`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to save category');
        const cat = categories.find((c) => String(c.id) === String(categoryId)) || null;
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, categoryId: cat ? cat.id : null, category: cat } : t)),
        );
      } catch {
        toast.error('Couldn’t save the category');
      }
    },
    [categories],
  );

  // Card transactions nested under a bill payment are managed the same way as
  // anywhere else. They live in each row's local cc-link state, so the tag map
  // is seeded as those rows load and merged across expanded rows.
  const cardManager = useCardTransactionManager({
    categories,
    onRowPatched: (txnId, patch) =>
      setCcDetailByTransaction((prev) => {
        const next = { ...prev };
        for (const [bankId, detail] of Object.entries(next)) {
          if (!detail?.coveredTransactions) continue;
          if (!detail.coveredTransactions.some((t) => String(t.id) === String(txnId))) continue;
          next[bankId] = {
            ...detail,
            coveredTransactions: detail.coveredTransactions.map((t) =>
              String(t.id) === String(txnId) ? { ...t, ...patch } : t,
            ),
          };
        }
        return next;
      }),
  });
  const { seedTags: seedCardTags, openManage: openCardManage } = cardManager;

  const loadCcDetail = useCallback(async (bankTxId) => {
    setCcDetailByTransaction((p) => ({ ...p, [bankTxId]: { loading: true } }));
    try {
      const data = await getCcLink(bankTxId);
      setCcDetailByTransaction((p) => ({ ...p, [bankTxId]: data }));
      // Merge, not replace: other bill payments may already be expanded.
      seedCardTags(data.coveredTransactions);
    } catch (error) {
      setCcDetailByTransaction((p) => ({
        ...p,
        [bankTxId]: { error: error.message || 'Failed to load card transactions' },
      }));
    }
  }, [seedCardTags]);

  // Read the sheet's row back out of the cache so it reflects edits.
  const cardManageRow = useMemo(() => {
    if (!cardManager.manageSheetId) return null;
    for (const detail of Object.values(ccDetailByTransaction)) {
      const hit = (detail?.coveredTransactions || []).find(
        (t) => String(t.id) === String(cardManager.manageSheetId),
      );
      if (hit) return hit;
    }
    return null;
  }, [cardManager.manageSheetId, ccDetailByTransaction]);

  // ── Render ─────────────────────────────────────────────────────────────
  const isSubs = view === 'subscriptions';
  const newLabel = isSubs ? 'New subscription' : 'New transaction';
  const onNew = isSubs ? openNewSubscription : openManual;

  const monthNav = (
    <div className="cal-nav" role="group" aria-label="Month">
      <Button variant="ghost" icon={ChevronLeft} label="Previous month" onClick={goPrev} />
      <Button label="Today" onClick={goToday} />
      <Button variant="ghost" icon={ChevronRight} label="Next month" onClick={goNext} />
    </div>
  );

  const header = (
    <PageHeader
      title={monthTitle}
      actions={
        <>
          {monthNav}
          <TabButtons options={VIEW_OPTIONS} value={view} onChange={setView} aria-label="Calendar view" />
          <Button variant="solid" iconLeft={Plus} label={newLabel} onClick={onNew} />
        </>
      }
      mobileActions={<Button variant="ghost" size="md" icon={Plus} label={newLabel} onClick={onNew} />}
    />
  );

  const upcomingCard = (
    <BillsCard
      title="Upcoming bills"
      items={upcoming}
      todayIso={todayIso}
      subsById={subsById}
      categoriesById={categoriesById}
      onOpenSubscription={openSubscription}
      loading={occLoading && upcoming.length === 0}
      actions={<Button variant="ghost" icon={Plus} label="New subscription" tooltip="New subscription" onClick={openNewSubscription} />}
      emptyTitle={`No more bills in ${monthName}`}
      emptyDescription="Subscriptions you add show here before they are due."
    />
  );

  // Jump to the next day with something to categorise; its day panel lists
  // those transactions with a category picker on each.
  const goToNextPending = () => {
    const next = nextPendingDay(pending.days, activeIso);
    if (!next) return;
    selectDay(next);
    // Bring that day's table into view, where the pickers are.
    requestAnimationFrame(() => dayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const categorised = pending.total - pending.pending;
  const pendingBar = txLoading && pending.total === 0 ? null : pending.pending > 0 ? (
    <div className="cal-pending-bar" role="status">
      <span className="cal-pending-bar__icon" aria-hidden="true">
        <Tag size={16} strokeWidth={1.5} />
      </span>
      <div className="cal-pending-bar__body">
        <p className="cal-pending-bar__title">
          <strong>
            {pending.pending} transaction{pending.pending === 1 ? '' : 's'}
          </strong>{' '}
          on {pending.days.length} day{pending.days.length === 1 ? '' : 's'} need{pending.pending === 1 ? 's' : ''} a category
        </p>
        <div className="cal-pending-bar__track" aria-hidden="true">
          <div
            className="cal-pending-bar__fill"
            style={{ width: `${pending.total ? Math.round((Math.max(categorised, 0) / pending.total) * 100) : 0}%` }}
          />
        </div>
        <span className="cal-pending-bar__meta">
          {Math.max(categorised, 0)} of {pending.total} categorised in {monthName}
        </span>
      </div>
      <div className="cal-pending-bar__actions">
        <Switch size="sm" label="Focus" checked={focusPending} onChange={setFocusPending} />
        <Button label="Next day to fix" iconRight={ArrowRight} onClick={goToNextPending} />
      </div>
    </div>
  ) : pending.total > 0 ? (
    <div className="cal-pending-bar is-done" role="status">
      <span className="cal-pending-bar__icon" aria-hidden="true">
        <CheckCircle2 size={16} strokeWidth={1.5} />
      </span>
      <p className="cal-pending-bar__title">Every transaction in {monthName} has a category</p>
    </div>
  ) : null;

  const transactionsView = (
    <div className="cal-layout">
      <div className="cal-main">
        <div className="cal-summary-row">
          <p className="cal-summary">
            <Amount value={monthSpent} sign="never" tone="inherit" className="cal-summary__figure" /> spent
            <span aria-hidden="true"> · </span>
            <Amount value={monthEarned} sign={monthEarned > 0 ? 'always' : 'never'} tone={monthEarned > 0 ? 'in' : 'inherit'} className="cal-summary__figure" /> earned
            <span aria-hidden="true"> · </span>
            <Amount value={monthBillsTotal} sign="never" tone="inherit" className="cal-summary__figure" /> in bills
          </p>
          {txLoading && <Spinner size="sm" aria-label="Loading transactions" />}
        </div>
        {txError && (
          <Alert
            theme="red"
            title="Couldn’t load transactions"
            description={txError}
            primaryAction={{ label: 'Try again', onClick: loadTransactions }}
          />
        )}
        {pendingBar}
        {/* The grid stays mounted while a month loads: swapping it for a
            loading line collapsed the page and threw the scroll position
            back to the top on every month change. */}
        <MonthGrid
          cells={cells}
          txByDay={txByDay}
          subByDay={subByDay}
          cardsById={cardsById}
          ccDetailByTransaction={ccDetailByTransaction}
          todayIso={todayIso}
          selectedIso={activeIso}
          onSelect={selectDay}
          compact={isMobile}
          loading={txLoading}
          focusPending={focusPending}
          label={monthTitle}
        />
        <CalendarLegend compact={isMobile} />
        <DayTransactions
          ref={dayRef}
          iso={activeIso}
          txs={selectedTxs}
          bills={selectedBills}
          loading={txLoading}
          isMobile={isMobile}
          categories={categories}
          categoriesById={categoriesById}
          onAssignCategory={assignCategory}
          onOpenDetail={openTransactionDetail}
          ccDetailByTransaction={ccDetailByTransaction}
          onLoadCcDetail={loadCcDetail}
          cardTags={cardManager.tagsByTransaction}
          onAssignCardCategory={cardManager.assignCategory}
          onOpenCardManage={openCardManage}
          subsById={subsById}
          onOpenSubscription={openSubscription}
          onAddTransaction={openManual}
        />
      </div>
      <aside className="cal-aside" ref={asideRef} aria-label="Month details">
        <CategorySpend
          transactions={transactions}
          monthName={monthName}
          max={isMobile ? 5 : 6}
          loading={txLoading && transactions.length === 0}
        />
        {upcomingCard}
      </aside>
    </div>
  );

  return (
    <>
      {header}
      <PageBody className="cal-page">
        {isMobile && (
          <div className="cal-toolbar">
            <TabButtons options={VIEW_OPTIONS} value={view} onChange={setView} fluid aria-label="Calendar view" className="cal-toolbar__tabs" />
            {monthNav}
          </div>
        )}
        {isSubs ? (
          <SubscriptionsView
            compact={isMobile}
            subs={subs}
            loading={subsLoading}
            error={subsError}
            onRetry={loadSubs}
            nextById={nextById}
            categoriesById={categoriesById}
            subsById={subsById}
            monthBills={monthBills}
            monthName={monthName}
            monthTotal={monthBillsTotal}
            todayIso={todayIso}
            onNew={openNewSubscription}
            onEdit={openSubscription}
            onDelete={setDeleting}
          />
        ) : (
          transactionsView
        )}
      </PageBody>

      <NewTransactionDialog
        open={manualOpen}
        defaultDate={manualDate}
        compact={isMobile}
        onClose={() => setManualOpen(false)}
        onSubmit={addManualTransaction}
      />
      <SubscriptionDialog
        open={subDialog.open}
        subscription={subDialog.sub}
        categories={categories}
        compact={isMobile}
        onClose={closeSubscription}
        onSubmit={saveSubscription}
        onDelete={setDeleting}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete subscription?"
        message="This removes the recurring bill from the calendar. Past bank transactions are unchanged."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      {cardManageRow && (
        <TransactionManageSheet
          {...cardManager.manageSheetPropsFor(cardManageRow)}
          metaLine={cardTxnStatus(cardManageRow)}
          friends={friends}
        />
      )}
    </>
  );
}
