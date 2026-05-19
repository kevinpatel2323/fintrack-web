import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Portal from '../components/Portal.jsx';
import {
  Card, Num, Pill, Avatar, PrimaryBtn, GhostBtn, Overline, SectionTitle, HeroAmount,
} from '../components/ui/primitives.jsx';
import { IcPlus, IcSearch, IcEdit, IcTrash, IcChevR } from '../components/ui/Icon.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { inr } from '../utils/inr.js';
import { friendTint, initialsOf } from '../utils/categoryColors.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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
        const res = await fetch(`${API_BASE}/friends${qParam}`, { signal: ctrl.signal });
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
        const res = await fetch(`${API_BASE}/dashboard/friend-balances`);
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
      const res = await fetch(url, {
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
      const r = await fetch(`${API_BASE}/friends${query ? `?q=${encodeURIComponent(query)}` : ''}`);
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
          const res = await fetch(`${API_BASE}/friends/${f.id}`, { method: 'DELETE' });
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
                  style={{ color: 'var(--ft-spend)', borderColor: 'rgba(255,122,122,0.3)' }}
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
    <Card pad={18} style={{ marginBottom: 16 }}>
      <Overline>Net balance</Overline>
      <HeroAmount style={{ marginTop: 4 }} color={net >= 0 ? 'var(--ft-income)' : 'var(--ft-spend)'}>
        {inr(net, { sign: true })}
      </HeroAmount>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <div style={{ background: 'var(--ft-income-soft)', padding: 12, borderRadius: 12 }}>
          <Overline style={{ color: 'var(--ft-income)' }}>Owed to you</Overline>
          <Num size={20} weight={600} color="var(--ft-income)" style={{ marginTop: 4 }}>{inr(owedToMe)}</Num>
        </div>
        <div style={{ background: 'var(--ft-spend-soft)', padding: 12, borderRadius: 12 }}>
          <Overline style={{ color: 'var(--ft-spend)' }}>You owe</Overline>
          <Num size={20} weight={600} color="var(--ft-spend)" style={{ marginTop: 4 }}>{inr(iOwe)}</Num>
        </div>
      </div>
    </Card>
  );

  const list = (
    <Card pad={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div className="txn-search" style={{ flex: 1, maxWidth: '100%' }}>
          <IcSearch size={16} />
          <input
            type="search"
            placeholder="Search people"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
          />
        </div>
      </div>
      <div className="txn-pills" style={{ marginBottom: 12 }}>
        <Pill active={filter === 'all'} onClick={() => setFilter('all')}>All</Pill>
        <Pill active={filter === 'owed'} onClick={() => setFilter('owed')}>They owe</Pill>
        <Pill active={filter === 'owe'} onClick={() => setFilter('owe')}>You owe</Pill>
        <Pill active={filter === 'settled'} onClick={() => setFilter('settled')}>Settled</Pill>
      </div>
      {status && <p className="status">{status}</p>}
      {filtered.length === 0 ? (
        <p className="empty">No people match.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((f, i) => {
            const bal = Number(f.summary?.netBalance || 0);
            const owed = bal > 0;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate(`/friends/${f.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 8px',
                  borderTop: i ? '1px solid var(--ft-border)' : 'none',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  textAlign: 'left',
                  width: '100%',
                  borderRadius: 8,
                }}
              >
                <Avatar name={f.name} initials={initialsOf(f.name)} tint={friendTint(f.id)} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--ft-text)', fontWeight: 500, fontSize: 14 }}>{f.name}</div>
                  <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>
                    {Math.abs(bal) < 1
                      ? 'Settled up'
                      : owed
                        ? `Owes you ${inr(bal)}`
                        : `You owe ${inr(Math.abs(bal))}`}
                  </div>
                </div>
                {Math.abs(bal) < 1 ? (
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'var(--ft-surface-2)',
                      color: 'var(--ft-text-dim)',
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    Settled
                  </span>
                ) : (
                  <Num size={14} weight={600} color={owed ? 'var(--ft-income)' : 'var(--ft-spend)'}>
                    {inr(Math.abs(bal))}
                  </Num>
                )}
                <button
                  type="button"
                  className="txn-row__menu"
                  onClick={(e) => { e.stopPropagation(); openEdit(f); }}
                  aria-label="Edit"
                  style={{ opacity: 1 }}
                >
                  <IcEdit size={14} />
                </button>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );

  if (isMobile) {
    return (
      <>
        <ConfirmDialog {...confirmState} />
        {formSheet}
        {header}
        <main className="ft-mobile__content">
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {list}
        <div>{balanceHero}</div>
      </div>
    </>
  );
}
