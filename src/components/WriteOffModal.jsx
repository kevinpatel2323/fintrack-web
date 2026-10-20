import { useState } from 'react';
import Dialog from './ui/Dialog.jsx';
import { GhostBtn, PrimaryBtn } from './ui/primitives.jsx';
import { createWriteOff } from '../services/friendsApi.js';
import { roundCurrencyToMinor } from '../utils/splitEngine.ts';
import { minorToInput, rupees, toMinor } from '../utils/settlementAllocation.js';

/**
 * Closes a leftover with a recorded reason — Tally's round-off. On an entry it
 * forgives part of what is still pending; on a settlement it absorbs money
 * left on account. The balance moves by exactly the amount written off, and
 * the write-off can be undone from the friend page.
 */
export default function WriteOffModal({ friendId, tag, onClose, onSaved }) {
  const isSettlement = tag.direction === 'SETTLEMENT';
  const maxMinor = toMinor(isSettlement ? tag.unallocatedAmount : tag.pendingAmount);
  const [amount, setAmount] = useState(minorToInput(maxMinor));
  const [reason, setReason] = useState('Round-off');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const minor = roundCurrencyToMinor(amount, 100);
  const invalid = minor === null || minor <= 0 || minor > maxMinor;

  async function save() {
    setSaving(true);
    setError('');
    try {
      await createWriteOff(friendId, { tagId: tag.id, amount: minor / 100, reason: reason.trim() });
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Could not write off.');
      setSaving(false);
    }
  }

  const tx = tag.transaction || {};
  return (
    <Dialog
      overline="Write off"
      title={tx.upiName || tx.narration || tag.note || 'Entry'}
      maxWidth={440}
      onClose={onClose}
      footer={
        <>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving || invalid}>
            {saving ? 'Saving…' : `Write off ${invalid ? '' : rupees(minor)}`}
          </PrimaryBtn>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--ft-text-dim)', fontSize: 12.5, lineHeight: 1.5 }}>
        {isSettlement
          ? `${rupees(maxMinor)} of this settlement is on account. Writing it off treats it as settled — the balance moves by the amount you write off.`
          : `${rupees(maxMinor)} of this entry is still open. Writing it off forgives that much — the balance moves by the amount you write off.`}
      </p>
      <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--ft-text-dim)' }}>
        Amount
        <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--ft-text-dim)' }}>
        Reason
        <input type="text" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      </label>
      {invalid && amount !== '' && (
        <p style={{ margin: 0, color: 'var(--ft-spend)', fontSize: 12.5 }}>
          Enter an amount up to {rupees(maxMinor)}.
        </p>
      )}
      {error && <p style={{ margin: 0, color: 'var(--ft-spend)', fontSize: 12.5 }}>{error}</p>}
    </Dialog>
  );
}
