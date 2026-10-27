import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, Users } from 'lucide-react';
import {
  Alert, Amount, Avatar, Button, Card, Dropdown, EmptyState, ListView, PageBody, PageHeader, Select, Skeleton,
  TabButtons, TextInput,
} from '../components/ui';
import PersonDialog from '../components/people/PersonDialog.jsx';
import { useReviewSummary } from '../hooks/useReviewSummary.js';
import { API_BASE, apiFetch } from '../services/http.js';
import './Friends.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'owed', label: 'They owe' },
  { id: 'owe', label: 'You owe' },
  { id: 'settled', label: 'Settled' },
];

const SORTS = [
  { value: 'amount', label: 'Largest balance' },
  { value: 'recent', label: 'Recent activity' },
  { value: 'name', label: 'Name' },
];

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

const SECTIONS = [
  { id: 'owed', title: 'Owes you' },
  { id: 'owe', title: 'You owe' },
  { id: 'settled', title: 'Settled' },
];

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
  const [sort, setSort] = useState('amount'); // amount | recent | name
  const [createOpen, setCreateOpen] = useState(false);

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

  // One section per side of the ledger — who owes you, whom you owe, who is
  // square — each sorted on its own. A filter just narrows it to one section.
  const sections = useMemo(() => {
    const comparators = {
      amount: (a, b) => Math.abs(b.summary.netBalance || 0) - Math.abs(a.summary.netBalance || 0),
      recent: (a, b) => (b.summary.lastTransactionDate || '').localeCompare(a.summary.lastTransactionDate || ''),
      name: (a, b) => (a.name || '').localeCompare(b.name || ''),
    };
    return SECTIONS
      .filter((sec) => filter === 'all' || filter === sec.id)
      .map((sec) => {
        const rows = merged.filter((f) => balanceSide(Number(f.summary?.netBalance || 0)) === sec.id);
        // Settled people have no balance to rank by; keep them alphabetical.
        rows.sort(sec.id === 'settled' && sort === 'amount' ? comparators.name : comparators[sort]);
        const total = rows.reduce((sum, f) => sum + Math.abs(Number(f.summary.netBalance || 0)), 0);
        return { ...sec, rows, total };
      })
      .filter((sec) => sec.rows.length > 0);
  }, [merged, filter, sort]);
  const shownCount = sections.reduce((n, sec) => n + sec.rows.length, 0);

  const owedToMe = balances.reduce((s, b) => s + Math.max(0, Number(b.netBalance) || 0), 0);
  const iOwe = balances.reduce((s, b) => s - Math.min(0, Number(b.netBalance) || 0), 0);
  const net = owedToMe - iOwe;

  const columns = [
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(140px, 3fr)',
      render: (f) => {
        const activity = fmtActivity(f.summary?.lastTransactionDate);
        return (
          <span className="people-row__who">
            <Avatar label={f.name} size="xl" aria-hidden />
            <span className="people-row__text">
              <span className="people-row__name">{f.name}</span>
              <span className="people-row__meta">
                {activity ? `Last activity ${activity}` : 'No shared expenses yet'}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      key: 'balance',
      label: 'Balance',
      width: 'minmax(96px, 1fr)',
      align: 'right',
      render: (f) => <BalanceCell value={Number(f.summary?.netBalance || 0)} />,
    },
  ];

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
        rowHref={(f) => `/friends/${f.id}`}
        loading={loading && merged.length === 0}
        {...(filter === 'all' && shownCount > 0
          ? {
              groups: sections.map((sec) => ({
                key: sec.id,
                label: sec.id === 'settled' ? sec.title : <GroupLabel title={sec.title} total={sec.total} />,
                count: sec.rows.length,
                rows: sec.rows,
              })),
            }
          : { rows: sections.flatMap((sec) => sec.rows) })}
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
      <PageBody className="people-page">
        <ReviewAlert />
        <div className="people-layout">
          <div className="people-main">
            <div className="people-toolbar">
              <TextInput
                className="people-toolbar__search"
                type="search"
                prefix={Search}
                placeholder={counts.all > 0 && !query ? `Search ${counts.all} people` : 'Search people'}
                aria-label="Search people"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
              />
              <div className="people-toolbar__filters">
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
              </div>
              <Select
                className="people-toolbar__sort"
                aria-label="Sort people"
                options={SORTS}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              />
            </div>
            {list}
          </div>

          <Summary
            loading={loading && balances.length === 0}
            net={net}
            owedToMe={owedToMe}
            iOwe={iOwe}
            counts={counts}
            filter={filter}
            onFilter={(id) => setFilter(filter === id ? 'all' : id)}
          />
        </div>
      </PageBody>

      <PersonDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refreshFriends} />
    </>
  );
}

function GroupLabel({ title, total }) {
  return (
    <span className="people-group-label">
      {title}
      <span className="people-group-label__total">
        <Amount value={total} tone="inherit" />
      </span>
    </span>
  );
}

/** "Owes you ₹2,400" / "You owe ₹800" / "Settled" — the words carry the side. */
function BalanceCell({ value }) {
  const side = balanceSide(value);
  if (side === 'settled') return <span className="people-balance people-balance--settled">Settled</span>;
  return (
    <span className="people-balance">
      <Amount className="people-balance__amount" value={Math.abs(value)} tone={side === 'owed' ? 'in' : 'out'} />
      <span className="people-balance__label">{side === 'owed' ? 'Owes you' : 'You owe'}</span>
    </span>
  );
}

/**
 * Net balance and each side of it, with how many people are behind each
 * figure. Each side doubles as its filter, so the figure and the people behind
 * it are one click apart.
 */
function Summary({ loading, net, owedToMe, iOwe, counts, filter, onFilter }) {
  const square = Math.abs(net) < SETTLED_BELOW;
  const open = counts.owed + counts.owe;
  return (
    <Card as="aside" className="people-summary" padding="none" aria-labelledby="people-summary-title">
      <h2 id="people-summary-title" className="people-summary__title">Balances</h2>
      <div className="people-summary__list" aria-busy={loading || undefined}>
        <div className="people-summary__row">
          <span className="people-summary__label">Net balance</span>
          <span className="people-summary__value">
            {loading ? <Skeleton as="span" width={88} height={16} /> : <Amount value={Math.abs(net)} tone="inherit" />}
          </span>
          <span className="people-summary__hint">
            {square ? 'All square overall' : net > 0 ? 'Owed to you overall' : 'You owe overall'}
            {' · '}
            {open === 0 ? 'No open balances' : `${people(open)} with a balance`}
          </span>
        </div>
        <SummarySide
          id="owed"
          label="Owed to you"
          value={owedToMe}
          tone="in"
          count={counts.owed}
          loading={loading}
          active={filter === 'owed'}
          onFilter={onFilter}
        />
        <SummarySide
          id="owe"
          label="You owe"
          value={iOwe}
          tone="out"
          count={counts.owe}
          loading={loading}
          active={filter === 'owe'}
          onFilter={onFilter}
        />
      </div>
    </Card>
  );
}

function SummarySide({ id, label, value, tone, count, loading, active, onFilter }) {
  return (
    <button
      type="button"
      className="people-summary__row people-summary__row--button"
      aria-pressed={active}
      onClick={() => onFilter(id)}
    >
      <span className="people-summary__label">{label}</span>
      <span className="people-summary__value">
        {loading ? <Skeleton as="span" width={72} height={16} /> : <Amount value={value} tone={value > 0 ? tone : 'inherit'} />}
      </span>
      <span className="people-summary__hint">{people(count)}</span>
    </button>
  );
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
