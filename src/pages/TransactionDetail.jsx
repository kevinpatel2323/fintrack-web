import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { FriendTagCard } from '../components/FriendTagLedgerDisplay.jsx';
import Portal from '../components/Portal.jsx';
import SplitTransactionForm from '../components/SplitTransactionForm.jsx';
import {
  Card, Num, CatGlyph, Overline, HeroAmount, PrimaryBtn, GhostBtn,
} from '../components/ui/primitives.jsx';
import { IcChevL, IcClose } from '../components/ui/Icon.jsx';
import { inr } from '../utils/inr.js';
import { ledgerDirectionPhrase } from '../utils/ledgerParties.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [tx, setTx] = useState(location.state?.tx || null);
  const [tags, setTags] = useState([]);
  const [friends, setFriends] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tagsStatus, setTagsStatus] = useState('');
  const [splitApplying, setSplitApplying] = useState(false);
  const [splitSheetOpen, setSplitSheetOpen] = useState(false);
  const [categoryStatus, setCategoryStatus] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false });

  // Fetch friends and categories once
  useEffect(() => {
    fetch(`${API_BASE}/friends`).then((r) => r.json()).then((d) => setFriends(d.data || [])).catch(() => {});
    fetch(`${API_BASE}/categories`).then((r) => r.json()).then((d) => setCategories(d.data || d || [])).catch(() => {});
  }, []);

  // Fetch tags whenever id changes
  useEffect(() => { fetchTags(); }, [id]);

  async function fetchTags() {
    setTagsStatus('Loading…');
    try {
      const res = await fetch(`${API_BASE}/transactions/${id}/friends`);
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data = await res.json();
      setTags(data.data || []);
      setTagsStatus('');
    } catch (e) {
      setTagsStatus(e.message || 'Failed to load tags');
    }
  }

  function minorToApiAmount(minor) { return Number((minor / 100).toFixed(2)); }

  async function applySplit({ results, direction, note, linkedTagsByParticipant }) {
    setTagsStatus('');
    setSplitApplying(true);
    const noteTrimmed = typeof note === 'string' ? note.trim() : '';
    try {
      for (const r of results) {
        const lineDirection = r.amountMinor === 0 ? 'NOTHING_OUTSTANDING' : direction;
        const linkedIds = linkedTagsByParticipant?.[r.participantId];
        await fetch(`${API_BASE}/transactions/${id}/friends`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            friendId: Number(r.participantId),
            amount: r.amountMinor === 0 ? 0 : minorToApiAmount(r.amountMinor),
            direction: lineDirection,
            ...(noteTrimmed ? { note: noteTrimmed } : {}),
            ...(lineDirection === 'SETTLEMENT' && linkedIds?.length > 0
              ? { linkedTransactionIds: linkedIds.map(Number) } : {}),
          }),
        });
      }
      setTagsStatus('Split applied.');
      await fetchTags();
    } catch (e) {
      setTagsStatus(e.message || 'Failed to apply split.');
    } finally {
      setSplitApplying(false);
    }
  }

  function deleteTag(tagId) {
    setConfirmState({
      open: true,
      title: 'Remove tag?',
      message: 'This will remove the friend tag from this transaction.',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        setConfirmState({ open: false });
        setTagsStatus('Removing…');
        try {
          const res = await fetch(`${API_BASE}/transactions/${id}/friends/${tagId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete');
          await fetchTags();
        } catch (e) {
          setTagsStatus(e.message || 'Failed to remove tag');
        }
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  const assignCategory = useCallback(async (categoryId) => {
    setCategoryStatus('Saving…');
    try {
      if (categoryId) {
        await fetch(`${API_BASE}/transactions/${id}/category`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: Number(categoryId) }),
        });
      } else {
        await fetch(`${API_BASE}/transactions/${id}/category`, { method: 'DELETE' });
      }
      const cat = categories.find((c) => String(c.id) === String(categoryId)) || null;
      setTx((prev) => prev ? { ...prev, categoryId: cat?.id || null, category: cat } : prev);
      setCategoryStatus('');
    } catch {
      setCategoryStatus('Failed to save');
    }
  }, [id, categories]);

  if (!tx) {
    return (
      <>
        <header className="ft-mobile__header">
          <button className="ft-mobile__icon-btn" onClick={() => navigate('/transactions')} aria-label="Back">
            <IcChevL size={18} />
          </button>
          <h1 className="ft-mobile__title">Transaction</h1>
          <span style={{ width: 40 }} />
        </header>
        <main className="ft-mobile__content">
          <Card pad={24} style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 14, marginBottom: 16 }}>
              Open this transaction from the transactions list.
            </div>
            <GhostBtn onClick={() => navigate('/transactions')}>Go to Transactions</GhostBtn>
          </Card>
        </main>
      </>
    );
  }

  const withdrawal = Number(tx.withdrawal || 0);
  const deposit = Number(tx.deposit || 0);
  const isIncome = deposit > 0;
  const amount = isIncome ? deposit : withdrawal;
  const verb = isIncome ? 'You received' : 'You paid';
  const splitTotal = withdrawal > 0 ? withdrawal : deposit > 0 ? deposit : 0;

  const splitSheet = splitSheetOpen && (
    <Portal>
      <div
        className="calendar-sheet-backdrop"
        onClick={(e) => e.target === e.currentTarget && setSplitSheetOpen(false)}
      >
        <div className="calendar-sheet" role="dialog" aria-modal="true">
          <div className="calendar-sheet__header">
            <div>
              <h3>{tx.upiName || tx.narration || 'Transaction'}</h3>
              <p className="calendar-sheet__header-meta">{formatDate(tx.transactionDate)}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {withdrawal > 0 && (
                <span>Paid <strong>{inr(withdrawal)}</strong></span>
              )}
              {deposit > 0 && (
                <span>Received <strong>{inr(deposit)}</strong></span>
              )}
              <button className="ghost calendar-sheet__close" type="button" onClick={() => setSplitSheetOpen(false)} aria-label="Close">
                <IcClose size={16} />
              </button>
            </div>
          </div>
          <div className="calendar-manage-shell">
            <div className="friend-tags-panel">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <select
                  value={tx.categoryId || ''}
                  onChange={(e) => assignCategory(e.target.value)}
                  aria-label="Category"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
                {categoryStatus && <span className="status">{categoryStatus}</span>}
              </div>

              {splitTotal > 0 && (
                <SplitTransactionForm
                  key={`split-${id}`}
                  totalAmount={splitTotal}
                  participants={friends.map((f) => ({ id: String(f.id), name: f.name }))}
                  taggedFriendIds={tags.map((t) => String(t.friendId))}
                  defaultDirection="OWES_ME"
                  applying={splitApplying}
                  onApplySplit={applySplit}
                />
              )}

              {tagsStatus && <p className="status">{tagsStatus}</p>}

              <div className="friend-tags-list">
                {tags.length === 0 ? (
                  <p className="empty">No friend tags yet.</p>
                ) : (
                  tags.map((tag) => {
                    const friendName = tag.friend?.name || `Friend #${tag.friendId}`;
                    return (
                      <FriendTagCard
                        key={tag.id}
                        tag={tag}
                        transaction={tx}
                        friendName={friendName}
                        onRemove={() => deleteTag(tag.id)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );

  const settleHref = tags.length === 1
    ? `/friends/${tags[0].friendId}`
    : '/friends';

  return (
    <>
      <ConfirmDialog {...confirmState} />
      {splitSheet}

      <header className="ft-mobile__header">
        <button className="ft-mobile__icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          <IcChevL size={18} />
        </button>
        <h1 className="ft-mobile__title" style={{ margin: 0 }}>Transaction</h1>
        <span style={{ width: 40 }} />
      </header>

      <main className="ft-mobile__content">
        <Card pad={22} style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', marginBottom: 14 }}>
            <CatGlyph category={tx.category} size={56} />
          </div>
          <Overline>{verb}</Overline>
          <div style={{ fontSize: 17, color: 'var(--ft-text)', fontWeight: 500, marginTop: 4 }}>
            {tx.upiName || tx.narration || '—'}
          </div>
          <div style={{ marginTop: 12 }}>
            <HeroAmount color={isIncome ? 'var(--ft-income)' : 'var(--ft-spend)'}>
              {inr(isIncome ? amount : -amount, { sign: isIncome })}
            </HeroAmount>
          </div>
          <div style={{ marginTop: 8, color: 'var(--ft-text-dim)', fontSize: 13 }}>
            {formatDate(tx.transactionDate)}
          </div>
        </Card>

        <Card pad={16}>
          <DetailRow label="Note" value={tx.upiDescription || tx.narration || '—'} />
          <DetailRow label="Category" value={tx.category?.name || 'Uncategorised'} />
          <DetailRow label="Method" value={tx.upiBank ? `UPI · ${tx.upiBank}` : tx.isManual ? 'Manual' : 'Bank'} />
          <DetailRow label="Account" value={tx.accountNumber || '—'} mono />
          <DetailRow label="Reference" value={tx.id} mono />
        </Card>

        {tags.length > 0 && (
          <Card pad={16}>
            <Overline style={{ marginBottom: 10 }}>Split with</Overline>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tags.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'var(--ft-text)', fontSize: 14, fontWeight: 500 }}>
                      {t.friend?.name || `Friend #${t.friendId}`}
                    </div>
                    <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>
                      {ledgerDirectionPhrase(t.direction, t.friend?.name || `Friend #${t.friendId}`)}
                    </div>
                  </div>
                  <Num size={14} weight={600}>{inr(Number(t.amount || 0))}</Num>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <GhostBtn style={{ width: '100%' }} onClick={() => setSplitSheetOpen(true)}>
            Edit split
          </GhostBtn>
          <PrimaryBtn
            style={{ width: '100%' }}
            onClick={() => navigate(settleHref)}
            disabled={tags.length === 0}
          >
            Settle
          </PrimaryBtn>
        </div>

        {tagsStatus && <p className="status" style={{ textAlign: 'center', marginTop: 4 }}>{tagsStatus}</p>}
      </main>
    </>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderTop: '1px solid var(--ft-border)',
        gap: 12,
      }}
    >
      <span style={{ color: 'var(--ft-text-dim)', fontSize: 13 }}>{label}</span>
      <span
        style={{
          color: 'var(--ft-text)',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: mono ? 'var(--ft-font-mono)' : 'var(--ft-font-ui)',
          textAlign: 'right',
          maxWidth: '60%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </span>
    </div>
  );
}
