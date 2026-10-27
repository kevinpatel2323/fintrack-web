import { Link } from 'react-router-dom';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { Amount, Badge, Card, EmptyState } from '../../components/ui';
import CardMark from '../../components/cards/CardMark.jsx';
import { dayLabel, dueBadge } from '../../components/cards/cardFormat.js';

function whenText(d) {
  const n = Number(d.daysAway);
  switch (d.status) {
    case 'overdue':
      return `Was due ${dayLabel(d.dueDate)} · ${-n} day${n === -1 ? '' : 's'} ago`;
    case 'due-today':
      return `Due today, ${dayLabel(d.dueDate)}`;
    case 'due-tomorrow':
      return `Due tomorrow, ${dayLabel(d.dueDate)}`;
    default:
      return `Due ${dayLabel(d.dueDate)} · in ${n} days`;
  }
}

/**
 * Bills on credit cards, soonest first (the API's order): overdue in red, due
 * within a week in amber. Each row opens its card.
 */
export default function UpcomingDues({ dues, className = '' }) {
  return (
    <Card as="section" title="Upcoming dues" padding="none" className={`cards-dues ${className}`.trim()}>
      {dues.length === 0 ? (
        <EmptyState
          size="sm"
          icon={CalendarCheck}
          title="No bills due"
          description="Bills appear here once a statement is added."
        />
      ) : (
        <ul className="cards-dues__list">
          {dues.map((d) => {
            const badge = dueBadge(d);
            const overdue = d.status === 'overdue';
            return (
              <li key={`${d.cardId}-${d.statementId ?? d.dueDate}`}>
                <Link to={`/cards/${d.cardId}`} className="cards-dues__row">
                  <CardMark palette={d.palette} size="sm" />
                  <span className="cards-dues__text">
                    <span className="cards-dues__name truncate">
                      {d.cardName} ••{d.last4}
                    </span>
                    <span className="cards-dues__meta">
                      {badge && <Badge size="sm" theme={badge.theme} label={badge.label} />}
                      <span className="truncate">{whenText(d)}</span>
                    </span>
                  </span>
                  <span className="cards-dues__figure">
                    <Amount value={Number(d.amount)} tone={overdue ? 'due' : 'inherit'} />
                    {Number(d.minDue) > 0 && (
                      <span className="cards-dues__min">
                        Min <Amount value={Number(d.minDue)} tone="inherit" />
                      </span>
                    )}
                  </span>
                  <ChevronRight className="cards-dues__chevron" size={16} strokeWidth={1.5} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
