import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import CcLinkModal from '../components/CcLinkModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { FriendTagCard } from '../components/FriendTagLedgerDisplay.jsx';
import Portal from '../components/Portal.jsx';
import SplitTransactionForm from '../components/SplitTransactionForm.jsx';
import TransactionTable, { sortTableRows } from '../components/TransactionTable.jsx';
import TransactionListRow from '../components/TransactionListRow.jsx';
import TransactionManageSheet from '../components/TransactionManageSheet.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import {
  Card, Num, CatGlyph, Overline, HeroAmount, GhostBtn,
} from '../components/ui/primitives.jsx';
import { IcChevL, IcClose } from '../components/ui/Icon.jsx';
import { getCcLink, unlinkCcBillPayment } from '../services/cardsApi.js';
import { useCardTransactionManager } from '../hooks/useCardTransactionManager.js';
import { cardTxnStatus, toCardTableRow } from '../utils/cardTransactionRow.jsx';
import { inr } from '../utils/inr.js';
import { ledgerDirectionPhrase } from '../utils/ledgerParties.js';
import { calendarPath } from '../utils/calendarParams.js';
import { transactionsListPath } from '../utils/transactionsListParams.js';

import { API_BASE, apiFetch } from '../services/http.js';

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
  const isMobile = useMediaQuery('(max-width: 720px)');
  const backFromDetail = () => {
    if (location.state?.calendarSearch) {
      navigate(calendarPath(location.state.calendarSearch));
      return;
    }
    const listPath = transactionsListPath(location.state?.transactionsSearch);
    if (location.state?.transactionsSearch) {
      navigate(listPath);
      return;
    }
    navigate(-1);
  };

  const [tx, setTx] = useState(location.state?.tx || null);
  const [txLoading, setTxLoading] = useState(!location.state?.tx);
  const [txError, setTxError] = useState(false);
  const [tags, setTags] = useState([]);
  const [friends, setFriends] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tagsStatus, setTagsStatus] = useState('');
  const [splitApplying, setSplitApplying] = useState(false);
  const [splitSheetOpen, setSplitSheetOpen] = useState(false);
  const [categoryStatus, setCategoryStatus] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false });
  // GET /transactions/:id carries no card-bill info, so the link is a
  // separate fetch.
  const [ccLink, setCcLink] = useState(null);
  const [ccStatus, setCcStatus] = useState('');
  const [ccModalOpen, setCcModalOpen] = useState(false);

  // Fetch friends and categories once
  useEffect(() => {
    apiFetch(`${API_BASE}/friends`).then((r) => r.json()).then((d) => setFriends(d.data || [])).catch(() => {});
    apiFetch(`${API_BASE}/categories`).then((r) => r.json()).then((d) => setCategories(d.data || d || [])).catch(() => {});
  }, []);

  // Load transaction from navigation state or API when opened by id only
  useEffect(() => {
    const stateTx = location.state?.tx;
    if (stateTx && String(stateTx.id) === String(id)) {
      setTx(stateTx);
      setTxLoading(false);
      setTxError(false);
      return;
    }

    let cancelled = false;
    setTx(null);
    setTxLoading(true);
    setTxError(false);

    apiFetch(`${API_BASE}/transactions/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load transaction');
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        setTx(body.data ?? body);
        setTxLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTxError(true);
        setTxLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, location.state?.tx]);

  // Fetch tags whenever id changes
  useEffect(() => { fetchTags(); }, [id]);

  // Fetch the credit-card bill link whenever id changes
  useEffect(() => {
    let cancelled = false;
    setCcLink(null);
    getCcLink(id)
      .then((data) => !cancelled && setCcLink(data))
      .catch(() => !cancelled && setCcLink(null));
    return () => { cancelled = true; };
  }, [id]);

  const [coveredSortCol, setCoveredSortCol] = useState('date');
  const [coveredSortDir, setCoveredSortDir] = useState('asc');
  const [coveredPage, setCoveredPage] = useState(1);
  const [coveredPageSize, setCoveredPageSize] = useState(25);

  const handleCoveredSort = useCallback((col) => {
    setCoveredSortCol((current) => {
      if (current === col) setCoveredSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else setCoveredSortDir(col === 'date' ? 'desc' : 'asc');
      return col;
    });
    setCoveredPage(1);
  }, []);

  // The covered card transactions are managed like any other ledger row.
  const cardManager = useCardTransactionManager({
    categories,
    onRowPatched: (txnId, patch) =>
      setCcLink((prev) => (prev?.coveredTransactions ? {
        ...prev,
        coveredTransactions: prev.coveredTransactions.map((t) =>
          String(t.id) === String(txnId) ? { ...t, ...patch } : t,
        ),
      } : prev)),
  });

  // Seed split counts from the inline tags the cc-link payload carries.
  useEffect(() => {
    if (ccLink?.coveredTransactions) cardManager.seedTags(ccLink.coveredTransactions, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccLink]);

  const coveredRows = sortTableRows(
    (ccLink?.coveredTransactions || []).map((t) =>
      toCardTableRow(t, cardManager.tagsByTransaction),
    ),
    coveredSortCol,
    coveredSortDir,
  );

  const cardManageRow = cardManager.manageSheetId
    ? (ccLink?.coveredTransactions || []).find(
        (t) => String(t.id) === String(cardManager.manageSheetId),
      )
    : null;

  function unlinkCc() {
    setConfirmState({
      open: true,
      title: 'Unlink card bill?',
      message:
        'The covered card transactions go back to unpaid, and this debit counts as ordinary spend again.',
      confirmLabel: 'Unlink',
      onConfirm: async () => {
        setConfirmState({ open: false });
        setCcStatus('Unlinking…');
        try {
          await unlinkCcBillPayment(id);
          setCcLink({ linked: false });
          setCcStatus('');
        } catch (e) {
          setCcStatus(e.message || 'Failed to unlink');
        }
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  async function fetchTags() {
    setTagsStatus('Loading…');
    try {
      const res = await apiFetch(`${API_BASE}/transactions/${id}/friends`);
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
        await apiFetch(`${API_BASE}/transactions/${id}/friends`, {
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
          const res = await apiFetch(`${API_BASE}/transactions/${id}/friends/${tagId}`, { method: 'DELETE' });
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
        await apiFetch(`${API_BASE}/transactions/${id}/category`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: Number(categoryId) }),
        });
      } else {
        await apiFetch(`${API_BASE}/transactions/${id}/category`, { method: 'DELETE' });
      }
      const cat = categories.find((c) => String(c.id) === String(categoryId)) || null;
      setTx((prev) => prev ? { ...prev, categoryId: cat?.id || null, category: cat } : prev);
      setCategoryStatus('');
    } catch {
      setCategoryStatus('Failed to save');
    }
  }, [id, categories]);

  if (txLoading || !tx) {
    return (
      <>
        <header className="ft-mobile__header">
          <button className="ft-mobile__icon-btn" onClick={backFromDetail} aria-label="Back">
            <IcChevL size={18} />
          </button>
          <h1 className="ft-mobile__title">Transaction</h1>
          <span style={{ width: 40 }} />
        </header>
        <main className="ft-mobile__content">
          <Card pad={24} style={{ textAlign: 'center' }}>
            {txLoading ? (
              <div style={{ color: 'var(--ft-text-dim)', fontSize: 14 }}>Loading…</div>
            ) : (
              <>
                <div style={{ color: 'var(--ft-text-dim)', fontSize: 14, marginBottom: 16 }}>
                  {txError ? 'Could not load this transaction.' : 'Transaction not found.'}
                </div>
                <GhostBtn onClick={backFromDetail}>Go to Transactions</GhostBtn>
              </>
            )}
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

  return (
    <>
      <ConfirmDialog {...confirmState} />
      {splitSheet}
      {cardManageRow && (
        <TransactionManageSheet
          {...cardManager.manageSheetPropsFor(cardManageRow)}
          metaLine={[
            ccLink?.card ? `${ccLink.card.name} ····${ccLink.card.last4}` : null,
            cardTxnStatus(cardManageRow),
          ].filter(Boolean).join(' · ')}
          friends={friends}
        />
      )}

      <header className="ft-mobile__header">
        <button className="ft-mobile__icon-btn" onClick={backFromDetail} aria-label="Back">
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

        {ccLink?.linked && (
          <Card pad={16}>
            <Overline style={{ marginBottom: 10 }}>
              Covered card transactions
            </Overline>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 12, marginBottom: 10 }}>
              {ccLink.card ? `${ccLink.card.name} · ····${ccLink.card.last4}` : 'Credit card'}
              {' · '}
              {(ccLink.coveredTransactions || []).length} item
              {(ccLink.coveredTransactions || []).length === 1 ? '' : 's'}
            </div>
            {isMobile ? (
              /* Not the day-grouped list: these all belong to one bill, and a
                 statement cycle would emit a date header per row. Each row
                 carries its own date instead. */
              coveredRows.length === 0 ? (
                <p className="empty" style={{ margin: '4px 0 0' }}>No card transactions covered.</p>
              ) : (
                coveredRows.map((row) => (
                  <TransactionListRow
                    key={row.id}
                    showDate
                    row={row}
                    categories={categories}
                    onAssignCategory={cardManager.assignCategory}
                    onOpenDetail={() => cardManager.openManage(row.id)}
                  />
                ))
              )
            ) : (
              <div
                /* Full-bleed inside the padded card; clipped so the table's
                   rounded header corners stay within the card's. */
                style={{ margin: '0 -16px', overflow: 'hidden' }}
              >
                <TransactionTable
                  rows={coveredRows}
                  columnLabels={{ description: 'Merchant', method: 'Status' }}
                  categories={categories}
                  onAssignCategory={cardManager.assignCategory}
                  onOpenManage={cardManager.openManage}
                  onOpenDetail={(row) => cardManager.openManage(row.id)}
                  sortCol={coveredSortCol}
                  sortDir={coveredSortDir}
                  onSort={handleCoveredSort}
                  page={coveredPage}
                  pageSize={coveredPageSize}
                  onPageChange={setCoveredPage}
                  onPageSizeChange={setCoveredPageSize}
                  emptyMessage="No card transactions covered."
                />
              </div>
            )}
            {Number(ccLink.remainder || 0) !== 0 && (
              <div
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 12, marginTop: 10, paddingTop: 10,
                  borderTop: '1px dashed var(--ft-border)',
                }}
              >
                <span style={{ color: 'var(--ft-text-dim)', fontSize: 12.5, fontStyle: 'italic' }}>
                  {Number(ccLink.remainder) > 0
                    ? 'Carried forward / other charges'
                    : 'Not covered by this payment'}
                </span>
                <Num size={13} weight={600} color="var(--ft-text-dim)">
                  {inr(Number(ccLink.remainder), { decimals: 2 })}
                </Num>
              </div>
            )}
            <GhostBtn style={{ width: '100%', marginTop: 12 }} onClick={unlinkCc}>
              Unlink card bill
            </GhostBtn>
          </Card>
        )}

        <GhostBtn style={{ width: '100%' }} onClick={() => setSplitSheetOpen(true)}>
          Edit split
        </GhostBtn>

        {/* Only a debit can be a card bill payment — the API enforces this too. */}
        {ccLink && !ccLink.linked && withdrawal > 0 && deposit === 0 && (
          <GhostBtn style={{ width: '100%' }} onClick={() => setCcModalOpen(true)}>
            Link to credit card bill
          </GhostBtn>
        )}

        {ccStatus && <p className="status" style={{ textAlign: 'center', marginTop: 4 }}>{ccStatus}</p>}
        {tagsStatus && <p className="status" style={{ textAlign: 'center', marginTop: 4 }}>{tagsStatus}</p>}
      </main>

      {ccModalOpen && (
        <CcLinkModal
          transaction={tx}
          onClose={() => setCcModalOpen(false)}
          onLinked={(result) => { setCcModalOpen(false); setCcLink(result); }}
        />
      )}
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
