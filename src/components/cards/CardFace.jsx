import { CARD_PALETTES } from '../../services/cardsApi.js';
import { bankName } from './cardFormat.js';
import './CardFace.css';

/**
 * The card as it looks in your wallet: bank, product, chip, masked number,
 * cardholder, expiry and network, in the card's chosen colour. Fluid — it
 * fills its container's width at the real card ratio and every part scales
 * with it — so the same component serves the Cards grid, the card page and
 * the form preview.
 */
export default function CardFace({ card, className = '' }) {
  const palette = CARD_PALETTES[card?.palette] || CARD_PALETTES.obsidian;
  const isCredit = card?.kind !== 'debit';
  const last4 = card?.last4 || '••••';
  const expiry =
    card?.expiryMonth && card?.expiryYear
      ? `${String(card.expiryMonth).padStart(2, '0')}/${String(card.expiryYear).slice(-2)}`
      : 'MM/YY';
  const bank = bankName(card?.bank) || 'Bank';
  const label = `${bank} ${isCredit ? 'credit' : 'debit'} card ending ${last4}`;

  return (
    <div
      className={`card-face ${className}`.trim()}
      role="img"
      aria-label={label}
      // The palette is the user's choice per card, so it is set inline.
      style={{ '--cf-from': palette.from, '--cf-to': palette.to, '--cf-ink': palette.text }}
      data-ink={palette.text === '#0A0B0E' ? 'dark' : 'light'}
    >
      <div className="card-face__inner" aria-hidden="true">
        <div className="card-face__top">
          <div className="card-face__issuer">
            <span className="card-face__bank">{bank}</span>
            <span className="card-face__kind">{isCredit ? 'Credit card' : 'Debit card'}</span>
          </div>
          {card?.name && <span className="card-face__product">{card.name}</span>}
        </div>

        <Chip />

        <div className="card-face__number">
          <span>••••</span>
          <span>••••</span>
          <span>••••</span>
          <span>{last4}</span>
        </div>

        <div className="card-face__bottom">
          <div className="card-face__field card-face__field--holder">
            <span className="card-face__label">Cardholder</span>
            <span className="card-face__value">{card?.holder || 'Name on card'}</span>
          </div>
          <div className="card-face__field">
            <span className="card-face__label">Expires</span>
            <span className="card-face__value">{expiry}</span>
          </div>
          <NetworkMark network={card?.network} />
        </div>
      </div>
    </div>
  );
}

function Chip() {
  return (
    <svg className="card-face__chip" viewBox="0 0 40 30" focusable="false">
      <defs>
        <linearGradient id="card-face-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9D7A1" />
          <stop offset="0.5" stopColor="#C9A955" />
          <stop offset="1" stopColor="#E3CC86" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="39" height="29" rx="5" fill="url(#card-face-chip)" />
      <path
        d="M0.5 10.5h12M0.5 19.5h12M27.5 10.5h12M27.5 19.5h12M12.5 0.5v29M27.5 0.5v29M12.5 15h15"
        stroke="#8F7536"
        strokeOpacity="0.55"
        strokeWidth="0.8"
        fill="none"
      />
    </svg>
  );
}

/** Network marks in their own brand colours (they're logos, not theme). */
function NetworkMark({ network }) {
  if (network === 'mc') {
    return (
      <span className="card-face__network card-face__network--mc">
        <span className="card-face__mc card-face__mc--red" />
        <span className="card-face__mc card-face__mc--amber" />
      </span>
    );
  }
  if (network === 'visa') return <span className="card-face__network card-face__network--visa">VISA</span>;
  if (network === 'rupay') {
    return (
      <span className="card-face__network card-face__network--rupay">
        RuPay<span className="card-face__rupay-mark" />
      </span>
    );
  }
  if (network === 'amex') return <span className="card-face__network card-face__network--amex">AMEX</span>;
  if (!network) return null;
  return <span className="card-face__network">{String(network).toUpperCase()}</span>;
}
