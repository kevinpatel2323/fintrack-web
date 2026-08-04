import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  GhostBtn,
  HeroAmount,
  Num,
  Overline,
  Pill,
  PrimaryBtn,
  SectionTitle,
} from '../components/ui/primitives.jsx';
import {
  IcChevL,
  IcEdit,
  IcPlus,
  IcRefresh,
  IcSearch,
  IcTrash,
} from '../components/ui/Icon.jsx';
import CardFace from '../components/ui/CardFace.jsx';
import CardFormModal from '../components/CardFormModal.jsx';
import CardTransactionModal from '../components/CardTransactionModal.jsx';
import CardPaymentModal from '../components/CardPaymentModal.jsx';
import CardStatementModal from '../components/CardStatementModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import TransactionTable from '../components/TransactionTable.jsx';
import TransactionManageSheet from '../components/TransactionManageSheet.jsx';
import TransactionMobileList from '../components/TransactionMobileList.jsx';
import {
  addCardTransactionFriend,
  deleteCard,
  deleteCardPayment,
  deleteCardStatement,
  deleteCardTransaction,
  deleteCardTransactionFriend,
  fetchStatementBreakdown,
  getCard,
  listCardPayments,
  listCardStatements,
  listCardTransactionFriends,
  listCardTransactions,
  setCardControls,
  setCardFreeze,
  setCardPrimary,
  updateCardTransaction,
} from '../services/cardsApi.js';
import { cardTxnStatus, toCardTableRow } from '../utils/cardTransactionRow.jsx';
import { inr, inrCompact } from '../utils/inr.js';
import { useCardTransactionManager } from '../hooks/useCardTransactionManager.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

import { API_BASE, apiFetch } from '../services/http.js';

const STATEMENT_STATUS_COLORS = {
  open: 'var(--ft-info)',
  closed: 'var(--ft-warn)',
  paid: 'var(--ft-income)',
  overdue: 'var(--ft-spend)',
};

