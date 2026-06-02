import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FriendLedgerExportModal from '../components/FriendLedgerExportModal.jsx';
import {
  Card, Num, Pill, Avatar, GhostBtn, Overline, HeroAmount, SectionTitle,
} from '../components/ui/primitives.jsx';
import {
  IcChevL, IcArrowDL, IcArrowUR, IcCheck, IcDownload, IcPlus,
} from '../components/ui/Icon.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { inr } from '../utils/inr.js';
import { friendTint, initialsOf } from '../utils/categoryColors.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function FriendDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 720px)');

  const [friend, setFriend] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tags, setTags] = useState([]);
  const [tab, setTab] = useState('all');
  const [status, setStatus] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [fRes, sRes, tRes] = await Promise.all([
          fetch(`${API_BASE}/friends/${id}`),
          fetch(`${API_BASE}/friends/${id}/summary`),
          fetch(`${API_BASE}/friends/${id}/transactions`),
        ]);
        if (fRes.ok) { const d = await fRes.json(); setFriend(d.data || d); }
        if (sRes.ok) { const d = await sRes.json(); setSummary(d.data || d); }
        if (tRes.ok) { const d = await tRes.json(); setTags(d.data || []); }
        setStatus('');
      } catch (e) {
        setStatus(e.message || 'Failed to load');
      }
    })();
  }, [id]);

  // resilient: friend may be a wrapped object
  const f = friend?.id ? friend : friend?.data || friend;

  const owedToMe = Number(summary?.totalOwesMe ?? 0);   // friend owes me (I paid for them)
  const iOwe = Number(summary?.totalIOwe ?? 0);         // I owe friend (they paid for me)
  const settlements = Number(summary?.totalSettlements ?? 0);
  const net = Number(summary?.net ?? (owedToMe - iOwe - settlements));

  const filtered = useMemo(() => {
    if (tab === 'all') return tags;
    if (tab === 'owe') return tags.filter((t) => t.direction === 'I_OWE');
    if (tab === 'owed') return tags.filter((t) => t.direction === 'OWES_ME');
    if (tab === 'settled') return tags.filter((t) => t.direction === 'SETTLEMENT' || t.direction === 'NOTHING_OUTSTANDING');
    return tags;
  }, [tags, tab]);

  if (!f) {
    return (
      <>
        <header className={isMobile ? 'ft-mobile__header' : 'ft-page-header'}>
          {isMobile ? (
            <button className="ft-mobile__icon-btn" onClick={() => navigate(-1)} aria-label="Back">
              <IcChevL size={18} />
            </button>
          ) : (
            <GhostBtn onClick={() => navigate('/friends')}><IcChevL size={14} /> People</GhostBtn>
          )}
        </header>
        <main className={isMobile ? 'ft-mobile__content' : ''}>
          <p className="status">{status || 'Loading…'}</p>
        </main>
      </>
    );
  }

  const balanceHero = (
    <Card pad={22} style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -40,
          top: -40,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: net >= 0 ? 'var(--ft-income-soft)' : 'var(--ft-spend-soft)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <Overline>{net > 0 ? 'They owe you' : net < 0 ? 'You owe' : 'All settled'}</Overline>
      <HeroAmount color={net > 0 ? 'var(--ft-income)' : net < 0 ? 'var(--ft-spend)' : 'var(--ft-text-dim)'} style={{ marginTop: 4 }}>
        {inr(Math.abs(net))}
      </HeroAmount>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18, position: 'relative' }}>
        <Mini label="They paid" value={inr(iOwe)} color="var(--ft-spend)" />
        <Mini label="You paid" value={inr(owedToMe)} color="var(--ft-income)" />
        <Mini label="Settled" value={inr(settlements)} color="var(--ft-violet)" />
      </div>
    </Card>
  );

  const activityFeed = (
    <Card pad={18}>
      <SectionTitle>Activity</SectionTitle>
      <div className="txn-pills" style={{ marginBottom: 12 }}>
        <Pill active={tab === 'all'} onClick={() => setTab('all')}>All</Pill>
        <Pill active={tab === 'owe'} onClick={() => setTab('owe')}>You owe</Pill>
        <Pill active={tab === 'owed'} onClick={() => setTab('owed')}>They owe</Pill>
        <Pill active={tab === 'settled'} onClick={() => setTab('settled')}>Settled</Pill>
      </div>
      {filtered.length === 0 ? (
        <p className="empty">No activity yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((t, i) => <LedgerRow key={t.id || i} tag={t} first={i === 0} />)}
        </div>
      )}
    </Card>
  );

  if (isMobile) {
    return (
      <>
        <FriendLedgerExportModal friend={f} open={exportOpen} onClose={() => setExportOpen(false)} />
        <header className="ft-mobile__header">
          <button className="ft-mobile__icon-btn" onClick={() => navigate('/friends')} aria-label="Back">
            <IcChevL size={18} />
          </button>
          <h1 className="ft-mobile__title" style={{ margin: 0 }}>{f.name}</h1>
          <button
            type="button"
            className="ft-mobile__icon-btn"
            onClick={() => setExportOpen(true)}
            aria-label="Export ledger"
          >
            <IcDownload size={20} />
          </button>
        </header>
        <main className="ft-mobile__content">
          <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 10 }}>
            <Avatar name={f.name} initials={initialsOf(f.name)} tint={friendTint(f.id)} size={68} />
            <Overline>{net > 0 ? 'They owe you' : net < 0 ? 'You owe' : 'All settled'}</Overline>
            <HeroAmount color={net > 0 ? 'var(--ft-income)' : net < 0 ? 'var(--ft-spend)' : 'var(--ft-text-dim)'}>
              {inr(Math.abs(net))}
            </HeroAmount>
          </div>
          <Card pad={14}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <Mini label="They paid" value={inr(iOwe)} color="var(--ft-spend)" />
              <Mini label="You paid" value={inr(owedToMe)} color="var(--ft-income)" />
              <Mini label="Settled" value={inr(settlements)} color="var(--ft-violet)" />
            </div>
          </Card>
          {activityFeed}
        </main>
      </>
    );
  }

  return (
    <>
      <FriendLedgerExportModal friend={f} open={exportOpen} onClose={() => setExportOpen(false)} />
      <header className="ft-page-header">
        <div>
          <p className="ft-page-header__sub">
            <button
              type="button"
              onClick={() => navigate('/friends')}
              style={{ background: 'transparent', border: 0, color: 'var(--ft-text-dim)', cursor: 'pointer' }}
            >
              People
            </button>{' / '}{f.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
            <Avatar name={f.name} initials={initialsOf(f.name)} tint={friendTint(f.id)} size={72} />
            <div>
              <h1 className="ft-page-header__title" style={{ marginBottom: 0 }}>{f.name}</h1>
              <p className="ft-page-header__sub" style={{ marginTop: 2 }}>
                {[f.email, f.phone].filter(Boolean).join(' · ') || 'No contact info'}
              </p>
            </div>
          </div>
        </div>
        <div className="ft-page-header__actions">
          <GhostBtn onClick={() => setExportOpen(true)}><IcDownload size={14} /> Export ledger</GhostBtn>
          <GhostBtn><IcPlus size={14} /> Add expense</GhostBtn>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {balanceHero}
          {activityFeed}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card pad={18}>
            <SectionTitle>Balance over time</SectionTitle>
            <BalanceSparkline tags={tags} />
          </Card>
        </div>
      </div>
    </>
  );
}

