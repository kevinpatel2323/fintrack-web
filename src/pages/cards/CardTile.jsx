import { Link } from 'react-router-dom';
import { Amount, Badge, Progress, Skeleton } from '../../components/ui';
import CardFace from '../../components/cards/CardFace.jsx';
import {
  bankName, cardTitle, dayLabel, dueBadge, formatPct,
} from '../../components/cards/cardFormat.js';

/** "Statements up to date · Nov 2026 in 20 days", or the statement to import. */
export function StatementStatus({ schedule, className = '' }) {
  if (!schedule?.next) return null;
  const { status, next, pending = [] } = schedule;
  if (status === 'ready') {
    return (
      <p className={`cards-statement ${className}`.trim()}>
        <Link to="/import" className="cards-statement__import">
          Import {next.label} statement
        </Link>
        {pending.length > 1 && <span> · {pending.length - 1} more waiting</span>}
      </p>
    );
  }
  const days = Number(next.daysAway);
  const when = days <= 0 ? 'due today' : `in ${days} day${days === 1 ? '' : 's'}`;
  return (
    <p className={`cards-statement ${className}`.trim()}>
      Statements up to date · {next.label} {when}
    </p>
  );
}

/** The next bill on a credit card, from /cards/dues (falls back to the card). */
function DueLine({ card, due }) {
  const owed = due ? (due.status === 'no-due' ? 0 : due.amount) : Number(card.currentDue || 0);
  const date = due?.dueDate || card.currentDueDate;
  if (!owed || !date) return <p className="cards-tile__muted">No bill due</p>;
  const badge = dueBadge(due);
  return (
    <p className="cards-tile__due">
      <span className="truncate">
        Due {dayLabel(date)} ·{' '}
        <Amount value={Number(owed)} tone={due?.status === 'overdue' ? 'due' : 'inherit'} />
      </span>
      {badge && <Badge size="sm" theme={badge.theme} label={badge.label} />}
    </p>
  );
}

/**
 * One card on the Cards page: who and which card, what's owed, how much of
 * the limit is used, and what's next (the bill and the statement). The whole
 * tile opens the card; the import link inside stays its own link.
 */
export default function CardTile({ card, schedule, due }) {
  const isCredit = card.kind === 'credit';
  const meta = [
    bankName(card.bank),
    card.nickname && card.nickname !== card.name ? card.name : null,
    card.last4 ? `••${card.last4}` : null,
  ].filter(Boolean);
  const pct = card.utilizationPct;

  return (
    <article className="cards-tile">
      {/* The face repeats the title link for pointer users; keyboard and
          screen-reader users get the one link below. */}
      <Link to={`/cards/${card.id}`} className="cards-tile__face" tabIndex={-1} aria-hidden="true">
        <CardFace card={card} />
      </Link>

      <div className="cards-tile__head">
        <div className="cards-tile__id">
          <div className="cards-tile__title">
            <Link to={`/cards/${card.id}`} className="cards-tile__link truncate">
              {cardTitle(card)}
            </Link>
            {card.isPrimary && <Badge size="sm" label="Primary" />}
          </div>
          <p className="cards-tile__meta truncate">{meta.join(' · ')}</p>
        </div>
      </div>

      {isCredit ? (
        <div className="cards-tile__body">
          <div className="cards-tile__figure">
            <span className="cards-tile__label">Outstanding</span>
            <Amount className="cards-tile__amount" value={Number(card.outstanding || 0)} tone="inherit" />
          </div>
          {pct != null ? (
            <Progress
              size="md"
              value={Math.round(pct)}
              label={`${formatPct(pct)} of limit used`}
              hint={
                <span className="cards-tile__muted-inline">
                  <Amount value={Number(card.available ?? 0)} tone="inherit" /> available
                </span>
              }
            />
          ) : (
            <p className="cards-tile__muted">No credit limit set</p>
          )}
        </div>
      ) : (
        <div className="cards-tile__body">
          <div className="cards-tile__figure">
            <span className="cards-tile__label">Spent this month</span>
            <Amount className="cards-tile__amount" value={Number(card.thisMonthSpend || 0)} tone="inherit" />
          </div>
          {card.linkedAccountNumber && (
            <p className="cards-tile__muted truncate">Linked to {card.linkedAccountNumber}</p>
          )}
        </div>
      )}

      {isCredit && (
        <div className="cards-tile__foot">
          <DueLine card={card} due={due} />
          <StatementStatus schedule={schedule} />
        </div>
      )}
    </article>
  );
}

export function CardTileSkeleton() {
  return (
    <div className="cards-tile cards-tile--skeleton" aria-hidden="true">
      <Skeleton className="cards-tile__face-skeleton" />
      <div className="cards-tile__head">
        <div className="cards-tile__id">
          <Skeleton height={14} width="55%" />
          <Skeleton height={12} width="80%" />
        </div>
      </div>
      <div className="cards-tile__body">
        <Skeleton height={20} width="40%" />
        <Skeleton height={8} width="100%" />
      </div>
      <div className="cards-tile__foot">
        <Skeleton height={12} width="60%" />
      </div>
    </div>
  );
}
