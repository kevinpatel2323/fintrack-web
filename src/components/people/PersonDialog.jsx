import { useEffect, useId, useState } from 'react';
import { Dialog, ErrorMessage, FormControl, toast } from '../ui';
import { API_BASE, apiErrorMessage, apiFetch } from '../../services/http.js';
import './people.css';

const EMPTY = { name: '', email: '', phone: '', note: '' };
// Loose on purpose: the API has the final say, this only catches typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Adds a person, or edits one (`person` set). Same requests as before:
 * POST /friends or PATCH /friends/:id with name, email, phone and note.
 * `onSaved(data)` runs after a successful save, before the dialog closes.
 */
export default function PersonDialog({ open, person = null, onClose, onSaved }) {
  const formId = useId();
  const [form, setForm] = useState(EMPTY);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      person
        ? { name: person.name || '', email: person.email || '', phone: person.phone || '', note: person.note || '' }
        : EMPTY,
    );
    setNameError('');
    setEmailError('');
    setError('');
    setSaving(false);
  }, [open, person]);

  const set = (key) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'name' && value.trim()) setNameError('');
    if (key === 'email') setEmailError('');
  };

  async function submit(e) {
    e.preventDefault();
    const email = form.email.trim();
    const nameMissing = !form.name.trim();
    const emailBad = Boolean(email) && !EMAIL_RE.test(email);
    setNameError(nameMissing ? 'Enter a name.' : '');
    setEmailError(emailBad ? 'Enter a valid email, like name@example.com.' : '');
    if (nameMissing || emailBad) return;
    setSaving(true);
    setError('');
    try {
      const url = person ? `${API_BASE}/friends/${person.id}` : `${API_BASE}/friends`;
      const res = await apiFetch(url, {
        method: person ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: email || undefined,
          phone: form.phone.trim() || undefined,
          note: form.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Save failed'));
      await onSaved?.(data);
      toast.success(person ? 'Changes saved' : `${form.name.trim()} added`);
      onClose();
    } catch (err) {
      setError(err.message || 'Save failed');
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={person ? 'Edit person' : 'Add person'}
      actions={[
        { label: 'Cancel' },
        {
          label: person ? 'Save' : 'Add person',
          variant: 'solid',
          type: 'submit',
          form: formId,
          loading: saving,
        },
      ]}
    >
      <form id={formId} className="people-form" onSubmit={submit} noValidate>
        <FormControl
          label="Name"
          required
          placeholder="Full name"
          autoFocus
          value={form.name}
          onChange={set('name')}
          error={nameError || undefined}
        />
        <div className="people-form__pair">
          <FormControl
            label="Email"
            type="email"
            value={form.email}
            onChange={set('email')}
            error={emailError || undefined}
          />
          <FormControl label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        </div>
        <FormControl label="Note" value={form.note} onChange={set('note')} />
        <ErrorMessage message={error} />
      </form>
    </Dialog>
  );
}
