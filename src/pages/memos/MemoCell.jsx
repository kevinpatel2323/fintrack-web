import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Spinner, TextInput } from '../../components/ui';
import { MEMO_MAX_LENGTH, memoPayee, normaliseMemo } from './memoModel.js';

/**
 * The memo, editable in place on a row (the CategoryCell pattern): the text,
 * or a muted "Add memo", with a pencil on hover. A click turns the cell into
 * a field; Enter or leaving the field saves when the text changed, Escape
 * puts the saved memo back. A failed save keeps the field open with what was
 * typed (the page toasts why). `data-row-click-ignore` keeps clicks in the
 * cell from opening the row.
 */
export default function MemoCell({ row, onSave }) {
  const saved = row.memo ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const cancelRef = useRef(false);
  // Enter / Escape hand focus back to the cell; a click elsewhere keeps it there.
  const refocusRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange?.(end, end);
  }, [editing]);

  useEffect(() => {
    if (editing || !refocusRef.current) return;
    refocusRef.current = false;
    triggerRef.current?.focus();
  }, [editing]);

  function start() {
    cancelRef.current = false;
    setDraft(saved);
    setFailed(false);
    setEditing(true);
  }

  function stop() {
    setEditing(false);
    setFailed(false);
  }

  async function commit(value) {
    if (saving) return;
    const next = normaliseMemo(value);
    if (next === normaliseMemo(saved)) {
      stop();
      return;
    }
    setSaving(true);
    try {
      await onSave(row, next);
      stop();
    } catch {
      // The page has said what went wrong; the typed text stays in the field.
      setFailed(true);
      refocusRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  const payee = memoPayee(row);

  if (editing) {
    return (
      <div className="memos-cell-control" data-row-click-ignore>
        <TextInput
          ref={inputRef}
          className="memos-memo-input"
          variant="outline"
          value={draft}
          maxLength={MEMO_MAX_LENGTH}
          placeholder="What was this for?"
          aria-label={`Memo for ${payee}`}
          enterKeyHint="done"
          invalid={failed}
          title={failed ? 'Not saved' : undefined}
          readOnly={saving}
          suffix={saving ? <Spinner size="sm" aria-label="Saving memo" /> : null}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            if (cancelRef.current) {
              cancelRef.current = false;
              return;
            }
            commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              refocusRef.current = true;
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancelRef.current = true;
              refocusRef.current = true;
              stop();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="memos-cell-control" data-row-click-ignore>
      <button
        ref={triggerRef}
        type="button"
        className="memos-memo-trigger"
        aria-label={saved ? `Memo for ${payee}: ${saved}. Edit memo` : `Add memo for ${payee}`}
        title={saved || undefined}
        onClick={start}
      >
        <span className={`memos-memo truncate${saved ? '' : ' is-empty'}`}>{saved || 'Add memo'}</span>
        <Pencil className="memos-memo__pencil" size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
