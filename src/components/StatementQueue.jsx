import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Download, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card, ErrorMessage, Skeleton, toast } from './ui';
import { updateCard } from '../services/cardsApi.js';
import { useImportSchedule } from '../hooks/useImportSchedule.js';
import './StatementQueue.css';

/**
 * "Which card statement do I import next?" — one block per credit card.
 *
 * The API reads each card's real statement day off the imports already made,
 * lists every statement the bank has generated since the newest import, and
 * flags months skipped in between. This renders that as a headline, a strip of
 * recent months, and the bank's file name to go looking for.
 */

const MONTH_STATES = {
  imported: { text: 'imported', icon: Check },
  ready: { text: 'out, not imported yet', icon: Download },
  missing: { text: 'missing from history', icon: TriangleAlert },
  upcoming: { text: 'not out yet', icon: null },
};

const LEGEND = [
  ['imported', 'Imported'],
  ['ready', 'Waiting'],
  ['missing', 'Missing'],
  ['upcoming', 'Not out yet'],
];

function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

/** "16 Sep", with the year only when it is not the current one. */
function fmtDay(iso, todayIso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00Z`);
  const sameYear = iso.slice(0, 4) === (todayIso || '').slice(0, 4);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(d);
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** A waiting statement whose bill date has already gone by. */
function isOverdue(row, today) {
  const due = row.next?.estimatedDueDate;
  return row.status === 'ready' && Boolean(due) && due < today;
}

function StatusBadge({ row, today }) {
  if (row.status === 'ready') {
    return isOverdue(row, today) ? (
      <Badge theme="red" label="Overdue" />
    ) : (
      <Badge theme="amber" label="Ready to import" />
    );
  }
  if (row.status === 'waiting') return <Badge theme="green" label="Up to date" />;
  return <Badge label="Not tracked" />;
}

export default function StatementQueue({ className = '', style }) {
  const { data, error, loading, refresh } = useImportSchedule();
  const rows = data?.cards ?? [];

  // Nothing to schedule without a credit card.
  if (data && rows.length === 0) return null;

  return (
    <Card
      as="section"
      title="Card statements · up next"
      className={`stq ${className}`.trim()}
      style={style}
      actions={
        // With a single card its own badge already says this.
        rows.length > 1 && data.pendingCount > 0 ? (
          <Badge theme="amber" label={`${data.pendingCount} to import`} />
        ) : null
      }
    >
      {!data && loading && (
        <div className="stq__loading" aria-busy="true">
          <Skeleton height={14} width="60%" />
          <Skeleton height={12} width="85%" />
          <Skeleton height={22} width="100%" />
        </div>
      )}
      {error && <ErrorMessage message={error} />}

      {rows.length > 0 && (
        <div className="stq__list">
          {rows.map((row) => (
            <ScheduleRow key={row.card.id} row={row} today={data.today} onChanged={refresh} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ScheduleRow({ row, today, onChanged }) {
  const { card, status, next, pending, gaps, timeline } = row;

  return (
    <div className="stq-card">
      <div className="stq-card__head">
        <Link to={`/cards/${card.id}`} className="stq-card__name">
          <span className="truncate">{card.nickname || card.name}</span>
          <span className="stq-card__last4 tabular-nums">•• {card.last4}</span>
        </Link>
        <StatusBadge row={row} today={today} />
      </div>

      {status === 'unknown' ? (
        <p className="stq-note">
          Import any one statement for this card, or{' '}
          <Link to={`/cards/${card.id}`} className="stq-link">
            set its statement day
          </Link>
          , and the next one will show up here.
        </p>
      ) : (
        <>
          <div>
            <div className="stq-card__headline">{status === 'ready' ? `${next.label} statement` : 'All caught up'}</div>
            <div className="stq-card__when">
              {status === 'ready' ? (
                <ReadyLine next={next} today={today} />
              ) : (
                <>
                  {next.label} statement arrives {fmtDay(next.expectedDate, today)} · in{' '}
                  {plural(next.daysAway, 'day', 'days')}
                </>
              )}
            </div>
          </div>

          <MonthStrip timeline={timeline} highlight={status === 'ready' ? next.month : null} />

          {status === 'ready' && next.filenameHint && <FileHint stem={next.filenameHint} />}

          {pending.length > 1 && (
            <p className="stq-note">
              Then {pending.slice(1).map((p) => p.label).join(', ')}. Import them oldest first so each one can pick up
              where the last left off.
            </p>
          )}
          {row.unbilledInNext > 0 && (
            <p className="stq-note">
              {plural(row.unbilledInNext, 'entry', 'entries')} you added by hand will be matched against the{' '}
              {next.label} statement instead of being added twice.
            </p>
          )}
          {gaps.length > 0 && (
            <p className="stq-note stq-note--alert">Missing from your history: {gaps.map((g) => g.label).join(', ')}.</p>
          )}
          {row.statementDayMismatch && <DayMismatch card={card} statementDay={row.statementDay} onFixed={onChanged} />}
        </>
      )}
    </div>
  );
}

function ReadyLine({ next, today }) {
  const ago = -next.daysAway;
  const due = next.estimatedDueDate;
  return (
    <>
      Out since {fmtDay(next.expectedDate, today)}
      {ago > 0 ? ` · ${plural(ago, 'day', 'days')} ago` : ' · today'}
      {due && (
        <>
          {' · '}
          <span className={due < today ? 'stq-due is-past' : 'stq-due'}>
            bill {due < today ? 'was due' : 'due'} around {fmtDay(due, today)}
          </span>
        </>
      )}
    </>
  );
}

/** The last few months at a glance; the one to import next is outlined. */
function MonthStrip({ timeline, highlight }) {
  if (!timeline?.length) return null;
  const present = new Set(timeline.map((t) => t.state));
  return (
    <div className="stq-months">
      <ul className="stq-months__strip" aria-label="Recent statements">
        {timeline.map((t) => {
          const s = MONTH_STATES[t.state] || MONTH_STATES.upcoming;
          const Icon = s.icon;
          const isNext = t.month === highlight;
          return (
            <li
              key={t.month}
              className={`stq-month${isNext ? ' is-next' : ''}`}
              data-state={t.state}
              title={`${t.label} · ${s.text}`}
            >
              <span aria-hidden>{t.label.slice(0, 3)}</span>
              {Icon && <Icon size={12} strokeWidth={2} aria-hidden />}
              <span className="sr-only">
                {t.label}, {s.text}
                {isNext ? ', import next' : ''}
              </span>
            </li>
          );
        })}
      </ul>
      {(present.has('ready') || present.has('missing')) && (
        <div className="stq-months__legend" aria-hidden>
          {LEGEND.filter(([state]) => present.has(state)).map(([state, label]) => {
            const Icon = MONTH_STATES[state].icon;
            return (
              <span key={state} className="stq-legend" data-state={state}>
                {Icon ? <Icon size={10} strokeWidth={2} /> : <span className="stq-legend__blank" />}
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The bank's export name, so the right file is easy to find in Downloads. */
function FileHint({ stem }) {
  const [copied, setCopied] = useState(false);
  // The clipboard API needs a secure context, which a phone on the LAN or
  // Tailscale address is not, so the button only shows where it can work.
  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator.clipboard);

  async function copy() {
    try {
      await navigator.clipboard.writeText(stem);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="stq-file">
      <span className="stq-file__label">Look for</span>
      {/* Wraps rather than truncates: the month and the card number are the
          parts that identify the file, and they sit at opposite ends. */}
      <code className="stq-file__name">{stem}_….xlsx</code>
      {canCopy && (
        <Button
          variant="ghost"
          size="xs"
          icon={copied ? Check : Copy}
          label={copied ? 'Copied' : 'Copy file name'}
          tooltip={copied ? 'Copied' : 'Copy file name'}
          onClick={copy}
        />
      )}
    </div>
  );
}

/**
 * The card's saved statement day disagrees with the dates on its statements.
 * The saved day also drives the card page's current-cycle figures, so it is
 * worth a one-tap fix.
 */
function DayMismatch({ card, statementDay, onFixed }) {
  const [busy, setBusy] = useState(false);

  async function fix() {
    setBusy(true);
    try {
      await updateCard(card.id, { statementDay });
      await onFixed();
      toast.success(`Statement day set to the ${ordinal(statementDay)}`);
    } catch (e) {
      toast.error(e.message || 'Could not update the card.');
      setBusy(false);
    }
  }

  return (
    <div className="stq-mismatch">
      <p className="stq-note">
        This card is set to a statement day of the <span className="stq-strong">{ordinal(card.statementDay)}</span>,
        but its statements arrive on the <span className="stq-strong">{ordinal(statementDay)}</span>. The card page's
        cycle figures use that setting too.
      </p>
      <Button label={`Use the ${ordinal(statementDay)}`} loading={busy} onClick={fix} />
    </div>
  );
}
