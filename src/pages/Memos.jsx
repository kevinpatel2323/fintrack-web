import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ellipsis, NotebookPen, Plus, RotateCw, Search, Smartphone } from 'lucide-react';
import {
  Amount, Badge, Button, Dropdown, EmptyState, ListView, PageBody, PageHeader, TabButtons, TextInput, toast,
} from '../components/ui';
import ListToolbar, { ListSummary, useStickyHeight } from '../components/common/ListToolbar.jsx';
import { refreshMemoSummary, useMemoSummary } from '../hooks/useMemoSummary.js';
import { fetchMemos, reparseAllMemos, updateMemo } from '../services/memosApi.js';
import { useIsCompact } from '../styles/breakpoints.js';
import ConnectIphoneDialog from './memos/ConnectIphoneDialog.jsx';
import DevicesDialog from './memos/DevicesDialog.jsx';
import MemoCell from './memos/MemoCell.jsx';
import MemoSheet from './memos/MemoSheet.jsx';
import MemosPager from './memos/MemosPager.jsx';
import MemosPhone from './memos/MemosPhone.jsx';
import {
  TABS, fmtMemoTime, fmtRelative, memoAccount, memoAmount, memoPayee, memoTime, parseMemosParams,
  patchMemosParams, plural,
} from './memos/memoModel.js';
import './Memos.css';

const DEFAULT_PAGE_SIZE = 50;

/** Copy for a filtered list with nothing in it. */
function emptyCopyFor(tab, q) {
  if (q) return { title: 'No matches', description: `Nothing found for “${q}”.` };
  if (tab === 'no-memo') return { title: 'Every message has a memo', description: 'New bank SMS without one will show up here.' };
  if (tab === 'debit') return { title: 'No money out', description: 'Debit messages will show up here.' };
  if (tab === 'credit') return { title: 'No money in', description: 'Credit messages will show up here.' };
  return { title: 'No memos', description: 'Captured bank SMS will show up here.' };
}

/**
 * Memos (/memos): bank, UPI and card SMS the iPhone shortcut captured, each
 * with the short note typed when it arrived. The memo is written in place on
 * each row; a row opens a sheet with the message as it arrived, what was read
 * from it, Re-parse and Delete. The header pairs and manages the iPhones.
 *
 * The API pages and filters (`tab`, `q`), so the list holds one page at a
 * time on desktop; phones append pages with "Show more". The tab and search
 * live in the URL.
 */
