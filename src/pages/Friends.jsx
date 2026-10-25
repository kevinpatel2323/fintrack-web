import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Portal from '../components/Portal.jsx';
import {
  Card, Num, Pill, Avatar, PrimaryBtn, GhostBtn, Overline,
} from '../components/ui/primitives.jsx';
import { IcPlus, IcSearch, IcEdit, IcTrash, IcChevR } from '../components/ui/Icon.jsx';
import { useIsCompact } from '../styles/breakpoints.js';
import { inr } from '../utils/inr.js';
import { friendTint, initialsOf } from '../utils/categoryColors.js';
import { useReviewSummary } from '../hooks/useReviewSummary.js';

import { API_BASE, apiFetch } from '../services/http.js';
import './friends-redesign.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'owed', label: 'They owe' },
  { id: 'owe', label: 'You owe' },
  { id: 'settled', label: 'Settled' },
];

const SORTS = [
  { id: 'amount', label: 'Largest balance' },
  { id: 'recent', label: 'Recent activity' },
  { id: 'name', label: 'Name' },
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
  { id: 'owed', title: 'Owes you', tone: 'var(--ft-income)' },
  { id: 'owe', title: 'You owe', tone: 'var(--ft-spend)' },
  { id: 'settled', title: 'Settled up', tone: 'var(--ft-text-dim)' },
];

