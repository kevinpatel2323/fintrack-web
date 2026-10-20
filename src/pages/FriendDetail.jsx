import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import FriendLedgerExportModal from '../components/FriendLedgerExportModal.jsx';
import SettlementAllocationModal from '../components/SettlementAllocationModal.jsx';
import NetOffModal, { canNetOff } from '../components/NetOffModal.jsx';
import WriteOffModal from '../components/WriteOffModal.jsx';
import LegacyReviewModal from '../components/LegacyReviewModal.jsx';
import { deleteOffset, deleteWriteOff, fetchOffsets } from '../services/friendsApi.js';
import { refreshReviewSummary } from '../hooks/useReviewSummary.js';
import { rupees, toMinor } from '../utils/settlementAllocation.js';
import {
  Card, Num, Pill, Avatar, GhostBtn, Overline, HeroAmount, SectionTitle,
} from '../components/ui/primitives.jsx';
import {
  IcChevL, IcArrowDL, IcArrowUR, IcCheck, IcDownload, IcPlus,
} from '../components/ui/Icon.jsx';
import { useIsCompact } from '../styles/breakpoints.js';
import { inr } from '../utils/inr.js';
import { friendTint, initialsOf } from '../utils/categoryColors.js';

import { API_BASE, apiFetch } from '../services/http.js';

