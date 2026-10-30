import {
  Amount, Badge, MobileField, MobileList, MobileSection,
} from '../../components/ui';
import {
  bankName, cardTitle, dayLabel, formatPct, networkName, nextStatementText, ordinal,
} from '../../components/cards/cardFormat.js';
import LinkedAccount from '../../components/cards/LinkedAccount.jsx';

const muted = (text) => <span className="carddm-muted">{text}</span>;

function Group({ title, action, children }) {
  return (
    <MobileSection title={title} action={action} aria-label={title}>
      <MobileList variant="inset" aria-label={title}>
        {children}
      </MobileList>
    </MobileSection>
  );
}

/**
 * The card page's side panel on phones (the Details tab): the same facts as
 * `CardDetailsPanel`, as grouped label/value rows. The face is already the
 * page's hero, so it isn't repeated here.
 */
export default function CardDetailsPhone({ card, schedule, onEdit }) {
  const isCredit = card.kind === 'credit';
  const pct = card.utilizationPct;
  const expiry =
    card.expiryMonth && card.expiryYear ? `${String(card.expiryMonth).padStart(2, '0')}/${card.expiryYear}` : null;
  const nextStatement = isCredit ? nextStatementText(schedule) : null;

  return (
    <div className="carddm-details">
      {isCredit ? (
        <>
          <Group title="Limit">
            <MobileField label="Credit limit">
              {card.creditLimit != null ? <Amount value={Number(card.creditLimit)} tone="inherit" /> : muted('Not set')}
            </MobileField>
            <MobileField label="Available">
              {card.available != null ? <Amount value={Number(card.available)} tone="inherit" /> : muted('—')}
            </MobileField>
            <MobileField label="Utilisation">{pct != null ? `${formatPct(pct)} used` : muted('—')}</MobileField>
          </Group>

          <Group title="Billing">
            <MobileField label="Statement day">
              {card.statementDay ? `${ordinal(card.statementDay)} of the month` : muted('Not set')}
            </MobileField>
            <MobileField label="Due day">
              {card.dueDay ? `${ordinal(card.dueDay)} of the month` : muted('Not set')}
            </MobileField>
            <MobileField label="Next due date">
              {card.currentDue > 0 && card.currentDueDate ? dayLabel(card.currentDueDate) : muted('No bill due')}
            </MobileField>
            {nextStatement && <MobileField label="Next statement">{nextStatement}</MobileField>}
          </Group>
        </>
      ) : (
        <Group title="Account">
          <MobileField label="Linked account">
            {card.linkedAccountNumber ? <LinkedAccount value={card.linkedAccountNumber} /> : muted('Not set')}
          </MobileField>
          <MobileField label="Daily limit">
            {card.dailyLimit != null ? <Amount value={Number(card.dailyLimit)} tone="inherit" /> : muted('Not set')}
          </MobileField>
          <MobileField label="ATM limit">
            {card.atmLimit != null ? <Amount value={Number(card.atmLimit)} tone="inherit" /> : muted('Not set')}
          </MobileField>
        </Group>
      )}

      <Group title="Card" action={onEdit ? { label: 'Edit', onClick: onEdit } : undefined}>
        <MobileField label="Name">
          <span className="carddm-details__name">
            {card.isPrimary && <Badge size="sm" label="Primary" />}
            <span>{cardTitle(card)}</span>
          </span>
        </MobileField>
        <MobileField label="Type">{isCredit ? 'Credit card' : 'Debit card'}</MobileField>
        <MobileField label="Cardholder">{card.holder || muted('Not set')}</MobileField>
        <MobileField label="Network">{networkName(card.network) || muted('—')}</MobileField>
        <MobileField label="Number">
          <span className="tabular-nums">••{card.last4}</span>
        </MobileField>
        <MobileField label="Expires">{expiry ? <span className="tabular-nums">{expiry}</span> : muted('—')}</MobileField>
        <MobileField label="Bank">{bankName(card.bank) || muted('—')}</MobileField>
      </Group>

      {isCredit && card.pointsLabel && (
        <Group title="Rewards">
          <MobileField label={card.pointsLabel}>
            <span className="tabular-nums">{Number(card.pointsBalance || 0).toLocaleString('en-IN')}</span>
          </MobileField>
          <MobileField label="Value">
            <Amount value={Number(card.pointsValue || 0)} tone="inherit" />
          </MobileField>
        </Group>
      )}

      {card.notes && (
        <MobileSection title="Notes" aria-label="Notes">
          <p className="carddm-details__notes">{card.notes}</p>
        </MobileSection>
      )}
    </div>
  );
}
