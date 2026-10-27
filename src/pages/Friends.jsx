import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, Users } from 'lucide-react';
import {
  Alert, Amount, Avatar, Badge, Button, Dropdown, EmptyState, ListView, PageBody, PageHeader, TabButtons, TextInput,
} from '../components/ui';
import ListToolbar, { ListSummary, useStickyHeight } from '../components/common/ListToolbar.jsx';
import PersonDialog from '../components/people/PersonDialog.jsx';
import TransactionColumnsMenu from '../components/transactions/TransactionColumnsMenu.jsx';
import { useTransactionTableSettings } from '../components/transactions/useTransactionTableSettings.js';
import { avatarTheme } from '../components/ui/AvatarGroup.jsx';
import { useReviewSummary } from '../hooks/useReviewSummary.js';
import { API_BASE, apiFetch } from '../services/http.js';
import './Friends.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'owed', label: 'They owe' },
  { id: 'owe', label: 'You owe' },
  { id: 'settled', label: 'Settled' },
];

// Same column set-up as the transactions table: Name is always shown,
// contact details are there to turn on from Columns.
const COLUMNS = [
  { id: 'name', label: 'Name', pinned: true },
  { id: 'status', label: 'Status' },
  { id: 'activity', label: 'Last activity' },
  { id: 'email', label: 'Email', defaultHidden: true },
  { id: 'phone', label: 'Phone', defaultHidden: true },
  { id: 'balance', label: 'Balance' },
];
const COLUMN_CHOICES = COLUMNS.filter((c) => !c.pinned).map(({ id, label }) => ({ id, label }));
const DEFAULT_SORT = { key: 'balance', direction: 'desc' };
const SIDE_ORDER = { owed: 0, owe: 1, settled: 2 };
const STATUS = {
  owed: { label: 'Owes you', theme: 'green' },
  owe: { label: 'You owe', theme: 'amber' },
  settled: { label: 'Settled', theme: 'gray' },
};

// Under a rupee either way reads as settled (paise left over from splits).
const SETTLED_BELOW = 1;

function balanceSide(bal) {
  if (Math.abs(bal) < SETTLED_BELOW) return 'settled';
  return bal > 0 ? 'owed' : 'owe';
}

/** "Today", "3 days ago", "17 Oct", "17 Oct 2025" — for the row's last activity. */
function fmtActivity(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  }).format(d);
}

