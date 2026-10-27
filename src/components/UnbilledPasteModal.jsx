import { useState } from 'react';
import Portal from './Portal.jsx';
import { GhostBtn, Overline, PrimaryBtn } from './ui/primitives.jsx';
import { IcClose } from './ui/Icon.jsx';
import { previewUnbilledPaste, saveUnbilledPaste } from '../services/cardsApi.js';
import { inr } from '../utils/inr.js';

const STATUS_TEXT = {
  new: 'New',
  existing: 'Already added',
  billed_cycle: 'Already billed',
};

/**
 * Paste the list from HDFC's Unbilled Transactions page (MyCards or
 * NetBanking). HDFC has no download for it, but the page copies cleanly.
 * Pasting again later only adds rows that are not on the card yet, and the
 * next statement import bills these rows in place instead of duplicating them.
 */
export default function UnbilledPasteModal({ card, onClose, onSaved }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const check = () => run(async () => setPreview(await previewUnbilledPaste(card.id, text)));
  const save = () => run(async () => onSaved?.(await saveUnbilledPaste(card.id, text)));

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', inset: 0, background: 'var(--ft-scrim)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      >
        <div
          style={{
            width: '100%', maxWidth: 560, maxHeight: '90vh', background: 'var(--ft-surface)',
            border: '1px solid var(--ft-border)', borderRadius: 20, display: 'flex', flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--ft-border)',
            }}
          >
            <div>
              <Overline>{card?.name} ····{card?.last4}</Overline>
              <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 600 }}>Paste unbilled transactions</h2>
            </div>
            <button
              type="button" onClick={onClose} aria-label="Close"
              style={{ background: 'transparent', border: 0, color: 'var(--ft-text-dim)', cursor: 'pointer', padding: 6 }}
            >
              <IcClose size={18} />
            </button>
          </div>

          <div style={{ padding: 20, display: 'grid', gap: 14, overflowY: 'auto' }}>
            {!preview ? (
              <>
                <div style={{ color: 'var(--ft-text-dim)', fontSize: 13 }}>
                  In HDFC MyCards or NetBanking open <b>Unbilled Transactions</b> (Settled tab), select the
                  whole page from “Total Spent” to the last row, copy, and paste it here.
                </div>
                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); setError(''); }}
                  rows={10}
                  placeholder={'Total Spent\n₹22,074.00\n…\n25 Oct 2026\nUpi-four Coffee\n₹735.00 debit icon'}
                  style={{
                    width: '100%', background: 'var(--ft-surface-2)', border: '1px solid var(--ft-border)',
                    color: 'var(--ft-text)', borderRadius: 10, padding: '10px 12px',
                    fontFamily: 'var(--ft-font-mono, monospace)', fontSize: 12.5, resize: 'vertical',
                  }}
                />
              </>
            ) : (
              <>
                <div style={{ fontSize: 13.5 }}>
                  <b>{preview.newRows}</b> new · {preview.existingRows} already on the card
                  {preview.billedCycleRows > 0 && ` · ${preview.billedCycleRows} in a cycle already billed (skipped)`}
                  {preview.totalSpent != null && (
                    <span style={{ color: 'var(--ft-text-dim)' }}> · matches Total Spent {inr(preview.totalSpent)}</span>
                  )}
                </div>
                <div style={{ border: '1px solid var(--ft-border)', borderRadius: 10, overflow: 'hidden' }}>
                  {preview.rows.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid', gridTemplateColumns: '84px 1fr auto auto', gap: 10, alignItems: 'center',
                        padding: '8px 12px', fontSize: 13, opacity: r.status === 'new' ? 1 : 0.55,
                        borderTop: i ? '1px solid var(--ft-border)' : 0,
                      }}
                    >
                      <span style={{ color: 'var(--ft-text-dim)' }}>{r.txnDate}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.merchant}</span>
                      <span style={{ color: r.isRefund ? 'var(--ft-income, inherit)' : undefined }}>
                        {r.isRefund ? '+' : ''}{inr(r.amount)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ft-text-dim)', minWidth: 86, textAlign: 'right' }}>
                        {STATUS_TEXT[r.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {error && <div style={{ color: 'var(--ft-spend)', fontSize: 13 }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {preview ? (
                <>
                  <GhostBtn onClick={() => setPreview(null)} disabled={busy}>Back</GhostBtn>
                  <PrimaryBtn onClick={save} disabled={busy || preview.newRows === 0}>
                    {busy ? 'Saving…' : preview.newRows ? `Add ${preview.newRows} transaction${preview.newRows === 1 ? '' : 's'}` : 'Nothing new'}
                  </PrimaryBtn>
                </>
              ) : (
                <>
                  <GhostBtn onClick={onClose}>Cancel</GhostBtn>
                  <PrimaryBtn onClick={check} disabled={busy || !text.trim()}>
                    {busy ? 'Checking…' : 'Preview'}
                  </PrimaryBtn>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