export default function CardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 720px)');

  const [card, setCard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [statements, setStatements] = useState([]);
  const [payments, setPayments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState('transactions');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [txnOpen, setTxnOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [stmtOpen, setStmtOpen] = useState(false);
  const [activeBreakdown, setActiveBreakdown] = useState(null);

  // ── Transactions tab: same ledger controls as the bank transactions page ──
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editTxn, setEditTxn] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, t, s, p, cats, frs] = await Promise.all([
        getCard(id),
        listCardTransactions(id),
        listCardStatements(id),
        listCardPayments(id),
        apiFetch(`${API_BASE}/categories`).then((r) => r.json()).catch(() => ({ data: [] })),
        apiFetch(`${API_BASE}/friends`).then((r) => r.json()).catch(() => ({ data: [] })),
      ]);
      const rows = t.data ?? [];
      setCard(c);
      setTransactions(rows);
      setStatements(s.data ?? []);
      setPayments(p.data ?? []);
      setCategories(cats.data ?? cats ?? []);
      setFriends(frs.data ?? frs ?? []);
      // The list payload carries each row's friend tags inline, so seed the
      // split column from it instead of fetching per row.
      seedTags(rows, { replace: true });
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load card.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  const isCredit = card?.kind === 'credit';

  const onFreezeToggle = async () => {
    if (!card) return;
    try {
      const updated = await setCardFreeze(card.id, !card.frozen);
      setCard((prev) => ({ ...prev, ...updated }));
    } catch (e) {
      setError(e.message || 'Failed to update');
    }
  };

  const onControlToggle = async (key) => {
    if (!card) return;
    try {
      const updated = await setCardControls(card.id, { [key]: !card[key] });
      setCard((prev) => ({ ...prev, ...updated }));
    } catch (e) {
      setError(e.message || 'Failed to update');
    }
  };

  const onMakePrimary = async () => {
    if (!card || card.isPrimary) return;
    try {
      await setCardPrimary(card.id);
      await loadAll();
    } catch (e) {
      setError(e.message || 'Failed to update');
    }
  };

  const onDeleteCard = async () => {
    if (!card) return;
    if (!confirm('Delete this card? Statements, transactions and payments will also be removed.')) return;
    try {
      await deleteCard(card.id);
      navigate('/cards');
    } catch (e) {
      setError(e.message || 'Failed to delete');
    }
  };

  const onDeleteTxn = (txnId) => {
    setConfirmState({
      open: true,
      title: 'Delete transaction?',
      message: 'This removes the card transaction and any friend tags on it.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmState({ open: false });
        try {
          await deleteCardTransaction(txnId);
          setManageSheetId((current) => (current === txnId ? null : current));
          await loadAll();
        } catch (e) {
          setError(e.message || 'Failed to delete');
        }
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  };

  // Managing a card transaction (category, splits, friend tags) is shared with
  // every other place a card ledger is rendered.
  const manager = useCardTransactionManager({
    categories,
    onRowPatched: (txnId, patch) =>
      setTransactions((prev) =>
        prev.map((t) => (String(t.id) === String(txnId) ? { ...t, ...patch } : t)),
      ),
  });
  const {
    tagsByTransaction, categoryStatusByTransaction, manageSheetId,
    setManageSheetId, seedTags, assignCategory, openManage, manageSheetPropsFor,
  } = manager;

  const deleteTag = useCallback((txnId, tagId) => {
    setConfirmState({
      open: true,
      title: 'Remove tag?',
      message: 'This will remove the friend tag from this transaction.',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        setConfirmState({ open: false });
        await manager.removeTag(txnId, tagId);
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }, [manager]);

  const handleSort = useCallback((col) => {
    setSortCol((currentCol) => {
      if (currentCol === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDir(col === 'date' ? 'desc' : 'asc');
      }
      return col;
    });
    setPage(1);
  }, []);

  const onDeletePayment = async (paymentId) => {
    if (!confirm('Delete this payment?')) return;
    try {
      await deleteCardPayment(paymentId);
      await loadAll();
    } catch (e) {
      setError(e.message || 'Failed to delete');
    }
  };

  const onDeleteStatement = async (stmtId) => {
    if (!confirm('Delete this statement? Transactions linked to it will be unlinked, not removed.')) return;
    try {
      await deleteCardStatement(stmtId);
      await loadAll();
    } catch (e) {
      setError(e.message || 'Failed to delete');
    }
  };

  const openBreakdown = async (statementId) => {
    try {
      const data = await fetchStatementBreakdown(statementId);
      setActiveBreakdown(data);
    } catch (e) {
      setError(e.message || 'Failed to load breakdown');
    }
  };

  const totalSpend = useMemo(
    () => transactions.reduce((s, t) => s + (t.isRefund ? -Number(t.amount) : Number(t.amount)), 0),
    [transactions],
  );

  // -- Transactions tab derived state --
  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (categoryFilter) {
      list = categoryFilter === '__none__'
        ? list.filter((t) => !t.categoryId)
        : list.filter((t) => String(t.categoryId) === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) =>
        [t.merchant, t.notes, t.category?.name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [transactions, categoryFilter, search]);

  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];
    sorted.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'date':
          va = a.txnDate || ''; vb = b.txnDate || ''; break;
        case 'description':
          va = (a.merchant || '').toLowerCase();
          vb = (b.merchant || '').toLowerCase(); break;
        case 'category':
          va = (a.category?.name || '').toLowerCase();
          vb = (b.category?.name || '').toLowerCase(); break;
        case 'method':
          va = cardTxnStatus(a); vb = cardTxnStatus(b); break;
        case 'tags':
          va = (tagsByTransaction[a.id] || []).length;
          vb = (tagsByTransaction[b.id] || []).length; break;
        case 'amount':
          // Sort on the signed ledger effect, matching the bank ledger.
          va = a.isRefund ? -Number(a.amount || 0) : Number(a.amount || 0);
          vb = b.isRefund ? -Number(b.amount || 0) : Number(b.amount || 0); break;
        default:
          return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredTransactions, sortCol, sortDir, tagsByTransaction]);

  const tableRows = useMemo(
    () => sortedTransactions.map((row) => toCardTableRow(row, tagsByTransaction)),
    [sortedTransactions, tagsByTransaction],
  );

  const manageRow = useMemo(
    () => (manageSheetId ? transactions.find((t) => t.id === manageSheetId) : null),
    [manageSheetId, transactions],
  );

  useEffect(() => {
    if (manageSheetId && !transactions.some((t) => t.id === manageSheetId)) {
      setManageSheetId(null);
    }
  }, [transactions, manageSheetId]);

  if (!card && !loading) {
    return (
      <main className={isMobile ? 'ft-mobile__content' : ''}>
        <p style={{ color: 'var(--ft-spend)' }}>{error || 'Card not found.'}</p>
        <GhostBtn onClick={() => navigate('/cards')}><IcChevL size={14} /> Back to cards</GhostBtn>
      </main>
    );
  }

  return (
    <>
      <header className={isMobile ? 'ft-mobile__header' : 'ft-page-header'}>
        {isMobile ? (
          <button
            className="ft-mobile__icon-btn"
            onClick={() => navigate('/cards')}
            aria-label="Back"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--ft-text)',
              cursor: 'pointer',
              padding: 6,
            }}
          >
            <IcChevL size={18} />
          </button>
        ) : (
          <GhostBtn onClick={() => navigate('/cards')}><IcChevL size={14} /> Cards</GhostBtn>
        )}
        {card && (
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostBtn onClick={() => setEditOpen(true)}>
              <IcEdit size={14} /> Edit
            </GhostBtn>
            <GhostBtn onClick={onDeleteCard} style={{ color: 'var(--ft-spend)' }}>
              <IcTrash size={14} /> Delete
            </GhostBtn>
          </div>
        )}
      </header>

      <main className={isMobile ? 'ft-mobile__content' : ''}>
        {error && (
          <Card pad={14} style={{ marginBottom: 18, borderColor: 'var(--ft-spend)' }}>
            <span style={{ color: 'var(--ft-spend)' }}>{error}</span>
          </Card>
        )}
        {!card ? (
          <p style={{ color: 'var(--ft-text-dim)' }}>Loading…</p>
        ) : (
          <>
            <Card pad={isMobile ? 16 : 22} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
                <CardFace card={card} width={isMobile ? 280 : 320} height={isMobile ? 170 : 200} privacy={false} />
                <div style={{ flex: 1, minWidth: 240 }}>
                  <Overline>{isCredit ? 'Outstanding' : 'Linked balance'}</Overline>
                  <HeroAmount
                    color={
                      isCredit
                        ? card.outstanding > 0
                          ? 'var(--ft-text)'
                          : 'var(--ft-text-dim)'
                        : 'var(--ft-text)'
                    }
                    style={{ marginTop: 4 }}
                  >
                    {isCredit ? inr(card.outstanding) : inr(card.thisMonthSpend)}
                  </HeroAmount>
                  <div style={{ marginTop: 12, color: 'var(--ft-text-dim)', fontSize: 13, display: 'grid', gap: 6 }}>
                    {isCredit ? (
                      <>
                        <Row label="Available">
                          <Num size={13} weight={600}>{inr(card.available ?? 0)}</Num>
                        </Row>
                        <Row label="Limit">
                          <Num size={13} weight={600}>{inr(card.creditLimit ?? 0)}</Num>
                        </Row>
                        <Row label="Utilization">
                          <Num size={13} weight={600} color="var(--ft-warn)">
                            {(card.utilizationPct ?? 0).toFixed(1)}%
                          </Num>
                        </Row>
                        <Row label="Spent this cycle">
                          <Num size={13} weight={600}>{inr(card.thisCycleSpend ?? 0)}</Num>
                        </Row>
                        {card.currentDue > 0 && (
                          <Row label={`Due ${card.currentDueDate ?? ''}`}>
                            <Num size={13} weight={600} color="var(--ft-warn)">{inr(card.currentDue)}</Num>
                          </Row>
                        )}
                        {card.pointsLabel && (
                          <Row label={card.pointsLabel}>
                            <Num size={13} weight={600}>
                              {card.pointsBalance} · {inrCompact(card.pointsValue)}
                            </Num>
                          </Row>
                        )}
                      </>
                    ) : (
                      <>
                        <Row label="Daily limit">
                          <Num size={13} weight={600}>{inr(card.dailyLimit ?? 0)}</Num>
                        </Row>
                        <Row label="ATM limit">
                          <Num size={13} weight={600}>{inr(card.atmLimit ?? 0)}</Num>
                        </Row>
                        {card.linkedAccountNumber && (
                          <Row label="Linked">
                            <span style={{ color: 'var(--ft-text)' }}>{card.linkedAccountNumber}</span>
                          </Row>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                <Toggle active={card.frozen} onClick={onFreezeToggle} accent="var(--ft-info)">
                  {card.frozen ? '❄ Frozen' : 'Freeze card'}
                </Toggle>
                <Toggle active={card.onlineEnabled} onClick={() => onControlToggle('onlineEnabled')}>
                  Online {card.onlineEnabled ? 'on' : 'off'}
                </Toggle>
                <Toggle active={card.contactlessEnabled} onClick={() => onControlToggle('contactlessEnabled')}>
                  Contactless {card.contactlessEnabled ? 'on' : 'off'}
                </Toggle>
                <Toggle active={card.internationalEnabled} onClick={() => onControlToggle('internationalEnabled')}>
                  Intl. {card.internationalEnabled ? 'on' : 'off'}
                </Toggle>
                {!card.isPrimary && (
                  <Toggle active={false} onClick={onMakePrimary} accent="var(--ft-accent)">
                    Make primary
                  </Toggle>
                )}
              </div>
            </Card>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <Pill active={tab === 'transactions'} onClick={() => setTab('transactions')}>
                Transactions · {transactions.length}
              </Pill>
              {isCredit && (
                <Pill active={tab === 'statements'} onClick={() => setTab('statements')}>
                  Statements · {statements.length}
                </Pill>
              )}
              {isCredit && (
                <Pill active={tab === 'payments'} onClick={() => setTab('payments')}>
                  Payments · {payments.length}
                </Pill>
              )}
            </div>

            {tab === 'transactions' && (
              <>
                <SectionTitle
                  action={
                    <PrimaryBtn onClick={() => setTxnOpen(true)}>
                      <IcPlus size={14} /> Add
                    </PrimaryBtn>
                  }
                >
                  Transactions {totalSpend > 0 && `· ${inr(totalSpend)}`}
                </SectionTitle>

                <Card pad={isMobile ? 12 : 14} style={{ marginBottom: 14 }}>
                  <div className="txn-toolbar">
                    <div className="txn-search txn-search--wide">
                      <IcSearch size={16} />
                      <input
                        type="search"
                        placeholder="Search by merchant, note, category…"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      />
                    </div>
                    <select
                      className="txn-toolbar__filter"
                      value={categoryFilter}
                      onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                    >
                      <option value="">All categories</option>
                      <option value="__none__">Uncategorised</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                      ))}
                    </select>
                  </div>
                </Card>

                {isMobile ? (
                  <Card pad={14}>
                    {tableRows.length === 0 ? (
                      <p className="empty">No transactions match.</p>
                    ) : (
                      <TransactionMobileList
                        rows={tableRows}
                        categories={categories}
                        onAssignCategory={assignCategory}
                        onOpenDetail={(row) => openManage(row.id)}
                      />
                    )}
                  </Card>
                ) : (
                  <Card pad={0}>
                    <TransactionTable
                      rows={tableRows}
                      columnLabels={{ description: 'Merchant', method: 'Status' }}
                      categories={categories}
                      onAssignCategory={assignCategory}
                      onOpenManage={openManage}
                      onOpenDetail={(row) => openManage(row.id)}
                      sortCol={sortCol}
                      sortDir={sortDir}
                      onSort={handleSort}
                      page={page}
                      pageSize={pageSize}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                      loading={loading}
                      emptyMessage="No transactions match."
                    />
                  </Card>
                )}
              </>
            )}

            {tab === 'statements' && isCredit && (
              <>
                <SectionTitle
                  action={
                    <PrimaryBtn onClick={() => setStmtOpen(true)}>
                      <IcPlus size={14} /> New cycle
                    </PrimaryBtn>
                  }
                >
                  Statements
                </SectionTitle>
                <StatementList
                  statements={statements}
                  onOpen={openBreakdown}
                  onDelete={onDeleteStatement}
                />
              </>
            )}

            {tab === 'payments' && isCredit && (
              <>
                <SectionTitle
                  action={
                    <PrimaryBtn onClick={() => setPayOpen(true)}>
                      <IcPlus size={14} /> Record
                    </PrimaryBtn>
                  }
                >
                  Payments
                </SectionTitle>
                <PaymentList payments={payments} onDelete={onDeletePayment} />
              </>
            )}
          </>
        )}
      </main>

      {editOpen && (
        <CardFormModal
          initial={card}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false);
            await loadAll();
          }}
        />
      )}
      {txnOpen && (
        <CardTransactionModal
          cardId={card?.id}
          categories={categories}
          statementId={card?.nextStatementId ?? null}
          onClose={() => setTxnOpen(false)}
          onSaved={async () => {
            setTxnOpen(false);
            await loadAll();
          }}
        />
      )}
      {editTxn && (
        <CardTransactionModal
          cardId={card?.id}
          categories={categories}
          initial={editTxn}
          onClose={() => setEditTxn(null)}
          onSaved={async () => {
            setEditTxn(null);
            await loadAll();
          }}
        />
      )}
      {manageRow && (
        <TransactionManageSheet
          {...manageSheetPropsFor(manageRow)}
          metaLine={[
            card ? `${card.nickname || card.issuer || 'Card'} ····${card.last4}` : null,
            cardTxnStatus(manageRow),
          ].filter(Boolean).join(' · ')}
          friends={friends}
          onDeleteTag={(tagId) => deleteTag(manageRow.id, tagId)}
          actions={
            <>
              <GhostBtn onClick={() => { setManageSheetId(null); setEditTxn(manageRow); }}>
                <IcEdit size={14} /> Edit
              </GhostBtn>
              <GhostBtn onClick={() => onDeleteTxn(manageRow.id)} style={{ color: 'var(--ft-spend)' }}>
                <IcTrash size={14} /> Delete
              </GhostBtn>
            </>
          }
        />
      )}
      <ConfirmDialog {...confirmState} />
      {payOpen && (
        <CardPaymentModal
          cardId={card?.id}
          statementId={card?.nextStatementId ?? null}
          suggestedAmount={card?.currentDue || ''}
          onClose={() => setPayOpen(false)}
          onSaved={async () => {
            setPayOpen(false);
            await loadAll();
          }}
        />
      )}
      {stmtOpen && (
        <CardStatementModal
          cardId={card?.id}
          onClose={() => setStmtOpen(false)}
          onSaved={async () => {
            setStmtOpen(false);
            await loadAll();
          }}
        />
      )}
      {activeBreakdown && (
        <StatementBreakdownPanel data={activeBreakdown} onClose={() => setActiveBreakdown(null)} />
      )}
    </>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{label}</span>
      <span style={{ color: 'var(--ft-text)' }}>{children}</span>
    </div>
  );
}

