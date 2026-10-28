import { useId, useState } from 'react';
import { Button, Dialog, ErrorMessage, FormControl, MobileActionBar } from './ui';
import { groupTotals } from '../utils/entryGroups.js';
import { friendFirstName } from '../utils/ledgerParties.js';
import { rupees, toMinor } from '../utils/settlementAllocation.js';
import './people/people.css';
import './people/ledger.css';

/**
 * Entry groups on the friend page: several entries bundled under one title
 * ("Ketul's wedding"), shown in the ledger table as one row with the entries'
 * net total (see pages/people/PersonLedgerTable.jsx). This file holds the
 * naming dialog and the "tick entries to group" bar.
 */

/** "You owe Yash ₹6,511" / "Yash owes you ₹2,289" / "Nothing owed". */
export function groupNetPhrase(amount, friendName) {
  const first = friendFirstName(friendName);
  const minor = toMinor(amount);
  if (minor > 0) return `${first} owes you ${rupees(minor)}`;
  if (minor < 0) return `You owe ${first} ${rupees(-minor)}`;
  return 'Nothing owed';
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
function selectionCopy(count, target) {
  return {
    ready: target ? count >= 1 : count >= 2,
    hint: target
      ? `Tick entries to add to “${target.title}”`
      : count < 2
        ? 'Tick at least 2 entries to group'
        : 'Tick the entries to group',
    confirmLabel: target
      ? count > 0 ? `Add ${count} to group` : 'Add to group'
      : count > 0 ? `Group ${count}` : 'Group entries',
  };
}

export function GroupSelectionBar({ count, target, onConfirm, onCancel }) {
  const { ready, hint, confirmLabel } = selectionCopy(count, target);
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
          <Button variant="solid" disabled={!ready} onClick={onConfirm} label={confirmLabel} />
        </div>
      </div>
    </div>
  );
}

/**
 * The same selection on a phone: it takes the place of the page's action
 * bar at the bottom of the screen, with the count and hint above the two
 * buttons.
 */
export function GroupSelectionActionBar({ count, target, onConfirm, onCancel }) {
  const { ready, hint, confirmLabel } = selectionCopy(count, target);
  return (
    <MobileActionBar className="ledger-mbar">
      <p className="ledger-mbar__text" role="status" aria-live="polite">
        <span className="ledger-mbar__count">{count} selected</span>
        <span className="ledger-mbar__hint">{hint}</span>
      </p>
      <Button size="lg" label="Cancel" onClick={onCancel} />
      <Button size="lg" variant="solid" disabled={!ready} onClick={onConfirm} label={confirmLabel} />
    </MobileActionBar>
  );
}
