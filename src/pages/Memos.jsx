import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Inbox, MoreHorizontal, NotebookPen, Plus, RefreshCw, RotateCw, Search, SearchX, Smartphone,
} from 'lucide-react';
import ListToolbar, { ListSummary, useStickyHeight } from '../components/common/ListToolbar.jsx';
import { TransactionPeriodFilter } from '../components/transactions/TransactionFilters.jsx';
import {
  formatRangeLabel, getCurrentMonthRange, getMonthOptions, matchMonthValue,
} from '../components/transactions/transactionListModel.js';
import {
  Alert, Amount, Button, ConfirmDialog, Dropdown, EmptyState, KeyboardShortcut, ListColumnsMenu, ListView, PageBody,
  PageHeader, TabButtons, TextInput, toast,
} from '../components/ui';
import { useAccountNames } from '../hooks/useAccounts.js';
import { refreshMemoSummary, useMemoSummary } from '../hooks/useMemoSummary.js';
import {
  deleteMemo, fetchMemosInPeriod, reparseAllMemos, reparseMemo, updateMemo,
} from '../services/memosApi.js';
import { useIsCompact } from '../styles/breakpoints.js';
import ConnectIphoneDialog from './memos/ConnectIphoneDialog.jsx';
import DevicesDialog from './memos/DevicesDialog.jsx';
import MemosPhone from './memos/MemosPhone.jsx';
import {
  MEMO_DEFAULT_SORT, desktopMemoColumns, memoColumnChoices, useMemoColumns,
} from './memos/memoColumns.jsx';
import {
  TABS, filterMemos, memoTotals, parseMemosParams, parseStatusOf, patchMemosParams, plural,
} from './memos/memoModel.js';
import './Memos.css';

/**
 * Memos (/memos): bank, UPI and card SMS the iPhone shortcut captured, each
 * with the short memo typed when it arrived — laid out like Transactions.
 * The toolbar holds the search, the All / No memo / Debit / Credit segments
 * and the period; the summary, Columns and Refresh sit on its right. The
 * memo is written in place on each row; a row opens the memo's page
 * (`/memos/:id`) with the message as it arrived and what was read from it.
 *
 * One request loads every memo in the period; the list searches, filters,
 * sorts and pages them itself. Filters and the period live in the URL.
 */
