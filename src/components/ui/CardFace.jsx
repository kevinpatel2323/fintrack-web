import { CARD_PALETTES } from '../../services/cardsApi.js';
import { IcWallet } from './Icon.jsx';

function NetworkMark({ network, color = '#fff', size = 1 }) {
  if (network === 'visa') {
    return (
      <span
        style={{
          color,
          fontFamily: 'Georgia, serif',
          fontSize: 22 * size,
          fontWeight: 900,
          letterSpacing: 1.5,
          fontStyle: 'italic',
          textShadow: '0 1px 0 rgba(0,0,0,0.25)',
        }}
      >
        VISA
      </span>
    );
  }
  if (network === 'mc') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <span
          style={{
            display: 'inline-block',
            width: 22 * size,
            height: 22 * size,
            borderRadius: '50%',
            background: '#EB001B',
          }}
        />
        <span
          style={{
            display: 'inline-block',
            width: 22 * size,
            height: 22 * size,
            borderRadius: '50%',
            background: '#F79E1B',
            marginLeft: -9 * size,
            mixBlendMode: 'multiply',
            opacity: 0.92,
          }}
        />
      </div>
    );
  }
  if (network === 'rupay') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 5,
          background:
            'linear-gradient(90deg, #00854A 0%, #00854A 50%, #F47920 50%, #F47920 100%)',
          color: '#fff',
          fontFamily: 'Arial Black, sans-serif',
          fontSize: 11 * size,
          fontWeight: 900,
          letterSpacing: 0.4,
        }}
      >
        RuPay
      </span>
    );
  }
  if (network === 'amex') {
    return (
      <span
        style={{
          padding: '5px 9px',
          background: '#006fcf',
          color: '#fff',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 900,
          fontSize: 9.5 * size,
          letterSpacing: 0.6,
          lineHeight: 1,
          borderRadius: 2,
        }}
      >
        AMERICAN
        <br />
        EXPRESS
      </span>
    );
  }
  return (
    <span style={{ color, fontFamily: 'var(--ft-font-mono)', fontSize: 11 * size, opacity: 0.9 }}>
      {String(network || '').toUpperCase()}
    </span>
  );
}

function Chip({ size = 26, color = '#D7B14C' }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 26 20" fill="none" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="24"
        height="18"
        rx="3.5"
        fill={`${color}33`}
        stroke={`${color}88`}
        strokeWidth="0.6"
      />
      <path
        d="M1 7h7M1 13h7M18 7h7M18 13h7M9 1v5M9 14v5M17 1v5M17 14v5"
        stroke={`${color}AA`}
        strokeWidth="0.6"
      />
      <rect
        x="9"
        y="6"
        width="8"
        height="8"
        rx="1.5"
        fill={`${color}22`}
        stroke={`${color}88`}
        strokeWidth="0.6"
      />
    </svg>
  );
}