export default function Friends() {
  const navigate = useNavigate();
  const isMobile = useIsCompact();

  const [friends, setFriends] = useState([]);
  const [balances, setBalances] = useState([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [filter, setFilter] = useState('all'); // all | owed | owe | settled
  const [sort, setSort] = useState('amount'); // amount | recent | name

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' });
  const [confirmState, setConfirmState] = useState({ open: false });

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim()), 250);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setStatus('Loading…');
      try {
        const qParam = query ? `?q=${encodeURIComponent(query)}` : '';
        const res = await apiFetch(`${API_BASE}/friends${qParam}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('Failed to fetch friends');
        const data = await res.json();
        setFriends(data.data || []);
        setStatus('');
      } catch (e) {
        if (e.name === 'AbortError') return;
        setStatus(e.message || 'Failed to fetch friends');
      }
    })();
    return () => ctrl.abort();
  }, [query]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/dashboard/friend-balances`);
        if (res.ok) setBalances(await res.json());
      } catch {}
    })();
  }, [friends.length]);

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
        const people = merged.filter((f) => balanceSide(Number(f.summary?.netBalance || 0)) === sec.id);
        // Settled people have no balance to rank by; keep them alphabetical.
        people.sort(sec.id === 'settled' && sort === 'amount' ? comparators.name : comparators[sort]);
        const total = people.reduce((sum, f) => sum + Math.abs(Number(f.summary.netBalance || 0)), 0);
        return { ...sec, people, total };
      })
      .filter((sec) => sec.people.length > 0);
  }, [merged, filter, sort]);
  const shownCount = sections.reduce((n, sec) => n + sec.people.length, 0);

  const owedToMe = balances.reduce((s, b) => s + Math.max(0, Number(b.netBalance) || 0), 0);
  const iOwe = balances.reduce((s, b) => s - Math.min(0, Number(b.netBalance) || 0), 0);
  const net = owedToMe - iOwe;

  function openCreate() {
    setEditId(null);
    setForm({ name: '', email: '', phone: '', note: '' });
    setFormStatus('');
    setCreateOpen(true);
  }

  function openEdit(f) {
    setEditId(f.id);
    setForm({ name: f.name || '', email: f.email || '', phone: f.phone || '', note: f.note || '' });
    setFormStatus('');
    setCreateOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormStatus('Enter a name.'); return; }
    setFormStatus('Saving…');
    try {
      const url = editId ? `${API_BASE}/friends/${editId}` : `${API_BASE}/friends`;
      const res = await apiFetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          note: form.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setCreateOpen(false);
      setEditId(null);
      setQuery((q) => q); // re-trigger fetch
      const r = await apiFetch(`${API_BASE}/friends${query ? `?q=${encodeURIComponent(query)}` : ''}`);
      if (r.ok) setFriends((await r.json()).data || []);
    } catch (err) {
      setFormStatus(err.message || 'Save failed');
    }
  }

  function askDelete(f) {
    setConfirmState({
      open: true,
      title: `Delete ${f.name}?`,
      message: 'This removes the friend and unlinks any tagged transactions.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmState({ open: false });
        try {
          const res = await apiFetch(`${API_BASE}/friends/${f.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Delete failed');
          setFriends((prev) => prev.filter((x) => x.id !== f.id));
        } catch (err) {
          setStatus(err.message || 'Delete failed');
        }
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  const formSheet = createOpen && (
    <Portal>
      <div className="calendar-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && setCreateOpen(false)}>
        <div className="calendar-sheet" role="dialog" aria-modal="true">
          <div className="ft-sheet__grabber" />
          <h3 className="ft-sheet__title">{editId ? 'Edit person' : 'New person'}</h3>
          <p className="ft-sheet__sub">Track who owes you and who you owe.</p>
          <form onSubmit={submit} className="form-grid">
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Name</span>
              <input type="text" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name" autoFocus />
            </label>
            <label className="field"><span>Email</span>
              <input type="email" value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </label>
            <label className="field"><span>Phone</span>
              <input type="tel" value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </label>
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Note</span>
              <input type="text" value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              {editId && (
                <GhostBtn
                  onClick={() => {
                    setCreateOpen(false);
                    const f = friends.find((x) => x.id === editId);
                    if (f) askDelete(f);
                  }}
                  style={{ color: 'var(--ft-spend)', borderColor: 'var(--ft-spend-hairline)' }}
                >
                  <IcTrash size={14} /> Delete
                </GhostBtn>
              )}
              <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                <GhostBtn onClick={() => setCreateOpen(false)}>Cancel</GhostBtn>
                <PrimaryBtn type="submit">Save</PrimaryBtn>
              </div>
            </div>
            {formStatus && <p className="status" style={{ gridColumn: '1 / -1' }}>{formStatus}</p>}
          </form>
        </div>
      </div>
    </Portal>
  );

  const header = isMobile ? (
    <header className="ft-mobile__header">
      <h1 className="ft-mobile__title">People</h1>
      <button className="ft-mobile__icon-btn" onClick={openCreate} aria-label="New person">
        <IcPlus size={20} />
      </button>
    </header>
  ) : (
    <header className="ft-page-header">
      <div>
        <p className="ft-page-header__sub">
          {counts.all > 0
            ? `${counts.all} people · ${counts.owed + counts.owe} with an open balance`
            : 'Track shared expenses'}
        </p>
        <h1 className="ft-page-header__title">People</h1>
      </div>
      <div className="ft-page-header__actions">
        <PrimaryBtn onClick={openCreate}><IcPlus size={16} /> Add person</PrimaryBtn>
      </div>
    </header>
  );

  const owedShare = owedToMe + iOwe > 0 ? (owedToMe / (owedToMe + iOwe)) * 100 : 50;
  const balanceHero = (
    <Card pad={18} className="friends-summary">
      <div className="friends-summary__net">
        <Overline>Net balance</Overline>
        <Num size={30} weight={600} color={Math.abs(net) < SETTLED_BELOW ? 'var(--ft-text)' : net > 0 ? 'var(--ft-income)' : 'var(--ft-spend)'}>
          {inr(Math.abs(net))}
        </Num>
        <span className="friends-summary__caption">
          {Math.abs(net) < SETTLED_BELOW
            ? 'You and your people are square overall.'
            : net > 0 ? 'More is owed to you than you owe.' : 'You owe more than is owed to you.'}
        </span>
      </div>

      {owedToMe + iOwe > 0 && (
        <div className="friends-summary__bar" aria-hidden>
          <span style={{ width: `${owedShare}%`, background: 'var(--ft-income)' }} />
          <span style={{ width: `${100 - owedShare}%`, background: 'var(--ft-spend)' }} />
        </div>
      )}

      {/* Each side doubles as its filter, so the figure and the people behind it are one click apart. */}
      <div className="friends-summary__split">
        <button
          type="button"
          className="friends-summary__stat"
          data-active={filter === 'owed'}
          onClick={() => setFilter(filter === 'owed' ? 'all' : 'owed')}
        >
          <span className="friends-summary__label"><i style={{ background: 'var(--ft-income)' }} /> Owed to you</span>
          <Num size={16} weight={600} color="var(--ft-income)">{inr(owedToMe)}</Num>
          <span className="friends-summary__count">{counts.owed} {counts.owed === 1 ? 'person' : 'people'}</span>
        </button>
        <button
          type="button"
          className="friends-summary__stat"
          data-active={filter === 'owe'}
          onClick={() => setFilter(filter === 'owe' ? 'all' : 'owe')}
        >
          <span className="friends-summary__label"><i style={{ background: 'var(--ft-spend)' }} /> You owe</span>
          <Num size={16} weight={600} color="var(--ft-spend)">{inr(iOwe)}</Num>
          <span className="friends-summary__count">{counts.owe} {counts.owe === 1 ? 'person' : 'people'}</span>
        </button>
      </div>
    </Card>
  );

  const emptyCopy = (() => {
    if (status === 'Loading…') return null;
    if (query) {
      return {
        title: 'No matches',
        sub: `Nothing found for “${query}”. Try another name.`,
      };
    }
    if (filter === 'owed') return { title: 'No one owes you', sub: 'People who owe you will show up here.' };
    if (filter === 'owe') return { title: 'You’re all clear', sub: 'Balances you owe will show up here.' };
    if (filter === 'settled') return { title: 'No settled balances', sub: 'Friends at zero will show up here.' };
    if (merged.length === 0) {
      return {
        title: 'No people yet',
        sub: 'Add someone to start tracking shared expenses.',
      };
    }
    return { title: 'No people match', sub: 'Try a different filter.' };
  })();

  const list = (
    <Card pad={0} className="friends-panel">
      <div className="friends-toolbar">
        <div className="friends-toolbar__row">
          <div className="txn-search">
            <IcSearch size={16} />
            <input
              type="search"
              placeholder={counts.all > 0 && !query ? `Search ${counts.all} people` : 'Search people'}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              aria-label="Search people"
            />
          </div>
          <select
            className="friends-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort people"
          >
            {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div className="friends-filters" role="tablist" aria-label="Balance filters">
          {FILTERS.map((f) => (
            <Pill
              key={f.id}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
              className="friends-filter"
              data-active={filter === f.id}
              role="tab"
              aria-selected={filter === f.id}
            >
              {f.label}
              <span className="friends-filter__count">{counts[f.id]}</span>
            </Pill>
          ))}
        </div>
      </div>

      {status && <p className="friends-status">{status}</p>}

      {!status && shownCount === 0 && emptyCopy ? (
        <div className="friends-empty">
          <p className="friends-empty__title">{emptyCopy.title}</p>
          <p className="friends-empty__sub">{emptyCopy.sub}</p>
          {merged.length === 0 && !query && (
            <PrimaryBtn onClick={openCreate} style={{ marginTop: 8 }}>
              <IcPlus size={14} /> Add person
            </PrimaryBtn>
          )}
        </div>
      ) : shownCount > 0 ? (
        <div className="friends-sections">
          {sections.map((sec) => (
            <section key={sec.id} className={`friends-section friends-section--${sec.id}`}>
              <div className="friends-section__head">
                <span className="friends-section__title">
                  <i style={{ background: sec.tone }} />
                  {sec.title}
                  <span className="friends-section__n">{sec.people.length}</span>
                </span>
                {sec.id !== 'settled' && (
                  <Num size={12.5} weight={600} color={sec.tone}>{inr(sec.total)}</Num>
                )}
              </div>
              <div className="friends-list">
                {sec.people.map((f) => (
                  <FriendRow
                    key={f.id}
                    friend={f}
                    side={sec.id}
                    onOpen={() => navigate(`/friends/${f.id}`)}
                    onEdit={() => openEdit(f)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </Card>
  );

  if (isMobile) {
    return (
      <>
        <ConfirmDialog {...confirmState} />
        {formSheet}
        {header}
        <main className="ft-mobile__content friends-layout--mobile">
          {balanceHero}
          <ReviewCard onOpen={(friendId) => navigate(`/friends/${friendId}?review=1`)} />
          {list}
        </main>
      </>
    );
  }
  return (
    <>
      <ConfirmDialog {...confirmState} />
      {formSheet}
      {header}
      <div className="ft-split" style={{ '--ft-split-aside': '320px' }}>
        {list}
        <aside className="friends-aside">
          {balanceHero}
          <ReviewCard onOpen={(friendId) => navigate(`/friends/${friendId}?review=1`)} />
        </aside>
      </div>
    </>
  );
}

function FriendRow({ friend, side, onOpen, onEdit }) {
  const bal = Number(friend.summary?.netBalance || 0);
  const activity = fmtActivity(friend.summary?.lastTransactionDate);
  return (
    <div className={`friends-row friends-row--${side}`}>
      <button type="button" className="friends-row__main" onClick={onOpen}>
        <Avatar name={friend.name} initials={initialsOf(friend.name)} tint={friendTint(friend.id)} size={36} />
        <div className="friends-row__body">
          <div className="friends-row__name">{friend.name}</div>
          <div className="friends-row__meta">
            {activity ? `Last activity ${activity}` : 'No shared expenses yet'}
          </div>
        </div>
        <div className="friends-row__aside">
          {side !== 'settled' && (
            <span className="friends-row__amount">
              <Num size={14} weight={600} color={side === 'owed' ? 'var(--ft-income)' : 'var(--ft-spend)'}>
                {inr(Math.abs(bal))}
              </Num>
            </span>
          )}
          <IcChevR size={14} className="friends-row__chev" aria-hidden="true" />
        </div>
      </button>
      <button
        type="button"
        className="friends-row__edit"
        onClick={onEdit}
        aria-label={`Edit ${friend.name}`}
        title="Edit"
      >
        <IcEdit size={14} />
      </button>
    </div>
  );
}

/**
 * Friends whose older settlements — saved before amounts were recorded —
 * don't match their entries. Each opens that friend's review.
 */
function ReviewCard({ onOpen }) {
  const { data } = useReviewSummary();
  const friends = (data?.friends ?? []).filter((f) => f.needingReview > 0);
  if (friends.length === 0) return null;
  return (
    <Card pad={16} style={{ borderColor: 'var(--ft-warn)' }}>
      <Overline>Older settlements to review</Overline>
      <p style={{ margin: '6px 0 10px', color: 'var(--ft-text-dim)', fontSize: 12.5, lineHeight: 1.5 }}>
        {data.needingReview} settlement{data.needingReview === 1 ? '' : 's'} saved before amounts were
        recorded {data.needingReview === 1 ? "doesn't" : "don't"} match {data.needingReview === 1 ? 'its' : 'their'} entries.
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        {friends.map((f) => (
          <button
            key={f.friendId}
            type="button"
            onClick={() => onOpen(f.friendId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
              border: '1px solid var(--ft-border)', background: 'var(--ft-surface-2)', color: 'var(--ft-text)',
              cursor: 'pointer', textAlign: 'left', fontSize: 13,
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>{f.friendName}</span>
            {f.netChange !== 0 && (
              <span style={{ color: 'var(--ft-warn)', fontSize: 11.5 }}>balance changes</span>
            )}
            <span style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>{f.needingReview}</span>
            <IcChevR size={14} style={{ color: 'var(--ft-text-faint)' }} />
          </button>
        ))}
      </div>
    </Card>
  );
}
