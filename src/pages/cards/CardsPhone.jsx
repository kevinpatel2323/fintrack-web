import { Link } from 'react-router-dom';
import { ChevronRight, CreditCard, Plus } from 'lucide-react';
import {
  Alert, Amount, Badge, Button, EmptyState, MobileField, MobileSection, PageBody, Progress, Skeleton,
} from '../../components/ui';
import CardFace from '../../components/cards/CardFace.jsx';
import {
  bankName, cardTitle, dayLabel, dueBadge, formatPct, nextBill, nextStatementText,
} from '../../components/cards/cardFormat.js';
import { inrCompact } from '../../utils/inr.js';
import './cards-phone.css';

/** "Next 5 Nov · Regalia", the overdue count, or nothing due. */
function dueHint(dues) {
  const overdue = dues.filter((d) => d.status === 'overdue');
  if (overdue.length) {
    return (
      <span className="cardsm-tile__alert">
        {overdue.length} overdue · <Amount value={overdue.reduce((s, d) => s + Number(d.amount || 0), 0)} tone="inherit" />
      </span>
    );
  }
  const next = dues[0];
  if (!next) return 'Nothing due';
  return `Next ${dayLabel(next.dueDate)} · ${next.cardName}`;
}

function Tile({ label, value, hint, to, wide }) {
  const body = (
    <>
      <span className="cardsm-tile__label">
        {label}
        {to && <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />}
      </span>
      <span className="cardsm-tile__value">{value}</span>
      {hint && <span className="cardsm-tile__hint">{hint}</span>}
    </>
  );
  const cls = `cardsm-tile${wide ? ' cardsm-tile--wide' : ''}`;
  return to ? (
    <Link to={to} className={cls} data-interactive="">
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Total outstanding as the hero, then what's due and what's left to spend. */
function Summary({ totals, activeDues, urgentDue }) {
  const overdue = activeDues.some((d) => d.status === 'overdue');
  const tiles = [
    <Tile
      key="due"
      label="Due soon"
      value={<Amount value={totals.totalDue} tone={overdue ? 'due' : 'inherit'} />}
      hint={dueHint(activeDues)}
      to={urgentDue ? `/cards/${urgentDue.cardId}` : undefined}
    />,
    <Tile
      key="available"
      label="Available credit"
      value={<Amount value={totals.totalAvailable} tone="inherit" />}
      hint={
        totals.totalLimit > 0 ? (
          <Progress
            className="cardsm-tile__progress"
            value={totals.utilizationPct}
            label={`${formatPct(totals.utilizationPct)} of ${inrCompact(totals.totalLimit)} used`}
          />
        ) : (
          'No credit limits set'
        )
      }
    />,
  ];
  if (totals.totalPointsValue > 0) {
    tiles.push(
      <Tile
        key="rewards"
        wide
        label="Rewards value"
        value={<Amount value={totals.totalPointsValue} tone="inherit" />}
        hint="Points across your credit cards"
      />,
    );
  }

  return (
    <section className="cardsm-summary" aria-label="Summary">
      <div className="cardsm-hero">
        <span className="cardsm-hero__label">Total outstanding</span>
        <Amount className="cardsm-hero__amount" value={totals.totalOutstanding} tone="inherit" />
        <span className="cardsm-hero__line">
          Across {totals.creditCount} credit card{totals.creditCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="cardsm-tiles">{tiles}</div>
    </section>
  );
}

/** The next bill on a card, as a field value. */
function BillValue({ card, due }) {
  const bill = nextBill(card, due);
  if (!bill) return <span className="cardsm-muted">No bill due</span>;
  const badge = dueBadge(due);
  return (
    <span className="cardsm-card__bill">
      {badge && <Badge size="sm" theme={badge.theme} label={badge.label} />}
      <span>
        {dayLabel(bill.date)} · <Amount value={bill.amount} tone={due?.status === 'overdue' ? 'due' : 'inherit'} />
      </span>
    </span>
  );
}

/** The statement side: one waiting to import, or when the next one is out. */
function StatementField({ schedule }) {
  if (!schedule?.next) return null;
  const { status, next, pending = [] } = schedule;
  if (status === 'ready') {
    return (
      <MobileField label="Statement">
        <Link to="/import" className="cardsm-card__import">
          Import {next.label}
        </Link>
        {pending.length > 1 && <span className="cardsm-muted"> · {pending.length - 1} more</span>}
      </MobileField>
    );
  }
  return <MobileField label="Next statement">{nextStatementText(schedule)}</MobileField>;
}

/**
 * One card: its face (the card's identity), who and which, what's owed and
 * how much of the limit is used, then the bill and the statement. The face
 * and the title open the card; the import link stays its own link.
 */
function PhoneCard({ card, schedule, due }) {
  const isCredit = card.kind === 'credit';
  const to = `/cards/${card.id}`;
  const meta = [
    bankName(card.bank),
    card.nickname && card.nickname !== card.name ? card.name : null,
    card.last4 ? `••${card.last4}` : null,
  ].filter(Boolean);
  const pct = card.utilizationPct;

  return (
    <article className="cardsm-card">
      {/* The face repeats the title link for touch; screen readers get the one link. */}
      <Link to={to} className="cardsm-card__face" tabIndex={-1} aria-hidden="true">
        <CardFace card={card} />
      </Link>

      <div className="cardsm-card__head">
        <div className="cardsm-card__id">
          <span className="cardsm-card__title">
            <Link to={to} className="cardsm-card__link truncate">
              {cardTitle(card)}
            </Link>
            {card.isPrimary && <Badge size="sm" label="Primary" />}
          </span>
          <span className="cardsm-card__meta truncate">{meta.join(' · ')}</span>
        </div>
        <div className="cardsm-card__figure">
          <Amount
            className="cardsm-card__amount"
            value={Number((isCredit ? card.outstanding : card.thisMonthSpend) || 0)}
            tone="inherit"
          />
          <span className="cardsm-card__label">{isCredit ? 'Outstanding' : 'This month'}</span>
        </div>
      </div>

      {isCredit ? (
        <>
          {pct != null ? (
            <Progress
              className="cardsm-card__usage"
              value={Math.round(pct)}
              label={`${formatPct(pct)} of limit used`}
              hint={
                <span>
                  <Amount value={Number(card.available ?? 0)} tone="inherit" /> available
                </span>
              }
            />
          ) : (
            <p className="cardsm-muted cardsm-card__nolimit">No credit limit set</p>
          )}
          <div role="list" className="cardsm-card__facts" aria-label="Bill and statement">
            <MobileField label="Next bill">
              <BillValue card={card} due={due} />
            </MobileField>
            <StatementField schedule={schedule} />
          </div>
        </>
      ) : (
        card.linkedAccountNumber && (
          <div role="list" className="cardsm-card__facts" aria-label="Account">
            <MobileField label="Linked to">{card.linkedAccountNumber}</MobileField>
          </div>
        )
      )}
    </article>
  );
}

function CardList({ title, cards, scheduleByCard, dueByCard }) {
  if (!cards.length) return null;
  return (
    <MobileSection
      title={
        <>
          {title} <span className="cardsm-count">{cards.length}</span>
        </>
      }
      aria-label={title}
    >
      <div className="cardsm-list">
        {cards.map((card) => (
          <PhoneCard key={card.id} card={card} schedule={scheduleByCard.get(card.id)} due={dueByCard.get(card.id)} />
        ))}
      </div>
    </MobileSection>
  );
}

function PhoneSkeleton() {
  return (
    <div className="cardsm-skeleton" aria-busy="true" aria-label="Loading cards">
      <div className="cardsm-hero">
        <Skeleton height={13} width={110} />
        <Skeleton height={30} width={140} />
        <Skeleton height={13} width={130} />
      </div>
      <div className="cardsm-tiles">
        <Skeleton className="cardsm-skeleton__tile" />
        <Skeleton className="cardsm-skeleton__tile" />
      </div>
      <Skeleton className="cardsm-skeleton__face" />
    </div>
  );
}

/**
 * The Cards tab on phones: the wallet's totals (outstanding as the hero, then
 * due soon and available credit), and each card as its face with its key
 * facts under it. State and data come from `pages/Cards.jsx`.
 */
export default function CardsPhone({
  error,
  onRetry,
  initialLoading,
  hasCredit,
  totals,
  activeDues,
  urgentDue,
  cards,
  creditCards,
  debitCards,
  scheduleByCard,
  dueByCard,
  onAdd,
}) {
  return (
    <PageBody className="cardsm">
      {error && (
        <Alert
          theme="red"
          title="Couldn't load your cards"
          description={error}
          primaryAction={{ label: 'Try again', onClick: onRetry }}
        />
      )}

      {initialLoading ? (
        <PhoneSkeleton />
      ) : cards.length === 0 ? (
        !error && (
          <EmptyState
            className="cardsm-empty"
            icon={CreditCard}
            title="No cards yet"
            description="Add a card to track its spends, statements and bills."
            action={<Button size="lg" variant="solid" iconLeft={Plus} label="Add card" onClick={onAdd} />}
          />
        )
      ) : (
        <>
          {hasCredit && <Summary totals={totals} activeDues={activeDues} urgentDue={urgentDue} />}
          <CardList title="Credit cards" cards={creditCards} scheduleByCard={scheduleByCard} dueByCard={dueByCard} />
          <CardList title="Debit cards" cards={debitCards} scheduleByCard={scheduleByCard} dueByCard={dueByCard} />
        </>
      )}
    </PageBody>
  );
}
