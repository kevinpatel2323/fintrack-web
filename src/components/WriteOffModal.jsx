import { useId, useState } from 'react';
import { Dialog, ErrorMessage, FormControl, toast } from './ui';
import { createWriteOff, deleteWriteOff } from '../services/friendsApi.js';
import { roundCurrencyToMinor } from '../utils/splitEngine.ts';
import { minorToInput, rupees, toMinor } from '../utils/settlementAllocation.js';
import './people/people.css';

/**
 * Closes a leftover with a recorded reason — Tally's round-off. On an entry it
 * forgives part of what is still pending; on a settlement it absorbs money
 * left on account. The balance moves by exactly the amount written off, and
 * the write-off can be undone from the friend page (or the toast).
 */
export default function WriteOffModal({ friendId, tag, onClose, onSaved }) {
  const formId = useId();
  const isSettlement = tag.direction === 'SETTLEMENT';
  const maxMinor = toMinor(isSettlement ? tag.unallocatedAmount : tag.pendingAmount);
  const [amount, setAmount] = useState(minorToInput(maxMinor));
  const [reason, setReason] = useState('Round-off');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const minor = roundCurrencyToMinor(amount, 100);
  const invalid = minor === null || minor <= 0 || minor > maxMinor;

  async function save(e) {
    e?.preventDefault();
    if (invalid || saving) return;
    setSaving(true);
    setError('');
    try {
      const created = await createWriteOff(friendId, { tagId: tag.id, amount: minor / 100, reason: reason.trim() });
      await onSaved?.();
      toast.success({
        title: `${rupees(minor)} written off`,
        action: created?.id
          ? {
              label: 'Undo',
              onClick: async () => {
                try {
                  await deleteWriteOff(friendId, created.id);
                  await onSaved?.();
                  toast('Write-off undone');
                } catch (err) {
                  toast.error(err.message || 'Could not undo.');
                }
              },
            }
          : undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not write off.');
      setSaving(false);
    }
  }

  const tx = tag.transaction || {};
  return (
    <Dialog
      size="sm"
      title="Write off"
      description={
        isSettlement
          ? `${rupees(maxMinor)} of this settlement is on account. Writing it off treats it as settled — the balance moves by the amount you write off.`
          : `${rupees(maxMinor)} of this entry is still open. Writing it off forgives that much — the balance moves by the amount you write off.`
      }
      onClose={onClose}
      actions={[
        { label: 'Cancel' },
        {
          label: invalid ? 'Write off' : `Write off ${rupees(minor)}`,
          variant: 'solid',
          type: 'submit',
          form: formId,
          loading: saving,
          disabled: invalid,
        },
      ]}
    >
      <form id={formId} className="people-form" onSubmit={save} noValidate>
        <p className="people-form__context truncate">{tx.upiName || tx.narration || tag.note || 'Entry'}</p>
        <FormControl
          label="Amount"
          inputMode="decimal"
          prefix={<span className="text-ink-gray-5">₹</span>}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={invalid && amount !== '' ? `Enter an amount up to ${rupees(maxMinor)}.` : undefined}
          autoFocus
        />
        <FormControl label="Reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        <ErrorMessage message={error} />
      </form>
    </Dialog>
  );
}
