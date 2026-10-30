import { useEffect, useId, useState } from 'react';
import { Dialog, ErrorMessage, FormControl } from '../../components/ui';
import { useIsCompact } from '../../styles/breakpoints.js';

/**
 * Names a bank account after its holder. The number is in the description so
 * it is clear which account this is. An empty name clears it, and the account
 * shows by its number again. `onSubmit(holderName | null)` saves; a rejection
 * shows its message here.
 */
export default function AccountNameDialog({ open, account, onClose, onSubmit }) {
  // Phones: the sheet takes focus rather than the field, so the keyboard
  // doesn't cover it as it opens; fields are 44px.
  const isMobile = useIsCompact();
  const formId = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(account?.holderName || '');
    setError('');
    setSubmitting(false);
  }, [open, account]);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(name.trim() || null);
    } catch (err) {
      setError(err?.message || 'Save failed');
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={account?.holderName ? 'Rename account' : 'Name account'}
      description={
        account ? (
          <>
            Account <span className="accts-number">{account.accountNumber}</span>
          </>
        ) : null
      }
      actions={[
        { label: 'Cancel', disabled: submitting },
        { label: 'Save', variant: 'solid', type: 'submit', form: formId, loading: submitting },
      ]}
    >
      <form id={formId} className="accts-form" onSubmit={submit} noValidate>
        <FormControl
          label="Account holder"
          description="Shown instead of the account number everywhere in Fintrack. Leave it empty to show the number."
          autoFocus={!isMobile}
          size={isMobile ? 'lg' : undefined}
          maxLength={100}
          placeholder="e.g. Kevin Patel"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <ErrorMessage message={error} />
      </form>
    </Dialog>
  );
}
