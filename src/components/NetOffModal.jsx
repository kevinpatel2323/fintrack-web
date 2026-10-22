import { useEffect, useMemo, useState } from 'react';
import Dialog from './ui/Dialog.jsx';
import { GhostBtn, PrimaryBtn } from './ui/primitives.jsx';
import { createOffset, fetchOpenDues } from '../services/friendsApi.js';
import { friendFirstName } from '../utils/ledgerParties.js';
import { roundCurrencyToMinor } from '../utils/splitEngine.ts';
import {
  availableMinor,
  draftToAllocations,
  fillOldestFirst,
  rupees,
  toMinor,
} from '../utils/settlementAllocation.js';
import '../styles/settlement-allocator.css';

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
      .catch((e) => setError(e.message || 'Could not load the entries.'));
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
      await createOffset(friendId, draftToAllocations(draft), note.trim());
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Could not net off.');
      setSaving(false);
    }
  }

  const groups = [
    { side: 'OWES_ME', label: `${first} owes you` },
    { side: 'I_OWE', label: `You owe ${first}` },
  ];

  return (
    <Dialog
      overline="Net off"
      title={`Net off with ${friendName}`}
      onClose={onClose}
      footer={
        <>
          <span style={{ marginRight: 'auto', color: check.valid ? 'var(--ft-text-dim)' : 'var(--ft-warn)', fontSize: 12.5 }}>
            {rupees(check.sums.OWES_ME)} ↔ {rupees(check.sums.I_OWE)}
            {check.sums.OWES_ME !== check.sums.I_OWE && ' — both sides must match'}
          </span>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving || !check.valid}>
            {saving ? 'Saving…' : `Net off ${check.valid ? rupees(check.sums.OWES_ME) : ''}`}
          </PrimaryBtn>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--ft-text-dim)', fontSize: 12.5, lineHeight: 1.5 }}>
        Clears what you owe {first} against what {first} owes you. No money moves and the
        balance stays the same — the netted entries just stop showing as open.
      </p>
      {!dues && !error && <p className="status">Loading…</p>}
      {dues &&
        groups.map(({ side, label }) => {
          const rows = dues.filter((d) => d.direction === side);
          if (rows.length === 0) return null;
          return (
            <section key={side} className="settle-alloc__group">
              <div className="settle-alloc__group-head">
                <span>
                  {label} · {rupees(rows.reduce((s, d) => s + availableMinor(d), 0))} open
                </span>
              </div>
              {rows.map((due) => {
                const id = String(due.id);
                const selected = id in draft;
                const tx = due.transaction || {};
                const rowError = check.rowErrors[id];
                return (
                  <div key={id} className={`settle-alloc__row${selected ? ' settle-alloc__row--selected' : ''}${rowError ? ' settle-alloc__row--error' : ''}`}>
                    <label className="settle-alloc__pick">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const next = { ...draft };
                          if (selected) delete next[id];
                          else next[id] = String(availableMinor(due) / 100);
                          setDraft(next);
                        }}
                      />
                      <span className="settle-alloc__what">
                        <span className="settle-alloc__name">{tx.upiName || tx.narration || due.note || 'Entry'}</span>
                        <span className="settle-alloc__meta">
                          {formatDate(tx.transactionDate)} · {rupees(availableMinor(due))} open
                          {due.entryGroup?.title ? ` · ${due.entryGroup.title}` : ''}
                        </span>
                      </span>
                    </label>
                    {selected && (
                      <div className="settle-alloc__apply">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="settle-alloc__amount"
                          value={draft[id]}
                          onChange={(e) => setDraft({ ...draft, [id]: e.target.value })}
                        />
                        {rowError && <span className="settle-alloc__after settle-alloc__after--error">{rowError}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--ft-text-dim)' }}>
        Note (optional)
        <input type="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Squared up over dinner" />
      </label>
      {error && <p style={{ margin: 0, color: 'var(--ft-spend)', fontSize: 12.5 }}>{error}</p>}
    </Dialog>
  );
}

// Re-exported for the friend page's "Net off" button condition.
export const canNetOff = (summary) => toMinor(summary?.openOwesMe) > 0 && toMinor(summary?.openIOwe) > 0;