export default function FriendDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsCompact();

  const [friend, setFriend] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tags, setTags] = useState([]);
  const [tab, setTab] = useState('all');
  const [status, setStatus] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  // The settlement whose bill-wise allocation is being edited, if any.
  const [allocatingTag, setAllocatingTag] = useState(null);
  const [writeOffTag, setWriteOffTag] = useState(null);
  const [netOffOpen, setNetOffOpen] = useState(false);
  // People links here with ?review=1 to open the review straight away.
  const [searchParams] = useSearchParams();
  const [reviewOpen, setReviewOpen] = useState(searchParams.get('review') === '1');
  const [offsets, setOffsets] = useState([]);
  const [actionError, setActionError] = useState('');

  async function load() {
    try {
      const [fRes, sRes, tRes, oRes] = await Promise.all([
        apiFetch(`${API_BASE}/friends/${id}`),
        apiFetch(`${API_BASE}/friends/${id}/summary`),
        apiFetch(`${API_BASE}/friends/${id}/transactions`),
        fetchOffsets(id).catch(() => ({ data: [] })),
      ]);
      if (fRes.ok) { const d = await fRes.json(); setFriend(d.data || d); }
      if (sRes.ok) { const d = await sRes.json(); setSummary(d.data || d); }
      if (tRes.ok) { const d = await tRes.json(); setTags(d.data || []); }
      setOffsets(oRes?.data || []);
      setStatus('');
    } catch (e) {
      setStatus(e.message || 'Failed to load');
    }
  }

  // After anything that changes what is settled: reload this page and the
  // review badge on People.
  async function reload() {
    setActionError('');
    await Promise.all([load(), refreshReviewSummary()]);
  }

  async function undo(action) {
    setActionError('');
    try {
      await action();
      await reload();
    } catch (e) {
      setActionError(e.message || 'Could not undo.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // resilient: friend may be a wrapped object
  const f = friend?.id ? friend : friend?.data || friend;

  const owedToMe = Number(summary?.totalOwesMe ?? 0);   // friend owes me (I paid for them)
  const iOwe = Number(summary?.totalIOwe ?? 0);         // I owe friend (they paid for me)
  const settlements = Number(summary?.totalSettlements ?? 0);
  const net = Number(summary?.net ?? (owedToMe - iOwe - settlements));

  // Bill-wise: entry by entry, what is still pending, and settlement money not
  // applied to any entry yet. Entries settled by pre-amount links count as done.
  const openOwesMe = Number(summary?.openOwesMe ?? 0);
  const openIOwe = Number(summary?.openIOwe ?? 0);
  const onAccountReceived = Number(summary?.onAccountReceived ?? summary?.onAccount ?? 0);
  const onAccountPaid = Number(summary?.onAccountPaid ?? 0);
  const legacyDifference = Number(summary?.legacyDifference ?? 0);
  const needingReview = Number(summary?.legacyNeedingReview ?? 0);
  const openLine = {
    openOwesMe, openIOwe, onAccountReceived, onAccountPaid, legacyDifference,
    onReview: () => setReviewOpen(true),
  };

  const filtered = useMemo(() => {
    if (tab === 'all') return tags;
    if (tab === 'open') {
      return tags.filter(
        (t) =>
          ((t.direction === 'OWES_ME' || t.direction === 'I_OWE') && Number(t.pendingAmount) > 0) ||
          (t.direction === 'SETTLEMENT' && Number(t.unallocatedAmount) > 0),
      );
    }
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
      <OpenDuesLine {...openLine} name={f.name} />
      {canNetOff(summary) && (
        <GhostBtn onClick={() => setNetOffOpen(true)} style={{ marginTop: 12, position: 'relative' }}>
          Net off what you owe each other
        </GhostBtn>
      )}
    </Card>
  );

  const reviewBanner = needingReview > 0 && (
    <Card pad={14} style={{ borderColor: 'var(--ft-warn)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 200, fontSize: 13, lineHeight: 1.5 }}>
        <strong>{needingReview} older settlement{needingReview === 1 ? '' : 's'}</strong>{' '}
        {needingReview === 1 ? "doesn't" : "don't"} match {needingReview === 1 ? 'its' : 'their'} entries. They were saved before
        Fintrack recorded amounts.
      </span>
      <GhostBtn onClick={() => setReviewOpen(true)}>Review</GhostBtn>
    </Card>
  );

  const offsetsCard = offsets.length > 0 && (
    <Card pad={18}>
      <SectionTitle>Netted off</SectionTitle>
      <div style={{ display: 'grid', gap: 8 }}>
        {offsets.map((o) => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
            <span style={{ flex: 1, minWidth: 0, color: 'var(--ft-text-dim)' }}>
              {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' · '}
              {o.lines.length} entries{o.note ? ` · ${o.note}` : ''}
            </span>
            <Num size={13} weight={600}>{rupees(toMinor(o.amount))}</Num>
            <button type="button" className="friend-tag-card__apply" onClick={() => undo(() => deleteOffset(id, o.id))}>
              Undo
            </button>
          </div>
        ))}
      </div>
    </Card>
  );

  const dialogs = (
    <>
      {allocatingTag && (
        <SettlementAllocationModal
          tag={allocatingTag}
          friendName={f.name}
          onClose={() => setAllocatingTag(null)}
          onSaved={reload}
        />
      )}
      {writeOffTag && (
        <WriteOffModal friendId={id} tag={writeOffTag} onClose={() => setWriteOffTag(null)} onSaved={reload} />
      )}
      {netOffOpen && (
        <NetOffModal friendId={id} friendName={f.name} onClose={() => setNetOffOpen(false)} onSaved={reload} />
      )}
      {reviewOpen && (
        <LegacyReviewModal friendId={id} friendName={f.name} onClose={() => setReviewOpen(false)} onSaved={reload} />
      )}
    </>
  );

  const activityFeed = (
    <Card pad={18}>
      <SectionTitle>Activity</SectionTitle>
      <div className="txn-pills" style={{ marginBottom: 12 }}>
        <Pill active={tab === 'all'} onClick={() => setTab('all')}>All</Pill>
        <Pill active={tab === 'open'} onClick={() => setTab('open')}>Open</Pill>
        <Pill active={tab === 'owe'} onClick={() => setTab('owe')}>You owe</Pill>
        <Pill active={tab === 'owed'} onClick={() => setTab('owed')}>They owe</Pill>
        <Pill active={tab === 'settled'} onClick={() => setTab('settled')}>Settled</Pill>
      </div>
      {filtered.length === 0 ? (
        <p className="empty">No activity yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((t, i) => (
            <LedgerRow
              key={t.id || i}
              tag={t}
              first={i === 0}
              onAllocate={setAllocatingTag}
              onWriteOff={setWriteOffTag}
              onUndoWriteOff={(writeOffId) => undo(() => deleteWriteOff(id, writeOffId))}
            />
          ))}
        </div>
      )}
      {actionError && <p className="status" style={{ color: 'var(--ft-spend)' }}>{actionError}</p>}
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
            <OpenDuesLine {...openLine} name={f.name} />
            {canNetOff(summary) && (
              <GhostBtn onClick={() => setNetOffOpen(true)} style={{ marginTop: 12 }}>
                Net off what you owe each other
              </GhostBtn>
            )}
          </Card>
          {reviewBanner}
          {activityFeed}
          {offsetsCard}
        </main>
        {dialogs}
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

      <div className="ft-split" style={{ '--ft-split-aside': '360px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviewBanner}
          {balanceHero}
          {activityFeed}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card pad={18}>
            <SectionTitle>Balance over time</SectionTitle>
            <BalanceSparkline tags={tags} />
          </Card>
          {offsetsCard}
        </div>
      </div>
      {dialogs}
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

/**
 * How the balance splits up entry by entry: what is open on each side, money
 * on account, and whatever only older amount-less settlements explain — so
 * the pieces always add back up to the balance above.
 */
function OpenDuesLine({ openOwesMe, openIOwe, onAccountReceived, onAccountPaid, legacyDifference, onReview, name }) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'They';
  const parts = [
    openOwesMe > 0 ? `${first} has ${rupees(toMinor(openOwesMe))} open` : null,
    openIOwe > 0 ? `you have ${rupees(toMinor(openIOwe))} open` : null,
    onAccountReceived > 0 ? `${rupees(toMinor(onAccountReceived))} of ${first}'s money on account` : null,
    onAccountPaid > 0 ? `${rupees(toMinor(onAccountPaid))} of your money on account` : null,
  ].filter(Boolean);
  const legacy = toMinor(legacyDifference);
  if (parts.length === 0 && legacy === 0) return null;
  return (
    <p style={{ margin: '12px 0 0', color: 'var(--ft-text-dim)', fontSize: 12.5, lineHeight: 1.5, position: 'relative' }}>
      {parts.length > 0 && <>Entry by entry: {parts.join(' · ')}</>}
      {legacy !== 0 && (
        <>
          {parts.length > 0 && ' · '}
          <span style={{ color: 'var(--ft-warn)' }}>
            {rupees(Math.abs(legacy))} from older settlements that don&apos;t match their entries
          </span>{' '}
          <button type="button" className="friend-tag-card__apply" style={{ marginTop: 0 }} onClick={onReview}>
            Review
          </button>
        </>
      )}
    </p>
  );
}

/**
 * Where a row stands bill-wise: an entry's pending, netted or written-off
 * amounts, or a settlement's money still on account. Empty for rows settled
 * by a link from before amounts were recorded — there is nothing to add.
 */
function rowSettlementNotes(tag) {
  if (tag.settlementLegacy !== false) return [];
  const notes = [];
  const writtenOff = toMinor(tag.writtenOffAmount);
  if (tag.direction === 'SETTLEMENT') {
    if (toMinor(tag.refundedAmount) > 0) notes.push({ text: `${rupees(toMinor(tag.refundedAmount))} refund`, tone: 'dim' });
    if (writtenOff > 0) notes.push({ text: `${rupees(writtenOff)} written off`, tone: 'dim' });
    const onAccount = toMinor(tag.unallocatedAmount);
    if (onAccount > 0) notes.push({ text: `${rupees(onAccount)} on account`, tone: 'warn' });
    return notes;
  }
  if (toMinor(tag.nettedAmount) > 0) notes.push({ text: `${rupees(toMinor(tag.nettedAmount))} netted off`, tone: 'dim' });
  if (writtenOff > 0) notes.push({ text: `${rupees(writtenOff)} written off`, tone: 'dim' });
  if (tag.settlementStatus === 'partial') notes.push({ text: `${rupees(toMinor(tag.pendingAmount))} pending`, tone: 'warn' });
  if (tag.settlementStatus === 'settled') notes.push({ text: 'Settled', tone: 'ok' });
  return notes;
}

const NOTE_COLOR = { warn: 'var(--ft-warn)', ok: 'var(--ft-income)', dim: 'var(--ft-text-dim)' };

function LedgerRow({ tag, first, onAllocate, onWriteOff, onUndoWriteOff }) {
  const dir = tag.direction;
  const isSettlement = dir === 'SETTLEMENT';
  const isIOwe = dir === 'I_OWE';
  const isOwesMe = dir === 'OWES_ME';
  const color = isSettlement ? 'var(--ft-violet)'
    : isIOwe ? 'var(--ft-spend)'
    : isOwesMe ? 'var(--ft-income)'
    : 'var(--ft-text-dim)';
  const Ic = isSettlement ? IcCheck : isIOwe ? IcArrowDL : IcArrowUR;
  const label = isSettlement
    ? tag.settlementSide === 'paid' ? 'You paid back' : 'Settled'
    : isIOwe ? 'You owe' : isOwesMe ? 'They owe' : 'Nothing outstanding';
  const tx = tag.transaction || {};
  const date = tx.transactionDate
    ? new Date(tx.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const amount = Number(tag.amount || 0);
  const notes = rowSettlementNotes(tag);
  // A leftover worth closing: money on account, or the open remainder of an
  // entry that has already been partly paid.
  const leftover = tag.settlementLegacy === false
    ? isSettlement
      ? toMinor(tag.unallocatedAmount)
      : tag.settlementStatus === 'partial' ? toMinor(tag.pendingAmount) : 0
    : 0;
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
        {(tag.writeOffs || []).map((w) => (
          <div key={w.id} style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, marginTop: 2 }}>
            {rupees(toMinor(w.amount))} written off · {w.reason}{' '}
            <button
              type="button"
              onClick={() => onUndoWriteOff?.(w.id)}
              style={{ background: 'none', border: 0, padding: 0, color: 'var(--ft-accent-fg)', cursor: 'pointer', fontSize: 11.5 }}
            >
              Undo
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {isSettlement && onAllocate && (
            <button
              type="button"
              className="friend-tag-card__apply"
              onClick={() => onAllocate(tag)}
            >
              {tag.settlementLegacy === false && toMinor(tag.allocatedAmount) === 0
                ? 'Apply to entries'
                : 'Change what it settles'}
            </button>
          )}
          {leftover > 0 && onWriteOff && (
            <button type="button" className="friend-tag-card__apply" onClick={() => onWriteOff(tag)}>
              Write off {rupees(leftover)}
            </button>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Num size={14} weight={600} color={color}>{inr(amount)}</Num>
        <div style={{ color: 'var(--ft-text-dim)', fontSize: 11 }}>{label}</div>
        {notes.map((n) => (
          <div key={n.text} style={{ color: NOTE_COLOR[n.tone], fontSize: 11, marginTop: 1 }}>
            {n.text}
          </div>
        ))}
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
