import { useEffect, useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import {
  Alert, Amount, Button, EmptyState, PageBody, PageHeader, Progress, StatCard,
} from '../components/ui';
import CardFormModal from '../components/CardFormModal.jsx';
import CardTile, { CardTileSkeleton } from './cards/CardTile.jsx';
import { fetchDues, fetchWallet } from '../services/cardsApi.js';
import { useImportSchedule } from '../hooks/useImportSchedule.js';
import { inrCompact } from '../utils/inr.js';
import { dayLabel, formatPct } from '../components/cards/cardFormat.js';
import './cards/cards-page.css';

const EMPTY_TOTALS = {
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

function DueSoonHint({ dues }) {
  const overdue = dues.filter((d) => d.status === 'overdue');
  if (overdue.length) {
    return (
      <span className="cards-stat__alert">
        {overdue.length} overdue · <Amount value={overdue.reduce((s, d) => s + Number(d.amount || 0), 0)} tone="inherit" />
      </span>
    );
  }
  const next = dues[0];
  if (!next) return 'Nothing due';
  return `Next ${dayLabel(next.dueDate)} · ${next.cardName}`;
}

function CardSection({ title, cards, scheduleByCard, dueByCard }) {
  if (!cards.length) return null;
  return (
    <section className="cards-section" aria-label={title}>
      <h2 className="cards-section__title">
        {title} <span className="cards-section__count">{cards.length}</span>
      </h2>
      <div className="cards-grid">
        {cards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            schedule={scheduleByCard.get(card.id)}
            due={dueByCard.get(card.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default function Cards() {
  const [wallet, setWallet] = useState(null);
  const [dues, setDues] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const { data: schedule } = useImportSchedule();
  const scheduleByCard = new Map((schedule?.cards ?? []).map((s) => [s.card.id, s]));

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
  const totals = wallet?.totals ?? EMPTY_TOTALS;
  const creditCards = cards.filter((c) => c.kind === 'credit');
  const debitCards = cards.filter((c) => c.kind !== 'credit');
  const activeDues = dues.filter((d) => d.status !== 'no-due');
  const dueByCard = new Map(dues.map((d) => [d.cardId, d]));
  // The bill to look at first: overdue before upcoming, then the nearest.
  const urgentDue = activeDues.find((d) => d.status === 'overdue') ?? activeDues[0];

  // First load only: a refresh after adding a card keeps the list in place.
  const initialLoading = loading && !wallet;
  const hasCredit = totals.creditCount > 0 || creditCards.length > 0;

  const onCreated = () => {
    setFormOpen(false);
    load();
  };

  const openForm = () => setFormOpen(true);

  return (
    <>
      <PageHeader
        title="Cards"
        actions={<Button variant="solid" iconLeft={Plus} label="Add card" onClick={openForm} />}
        mobileActions={<Button variant="ghost" size="md" icon={Plus} label="Add card" onClick={openForm} />}
      />
      <PageBody className="cards-page">
        {error && (
          <Alert
            theme="red"
            title="Couldn't load your cards"
            description={error}
            primaryAction={{ label: 'Try again', onClick: () => load() }}
          />
        )}

        {(initialLoading || hasCredit) && (
          <div className="cards-stats">
            <StatCard
              label="Total outstanding"
              loading={initialLoading}
              value={<Amount value={totals.totalOutstanding} tone="inherit" />}
              hint={`Across ${totals.creditCount} credit card${totals.creditCount === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Due soon"
              loading={initialLoading}
              value={<Amount value={totals.totalDue} tone={activeDues.some((d) => d.status === 'overdue') ? 'due' : 'inherit'} />}
              hint={<DueSoonHint dues={activeDues} />}
              to={urgentDue ? `/cards/${urgentDue.cardId}` : undefined}
            />
            <StatCard
              label="Available credit"
              loading={initialLoading}
              value={<Amount value={totals.totalAvailable} tone="inherit" />}
              hint={
                totals.totalLimit > 0 ? (
                  <Progress
                    className="cards-stat__progress"
                    value={totals.utilizationPct}
                    label={`${formatPct(totals.utilizationPct)} of ${inrCompact(totals.totalLimit)} used`}
                  />
                ) : (
                  'No credit limits set'
                )
              }
            />
            {totals.totalPointsValue > 0 && (
              <StatCard
                label="Rewards value"
                value={<Amount value={totals.totalPointsValue} tone="inherit" />}
                hint="Points across your credit cards"
              />
            )}
          </div>
        )}

        {initialLoading ? (
          <div className="cards-grid" aria-busy="true" aria-label="Loading cards">
            <CardTileSkeleton />
            <CardTileSkeleton />
          </div>
        ) : cards.length === 0 ? (
          !error && (
            <EmptyState
              icon={CreditCard}
              title="No cards yet"
              description="Add a card to track its spends, statements and bills."
              action={<Button iconLeft={Plus} label="Add card" onClick={openForm} />}
            />
          )
        ) : (
          // Each tile carries its own bill (due date, amount, overdue / due soon),
          // so the cards themselves are the page.
          <>
            <CardSection
              title="Credit cards"
              cards={creditCards}
              scheduleByCard={scheduleByCard}
              dueByCard={dueByCard}
            />
            <CardSection
              title="Debit cards"
              cards={debitCards}
              scheduleByCard={scheduleByCard}
              dueByCard={dueByCard}
            />
          </>
        )}
      </PageBody>

      {formOpen && <CardFormModal onClose={() => setFormOpen(false)} onSaved={onCreated} />}
    </>
  );
}