export default function Memos() {
  const navigate = useNavigate();
  const isMobile = useIsCompact();
  const [searchParams, setSearchParams] = useSearchParams();
  const [toolbarRef, toolbarHeight] = useStickyHeight();
  const { data: summary } = useMemoSummary();
  // Bank accounts show by their holder's name ("Kevin Patel") once named.
  const accountNames = useAccountNames();
  const columnSettings = useMemoColumns();

  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const monthOptions = useMemo(() => getMonthOptions(24), []);
  const { tab, q, start, end } = useMemo(
    () => parseMemosParams(searchParams, monthRange),
    [searchParams, monthRange],
  );
  const selectedMonth = useMemo(() => matchMonthValue(start, end, monthOptions), [start, end, monthOptions]);

  const patchParams = useCallback((patch) => {
    setSearchParams((prev) => patchMemosParams(prev, patch), { replace: true });
  }, [setSearchParams]);
  const setTab = useCallback((next) => patchParams({ tab: next }), [patchParams]);
  const applyDateRange = useCallback((s, e) => patchParams({ start: s, end: e }), [patchParams]);

  // The box keeps what was typed; the URL keeps it trimmed.
  const [searchDraft, setSearchDraft] = useState(q);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  useEffect(() => {
    setSearchDraft((draft) => (draft.trim() === q ? draft : q));
  }, [q]);
  const onSearchChange = useCallback((value) => {
    setSearchDraft(value);
    patchParams({ q: value });
  }, [patchParams]);

  // ⌘K / Ctrl+K focuses the search box.
  useEffect(() => {
    if (isMobile) return undefined;
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile]);

  // ---- Every memo in the period ----
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const requestRef = useRef(0);

  const load = useCallback(async ({ keep = false } = {}) => {
    const request = (requestRef.current += 1);
    setLoading(true);
    setLoadError('');
    if (!keep) setRows([]);
    try {
      const res = await fetchMemosInPeriod({ start, end });
      if (request !== requestRef.current) return;
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (request !== requestRef.current) return;
      setLoadError(e.message || 'Could not load memos');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const refresh = useCallback(() => {
    load({ keep: true });
    refreshMemoSummary();
  }, [load]);

  // ---- Paging (desktop): a new filter starts from the first page ----
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    setPage(1);
  }, [tab, q, start, end]);

  // ---- One memo changed or went away ----
  const patchRow = useCallback((updated) => {
    if (!updated?.id) return;
    setRows((current) => current.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }, []);

  /** Saves an inline edit (null clears it); on failure toasts and rejects, so the cell keeps the text. */
  const saveMemo = useCallback(async (memo, text) => {
    try {
      const updated = await updateMemo(memo.id, text);
      patchRow(updated);
      toast.success(text ? 'Memo saved' : 'Memo cleared');
      refreshMemoSummary();
      return updated;
    } catch (e) {
      toast.error({ title: 'Could not save the memo', description: e.message });
      throw e;
    }
  }, [patchRow]);

  const reparse = useCallback(async (memo) => {
    try {
      const updated = await reparseMemo(memo.id);
      patchRow(updated);
      toast.success({ title: 'Memo re-parsed', description: parseStatusOf(updated?.parseStatus).label });
    } catch (e) {
      toast.error({ title: 'Could not re-parse the memo', description: e.message });
    }
  }, [patchRow]);

  const [deleting, setDeleting] = useState(null);
  const confirmDelete = useCallback(async () => {
    const memo = deleting;
    try {
      await deleteMemo(memo.id);
      setRows((current) => current.filter((r) => r.id !== memo.id));
      toast.success('Memo deleted');
      refreshMemoSummary();
    } catch (e) {
      toast.error({ title: 'Could not delete the memo', description: e.message });
    }
    setDeleting(null);
  }, [deleting]);

  const reparseAll = useCallback(async () => {
    const id = toast('Re-parsing memos…', { duration: Infinity });
    try {
      const res = await reparseAllMemos();
      const n = Number(res?.updated) || 0;
      toast.success(n ? `Re-parsed ${plural(n, 'memo')}` : 'No memos needed re-parsing', { id, duration: 4000 });
      load({ keep: true });
    } catch (e) {
      toast.error({ id, title: 'Could not re-parse memos', description: e.message, duration: 6000 });
    }
  }, [load]);

  const listSearch = searchParams.toString();
  const rowLinkState = useCallback((memo) => ({ memo, memosSearch: listSearch }), [listSearch]);
  const openMemo = useCallback((memo) => {
    navigate(`/memos/${encodeURIComponent(memo.id)}`, { state: rowLinkState(memo) });
  }, [navigate, rowLinkState]);

  // ---- Header dialogs ----
  const [connectOpen, setConnectOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const openConnect = useCallback(() => setConnectOpen(true), []);
  const openDevices = useCallback(() => setDevicesOpen(true), []);

  // ---- Derived ----
  const filtered = useMemo(() => filterMemos(rows, { tab, q, accountNames }), [rows, tab, q, accountNames]);
  const hasFilters = tab !== 'all' || Boolean(q);
  // Totals describe what the list shows: the whole period, or the filtered rows.
  const totals = useMemo(() => memoTotals(hasFilters ? filtered : rows), [hasFilters, filtered, rows]);
  const periodWithoutMemo = useMemo(() => memoTotals(rows).withoutMemo, [rows]);

  const clearListFilters = useCallback(() => {
    setSearchDraft('');
    patchParams({ tab: 'all', q: '' });
  }, [patchParams]);
  const resetSheetFilters = useCallback(() => {
    patchParams({ tab: 'all', start: '', end: '' });
  }, [patchParams]);
  const activeFilterCount = (tab !== 'all' ? 1 : 0)
    + (start !== monthRange.startIso || end !== monthRange.endIso ? 1 : 0);

  // ---- Copy ----
  const periodLabel = selectedMonth
    ? monthOptions.find((m) => m.value === selectedMonth)?.label
    : formatRangeLabel(start, end);
  const countLabel = hasFilters
    ? `${filtered.length} of ${plural(rows.length, 'memo')}`
    : plural(rows.length, 'memo');
  const summaryContent = loading && rows.length === 0 ? null : (
    <>
      {countLabel}
      {totals.withoutMemo > 0 && tab !== 'no-memo' && ` · ${totals.withoutMemo} without a memo`}
      {' · '}
      <Amount value={totals.out} sign="never" tone="inherit" /> out
      {totals.in > 0 && (
        <>
          {' · '}
          <Amount value={totals.in} sign="never" tone="inherit" /> in
        </>
      )}
    </>
  );

  const tabOptions = TABS.map((t) => ({
    value: t.id,
    label: t.id === 'no-memo' && periodWithoutMemo > 0 ? (
      <>
        {t.label}
        <span className="memos-count">{periodWithoutMemo}</span>
      </>
    ) : t.label,
  }));

  const buttonSize = isMobile ? 'md' : undefined;
  let emptyState;
  if (loadError) {
    emptyState = (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load memos"
        description={loadError}
        action={<Button size={buttonSize} label="Try again" iconLeft={RefreshCw} onClick={refresh} />}
      />
    );
  } else if (hasFilters) {
    emptyState = (
      <EmptyState
        icon={SearchX}
        title="No memos match these filters"
        description={periodLabel
          ? `Nothing in ${periodLabel} matches the search and filters.`
          : 'Nothing in these dates matches the search and filters.'}
        action={<Button size={buttonSize} label="Clear filters" onClick={clearListFilters} />}
      />
    );
  } else if (summary?.total === 0) {
    emptyState = (
      <EmptyState
        icon={NotebookPen}
        title="No memos yet"
        description="Connect your iPhone to start capturing bank SMS."
        action={<Button size={buttonSize} iconLeft={Plus} label="Connect iPhone" onClick={openConnect} />}
      />
    );
  } else {
    emptyState = (
      <EmptyState
        icon={Inbox}
        title={periodLabel ? `No memos in ${periodLabel}` : 'No memos in these dates'}
        description="Bank SMS your iPhone sends in this period show up here."
      />
    );
  }

  const refreshError = loadError && rows.length > 0 ? (
    <Alert
      theme="red"
      title="Couldn't refresh memos"
      description={loadError}
      primaryAction={{ label: 'Try again', onClick: refresh }}
    />
  ) : null;

  const overlays = (
    <>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this memo?"
        message="The bank SMS, what was read from it and its memo are removed from Fintrack. This can't be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      <ConnectIphoneDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
      <DevicesDialog
        open={devicesOpen}
        onClose={() => setDevicesOpen(false)}
        onConnect={() => {
          setDevicesOpen(false);
          setConnectOpen(true);
        }}
      />
    </>
  );

  // ===== PHONE =====
  if (isMobile) {
    return (
      <>
        <MemosPhone
          searchDraft={searchDraft}
          onSearchChange={onSearchChange}
          tab={tab}
          tabOptions={tabOptions}
          onTabChange={setTab}
          start={start}
          end={end}
          onRangeChange={applyDateRange}
          monthOptions={monthOptions}
          selectedMonth={selectedMonth}
          activeFilterCount={activeFilterCount}
          onResetFilters={resetSheetFilters}
          rows={filtered}
          accountNames={accountNames}
          summaryContent={summaryContent}
          hasMemos={rows.length > 0}
          loading={loading}
          refreshError={refreshError}
          emptyState={emptyState}
          onOpen={openMemo}
          onConnect={openConnect}
          onDevices={openDevices}
          onReparseAll={reparseAll}
          onRefresh={refresh}
        />
        {overlays}
      </>
    );
  }

  // ===== DESKTOP =====
  const columns = desktopMemoColumns({
    accountNames,
    onSaveMemo: saveMemo,
    onOpen: openMemo,
    onReparse: reparse,
    onDelete: setDeleting,
  });

  return (
    <>
      <PageHeader
        title="Memos"
        actions={(
          <>
            <Button iconLeft={Smartphone} label="Devices" onClick={openDevices} />
            <Button variant="solid" iconLeft={Plus} label="Connect iPhone" onClick={openConnect} />
            <Dropdown
              placement="bottom-end"
              label="More memo actions"
              options={[{ label: 'Re-parse all', icon: RotateCw, onClick: reparseAll }]}
            >
              <Button icon={MoreHorizontal} label="More actions" />
            </Dropdown>
          </>
        )}
      />
      <PageBody className="memos-page" style={{ '--list-toolbar-height': `${toolbarHeight}px` }}>
        <ListToolbar
          ref={toolbarRef}
          meta={(
            <>
              {summaryContent && <ListSummary>{summaryContent}</ListSummary>}
              <ListColumnsMenu columns={memoColumnChoices()} settings={columnSettings} />
              <Button
                variant="ghost"
                icon={RefreshCw}
                label="Refresh"
                tooltip="Refresh"
                loading={loading}
                onClick={refresh}
              />
            </>
          )}
        >
          <TextInput
            ref={searchInputRef}
            className="memos-search"
            type="search"
            prefix={Search}
            suffix={!searchFocused && !searchDraft ? <KeyboardShortcut combo="Mod+K" /> : null}
            placeholder="Search memos"
            aria-label="Search memos"
            value={searchDraft}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <TabButtons aria-label="Show" options={tabOptions} value={tab} onChange={setTab} />
          <TransactionPeriodFilter
            rangeStart={start}
            rangeEnd={end}
            onChange={applyDateRange}
            monthOptions={monthOptions}
          />
        </ListToolbar>

        {refreshError}

        <ListView
          className="memos-table"
          aria-label="Memos"
          columns={columns}
          rows={filtered}
          onRowClick={openMemo}
          rowClassName={() => 'memos-row'}
          defaultSort={MEMO_DEFAULT_SORT}
          columnSettings={columnSettings}
          pagination={{ page, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize }}
          loading={loading}
          skeletonRows={8}
          stickyHeader
          emptyState={emptyState}
        />
      </PageBody>
      {overlays}
    </>
  );
}