function Toggle({ active, onClick, children, accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid var(--ft-border)',
        background: active ? `${accent || 'var(--ft-accent)'}1A` : 'var(--ft-surface-2)',
        color: active ? accent || 'var(--ft-accent)' : 'var(--ft-text-dim)',
        padding: '7px 13px',
        borderRadius: 999,
        fontFamily: 'var(--ft-font-ui)',
        fontSize: 12.5,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function StatementList({ statements, onOpen, onDelete }) {
  if (statements.length === 0)
    return (
      <Card pad={20}>
        <span style={{ color: 'var(--ft-text-dim)' }}>No statements yet.</span>
      </Card>
    );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {statements.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onOpen(s.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--ft-surface)',
            border: '1px solid var(--ft-border)',
            borderRadius: 12,
            padding: '12px 14px',
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <div
            style={{
              width: 6,
              height: 38,
              borderRadius: 3,
              background: STATEMENT_STATUS_COLORS[s.status] || 'var(--ft-text-dim)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--ft-text)', fontSize: 13.5, fontWeight: 500 }}>
              {s.cycleStart} → {s.cycleEnd}
            </div>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, marginTop: 2 }}>
              Due {s.dueDate} · {s.status} · paid {inrCompact(s.paidAmount)} / {inrCompact(s.totalAmount)}
            </div>
          </div>
          <Num size={14} weight={600}>
            {inr(s.totalAmount)}
          </Num>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(s.id);
            }}
            aria-label="Delete"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--ft-text-faint)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <IcTrash size={15} />
          </button>
        </button>
      ))}
    </div>
  );
}

