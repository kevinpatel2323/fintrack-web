import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, ErrorMessage, FormControl, LoadingIndicator, toast } from './ui';
import { AllocRowView, AllocTable } from './people/AllocTable.jsx';
import { createOffset, deleteOffset, fetchOpenDues } from '../services/friendsApi.js';
import { friendFirstName } from '../utils/ledgerParties.js';
import { roundCurrencyToMinor } from '../utils/splitEngine.ts';
import {
  availableMinor,
  draftToAllocations,
  fillOldestFirst,
  rupees,
  toMinor,
} from '../utils/settlementAllocation.js';
import './people/allocation.css';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

/**
 * Nets what a friend owes against what the user owes them, with no money
 * moving: both sides clear the same amount, so the balance does not change —
 * only which entries count as open. Starts filled with the most both sides can
 * clear, oldest entries first.
 */
export default function NetOffModal({ friendId, friendName, onClose, onSaved }) {
  const first = friendFirstName(friendName);
  const [dues, setDues] = useState(null);
  const [draft, setDraft] = useState({});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOpenDues(friendId)
      .then((res) => {
        const list = res?.data || [];
        setDues(list);
        const total = (side) => list.filter((d) => d.direction === side).reduce((s, d) => s + availableMinor(d), 0);
        const most = Math.min(total('OWES_ME'), total('I_OWE'));
        setDraft({
          ...fillOldestFirst(most, list, 'OWES_ME'),
          ...fillOldestFirst(most, list, 'I_OWE'),
        });
      })
      .catch((e) => setLoadError(e.message || 'Could not load the entries.'));
  }, [friendId]);

  const check = useMemo(() => {
    const rowErrors = {};
    const sums = { OWES_ME: 0, I_OWE: 0 };
    for (const due of dues || []) {
      const id = String(due.id);
      if (!(id in draft)) continue;
      const minor = roundCurrencyToMinor(String(draft[id] ?? ''), 100);
      if (minor === null || minor <= 0) rowErrors[id] = 'Enter an amount';
      else if (minor > availableMinor(due)) rowErrors[id] = `Only ${rupees(availableMinor(due))} open`;
      else sums[due.direction] += minor;
    }
    const balanced = sums.OWES_ME === sums.I_OWE && sums.OWES_ME > 0;
    return { rowErrors, sums, valid: balanced && Object.keys(rowErrors).length === 0 };
  }, [dues, draft]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const amount = check.sums.OWES_ME;
      const created = await createOffset(friendId, draftToAllocations(draft), note.trim());
      await onSaved?.();
      toast.success({
        title: `Netted off ${rupees(amount)} with ${first}`,
        action: created?.id
          ? {
              label: 'Undo',
              onClick: async () => {
                try {
                  await deleteOffset(friendId, created.id);
                  await onSaved?.();
                  toast('Net off undone');
                } catch (err) {
                  toast.error(err.message || 'Could not undo.');
                }
              },
            }
          : undefined,
      });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not net off.');
      setSaving(false);
    }
  }

  function toggle(due) {
    const id = String(due.id);
    const next = { ...draft };
    if (id in next) delete next[id];
    else next[id] = String(availableMinor(due) / 100);
    setDraft(next);
  }

  const groups = [
    { side: 'OWES_ME', label: `${first} owes you` },
    { side: 'I_OWE', label: `You owe ${first}` },
  ];
  const mismatch = check.sums.OWES_ME !== check.sums.I_OWE;

  return (
    <Dialog
      size="2xl"
      title={`Net off with ${friendName}`}
      description={`Clears what you owe ${first} against what ${first} owes you. No money moves and the balance stays the same — the netted entries just stop showing as open.`}
      onClose={onClose}
      footer={
        <>
          <span className="alloc-dialog__status" data-tone={check.valid ? undefined : 'warn'}>
            {rupees(check.sums.OWES_ME)} ↔ {rupees(check.sums.I_OWE)}
            {mismatch && ' · both sides must match'}
          </span>
          <Button label="Cancel" onClick={onClose} />
          <Button
            variant="solid"
            label={check.valid ? `Net off ${rupees(check.sums.OWES_ME)}` : 'Net off'}
            loading={saving}
            disabled={!check.valid}
            onClick={save}
          />
        </>
      }
    >
      {!dues && !loadError && <LoadingIndicator text="Loading open entries…" />}
      <ErrorMessage message={loadError} />
      {dues && (
        <div className="alloc">
          {groups.map(({ side, label }) => {
            const rows = dues.filter((d) => d.direction === side);
            if (rows.length === 0) return null;
            return (
              <section key={side} className="alloc-section">
                <div className="alloc-section__head">
                  <h4 className="alloc-section__title">
                    {label}
                    <span className="alloc-section__total">
                      {rupees(rows.reduce((s, d) => s + availableMinor(d), 0))} open
                    </span>
                  </h4>
                </div>
                <AllocTable label={label} applyLabel="Net off">
                  {rows.map((due) => {
                    const id = String(due.id);
                    const tx = due.transaction || {};
                    const rowError = check.rowErrors[id];
                    return (
                      <AllocRowView
                        key={id}
                        name={tx.upiName || tx.narration || due.note || 'Entry'}
                        meta={`${formatDate(tx.transactionDate)}${due.entryGroup?.title ? ` · ${due.entryGroup.title}` : ''}`}
                        open={rupees(availableMinor(due))}
                        selected={id in draft}
                        onToggle={() => toggle(due)}
                        value={draft[id]}
                        onChange={(value) => setDraft({ ...draft, [id]: value })}
                        after={rowError}
                        tone={rowError ? 'error' : undefined}
                        invalid={Boolean(rowError)}
                      />
                    );
                  })}
                </AllocTable>
              </section>
            );
          })}
          <FormControl
            label="Note"
            description="Optional"
            value={note}
            maxLength={500}
            placeholder="e.g. Squared up over dinner"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
      <ErrorMessage message={error} />
    </Dialog>
  );
}

// Re-exported for the friend page's "Net off" button condition.
export const canNetOff = (summary) => toMinor(summary?.openOwesMe) > 0 && toMinor(summary?.openIOwe) > 0;
