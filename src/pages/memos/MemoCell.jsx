import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Spinner, TextInput } from '../../components/ui';
import { MEMO_MAX_LENGTH, memoPayee, normaliseMemo } from './memoModel.js';

function stopRowClick(e) {
  e.stopPropagation();
}

/**
 * The memo, editable in place on every row: a ghost field that saves on blur
 * or Enter when the text changed (Escape puts the saved memo back). A failed
 * save keeps what was typed so nothing is lost. Clicks inside it never open
 * the row (the same trick as TransactionTable's CategoryCell).
 */
export default function MemoCell({ row, onSave }) {
  const saved = row.memo ?? '';
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  // The last save failed: the field keeps the text and shows it isn't saved.
  const [failed, setFailed] = useState(false);
  const focusedRef = useRef(false);
  const skipCommitRef = useRef(false);

  // Follow a memo changed elsewhere (the sheet, a re-parse) unless the
  // field is being edited.
  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(saved);
      setFailed(false);
    }
  }, [saved]);

  async function commit(value) {
    const next = normaliseMemo(value);
    if (next === normaliseMemo(saved)) {
      setDraft(saved);
      setFailed(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(row, next);
      setFailed(false);
    } catch {
      // The page has said what went wrong; the typed text stays in the field.
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const payee = memoPayee(row);
  let suffix = null;
  if (saving) suffix = <Spinner size="sm" className="memos-cell__spinner" />;
  else if (saved) suffix = Pencil;

  return (
    <div className="memos-cell-control" data-row-click-ignore onClick={stopRowClick}>
      <TextInput
        className="memos-cell"
        variant="ghost"
        value={draft}
        maxLength={MEMO_MAX_LENGTH}
        placeholder="Add memo…"
        aria-label={saved ? `Memo for ${payee}: ${saved}. Edit memo` : `Add memo for ${payee}`}
        suffix={suffix}
        invalid={failed}
        title={failed ? 'Not saved' : saved || undefined}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          if (skipCommitRef.current) {
            skipCommitRef.current = false;
            setDraft(saved);
            setFailed(false);
            return;
          }
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            skipCommitRef.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
