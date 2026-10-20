import { useEffect, useMemo, useState } from 'react';
import Dialog from './ui/Dialog.jsx';
import { GhostBtn, PrimaryBtn } from './ui/primitives.jsx';
import { applyLegacyReview, fetchLegacyReview } from '../services/friendsApi.js';
import { friendFirstName } from '../utils/ledgerParties.js';
import { roundCurrencyToMinor } from '../utils/splitEngine.ts';
import { minorToInput, rupees, toMinor } from '../utils/settlementAllocation.js';
import '../styles/settlement-allocator.css';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

const REASON_TEXT = {
  on_account: 'leaves money on account',
  stale_link: 'points at an entry already paid',
  short: 'leaves an entry partly open',
  side_change: 'is money you paid',
};

/**
 * A settlement whose links all point at entries already paid, the same size
 * as money another settlement leaves on account, is most likely that money
 * going back — Vraj overpaid ₹150 and got ₹150 back. Refunds are applied after
 * the review, from the friend page, so this only says where to look.
 */
function refundHint(s, all, results, first) {
  const amount = toMinor(s.settlement.amount);
  if (!s.reasons.includes('stale_link') || (results[s.settlementId]?.applied ?? 0) > 0) return null;
  const match = all.find(
    (other) => other.settlementId !== s.settlementId && results[other.settlementId]?.onAccount === amount,
  );
  if (!match) return null;
  const date = formatDate(match.settlement.transaction?.transactionDate);
  return `Looks like a refund of the ${rupees(amount)} left on account from ${date}. After saving, open this settlement on ${first}'s page ("Change what it settles") and tick that refund.`;
}

/**
 * Reviews a friend's settlements that were linked before amounts existed.
 * Each one opens with the amounts its links most plausibly meant — oldest
 * first, each entry taking what the payment had left — and every amount can
 * be changed. Nothing is saved until "Save review"; afterwards any leftover
 * shows on the friend page as money on account or an open remainder, to
 * apply, refund or write off there.
 */
