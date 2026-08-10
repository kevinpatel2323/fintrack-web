import { categoryColor, categoryKey, friendTint, initialsOf } from '../../utils/categoryColors.js';
import { categoryIconFor } from './Icon.jsx';

// — Num: tabular mono number —
export function Num({ children, size = 16, weight = 500, color, style }) {
  return (
    <span
      style={{
        fontFamily: 'var(--ft-font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: size,
        fontWeight: weight,
        color: color || 'var(--ft-text)',
        letterSpacing: '-0.5px',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// — Avatar with initials and gradient ring —
export function Avatar({ name, initials, tint, size = 36, style }) {
  const t = tint || friendTint(name);
  const i = initials || initialsOf(name);
  const fontSz = Math.round(size * 0.4);
  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, color-mix(in srgb, ${t} 14%, transparent), color-mix(in srgb, ${t} 6%, transparent))`,
        border: `1px solid color-mix(in srgb, ${t} 40%, transparent)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: t,
        fontFamily: 'var(--ft-font-ui)',
        fontWeight: 600,
        fontSize: fontSz,
        letterSpacing: '-0.3px',
        flexShrink: 0,
        ...style,
      }}
    >
      {i}
    </div>
  );
}

// — Category glyph: tinted square — custom emoji or stroke icon —
export function CatGlyph({ category, size = 36, style }) {
  const color = categoryColor(category);
  const emoji = category?.icon?.trim();
  const key = categoryKey(category);
  const Ic = categoryIconFor(key);
  const radius = Math.max(10, Math.round(size * 0.33));
  return (
    <div
      role={emoji ? 'img' : undefined}
      aria-label={emoji ? (category?.name || 'Category') : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: emoji ? Math.round(size * 0.5) : undefined,
        lineHeight: 1,
        ...style,
      }}
    >
      {emoji ? (
        <span aria-hidden="true">{emoji}</span>
      ) : (
        <Ic size={Math.round(size * 0.5)} />
      )}
    </div>
  );
}

// — Pill / chip —
export function Pill({ active, children, onClick, tint, style, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 0,
        cursor: 'pointer',
        background: active ? (tint || 'var(--ft-accent)') : 'var(--ft-surface-2)',
        color: active ? (tint ? 'var(--ft-text-on-solid)' : 'var(--ft-text-on-accent)') : 'var(--ft-text-dim)',
        padding: '7px 13px',
        borderRadius: 999,
        fontFamily: 'var(--ft-font-ui)',
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

// — Card —
export function Card({ children, pad = 16, style, ...rest }) {
  return (
    <div
      style={{
        background: 'var(--ft-surface)',
        borderRadius: 18,
        padding: pad,
        border: '1px solid var(--ft-border)',
        boxShadow: 'var(--ft-shadow-card)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// — WidgetCard: title + subtitle + (actions or link) + body, with split paddings —
export function WidgetCard({ title, subtitle, actions, link, children, style }) {
  return (
    <div
      style={{
        background: 'var(--ft-surface)',
        border: '1px solid var(--ft-border)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: 'var(--ft-shadow-card)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 18px 10px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: 'var(--ft-text)',
              fontSize: 14.5,
              fontWeight: 600,
              letterSpacing: '-0.2px',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 12, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        {actions ? (
          <div
            style={{
              display: 'flex',
              padding: 3,
              background: 'var(--ft-surface-2)',
              borderRadius: 8,
              gap: 1,
              flexShrink: 0,
            }}
          >
            {actions.options.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => actions.onChange?.(a)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 0,
                  cursor: 'pointer',
                  background: actions.value === a ? 'var(--ft-bg)' : 'transparent',
                  color: actions.value === a ? 'var(--ft-text)' : 'var(--ft-text-dim)',
                  fontFamily: 'var(--ft-font-ui)',
                  fontSize: 11.5,
                  fontWeight: 500,
                }}
              >
                {a}
              </button>
            ))}
          </div>
        ) : link ? (
          <button
            type="button"
            onClick={link.onClick}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--ft-accent-fg)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {link.label} →
          </button>
        ) : null}
      </div>
      <div style={{ padding: '0 18px 18px' }}>{children}</div>
    </div>
  );
}

// — Primary button —
export function PrimaryBtn({ children, full = false, onClick, tint, style, disabled, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        border: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        width: full ? '100%' : 'auto',
        height: 38,
        padding: '0 18px',
        borderRadius: 14,
        background: tint || 'var(--ft-accent)',
        color: 'var(--ft-text-on-accent)',
        fontFamily: 'var(--ft-font-ui)',
        fontSize: 13.5,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        letterSpacing: '-0.2px',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

// — Ghost button —
export function GhostBtn({ children, onClick, style, disabled, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        border: '1px solid var(--ft-border-s)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        background: 'transparent',
        color: 'var(--ft-text)',
        height: 38,
        padding: '0 14px',
        borderRadius: 12,
        fontFamily: 'var(--ft-font-ui)',
        fontSize: 13.5,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

// — Stat card —
export function StatCard({ label, value, delta, accent, style }) {
  return (
    <div
      style={{
        background: accent
          ? 'linear-gradient(135deg, var(--ft-accent-soft), transparent 70%)'
          : 'var(--ft-surface)',
        border: accent ? '1px solid var(--ft-accent-hairline)' : '1px solid var(--ft-border)',
        borderRadius: 16,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          color: 'var(--ft-text-dim)',
          fontSize: 11.5,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 6 }}>
        <Num
          size={26}
          weight={600}
          color={accent ? 'var(--ft-accent)' : 'var(--ft-text)'}
          style={{ display: 'block', letterSpacing: '-0.8px' }}
        >
          {value}
        </Num>
      </div>
      {delta && (
        <div
          style={{
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: delta.up ? 'var(--ft-income)' : 'var(--ft-spend)',
            fontSize: 11.5,
            fontWeight: 500,
          }}
        >
          <span>{delta.up ? '↑' : '↓'}</span>
          <span>{delta.text}</span>
        </div>
      )}
    </div>
  );
}

// — Overline label —
export function Overline({ children, style }) {
  return (
    <div
      style={{
        color: 'var(--ft-text-dim)',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// — Section title —
export function SectionTitle({ children, action, style }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 12,
        ...style,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: '-0.2px',
          color: 'var(--ft-text)',
        }}
      >
        {children}
      </h3>
      {action}
    </div>
  );
}

// — Category chip (compact, used in tables) —
export function CategoryChip({ category, style }) {
  const color = categoryColor(category);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 6,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
        fontSize: 12,
        fontWeight: 500,
        ...style,
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }}
      />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {category?.name || 'Uncategorised'}
      </span>
    </span>
  );
}

// — Hero amount (big mono) —
export function HeroAmount({ children, color, size = 44, style }) {
  return (
    <div
      style={{
        fontFamily: 'var(--ft-font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: size,
        fontWeight: 500,
        color: color || 'var(--ft-text)',
        letterSpacing: '-2px',
        lineHeight: 1.05,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