function PaymentList({ payments, onDelete }) {
  if (payments.length === 0)
    return (
      <Card pad={20}>
        <span style={{ color: 'var(--ft-text-dim)' }}>No payments yet.</span>
      </Card>
    );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {payments.map((p) => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--ft-surface)',
            border: '1px solid var(--ft-border)',
            borderRadius: 12,
            padding: '12px 14px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--ft-text)', fontSize: 13.5, fontWeight: 500 }}>
              {p.viaLabel || 'Manual payment'}
            </div>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, marginTop: 2 }}>{p.paidOn}</div>
          </div>
          <Num size={14} weight={600} color="var(--ft-income)">
            {inr(p.amount)}
          </Num>
          <button
            type="button"
            onClick={() => onDelete(p.id)}
            aria-label="Delete"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--ft-text-faint)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <IcTrash size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

function StatementBreakdownPanel({ data, onClose }) {
  const { statement, categories: cats, transactions } = data;
  const max = Math.max(...cats.map((c) => c.amount), 1);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8,9,12,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--ft-surface)',
          border: '1px solid var(--ft-border)',
          borderRadius: 20,
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--ft-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <Overline>Statement</Overline>
            <h2 style={{ margin: '2px 0 0', fontSize: 18 }}>
              {statement.cycleStart} → {statement.cycleEnd}
            </h2>
            <div style={{ marginTop: 4, color: 'var(--ft-text-dim)', fontSize: 12.5 }}>
              Total {inr(statement.totalAmount)} · Paid {inr(statement.paidAmount)} · Due {statement.dueDate} · {statement.status}
            </div>
          </div>
          <GhostBtn onClick={onClose}>Close</GhostBtn>
        </div>
        <div style={{ padding: 22 }}>
          <SectionTitle>By category</SectionTitle>
          {cats.length === 0 && (
            <Card pad={14}>
              <span style={{ color: 'var(--ft-text-dim)' }}>No transactions in this statement.</span>
            </Card>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cats.map((c) => (
              <div key={c.categoryId || 'uncat'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--ft-text)' }}>{c.categoryName || 'Uncategorised'}</span>
                  <Num size={13} weight={600}>{inr(c.amount)}</Num>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 6,
                    borderRadius: 3,
                    background: 'var(--ft-surface-2)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(c.amount / max) * 100}%`,
                      height: '100%',
                      background: c.categoryColor || 'var(--ft-accent)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22 }}>
            <SectionTitle>Transactions</SectionTitle>
            {transactions.length === 0 ? (
              <Card pad={14}>
                <span style={{ color: 'var(--ft-text-dim)' }}>None</span>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {transactions.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--ft-surface-2)',
                      borderRadius: 10,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--ft-text)' }}>{t.merchant}</span>
                      <span style={{ color: 'var(--ft-text-faint)', marginLeft: 8, fontSize: 11.5 }}>{t.txnDate}</span>
                    </div>
                    <Num size={13} weight={600} color={t.isRefund ? 'var(--ft-income)' : 'var(--ft-text)'}>
                      {t.isRefund ? '-' : ''}{inr(t.amount)}
                    </Num>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