export default function LegacyReviewModal({ friendId, friendName, onClose, onSaved }) {
  const first = friendFirstName(friendName);
  const [review, setReview] = useState(null);
  // { [settlementId]: { [tagId]: amountString } } — a key present means "applies".
  const [amounts, setAmounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLegacyReview(friendId)
      .then((data) => {
        setReview(data);
        const seed = {};
        for (const s of data.settlements) {
          seed[s.settlementId] = {};
          for (const entry of s.linked) {
            if (entry.suggestedAmount > 0) seed[s.settlementId][String(entry.id)] = minorToInput(toMinor(entry.suggestedAmount));
          }
        }
        setAmounts(seed);
      })
      .catch((e) => setError(e.message || 'Could not load the review.'));
  }, [friendId]);

  // Per settlement: what it applies, what is left on account, and which way
  // its money now reads — the same rule the server uses.
  const outcome = useMemo(() => {
    const result = {};
    let netChange = 0;
    let invalid = false;
    for (const s of review?.settlements ?? []) {
      const chosen = amounts[s.settlementId] ?? {};
      let owesMe = 0;
      let iOwe = 0;
      const rowErrors = {};
      for (const entry of s.linked) {
        const id = String(entry.id);
        if (!(id in chosen)) continue;
        const minor = roundCurrencyToMinor(String(chosen[id] ?? ''), 100);
        if (minor === null || minor <= 0) rowErrors[id] = 'Enter an amount';
        else if (minor > toMinor(entry.amount)) rowErrors[id] = `At most ${rupees(toMinor(entry.amount))}`;
        else if (entry.direction === 'OWES_ME') owesMe += minor;
        else iOwe += minor;
      }
      const side = iOwe > owesMe ? 'paid' : 'received';
      const applied = Math.abs(owesMe - iOwe);
      const onAccount = toMinor(s.settlement.amount) - applied;
      if (onAccount < 0 || Object.keys(rowErrors).length) invalid = true;
      if (side === 'paid') netChange += 2 * toMinor(s.settlement.amount);
      result[s.settlementId] = { side, applied, onAccount, rowErrors };
    }
    return { result, netChange, invalid };
  }, [review, amounts]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await applyLegacyReview(
        friendId,
        review.settlements.map((s) => ({
          settlementTagId: Number(s.settlementId),
          allocations: Object.entries(amounts[s.settlementId] ?? {}).map(([tagId, raw]) => ({
            tagId: Number(tagId),
            amount: roundCurrencyToMinor(String(raw), 100) / 100,
          })),
        })),
      );
      await onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save the review.');
      setSaving(false);
    }
  }

  const netBefore = toMinor(review?.netBefore);
  const netAfter = netBefore + outcome.netChange;
  const balanceText = (minor) =>
    minor > 0 ? `${first} owes you ${rupees(minor)}` : minor < 0 ? `you owe ${first} ${rupees(-minor)}` : 'all square';

  return (
    <Dialog
      overline="Review older settlements"
      title={friendName}
      maxWidth={620}
      onClose={onClose}
      footer={
        <>
          <span style={{ marginRight: 'auto', fontSize: 12.5, color: outcome.netChange ? 'var(--ft-warn)' : 'var(--ft-text-dim)' }}>
            {review && (outcome.netChange
              ? `Balance: ${balanceText(netBefore)} → ${balanceText(netAfter)}`
              : `Balance stays: ${balanceText(netBefore)}`)}
          </span>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving || !review || outcome.invalid}>
            {saving ? 'Saving…' : 'Save review'}
          </PrimaryBtn>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--ft-text-dim)', fontSize: 12.5, lineHeight: 1.5 }}>
        These settlements were saved before Fintrack recorded how much of a payment went to each
        entry. Check the amounts below — they are a suggestion — and save to record them.
        Anything left over can then be applied, refunded or written off.
      </p>
      {!review && !error && <p className="status">Loading…</p>}
      {review?.settlements.map((s) => {
        const tx = s.settlement.transaction || {};
        const o = outcome.result[s.settlementId];
        const chosen = amounts[s.settlementId] ?? {};
        return (
          <section key={s.settlementId} className="settle-alloc__group" style={{ padding: 12, borderRadius: 14, border: '1px solid var(--ft-border)' }}>
            <div className="settle-alloc__group-head" style={{ color: 'var(--ft-text)' }}>
              <span>
                {formatDate(tx.transactionDate)} · {tx.upiName || tx.narration || s.settlement.note || 'Settlement'}
              </span>
              <strong>{rupees(toMinor(s.settlement.amount))}</strong>
            </div>
            {s.reasons.length > 0 && (
              <span style={{ color: 'var(--ft-warn)', fontSize: 11.5 }}>
                Needs a look: {s.reasons.map((r) => REASON_TEXT[r]).join(', ')}
              </span>
            )}
            {refundHint(s, review.settlements, outcome.result, first) && (
              <span style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, lineHeight: 1.5 }}>
                {refundHint(s, review.settlements, outcome.result, first)}
              </span>
            )}
            {s.linked.map((entry) => {
              const id = String(entry.id);
              const selected = id in chosen;
              const etx = entry.transaction || {};
              const rowError = o?.rowErrors[id];
              return (
                <div key={id} className={`settle-alloc__row${selected ? ' settle-alloc__row--selected' : ''}${rowError ? ' settle-alloc__row--error' : ''}`}>
                  <label className="settle-alloc__pick">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        const next = { ...chosen };
                        if (selected) delete next[id];
                        else next[id] = minorToInput(toMinor(entry.suggestedAmount || entry.amount));
                        setAmounts({ ...amounts, [s.settlementId]: next });
                      }}
                    />
                    <span className="settle-alloc__what">
                      <span className="settle-alloc__name">{etx.upiName || etx.narration || entry.note || 'Entry'}</span>
                      <span className="settle-alloc__meta">
                        {formatDate(etx.transactionDate)} · {rupees(toMinor(entry.amount))} ·{' '}
                        {entry.direction === 'OWES_ME' ? `${first} owed you` : `you owed ${first}`}
                        {entry.stale && ' · already paid by another settlement'}
                      </span>
                    </span>
                  </label>
                  {selected && (
                    <div className="settle-alloc__apply">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="settle-alloc__amount"
                        value={chosen[id]}
                        onChange={(e) => setAmounts({ ...amounts, [s.settlementId]: { ...chosen, [id]: e.target.value } })}
                      />
                      {rowError && <span className="settle-alloc__after settle-alloc__after--error">{rowError}</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {o && (
              <span style={{ fontSize: 12, color: o.onAccount < 0 ? 'var(--ft-spend)' : 'var(--ft-text-dim)' }}>
                {o.onAccount < 0
                  ? `That is ${rupees(-o.onAccount)} more than this settlement.`
                  : `Applies ${rupees(o.applied)}${o.onAccount > 0 ? ` · ${rupees(o.onAccount)} left on account` : ''} · money ${
                      o.side === 'paid' ? `you paid ${first}` : `${first} paid you`
                    }`}
              </span>
            )}
          </section>
        );
      })}
      {error && <p style={{ margin: 0, color: 'var(--ft-spend)', fontSize: 12.5 }}>{error}</p>}
    </Dialog>
  );
}