export default function CardFace({ card, width = 360, height = 220, style = {}, onClick, privacy = true }) {
  const palette = CARD_PALETTES[card.palette] || CARD_PALETTES.obsidian;
  const text = palette.text;
  const dim = text === '#0A0B0E' ? 'rgba(10,11,14,0.65)' : 'rgba(255,255,255,0.72)';
  const faint = text === '#0A0B0E' ? 'rgba(10,11,14,0.45)' : 'rgba(255,255,255,0.50)';
  const scale = width / 360;
  const last4 = card.last4 || '••••';
  const numberDisplay = privacy
    ? `•••• •••• •••• ${last4}`
    : `${card.network === 'amex' ? 'XXXX XXXXXX' : 'XXXX XXXX XXXX'} ${last4}`;
  const expiry = `${String(card.expiryMonth ?? '').padStart(2, '0')}/${String(card.expiryYear ?? '').slice(-2)}`;

  return (
    <div
      onClick={onClick}
      style={{
        /* Fluid canvas: renders at exactly `width` when there is room and
           scales down proportionally when there is not, so the card can never
           outgrow a narrow grid cell. Every inner offset below is in cqw
           (1cqw = 1% of this element's width) — which is what the old
           `N * scale` px math computed, so output at the nominal width is
           byte-identical. */
        width: '100%',
        maxWidth: width,
        aspectRatio: `${width} / ${height}`,
        containerType: 'inline-size',
        borderRadius: '5cqw',
        position: 'relative',
        background: `
          radial-gradient(120% 80% at 0% 0%, ${palette.from}EE, transparent 60%),
          radial-gradient(120% 80% at 100% 100%, ${palette.accent}22, transparent 50%),
          linear-gradient(135deg, ${palette.from}, ${palette.to})`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
        color: text,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, transparent 40%, ${text}06 60%, transparent 80%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: '-11.1111cqw',
          top: '-11.1111cqw',
          width: '44.4444cqw',
          height: '44.4444cqw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.accent}26 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Top row — bank + kind */}
      <div
        style={{
          position: 'absolute',
          top: '5cqw',
          left: '5.5556cqw',
          right: '5.5556cqw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--ft-font-ui)',
              fontSize: '3.6111cqw',
              fontWeight: 700,
              letterSpacing: '-0.3px',
              color: text,
            }}
          >
            {(card.bank || '').toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: 'var(--ft-font-ui)',
              fontSize: '2.9167cqw',
              fontWeight: 500,
              color: dim,
              marginTop: 1,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
            }}
          >
            {card.kind === 'credit' ? 'Credit Card' : 'Debit Card'}
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--ft-font-ui)',
            fontSize: '3.0556cqw',
            fontWeight: 600,
            color: text,
            opacity: 0.9,
            textAlign: 'right',
            maxWidth: '38.8889cqw',
          }}
        >
          {card.name}
        </div>
      </div>

      {/* Chip */}
      {/* Chip and network mark size in px off the nominal width: their SVG
          geometry attributes do not take container units. They stay put and
          stay proportional at every size the card is actually laid out at. */}
      <div style={{ position: 'absolute', top: '17.7778cqw', left: '5.5556cqw' }}>
        <Chip size={36 * scale} color={palette.accent === '#0A0B0E' ? '#9c8744' : '#D7B14C'} />
      </div>

      {/* Number */}
      <div
        style={{
          position: 'absolute',
          bottom: '19.4444cqw',
          left: '5.5556cqw',
          right: '5.5556cqw',
          fontFamily: 'var(--ft-font-mono)',
          fontSize: '4.7222cqw',
          fontWeight: 500,
          letterSpacing: '0.5556cqw',
          color: text,
        }}
      >
        {numberDisplay}
      </div>

      {/* Holder + Expiry */}
      <div
        style={{
          position: 'absolute',
          bottom: '10cqw',
          left: '5.5556cqw',
          right: '5.5556cqw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '2.2222cqw', color: faint, textTransform: 'uppercase', letterSpacing: 1 }}>
            Cardholder
          </div>
          <div
            style={{
              fontFamily: 'var(--ft-font-ui)',
              fontSize: '3.0556cqw',
              fontWeight: 600,
              color: text,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {card.holder || 'Cardholder'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '2.2222cqw', color: faint, textTransform: 'uppercase', letterSpacing: 1 }}>
            Expires
          </div>
          <div
            style={{
              fontFamily: 'var(--ft-font-mono)',
              fontSize: '3.0556cqw',
              fontWeight: 500,
              color: text,
            }}
          >
            {expiry}
          </div>
        </div>
      </div>

      {/* Network mark */}
      <div style={{ position: 'absolute', bottom: '3.8889cqw', right: '5cqw' }}>
        <NetworkMark network={card.network} color={text} size={scale} />
      </div>

      {/* Frozen overlay */}
      {card.frozen && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(125, 185, 255, 0.18)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontFamily: 'var(--ft-font-ui)',
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            fontSize: '3.6111cqw',
          }}
        >
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(10,11,14,0.55)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            ❄ Frozen
          </span>
        </div>
      )}
    </div>
  );
}

export function CardFaceMini({ card, width = 90, height = 56, onClick, style = {} }) {
  const palette = CARD_PALETTES[card.palette] || CARD_PALETTES.obsidian;
  return (
    <div
      onClick={onClick}
      style={{
        width,
        height,
        borderRadius: 8,
        background: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
        position: 'relative',
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 7,
          fontSize: 8,
          fontWeight: 700,
          color: palette.text,
          letterSpacing: 0.4,
        }}
      >
        {(card.bank || '').toUpperCase()}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 5,
          left: 7,
          fontFamily: 'var(--ft-font-mono)',
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: 0.5,
          color: palette.text,
          opacity: 0.85,
        }}
      >
        •• {card.last4}
      </div>
      <IcWallet
        size={12}
        style={{ position: 'absolute', top: 6, right: 6, color: palette.text, opacity: 0.6 }}
      />
    </div>
  );
}
