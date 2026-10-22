import { useState } from 'react';
import Dialog from './ui/Dialog.jsx';
import { GhostBtn, Num, PrimaryBtn } from './ui/primitives.jsx';
import { IcChevD, IcChevR } from './ui/Icon.jsx';
import { groupTotals } from '../utils/entryGroups.js';
import { friendFirstName } from '../utils/ledgerParties.js';
import { rupees, toMinor } from '../utils/settlementAllocation.js';

/**
 * Entry groups on the friend page: several entries bundled under one title
 * ("Ketul's wedding"), shown as one row with the entries' net total. The
 * entries stay as they are underneath — expand the row to see or change them.
 */

function formatDay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "You owe Yash ₹6,511" / "Yash owes you ₹2,289" / "Nothing owed". */
export function groupNetPhrase(amount, friendName) {
  const first = friendFirstName(friendName);
  const minor = toMinor(amount);
  if (minor > 0) return `${first} owes you ${rupees(minor)}`;
  if (minor < 0) return `You owe ${first} ${rupees(-minor)}`;
  return 'Nothing owed';
}

const STATUS_TEXT = { open: 'Open', partial: 'Partly settled', settled: 'Settled' };
const STATUS_COLOR = { open: 'var(--ft-text-dim)', partial: 'var(--ft-warn)', settled: 'var(--ft-income)' };

/**
 * One group as a ledger row. `renderEntry(tag, index)` draws each entry when
 * the row is expanded, so entries keep every action they have on their own.
 */
export function GroupRow({ group, members, friendName, first, onRename, onAddEntries, onUngroup, renderEntry }) {
  const [open, setOpen] = useState(false);
  const totals = groupTotals(members);
  const Chevron = open ? IcChevD : IcChevR;
  const net = toMinor(totals.totalAmount);
  const color = net > 0 ? 'var(--ft-income)' : net < 0 ? 'var(--ft-spend)' : 'var(--ft-text-dim)';
  const range = totals.dateFrom === totals.dateTo
    ? formatDay(totals.dateFrom)
    : `${formatDay(totals.dateFrom)} – ${formatDay(totals.dateTo)}`;

  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--ft-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px' }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${group.title}`}
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
            border: '1px solid var(--ft-accent-hairline)', background: 'var(--ft-accent-soft)',
            color: 'var(--ft-accent-fg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Chevron size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--ft-text)', fontSize: 14, fontWeight: 600 }}>{group.title}</div>
          <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>
            {totals.count} {totals.count === 1 ? 'entry' : 'entries'} · {range}
          </div>
          {open && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <button type="button" className="friend-tag-card__apply" style={{ marginTop: 0 }} onClick={onRename}>
                Rename
              </button>
              <button type="button" className="friend-tag-card__apply" style={{ marginTop: 0 }} onClick={onAddEntries}>
                Add entries
              </button>
              <button type="button" className="friend-tag-card__apply" style={{ marginTop: 0 }} onClick={onUngroup}>
                Ungroup
              </button>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <Num size={14} weight={600} color={color}>{rupees(Math.abs(net))}</Num>
          <div style={{ color: 'var(--ft-text-dim)', fontSize: 11 }}>{groupNetPhrase(totals.totalAmount, friendName)}</div>
          <div style={{ color: STATUS_COLOR[totals.status], fontSize: 11, marginTop: 1 }}>
            {/* What is open can run the other way from the group's total. */}
            {totals.status === 'partial'
              ? `Open: ${groupNetPhrase(totals.pendingNet, friendName)}`
              : STATUS_TEXT[totals.status]}
          </div>
        </div>
      </div>
      {open && (
        <div style={{ marginLeft: 18, paddingLeft: 12, borderLeft: '2px solid var(--ft-accent-hairline)' }}>
          {members.map((tag, i) => renderEntry(tag, i))}
        </div>
      )}
    </div>
  );
}

/**
 * Names a new group from the selected entries, or renames one. Shows what the
 * entries add up to, since that is what the group will read as.
 */
export function GroupTitleDialog({ mode, initialTitle = '', members = [], friendName, onClose, onSubmit }) {
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const totals = groupTotals(members);

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await onSubmit(title.trim());
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save the group.');
      setSaving(false);
    }
  }

  return (
    <Dialog
      overline={mode === 'create' ? 'Group entries' : 'Rename group'}
      title={mode === 'create' ? `${members.length} entries as one` : initialTitle}
      maxWidth={440}
      onClose={onClose}
      footer={
        <>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create group' : 'Save'}
          </PrimaryBtn>
        </>
      }
    >
      {mode === 'create' && (
        <p style={{ margin: 0, color: 'var(--ft-text-dim)', fontSize: 12.5, lineHeight: 1.5 }}>
          These entries will show as one, adding up to{' '}
          <strong style={{ color: 'var(--ft-text)' }}>{groupNetPhrase(totals.totalAmount, friendName)}</strong>.
          Each entry stays as it is underneath, so nothing about the balance changes, and you
          can ungroup at any time.
        </p>
      )}
      <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--ft-text-dim)' }}>
        Title
        <input
          type="text"
          value={title}
          maxLength={120}
          autoFocus
          placeholder="e.g. Ketul's wedding"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim() && !saving) submit();
          }}
        />
      </label>
      {error && <p style={{ margin: 0, color: 'var(--ft-spend)', fontSize: 12.5 }}>{error}</p>}
    </Dialog>
  );
}

/** The bar shown while ticking entries to group, or to add to a group. */
export function GroupSelectionBar({ count, target, onConfirm, onCancel }) {
  const ready = target ? count >= 1 : count >= 2;
  return (
    <div
      style={{
        position: 'sticky', top: 8, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 12px', marginBottom: 10, borderRadius: 12,
        background: 'var(--ft-surface-2)', border: '1px solid var(--ft-accent-hairline)',
      }}
    >
      <span style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: 'var(--ft-text-dim)' }}>
        {target
          ? `Tick entries to add to "${target.title}" · ${count} selected`
          : `Tick the entries to group · ${count} selected${count < 2 ? ' (pick at least 2)' : ''}`}
      </span>
      <GhostBtn onClick={onCancel}>Cancel</GhostBtn>
      <PrimaryBtn onClick={onConfirm} disabled={!ready}>
        {target
          ? count > 0 ? `Add ${count} to group` : 'Add to group'
          : count > 0 ? `Group ${count} entries` : 'Group entries'}
      </PrimaryBtn>
    </div>
  );
}
