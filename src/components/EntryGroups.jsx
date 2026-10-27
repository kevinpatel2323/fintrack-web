import { useId, useState } from 'react';
import { ChevronDown, ChevronRight, FolderMinus, ListPlus, MoreHorizontal, Pencil } from 'lucide-react';
import { Amount, Button, Dialog, Dropdown, ErrorMessage, FormControl } from './ui';
import { groupTotals } from '../utils/entryGroups.js';
import { friendFirstName } from '../utils/ledgerParties.js';
import { rupees, toMinor } from '../utils/settlementAllocation.js';
import './people/people.css';
import './people/ledger.css';

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

/**
 * One group as a ledger row. `renderEntry(tag, index)` draws each entry when
 * the row is expanded, so entries keep every action they have on their own.
 * `picking` reserves the checkbox column while entries are being ticked
 * (groups themselves can't be picked). `first` is accepted for older callers.
 */
export function GroupRow({
  group,
  members,
  friendName,
  first: _first,
  onRename,
  onAddEntries,
  onUngroup,
  renderEntry,
  picking = false,
}) {
  const [open, setOpen] = useState(false);
  const membersId = useId();
  const totals = groupTotals(members);
  const Chevron = open ? ChevronDown : ChevronRight;
  const range = totals.dateFrom === totals.dateTo
    ? formatDay(totals.dateFrom)
    : `${formatDay(totals.dateFrom)} – ${formatDay(totals.dateTo)}`;
  const net = toMinor(totals.totalAmount);
  const name = friendFirstName(friendName);
  // The amount column carries the figure; the words say which way it runs.
  const netWords = net > 0 ? `${name} owes you` : net < 0 ? `You owe ${name}` : 'Nets to nothing';
  // What is open can run the other way from the group's total.
  const status = totals.status === 'partial'
    ? `Open: ${groupNetPhrase(totals.pendingNet, friendName)}`
    : STATUS_TEXT[totals.status];

  return (
    <div className="ledger-group" data-open={open ? '' : undefined}>
      <div className="ledger-row ledger-row--group">
        {picking && <span className="ledger-row__check" aria-hidden />}
        <span className="ledger-row__date">{formatDay(totals.dateFrom)}</span>
        <div className="ledger-row__main">
          <button
            type="button"
            className="ledger-group__toggle"
            aria-expanded={open}
            aria-controls={membersId}
            onClick={() => setOpen(!open)}
          >
            <Chevron size={16} strokeWidth={1.5} aria-hidden />
            <span className="truncate">{group.title}</span>
          </button>
          <span className="ledger-row__meta">
            {totals.count} {totals.count === 1 ? 'entry' : 'entries'} · {range} ·{' '}
            {netWords} ·{' '}
            <span className="ledger-note" data-tone={totals.status === 'partial' ? 'warn' : undefined}>
              {status}
            </span>
          </span>
        </div>
        <span className="ledger-row__amount">
          <Amount value={totals.totalAmount} sign="always" decimals={net % 100 ? 2 : 0} />
        </span>
        <span className="ledger-row__menu">
          <Dropdown
            placement="bottom-end"
            options={[
              { label: 'Rename', icon: Pencil, onClick: onRename },
              { label: 'Add entries', icon: ListPlus, onClick: onAddEntries },
              { label: 'Ungroup', icon: FolderMinus, onClick: onUngroup },
            ]}
          >
            <Button variant="ghost" icon={MoreHorizontal} label={`Actions for ${group.title}`} />
          </Dropdown>
        </span>
      </div>
      {open && (
        <div id={membersId} className="ledger-group__members">
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
  const formId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const totals = groupTotals(members);

  async function submit(e) {
    e?.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSubmit(title.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save the group.');
      setSaving(false);
    }
  }

  return (
    <Dialog
      size="sm"
      title={mode === 'create' ? `Group ${members.length} entries` : 'Rename group'}
      onClose={onClose}
      actions={[
        { label: 'Cancel' },
        {
          label: mode === 'create' ? 'Create group' : 'Save',
          variant: 'solid',
          type: 'submit',
          form: formId,
          loading: saving,
          disabled: !title.trim(),
        },
      ]}
    >
      <form id={formId} className="people-form" onSubmit={submit} noValidate>
        {mode === 'create' && (
          <p className="people-form__text ledger-dialog__summary">
            These entries will show as one, adding up to{' '}
            <strong>{groupNetPhrase(totals.totalAmount, friendName)}</strong>. Each entry stays as it is
            underneath, so nothing about the balance changes, and you can ungroup at any time.
          </p>
        )}
        <FormControl
          label="Title"
          value={title}
          maxLength={120}
          autoFocus
          placeholder="e.g. Ketul's wedding"
          onChange={(e) => setTitle(e.target.value)}
        />
        <ErrorMessage message={error} />
      </form>
    </Dialog>
  );
}

/**
 * The floating bar shown while ticking entries to group, or to add to a
 * group — the kit's list selection banner, with the group action in it.
 */
export function GroupSelectionBar({ count, target, onConfirm, onCancel }) {
  const ready = target ? count >= 1 : count >= 2;
  const hint = target
    ? `Tick entries to add to “${target.title}”`
    : count < 2
      ? 'Tick at least 2 entries to group'
      : 'Tick the entries to group';
  return (
    <div className="ledger-selection-anchor">
      <div className="ledger-selection" role="region" aria-label="Selection">
        <div className="ledger-selection__text">
          <span className="ledger-selection__count" aria-live="polite">
            {count} selected
          </span>
          <span className="ledger-selection__hint">{hint}</span>
        </div>
        <div className="ledger-selection__actions">
          <Button variant="ghost" label="Cancel" onClick={onCancel} />
          <Button
            variant="solid"
            disabled={!ready}
            onClick={onConfirm}
            label={
              target
                ? count > 0 ? `Add ${count} to group` : 'Add to group'
                : count > 0 ? `Group ${count}` : 'Group entries'
            }
          />
        </div>
      </div>
    </div>
  );
}
