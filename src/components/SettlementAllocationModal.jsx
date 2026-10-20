import { useState } from 'react';
import Dialog from './ui/Dialog.jsx';
import SettlementAllocator from './SettlementAllocator.jsx';
import { GhostBtn, PrimaryBtn } from './ui/primitives.jsx';
import { saveSettlementAllocations } from '../services/friendsApi.js';
import {
  draftFromCurrent,
  draftToAllocations,
  rupees,
  toMinor,
} from '../utils/settlementAllocation.js';

/**
 * Re-applies an existing settlement: which entries it pays off and by how
 * much, what it nets in from the other side, and whose money on account it
 * refunds. Used for money that came in "on account" and is applied later, and
 * for correcting a split made earlier.
 *
 * A settlement linked before amounts were recorded opens empty — its old
 * links say nothing about amounts — and saving replaces those links.
 */
export default function SettlementAllocationModal({ tag, friendName, onClose, onSaved }) {
  const [draft, setDraft] = useState({});
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const amountMinor = toMinor(tag.amount);
  const name = friendName || tag.friend?.name || 'this friend';

  async function save() {
    setSaving(true);
    setError('');
    try {
      await saveSettlementAllocations(tag, draftToAllocations(draft));
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <Dialog
      overline="Apply settlement"
      title={`${rupees(amountMinor)} with ${name}`}
      onClose={onClose}
      footer={
        <>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving || !status?.valid}>
            {saving ? 'Saving…' : 'Save'}
          </PrimaryBtn>
        </>
      }
    >
      {tag.settlementLegacy && (
        <p style={{ margin: 0, padding: '9px 11px', borderRadius: 10, background: 'var(--ft-warn-soft)', fontSize: 12.5, lineHeight: 1.5 }}>
          This settlement was linked before amounts were recorded. Saving replaces those
          links with the amounts below.
        </p>
      )}
      <SettlementAllocator
        friendId={tag.friendId}
        friendName={name}
        amountMinor={amountMinor}
        settlementTagId={tag.id}
        draft={draft}
        onDraftChange={setDraft}
        onStatusChange={setStatus}
        onDuesLoaded={(dues, refundable) => setDraft(draftFromCurrent(dues, refundable))}
      />
      {error && <p style={{ margin: 0, color: 'var(--ft-spend)', fontSize: 12.5 }}>{error}</p>}
    </Dialog>
  );
}