const people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [balances, setBalances] = useState([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState('all'); // all | owed | owe | settled
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [createOpen, setCreateOpen] = useState(false);
  const columnSettings = useTransactionTableSettings('fintrack.people.columns', {
    pinned: ['name'],
    defaultHidden: COLUMNS.filter((c) => c.defaultHidden).map((c) => c.id),
  });
  const [toolbarRef, toolbarHeight] = useStickyHeight();

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim()), 250);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      setError('');
      try {
        const qParam = query ? `?q=${encodeURIComponent(query)}` : '';
        const res = await apiFetch(`${API_BASE}/friends${qParam}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('Failed to fetch friends');
        const data = await res.json();
        setFriends(data.data || []);
        setLoading(false);
      } catch (e) {
        if (e.name === 'AbortError') return;
        setError(e.message || 'Failed to fetch friends');
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [query, reloadKey]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/dashboard/friend-balances`);
        if (res.ok) setBalances(await res.json());
      } catch {}
    })();
  }, [friends.length]);

  // After adding someone: the same list request, with the current search.
  async function refreshFriends() {
    const r = await apiFetch(`${API_BASE}/friends${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    if (r.ok) setFriends((await r.json()).data || []);
  }

  const balanceByFriend = useMemo(() => {
    const m = new Map();
    for (const b of balances) m.set(String(b.friendId), b);
    return m;
  }, [balances]);

  const merged = useMemo(
    () => friends.map((f) => ({
      ...f,
      summary: balanceByFriend.get(String(f.id)) || { netBalance: 0, totalIOwe: 0, totalOwesMe: 0 },
    })),
    [friends, balanceByFriend],
  );

  const counts = useMemo(() => {
    const c = { all: merged.length, owed: 0, owe: 0, settled: 0 };
    for (const f of merged) c[balanceSide(Number(f.summary?.netBalance || 0))] += 1;
    return c;
  }, [merged]);

  // The table: narrowed by the balance filter, ordered by the header sort.
  const rows = useMemo(() => {
    const side = (f) => balanceSide(Number(f.summary?.netBalance || 0));
    const value = {
      name: (f) => (f.name || '').toLowerCase(),
      status: (f) => SIDE_ORDER[side(f)],
      activity: (f) => f.summary?.lastTransactionDate || '',
      email: (f) => (f.email || '').toLowerCase(),
      phone: (f) => f.phone || '',
      // Largest balance either way, as "Largest balance" always meant.
      balance: (f) => Math.abs(Number(f.summary?.netBalance || 0)),
    }[sort.key] || (() => 0);
    const dir = sort.direction === 'asc' ? 1 : -1;
    return merged
      .filter((f) => filter === 'all' || side(f) === filter)
      .sort((a, b) => {
        const va = value(a);
        const vb = value(b);
        if (va < vb) return -dir;
        if (va > vb) return dir;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [merged, filter, sort]);

  const owedToMe = balances.reduce((s, b) => s + Math.max(0, Number(b.netBalance) || 0), 0);
  const iOwe = balances.reduce((s, b) => s - Math.min(0, Number(b.netBalance) || 0), 0);

  const hidden = columnSettings.hidden;
  const columns = [
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(150px, 3fr)',
      sortable: true,
      render: (f) => {
        const side = balanceSide(Number(f.summary?.netBalance || 0));
        const activity = fmtActivity(f.summary?.lastTransactionDate);
        return (
          <span className="people-name">
            <Avatar label={f.name} size="md" theme={avatarTheme(f.id)} aria-hidden />
            <span className="people-name__text">
              <span className="people-name__label truncate">{f.name}</span>
              {/* Phones drop the Status and Last activity columns; the facts
                  move under the name. */}
              <span className="people-name__meta">
                {STATUS[side].label}
                {activity ? ` · ${activity}` : ''}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: 120,
      sortable: true,
      hideBelow: 'sm',
      render: (f) => {
        const s = STATUS[balanceSide(Number(f.summary?.netBalance || 0))];
        return <Badge theme={s.theme} label={s.label} />;
      },
    },
    {
      key: 'activity',
      label: 'Last activity',
      width: 140,
      sortable: true,
      hideBelow: 'sm',
      render: (f) => {
        const activity = fmtActivity(f.summary?.lastTransactionDate);
        return activity ? <span className="people-cell-muted">{activity}</span> : <span className="people-cell-empty">—</span>;
      },
    },
    {
      key: 'email',
      label: 'Email',
      width: 'minmax(160px, 2fr)',
      sortable: true,
      hideBelow: 'md',
      render: (f) => (f.email ? <span className="people-cell-muted truncate">{f.email}</span> : <span className="people-cell-empty">—</span>),
    },
    {
      key: 'phone',
      label: 'Phone',
      width: 140,
      sortable: true,
      hideBelow: 'md',
      render: (f) => (f.phone ? <span className="people-cell-muted">{f.phone}</span> : <span className="people-cell-empty">—</span>),
    },
    {
      key: 'balance',
      label: 'Balance',
      width: 120,
      align: 'right',
      sortable: true,
      render: (f) => <BalanceCell value={Number(f.summary?.netBalance || 0)} />,
    },
  ].filter((c) => c.key === 'name' || !hidden[c.key]);

  const emptyCopy = (() => {
    if (query) return { title: 'No matches', description: `Nothing found for “${query}”. Try another name.` };
    if (filter === 'owed') return { title: 'No one owes you', description: 'People who owe you will show up here.' };
    if (filter === 'owe') return { title: 'You don’t owe anyone', description: 'Balances you owe will show up here.' };
    if (filter === 'settled') return { title: 'No settled balances', description: 'People at zero will show up here.' };
    return { title: 'No people match', description: 'Try a different filter.' };
  })();

  const noPeople = !loading && !error && merged.length === 0 && !query;

  let list;
  if (error) {
    list = (
      <EmptyState
        icon={Users}
        title="Could not load people"
        description={error}
        action={<Button label="Try again" onClick={() => setReloadKey((k) => k + 1)} />}
      />
    );
  } else if (noPeople) {
    list = (
      <EmptyState
        icon={Users}
        title="No people yet"
        description="Add someone to start tracking shared expenses."
        action={<Button variant="subtle" iconLeft={Plus} label="Add person" onClick={() => setCreateOpen(true)} />}
      />
    );
  } else {
    list = (
      <ListView
        className="people-list"
        aria-label="People"
        columns={columns}
        rows={rows}
        rowHref={(f) => `/friends/${f.id}`}
        sort={sort}
        onSortChange={(next) => setSort(next ?? DEFAULT_SORT)}
        stickyHeader
        loading={loading && merged.length === 0}
        emptyState={<EmptyState size="sm" title={emptyCopy.title} description={emptyCopy.description} />}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="People"
        actions={<Button variant="solid" iconLeft={Plus} label="Add person" onClick={() => setCreateOpen(true)} />}
        mobileActions={<Button variant="ghost" size="md" icon={Plus} label="Add person" onClick={() => setCreateOpen(true)} />}
      />
      <PageBody className="people-page" style={{ '--list-toolbar-height': `${toolbarHeight}px` }}>
        <ListToolbar
          ref={toolbarRef}
          meta={(
            <>
              <ListSummary>
                {people(counts.all)}
                {owedToMe > 0 && (
                  <>
                    {' · '}
                    <Amount value={owedToMe} tone="in" /> owed to you
                  </>
                )}
                {iOwe > 0 && (
                  <>
                    {' · '}
                    <Amount value={iOwe} tone="inherit" /> you owe
                  </>
                )}
              </ListSummary>
              <TransactionColumnsMenu columns={COLUMN_CHOICES} settings={columnSettings} />
            </>
          )}
        >
          <TextInput
            className="people-search"
            type="search"
            prefix={Search}
            placeholder={counts.all > 0 && !query ? `Search ${counts.all} people` : 'Search people'}
            aria-label="Search people"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
          />
          <TabButtons
            aria-label="Balance filter"
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((f) => ({
              value: f.id,
              label: (
                <>
                  {f.label}
                  <span className="people-count">{counts[f.id]}</span>
                </>
              ),
            }))}
          />
        </ListToolbar>
        <ReviewAlert />
        {list}
      </PageBody>

      <PersonDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refreshFriends} />
    </>
  );
}

/** The open balance; its side is in the Status column (and under the name on
 *  phones), so the figure stays a plain, sortable number. */
function BalanceCell({ value }) {
  const side = balanceSide(value);
  if (side === 'settled') return <span className="people-cell-empty">—</span>;
  return <Amount className="people-balance" value={Math.abs(value)} tone={side === 'owed' ? 'in' : 'out'} />;
}

/**
 * Friends whose older settlements — saved before amounts were recorded —
 * don't match their entries. Opens that friend's review (`?review=1`).
 */
function ReviewAlert() {
  const { data } = useReviewSummary();
  const friends = (data?.friends ?? []).filter((f) => f.needingReview > 0);
  if (friends.length === 0) return null;
  const n = data.needingReview;
  const reviewHref = (f) => `/friends/${f.friendId}?review=1`;
  const detail = (f) =>
    `${f.needingReview} ${f.needingReview === 1 ? 'settlement' : 'settlements'}${f.netChange !== 0 ? ' · balance changes' : ''}`;

  // One person: a straight link. Several: pick whose review to open.
  const single = friends.length === 1;
  const picker = single ? undefined : (
    <Dropdown
      placement="bottom-start"
      options={friends.map((f) => ({ label: f.friendName, description: detail(f), to: reviewHref(f) }))}
    >
      <Button variant="outline" size="md" label="Review" iconRight={ChevronDown} />
    </Dropdown>
  );

  return (
    <Alert
      className="people-review"
      theme="amber"
      title={`${n} older ${n === 1 ? 'settlement needs' : 'settlements need'} review`}
      description={`Saved before Fintrack recorded amounts, ${n === 1 ? "it doesn't" : "they don't"} match ${
        n === 1 ? 'its' : 'their'
      } entries. ${friends.length === 1 ? detail(friends[0]) : `With ${friends.map((f) => f.friendName).join(', ')}`}.`}
      primaryAction={single ? { label: `Review with ${friends[0].friendName}`, to: reviewHref(friends[0]) } : undefined}
      actions={picker}
    />
  );
}
