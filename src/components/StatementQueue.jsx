import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, GhostBtn, Overline } from './ui/primitives.jsx';
import { IcCheck } from './ui/Icon.jsx';
import { updateCard } from '../services/cardsApi.js';
import { useImportSchedule } from '../hooks/useImportSchedule.js';

/**
 * "Which card statement do I import next?" — one block per credit card.
 *
 * The API reads each card's real statement day off the imports already made,
 * lists every statement the bank has generated since the newest import, and
 * flags months skipped in between. This renders that as a headline, a strip of
 * recent months, and the bank's file name to go looking for.
 */

const STATE_STYLE = {
  imported: { bg: 'var(--ft-income-soft)', fg: 'var(--ft-income)', border: 'transparent', text: 'imported' },
  missing:  { bg: 'var(--ft-spend-soft)',  fg: 'var(--ft-spend)',  border: 'transparent', text: 'missing from history' },
  ready:    { bg: 'var(--ft-warn-soft)',   fg: 'var(--ft-warn)',   border: 'transparent', text: 'out, not imported yet' },
  upcoming: { bg: 'transparent',           fg: 'var(--ft-text-faint)', border: 'var(--ft-border)', text: 'not out yet' },
};

const LEGEND = [
  ['imported', '✓', 'imported'],
  ['ready', '●', 'waiting'],
  ['missing', '!', 'missing'],
  ['upcoming', '○', 'not out yet'],
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

export default function StatementQueue({ style }) {
  const { data, error, loading, refresh } = useImportSchedule();
  const rows = data?.cards ?? [];

  // Nothing to schedule without a credit card.
  if (data && rows.length === 0) return null;

  return (
    <Card pad={18} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <Overline>Card statements · up next</Overline>
        {/* With a single card its own pill already says this. */}
        {rows.length > 1 && data.pendingCount > 0 && (
          <span style={pillStyle('var(--ft-warn-soft)', 'var(--ft-warn)')}>
            {data.pendingCount} to import
          </span>
        )}
      </div>

      {!data && loading && (
        <p style={{ margin: 0, color: 'var(--ft-text-dim)', fontSize: 12.5 }}>Checking your cards…</p>
      )}
      {error && (
        <p style={{ margin: 0, color: 'var(--ft-spend)', fontSize: 12.5 }}>{error}</p>
      )}

      {/* minmax(0, 1fr): grid items otherwise size to their content, and the
          unbroken file name would push the panel wider than its column. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
        {rows.map((row, i) => (
          <ScheduleRow
            key={row.card.id}
            row={row}
            today={data.today}
            divided={i > 0}
            onChanged={refresh}
          />
        ))}
      </div>
    </Card>
  );
}

function ScheduleRow({ row, today, divided, onChanged }) {
  const { card, status, next, pending, gaps, timeline } = row;
  const cardLabel = `${card.nickname || card.name} · •• ${card.last4}`;

  let pill;
  if (status === 'ready') {
    pill = (
      <span style={pillStyle('var(--ft-warn-soft)', 'var(--ft-warn)')}>
        {pending.length > 1 ? `${pending.length} waiting` : 'Ready to import'}
      </span>
    );
  } else if (status === 'waiting') {
    pill = <span style={pillStyle('var(--ft-income-soft)', 'var(--ft-income)')}>Up to date</span>;
  } else {
    pill = <span style={pillStyle('var(--ft-surface-2)', 'var(--ft-text-dim)')}>Not tracked</span>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, ...(divided ?{ borderTop: '1px solid var(--ft-border)', paddingTop: 14 } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Link
          to={`/cards/${card.id}`}
          style={{ color: 'var(--ft-text-dim)', fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {cardLabel}
        </Link>
        {pill}
      </div>

      {status === 'unknown' ? (
        <p style={{ margin: 0, color: 'var(--ft-text-dim)', fontSize: 12.5, lineHeight: 1.5 }}>
          Import any one statement for this card, or{' '}
          <Link to={`/cards/${card.id}`} style={{ color: 'var(--ft-accent-fg)' }}>set its statement day</Link>,
          and the next one will show up here.
        </p>
      ) : (
        <>
          <div>
            <div style={{ color: 'var(--ft-text)', fontSize: 16, fontWeight: 600, letterSpacing: '-0.2px' }}>
              {status === 'ready' ? `${next.label} statement` : 'All caught up'}
            </div>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 12.5, marginTop: 2, lineHeight: 1.5 }}>
              {status === 'ready' ? <ReadyLine next={next} today={today} /> : (
                <>
                  {next.label} statement arrives {fmtDay(next.expectedDate, today)} ·{' '}
                  in {plural(next.daysAway, 'day', 'days')}
                </>
              )}
            </div>
          </div>

          <TimelineStrip timeline={timeline} highlight={status === 'ready' ? next.month : null} />

          {status === 'ready' && next.filenameHint && <FileHint stem={next.filenameHint} />}

          {pending.length > 1 && (
            <Note>
              Then {pending.slice(1).map((p) => p.label).join(', ')}. Import them oldest
              first so each one can pick up where the last left off.
            </Note>
          )}
          {row.unbilledInNext > 0 && (
            <Note>
              {plural(row.unbilledInNext, 'entry', 'entries')} you added by hand will be
              matched against the {next.label} statement instead of being added twice.
            </Note>
          )}
          {gaps.length > 0 && (
            <Note color="var(--ft-spend)">
              Missing from your history: {gaps.map((g) => g.label).join(', ')}.
            </Note>
          )}
          {row.statementDayMismatch && (
            <DayMismatch card={card} statementDay={row.statementDay} onFixed={onChanged} />
          )}
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
          <span style={{ color: due < today ? 'var(--ft-warn)' : undefined }}>
            bill {due < today ? 'was due' : 'due'} around {fmtDay(due, today)}
          </span>
        </>
      )}
    </>
  );
}

/** The last few months at a glance; the one to import next is ringed. */
function TimelineStrip({ timeline, highlight }) {
  if (!timeline?.length) return null;
  const present = new Set(timeline.map((t) => t.state));
  return (
    <div>
      <div style={{ display: 'flex', gap: 5 }}>
        {timeline.map((t) => {
          const s = STATE_STYLE[t.state];
          const isNext = t.month === highlight;
          return (
            <div
              key={t.month}
              title={`${t.label} · ${s.text}`}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 0 5px',
                borderRadius: 8,
                textAlign: 'center',
                background: s.bg,
                color: s.fg,
                border: `1px ${t.state === 'upcoming' ? 'dashed' : 'solid'} ${s.border}`,
                boxShadow: isNext ? `0 0 0 2px ${s.fg}` : 'none',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.2 }}>{t.label.slice(0, 3)}</div>
              <div style={{ height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {t.state === 'imported' && <IcCheck size={11} />}
                {t.state === 'missing' && '!'}
                {t.state === 'ready' && '●'}
                {t.state === 'upcoming' && '○'}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 6, color: 'var(--ft-text-faint)', fontSize: 10.5 }}>
        {LEGEND.filter(([state]) => present.has(state)).map(([state, glyph, label]) => (
          <span key={state}>
            <span style={{ color: STATE_STYLE[state].fg }}>{glyph}</span> {label}
          </span>
        ))}
      </div>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, background: 'var(--ft-surface-2)' }}>
      <span style={{ color: 'var(--ft-text-faint)', fontSize: 11, flexShrink: 0 }}>Look for</span>
      {/* Wraps rather than truncates: the month and the card number are the
          parts that identify the file, and they sit at opposite ends. */}
      <code
        style={{
          flex: 1, minWidth: 0, color: 'var(--ft-text)', fontFamily: 'var(--ft-font-mono)', fontSize: 11.5,
          overflowWrap: 'anywhere', lineHeight: 1.4,
        }}
      >
        {stem}_….xlsx
      </code>
      {canCopy && (
        <GhostBtn onClick={copy} style={{ padding: '3px 8px', fontSize: 11, flexShrink: 0 }}>
          {copied ? 'Copied' : 'Copy'}
        </GhostBtn>
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
  const [error, setError] = useState('');

  async function fix() {
    setBusy(true);
    setError('');
    try {
      await updateCard(card.id, { statementDay });
      await onFixed();
    } catch (e) {
      setError(e.message || 'Could not update the card.');
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '9px 11px', borderRadius: 10, border: '1px solid var(--ft-border)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}>
      <span style={{ color: 'var(--ft-text-dim)', fontSize: 12, lineHeight: 1.5 }}>
        This card is set to a statement day of the <strong style={{ color: 'var(--ft-text)' }}>{ordinal(card.statementDay)}</strong>,
        but its statements arrive on the <strong style={{ color: 'var(--ft-text)' }}>{ordinal(statementDay)}</strong>.
        The card page's cycle figures use that setting too.
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <GhostBtn onClick={fix} disabled={busy} style={{ padding: '4px 10px', fontSize: 12 }}>
          {busy ? 'Saving…' : `Use the ${ordinal(statementDay)}`}
        </GhostBtn>
        {error && <span style={{ color: 'var(--ft-spend)', fontSize: 12 }}>{error}</span>}
      </div>
    </div>
  );
}

function Note({ children, color }) {
  return (
    <p style={{ margin: 0, color: color || 'var(--ft-text-dim)', fontSize: 12, lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

function pillStyle(bg, fg) {
  return {
    padding: '3px 9px',
    borderRadius: 999,
    background: bg,
    color: fg,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}
