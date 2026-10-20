import Portal from '../Portal.jsx';
import { Overline } from './primitives.jsx';
import { IcClose } from './Icon.jsx';

/**
 * Centered modal with a scrolling body and a fixed footer — the frame the
 * friend-ledger dialogs (apply settlement, net off, write off, review) share.
 */
export default function Dialog({ overline, title, onClose, footer, children, maxWidth = 560, label }) {
  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label || (typeof title === 'string' ? title : overline)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--ft-scrim)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 1100,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth,
            maxHeight: 'calc(100vh - 32px)',
            background: 'var(--ft-surface)',
            border: '1px solid var(--ft-border)',
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px 12px' }}>
            <div>
              {overline && <Overline>{overline}</Overline>}
              <div style={{ color: 'var(--ft-text)', fontSize: 17, fontWeight: 600, marginTop: overline ? 4 : 0 }}>
                {title}
              </div>
            </div>
            <button type="button" className="ghost" onClick={onClose} aria-label="Close" style={{ padding: 6 }}>
              <IcClose size={16} />
            </button>
          </div>

          <div style={{ padding: '0 20px 14px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            {children}
          </div>

          {footer && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '12px 20px 18px', borderTop: '1px solid var(--ft-border)' }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
