import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  GhostBtn,
  HeroAmount,
  Num,
  Overline,
  PrimaryBtn,
  SectionTitle,
  StatCard,
} from '../components/ui/primitives.jsx';
import { IcPlus, IcChevR, IcWallet } from '../components/ui/Icon.jsx';
import CardFace from '../components/ui/CardFace.jsx';
import CardFormModal from '../components/CardFormModal.jsx';
import { fetchDues, fetchWallet } from '../services/cardsApi.js';
import { inr, inrCompact } from '../utils/inr.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

const STATUS_COLORS = {
  overdue: 'var(--ft-spend)',
  'due-today': 'var(--ft-warn)',
  'due-tomorrow': 'var(--ft-warn)',
  upcoming: 'var(--ft-info)',
  'no-due': 'var(--ft-text-dim)',
};

const STATUS_LABELS = {
  overdue: 'Overdue',
  'due-today': 'Due today',
  'due-tomorrow': 'Due tomorrow',
  upcoming: 'Upcoming',
  'no-due': 'No due',
};

export default function Cards() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 720px)');
  const [wallet, setWallet] = useState(null);
  const [dues, setDues] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [w, d] = await Promise.all([fetchWallet(), fetchDues()]);
      setWallet(w);
      setDues(d.upcoming || []);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load cards.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cards = wallet?.cards ?? [];
  const totals = wallet?.totals ?? {
    totalLimit: 0,
    totalOutstanding: 0,
    totalAvailable: 0,
    totalDue: 0,
    utilizationPct: 0,
    totalPoints: 0,
    totalPointsValue: 0,
    creditCount: 0,
    debitCount: 0,
  };

  const onCreated = () => {
    setFormOpen(false);
    load();
  };

  return (
    <>
      <header className={isMobile ? 'ft-mobile__header' : 'ft-page-header'}>
        <div>
          <Overline>Wallet</Overline>
          <h1 style={{ margin: '4px 0 0', fontSize: isMobile ? 22 : 26, fontWeight: 700, letterSpacing: '-0.5px' }}>
            Cards
          </h1>
        </div>
        <PrimaryBtn onClick={() => setFormOpen(true)}>
          <IcPlus size={15} /> Add card
        </PrimaryBtn>
      </header>

      <main className={isMobile ? 'ft-mobile__content' : ''}>
        {error && (
          <Card pad={14} style={{ marginBottom: 18, borderColor: 'var(--ft-spend)' }}>
            <span style={{ color: 'var(--ft-spend)' }}>{error}</span>
          </Card>
        )}

        {/* Hero stats */}
        <Card pad={22} style={{ marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: -60,
              top: -60,
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'var(--ft-accent-soft)',
              filter: 'blur(60px)',
              pointerEvents: 'none',
            }}
          />
          <Overline>Total outstanding</Overline>
          <HeroAmount color={totals.totalOutstanding > 0 ? 'var(--ft-text)' : 'var(--ft-text-dim)'} style={{ marginTop: 4 }}>
            {inr(totals.totalOutstanding)}
          </HeroAmount>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', color: 'var(--ft-text-dim)', fontSize: 12.5 }}>
            <span>
              <Num size={13} weight={600} color="var(--ft-text)">{inrCompact(totals.totalAvailable)}</Num> available
            </span>
            <span>
              <Num size={13} weight={600} color="var(--ft-text)">{inrCompact(totals.totalLimit)}</Num> total limit
            </span>
            <span>
              <Num size={13} weight={600} color="var(--ft-warn)">{totals.utilizationPct.toFixed(1)}%</Num> utilization
            </span>
          </div>
          <div style={{ marginTop: 14, height: 8, borderRadius: 4, background: 'var(--ft-surface-2)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(totals.utilizationPct, 100)}%`,
                height: '100%',
                background:
                  totals.utilizationPct > 70
                    ? 'var(--ft-spend)'
                    : totals.utilizationPct > 40
                    ? 'var(--ft-warn)'
                    : 'var(--ft-income)',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </Card>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 22,
          }}
        >
          <StatCard label="Total due" value={inr(totals.totalDue)} accent={totals.totalDue > 0} />
          <StatCard label="Credit cards" value={String(totals.creditCount)} />
          <StatCard label="Debit cards" value={String(totals.debitCount)} />
          <StatCard label="Rewards value" value={inr(totals.totalPointsValue)} />
        </div>

        {/* Cards list */}
        <SectionTitle>Your cards</SectionTitle>
        {loading ? (
          <Card pad={20}>
            <span style={{ color: 'var(--ft-text-dim)' }}>Loading…</span>
          </Card>
        ) : cards.length === 0 ? (
          <Card pad={26} style={{ textAlign: 'center' }}>
            <IcWallet size={32} style={{ color: 'var(--ft-text-dim)' }} />
            <div style={{ marginTop: 10, color: 'var(--ft-text)', fontWeight: 600 }}>
              No cards yet
            </div>
            <div style={{ marginTop: 4, color: 'var(--ft-text-dim)', fontSize: 13 }}>
              Add your first card to start tracking spends and dues.
            </div>
            <PrimaryBtn onClick={() => setFormOpen(true)} style={{ marginTop: 14 }}>
              <IcPlus size={15} /> Add card
            </PrimaryBtn>
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => navigate(`/cards/${card.id}`)}
                style={{
                  background: 'var(--ft-surface)',
                  border: '1px solid var(--ft-border)',
                  borderRadius: 18,
                  padding: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <CardFace card={card} width={isMobile ? 280 : 280} height={170} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ color: 'var(--ft-text)', fontSize: 13.5, fontWeight: 600 }}>
                      {card.nickname || card.name}
                      {card.isPrimary && (
                        <span
                          style={{
                            marginLeft: 6,
                            padding: '1px 6px',
                            borderRadius: 6,
                            background: 'var(--ft-accent-soft)',
                            color: 'var(--ft-accent-fg)',
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: 0.4,
                            textTransform: 'uppercase',
                          }}
                        >
                          Primary
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, marginTop: 2 }}>
                      {card.kind === 'credit'
                        ? `Outstanding · ${inrCompact(card.outstanding)}`
                        : `Spent this month · ${inrCompact(card.thisMonthSpend)}`}
                    </div>
                  </div>
                  <IcChevR size={16} style={{ color: 'var(--ft-text-dim)' }} />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Upcoming dues */}
        {dues.length > 0 && (
          <>
            <SectionTitle>Upcoming dues</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {dues
                .filter((d) => d.status !== 'no-due')
                .map((d) => (
                  <button
                    key={`${d.cardId}-${d.statementId ?? d.dueDate}`}
                    type="button"
                    onClick={() => navigate(`/cards/${d.cardId}`)}
                    style={{
                      background: 'var(--ft-surface)',
                      border: '1px solid var(--ft-border)',
                      borderRadius: 14,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 40,
                        borderRadius: 3,
                        background: STATUS_COLORS[d.status],
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--ft-text)', fontSize: 13.5, fontWeight: 600 }}>
                        {d.cardName} · •• {d.last4}
                      </div>
                      <div style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, marginTop: 2 }}>
                        {d.dueDate} · {STATUS_LABELS[d.status]}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Num size={15} weight={600} color={d.status === 'overdue' ? 'var(--ft-spend)' : 'var(--ft-text)'}>
                        {inr(d.amount)}
                      </Num>
                      <div style={{ color: 'var(--ft-text-faint)', fontSize: 10.5, marginTop: 2 }}>
                        min {inr(d.minDue)}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </>
        )}
      </main>

      {formOpen && <CardFormModal onClose={() => setFormOpen(false)} onSaved={onCreated} />}
    </>
  );
}
