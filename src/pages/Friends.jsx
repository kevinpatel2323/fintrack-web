import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Portal from '../components/Portal.jsx';
import {
  Card, Num, Pill, Avatar, PrimaryBtn, GhostBtn, Overline, HeroAmount,
} from '../components/ui/primitives.jsx';
import { IcPlus, IcSearch, IcEdit, IcTrash, IcChevR } from '../components/ui/Icon.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { inr } from '../utils/inr.js';
import { friendTint, initialsOf } from '../utils/categoryColors.js';

import { API_BASE, apiFetch } from '../services/http.js';
import './friends-redesign.css';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'owed', label: 'They owe' },
  { id: 'owe', label: 'You owe' },
  { id: 'settled', label: 'Settled' },
];

export default function Friends() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 720px)');

  const [friends, setFriends] = useState([]);
  const [balances, setBalances] = useState([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [filter, setFilter] = useState('all'); // all | owed | owe | settled

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
    let owed = 0;
    let owe = 0;
    let settled = 0;
    for (const f of merged) {
      const bal = Number(f.summary?.netBalance || 0);
      if (Math.abs(bal) < 1) settled += 1;
      else if (bal > 0) owed += 1;
      else owe += 1;
    }
    return { all: merged.length, owed, owe, settled };
  }, [merged]);

  const filtered = useMemo(() => {
    let list = merged;
    if (filter === 'owed') list = list.filter((f) => (f.summary?.netBalance || 0) > 0);
    if (filter === 'owe') list = list.filter((f) => (f.summary?.netBalance || 0) < 0);
    if (filter === 'settled') list = list.filter((f) => Math.abs(f.summary?.netBalance || 0) < 1);
    return list;
  }, [merged, filter]);

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
        <p className="ft-page-header__sub">Track shared expenses</p>
        <h1 className="ft-page-header__title">People</h1>
      </div>
      <div className="ft-page-header__actions">
        <PrimaryBtn onClick={openCreate}><IcPlus size={16} /> Add person</PrimaryBtn>
      </div>
    </header>
  );

  const balanceHero = (
    <Card pad={18} className="friends-summary">
      <div className="friends-summary__net">
        <Overline>Net balance</Overline>
        <HeroAmount color={net >= 0 ? 'var(--ft-income)' : 'var(--ft-spend)'}>
          {inr(net, { sign: true })}
        </HeroAmount>
      </div>
      <div className="friends-summary__split">
        <div className="friends-summary__stat friends-summary__stat--owed">
          <Overline style={{ color: 'var(--ft-income)', marginBottom: 4 }}>Owed to you</Overline>
          <Num size={18} weight={600} color="var(--ft-income)">{inr(owedToMe)}</Num>
        </div>
        <div className="friends-summary__stat friends-summary__stat--owe">
          <Overline style={{ color: 'var(--ft-spend)', marginBottom: 4 }}>You owe</Overline>
          <Num size={18} weight={600} color="var(--ft-spend)">{inr(iOwe)}</Num>
        </div>
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
    <Card pad={16} className="friends-panel">
      <div className="friends-toolbar">
        <div className="txn-search">
          <IcSearch size={16} />
          <input
            type="search"
            placeholder="Search people"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            aria-label="Search people"
          />
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

      {!status && filtered.length === 0 && emptyCopy ? (
        <div className="friends-empty">
          <p className="friends-empty__title">{emptyCopy.title}</p>
          <p className="friends-empty__sub">{emptyCopy.sub}</p>
          {merged.length === 0 && !query && (
            <PrimaryBtn onClick={openCreate} style={{ marginTop: 8 }}>
              <IcPlus size={14} /> Add person
            </PrimaryBtn>
          )}
        </div>
      ) : filtered.length > 0 ? (
        <div className="friends-list">
          {filtered.map((f) => {
            const bal = Number(f.summary?.netBalance || 0);
            const settled = Math.abs(bal) < 1;
            const owed = bal > 0;
            const metaClass = settled
              ? 'friends-row__meta friends-row__meta--settled'
              : owed
                ? 'friends-row__meta friends-row__meta--owed'
                : 'friends-row__meta friends-row__meta--owe';
            const meta = settled
              ? 'Settled up'
              : owed
                ? 'Owes you'
                : 'You owe';

            return (
              <div key={f.id} className="friends-row">
                <button
                  type="button"
                  className="friends-row__main"
                  onClick={() => navigate(`/friends/${f.id}`)}
                >
                  <Avatar name={f.name} initials={initialsOf(f.name)} tint={friendTint(f.id)} size={42} />
                  <div className="friends-row__body">
                    <div className="friends-row__name">{f.name}</div>
                    <div className={metaClass}>{meta}</div>
                  </div>
                  <div className="friends-row__aside">
                    {settled ? (
                      <span className="friends-row__settled">Settled</span>
                    ) : (
                      <span className="friends-row__amount">
                        <Num size={14} weight={600} color={owed ? 'var(--ft-income)' : 'var(--ft-spend)'}>
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
                  onClick={() => openEdit(f)}
                  aria-label={`Edit ${f.name}`}
                >
                  <IcEdit size={14} />
                </button>
              </div>
            );
          })}
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
      <div className="friends-layout">
        <aside>{balanceHero}</aside>
        {list}
      </div>
    </>
  );
}