function Mini({ label, value, color }) {
  return (
    <div style={{ background: 'var(--ft-surface-2)', padding: 12, borderRadius: 12 }}>
      <Overline>{label}</Overline>
      <Num size={16} weight={600} color={color} style={{ marginTop: 4 }}>{value}</Num>
    </div>
  );
}

function LedgerRow({ tag, first }) {
  const dir = tag.direction;
  const isSettlement = dir === 'SETTLEMENT';
  const isIOwe = dir === 'I_OWE';
  const isOwesMe = dir === 'OWES_ME';
  const color = isSettlement ? 'var(--ft-violet)'
    : isIOwe ? 'var(--ft-spend)'
    : isOwesMe ? 'var(--ft-income)'
    : 'var(--ft-text-dim)';
  const Ic = isSettlement ? IcCheck : isIOwe ? IcArrowDL : IcArrowUR;
  const label = isSettlement ? 'Settled' : isIOwe ? 'You owe' : isOwesMe ? 'They owe' : 'Nothing outstanding';
  const tx = tag.transaction || {};
  const date = tx.transactionDate
    ? new Date(tx.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const amount = Number(tag.amount || 0);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 4px',
        borderTop: first ? 'none' : '1px solid var(--ft-border)',
      }}
    >
      <div
        style={{
          width: 34, height: 34, borderRadius: 10,
          background: `${color === 'var(--ft-violet)' ? 'var(--ft-violet-soft)' : color === 'var(--ft-income)' ? 'var(--ft-income-soft)' : 'var(--ft-spend-soft)'}`,
          color,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <Ic size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--ft-text)', fontSize: 14, fontWeight: 500 }}>
          {tx.upiName || tx.narration || tag.note || 'Transaction'}
        </div>
        <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>{date}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Num size={14} weight={600} color={color}>{inr(amount)}</Num>
        <div style={{ color: 'var(--ft-text-dim)', fontSize: 11 }}>{label}</div>
      </div>
    </div>
  );
}

function BalanceSparkline({ tags }) {
  if (!tags.length) return <p className="empty" style={{ margin: 0 }}>Not enough data.</p>;
  const sorted = [...tags]
    .filter((t) => t.transaction?.transactionDate)
    .sort((a, b) => new Date(a.transaction.transactionDate) - new Date(b.transaction.transactionDate));
  let running = 0;
  const pts = sorted.map((t) => {
    const amt = Number(t.amount || 0);
    if (t.direction === 'OWES_ME') running += amt;
    else if (t.direction === 'I_OWE') running -= amt;
    return running;
  });
  if (pts.length < 2) return <p className="empty" style={{ margin: 0 }}>Not enough data.</p>;
  const W = 280, H = 80;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const stepX = W / (pts.length - 1);
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * stepX},${H - ((v - min) / span) * H}`).join(' ');
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={d} fill="none" stroke="var(--ft-accent)" strokeWidth="2" />
    </svg>
  );
}

function ByCategoryList({ tags }) {
  const groups = useMemo(() => {
    const m = new Map();
    for (const t of tags) {
      const cat = t.transaction?.category?.name || 'Uncategorised';
      const cur = m.get(cat) || { total: 0, count: 0 };
      cur.total += Number(t.amount || 0);
      cur.count++;
      m.set(cat, cur);
    }
    return Array.from(m.entries()).sort(([, a], [, b]) => b.total - a.total).slice(0, 6);
  }, [tags]);
  if (groups.length === 0) return <p className="empty" style={{ margin: 0 }}>No data.</p>;
  const total = groups.reduce((s, [, v]) => s + v.total, 0) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groups.map(([cat, v]) => (
        <div key={cat}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--ft-text)', fontSize: 13 }}>{cat}</span>
            <Num size={12} weight={600}>{inr(v.total)}</Num>
          </div>
          <div style={{ height: 4, background: 'var(--ft-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(v.total / total) * 100}%`, height: '100%', background: 'var(--ft-accent)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
