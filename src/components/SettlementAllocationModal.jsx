import { useState } from 'react';
import { Alert, Dialog, ErrorMessage, toast } from './ui';
import SettlementAllocator from './SettlementAllocator.jsx';
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
      toast.success(`Settlement of ${rupees(amountMinor)} updated`);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <Dialog
      size="2xl"
      title="Apply settlement"
      description={`${rupees(amountMinor)} with ${name}. Choose the entries it settles; anything not applied stays on account.`}
      onClose={onClose}
      actions={[
        { label: 'Cancel' },
        { label: 'Save', variant: 'solid', onClick: save, loading: saving, disabled: !status?.valid },
      ]}
    >
      {tag.settlementLegacy && (
        <Alert
          theme="amber"
          title="Linked before amounts were recorded"
          description="Saving replaces those links with the amounts below."
        />
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
      <ErrorMessage message={error} />
    </Dialog>
  );
}
