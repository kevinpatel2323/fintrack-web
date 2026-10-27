import { Pencil } from 'lucide-react';
import { Amount, Badge, Button, Progress } from '../../components/ui';
import CardFace from '../../components/cards/CardFace.jsx';
import {
  bankName, cardTitle, dayLabel, formatPct, networkName, ordinal,
} from '../../components/cards/cardFormat.js';

function Field({ label, children }) {
  return (
    <div className="cardd-field">
      <dt className="cardd-field__label">{label}</dt>
      <dd className="cardd-field__value">{children}</dd>
    </div>
  );
}

const muted = (text) => <span className="cardd-field__empty">{text}</span>;

function Section({ title, children }) {
  return (
    <section className="cardd-side__section" aria-label={title}>
      <h3 className="cardd-side__heading">{title}</h3>
      <dl className="cardd-side__fields">{children}</dl>
    </section>
  );
}

/** "Nov 2026 · in 20 days", or the statement waiting to be imported. */
function nextStatementText(schedule) {
  if (!schedule?.next) return null;
  const { status, next } = schedule;
  if (status === 'ready') return `${next.label} · ready to import`;
  const days = Number(next.daysAway);
  return `${next.label} · ${days <= 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`;
}

/**
 * The card page's side panel (Frappe CRM style): the card's key facts as
 * label/value rows. On narrow screens it renders inside the Details tab.
 */
export default function CardDetailsPanel({ card, schedule, onEdit }) {
  const isCredit = card.kind === 'credit';
  const pct = card.utilizationPct;
  const expiry =
    card.expiryMonth && card.expiryYear ? `${String(card.expiryMonth).padStart(2, '0')}/${card.expiryYear}` : null;
  const nextStatement = isCredit ? nextStatementText(schedule) : null;

  return (
    <div className="cardd-side">
      <CardFace card={card} className="cardd-side__face" />
      <div className="cardd-side__identity">
        <div className="cardd-side__who">
          <div className="cardd-side__name">
            <span className="truncate">{cardTitle(card)}</span>
            {card.isPrimary && <Badge size="sm" label="Primary" />}
          </div>
          <div className="cardd-side__sub truncate">
            {bankName(card.bank)} · {isCredit ? 'Credit card' : 'Debit card'}
          </div>
        </div>
        {onEdit && <Button variant="ghost" icon={Pencil} label="Edit card" tooltip="Edit card" onClick={onEdit} />}
      </div>

      {isCredit ? (
        <>
          <Section title="Limit">
            <Field label="Credit limit">
              {card.creditLimit != null ? <Amount value={Number(card.creditLimit)} tone="inherit" /> : muted('Not set')}
            </Field>
            <Field label="Available">
              {card.available != null ? <Amount value={Number(card.available)} tone="inherit" /> : muted('—')}
            </Field>
            <Field label="Utilisation">
              {pct != null ? (
                <span className="cardd-field__progress">
                  <Progress value={pct} size="md" label={`${formatPct(pct)} used`} />
                </span>
              ) : (
                muted('—')
              )}
            </Field>
          </Section>

          <Section title="Billing">
            <Field label="Statement day">
              {card.statementDay ? `${ordinal(card.statementDay)} of the month` : muted('Not set')}
            </Field>
            <Field label="Due day">{card.dueDay ? `${ordinal(card.dueDay)} of the month` : muted('Not set')}</Field>
            <Field label="Next due date">
              {card.currentDue > 0 && card.currentDueDate ? dayLabel(card.currentDueDate) : muted('No bill due')}
            </Field>
            {nextStatement && <Field label="Next statement">{nextStatement}</Field>}
          </Section>
        </>
      ) : (
        <Section title="Account">
          <Field label="Linked account">{card.linkedAccountNumber || muted('Not set')}</Field>
          <Field label="Daily limit">
            {card.dailyLimit != null ? <Amount value={Number(card.dailyLimit)} tone="inherit" /> : muted('Not set')}
          </Field>
          <Field label="ATM limit">
            {card.atmLimit != null ? <Amount value={Number(card.atmLimit)} tone="inherit" /> : muted('Not set')}
          </Field>
        </Section>
      )}

      <Section title="Card">
        <Field label="Cardholder">{card.holder || muted('Not set')}</Field>
        <Field label="Network">{networkName(card.network) || muted('—')}</Field>
        <Field label="Number">
          <span className="tabular-nums">••{card.last4}</span>
        </Field>
        <Field label="Expires">{expiry ? <span className="tabular-nums">{expiry}</span> : muted('—')}</Field>
        <Field label="Bank">{bankName(card.bank) || muted('—')}</Field>
      </Section>

      {isCredit && card.pointsLabel && (
        <Section title="Rewards">
          <Field label={card.pointsLabel}>
            <span className="tabular-nums">{Number(card.pointsBalance || 0).toLocaleString('en-IN')}</span>
          </Field>
          <Field label="Value">
            <Amount value={Number(card.pointsValue || 0)} tone="inherit" />
          </Field>
        </Section>
      )}

      {card.notes && (
        <section className="cardd-side__section" aria-label="Notes">
          <h3 className="cardd-side__heading">Notes</h3>
          <p className="cardd-side__notes">{card.notes}</p>
        </section>
      )}
    </div>
  );
}