export default function Memos() {
  const isMobile = useIsCompact();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tab, q } = useMemo(() => parseMemosParams(searchParams), [searchParams]);
  const { data: summary } = useMemoSummary();
  const [toolbarRef, toolbarHeight] = useStickyHeight();

  // The box keeps what was typed; the URL gets it trimmed, after a pause.
  const [queryInput, setQueryInput] = useState(q);
  useEffect(() => {
    setQueryInput((draft) => (draft.trim() === q ? draft : q));
  }, [q]);
  useEffect(() => {
    const next = queryInput.trim();
    if (next === q) return undefined;
    const t = setTimeout(() => setSearchParams((prev) => patchMemosParams(prev, { q: next }), { replace: true }), 250);
    return () => clearTimeout(t);
  }, [queryInput, q, setSearchParams]);

  const setTab = useCallback((next) => {
    setSearchParams((prev) => patchMemosParams(prev, { tab: next }), { replace: true });
  }, [setSearchParams]);

  // A new filter (or switching layouts) goes back to the first page without
  // a wasted request for the old page number.
  const filterKey = `${tab}\n${q}\n${isMobile ? 'phone' : 'desk'}`;
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const setPage = useCallback((p) => setPaging({ key: filterKey, page: p }), [filterKey]);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // Phones: pages appended so far by "Show more".
  const [loadedPages, setLoadedPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const filterKeyRef = useRef(filterKey);
  filterKeyRef.current = filterKey;

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    fetchMemos({ tab, q, page, pageSize }, { signal: ctrl.signal })
      .then((res) => {
        setRows(Array.isArray(res?.data) ? res.data : []);
        setCount(Number(res?.count) || 0);
        setLoadedPages(1);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message || 'Could not load memos');
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [tab, q, page, pageSize, reloadKey]);

  const retry = useCallback(() => {
    setReloadKey((k) => k + 1);
    refreshMemoSummary();
  }, []);

  const loadMore = useCallback(async () => {
    const key = filterKeyRef.current;
    const next = loadedPages + 1;
    setLoadingMore(true);
    try {
      const res = await fetchMemos({ tab, q, page: next, pageSize });
      if (filterKeyRef.current !== key) return;
      const more = Array.isArray(res?.data) ? res.data : [];
      // New SMS can shift the pages under us: skip rows already shown.
      setRows((current) => {
        const seen = new Set(current.map((r) => r.id));
        return [...current, ...more.filter((r) => !seen.has(r.id))];
      });
      setCount(Number(res?.count) || 0);
      setLoadedPages(next);
    } catch (e) {
      toast.error({ title: 'Could not load more memos', description: e.message });
    } finally {
      setLoadingMore(false);
    }
  }, [loadedPages, tab, q, pageSize]);

  // ---- One row changed or went away ----
  const patchRow = useCallback((updated) => {
    if (!updated?.id) return;
    setRows((current) => current.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }, []);

  /** Saves a memo (null clears it). Resolves with the row; on failure says so and rethrows. */
  const saveMemo = useCallback(async (row, memo) => {
    try {
      const updated = await updateMemo(row.id, memo);
      patchRow(updated);
      toast.success(memo ? 'Memo saved' : 'Memo cleared');
      refreshMemoSummary();
      return updated;
    } catch (e) {
      toast.error({ title: 'Could not save the memo', description: e.message });
      throw e;
    }
  }, [patchRow]);

  // ---- Sheet ----
  // The row stays set while the sheet animates closed.
  const [sheetRow, setSheetRow] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openRow = useCallback((row) => {
    setSheetRow(row);
    setSheetOpen(true);
  }, []);
  // The sheet shows the list's copy of the row, so an edit made in it shows in both.
  const shownSheetRow = (sheetRow && rows.find((r) => r.id === sheetRow.id)) || sheetRow;

  const onDeleted = useCallback((id) => {
    setSheetOpen(false);
    setRows((current) => current.filter((r) => r.id !== id));
    setCount((c) => Math.max(0, c - 1));
    // Desktop shows one page: fetch it again so the next row moves up. Phones
    // keep the rows they have appended.
    if (!isMobile) setReloadKey((k) => k + 1);
    toast.success('Message deleted');
    refreshMemoSummary();
  }, [isMobile]);

  // A delete can empty the last page; step back to the one before it.
  useEffect(() => {
    if (!isMobile && !loading && !error && rows.length === 0 && page > 1) {
      setPage(Math.max(1, Math.min(page - 1, Math.ceil(count / pageSize))));
    }
  }, [isMobile, loading, error, rows.length, page, count, pageSize, setPage]);

  // ---- Header actions ----
  const [connectOpen, setConnectOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);

  const reparseAll = useCallback(async () => {
    const id = toast('Re-parsing every message…', { duration: Infinity });
    try {
      const res = await reparseAllMemos();
      const n = Number(res?.updated) || 0;
      toast.success(n ? `Re-parsed ${plural(n, 'message')}` : 'Nothing changed', { id, duration: 4000 });
      setReloadKey((k) => k + 1);
      refreshMemoSummary();
    } catch (e) {
      toast.error({ id, title: 'Could not re-parse messages', description: e.message, duration: 6000 });
    }
  }, []);

  const withoutMemo = summary?.withoutMemo ?? 0;
  const noMemos = !loading && !error && count === 0 && tab === 'all' && !q;
  const emptyCopy = emptyCopyFor(tab, q);

  const dialogs = (
    <>
      <MemoSheet
        open={sheetOpen}
        row={shownSheetRow}
        onClose={() => setSheetOpen(false)}
        onSaveMemo={saveMemo}
        onUpdated={patchRow}
        onDeleted={onDeleted}
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

  // Phones: their own layout on the same state.
  if (isMobile) {
    return (
      <>
        <MemosPhone
          tab={tab}
          onTabChange={setTab}
          withoutMemo={withoutMemo}
          queryInput={queryInput}
          onQueryInput={setQueryInput}
          rows={rows}
          count={count}
          pageSize={pageSize}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          onRetry={retry}
          noMemos={noMemos}
          emptyCopy={emptyCopy}
          onOpen={openRow}
          onLoadMore={loadMore}
          onConnect={() => setConnectOpen(true)}
          onDevices={() => setDevicesOpen(true)}
          onReparseAll={reparseAll}
        />
        {dialogs}
      </>
    );
  }

  const columns = [
    {
      key: 'received',
      label: 'Received',
      width: 124,
      minWidth: 104,
      render: (m) => <span className="memos-time tabular-nums">{fmtMemoTime(memoTime(m))}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      width: 112,
      minWidth: 88,
      align: 'right',
      render: (m) => {
        const a = memoAmount(m);
        return <Amount className="memos-amount" value={a.value} sign={a.sign} tone={a.tone} decimals={a.decimals} />;
      },
    },
    {
      key: 'payee',
      label: 'Payee',
      width: 'minmax(140px, 1fr)',
      flex: true,
      pinned: true,
      render: (m) => (
        <span className="memos-payee">
          <span className="memos-payee__name truncate">{memoPayee(m)}</span>
          {m.senderVerified === false && (
            <Badge size="sm" theme="amber" label="Unverified" title="The SMS sender could not be verified" />
          )}
        </span>
      ),
    },
    {
      key: 'account',
      label: 'Account',
      width: 136,
      minWidth: 96,
      hideBelow: 'lg',
      render: (m) => {
        const account = memoAccount(m);
        return account ? <span className="memos-muted">{account}</span> : <span className="memos-empty">—</span>;
      },
    },
    {
      key: 'memo',
      label: 'Memo',
      width: 'minmax(200px, 1.4fr)',
      minWidth: 160,
      render: (m) => <MemoCell row={m} onSave={saveMemo} />,
    },
  ];

  let list;
  if (error) {
    list = (
      <EmptyState
        icon={NotebookPen}
        title="Could not load memos"
        description={error}
        action={<Button label="Try again" onClick={retry} />}
      />
    );
  } else if (noMemos) {
    list = (
      <EmptyState
        icon={NotebookPen}
        title="No memos yet"
        description="Connect your iPhone to start capturing bank SMS."
        action={<Button variant="solid" iconLeft={Plus} label="Connect iPhone" onClick={() => setConnectOpen(true)} />}
      />
    );
  } else {
    list = (
      <ListView
        className="memos-list"
        aria-label="Memos"
        columns={columns}
        rows={rows}
        onRowClick={openRow}
        storageKey="fintrack.memos"
        stickyHeader
        loading={loading && rows.length === 0}
        emptyState={<EmptyState size="sm" title={emptyCopy.title} description={emptyCopy.description} />}
        footer={
          count > 0 ? (
            <MemosPager
              page={page}
              pageSize={pageSize}
              total={count}
              shown={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          ) : null
        }
      />
    );
  }

  const lastReceived = fmtRelative(summary?.lastReceivedAt);
  const summaryText = [
    error || (loading && rows.length === 0) ? null : plural(count, 'message'),
    lastReceived ? `last received ${lastReceived}` : null,
  ].filter(Boolean).join(' · ');
  // The search stays on screen through an error, so a search that failed can be changed.
  const showControls = !noMemos;

  return (
    <>
      <PageHeader
        title="Memos"
        actions={(
          <>
            <Button iconLeft={Smartphone} label="Devices" onClick={() => setDevicesOpen(true)} />
            <Button variant="solid" iconLeft={Plus} label="Connect iPhone" onClick={() => setConnectOpen(true)} />
            <Dropdown
              placement="bottom-end"
              label="More memo actions"
              options={[{ label: 'Re-parse all', icon: RotateCw, onClick: reparseAll }]}
            >
              <Button variant="ghost" icon={Ellipsis} label="More actions" />
            </Dropdown>
          </>
        )}
      />
      <PageBody className="memos-page" style={{ '--list-toolbar-height': `${toolbarHeight}px` }}>
        {showControls && (
          <ListToolbar
            ref={toolbarRef}
            meta={summaryText ? <ListSummary>{summaryText}</ListSummary> : null}
          >
            <TextInput
              className="memos-search"
              type="search"
              prefix={Search}
              placeholder="Search memos"
              aria-label="Search memos"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
            <TabButtons
              aria-label="Show"
              value={tab}
              onChange={setTab}
              options={TABS.map((t) => ({
                value: t.id,
                label:
                  t.id === 'no-memo' && withoutMemo > 0 ? (
                    <>
                      {t.label}
                      <span className="memos-count">{withoutMemo}</span>
                    </>
                  ) : (
                    t.label
                  ),
              }))}
            />
          </ListToolbar>
        )}
        {list}
      </PageBody>
      {dialogs}
    </>
  );
}
