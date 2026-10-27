import { useEffect, useRef } from 'react';
import { toast } from '../ui';

/** "Saving…", "Loading tags..." — work in progress, not a result. */
export function isProgressStatus(status) {
  return /(…|\.\.\.)\s*$/.test(String(status || ''));
}

function isSuccessStatus(status) {
  return /^split applied/i.test(String(status || ''));
}

/**
 * Turns the status strings the manage-sheet callers keep per transaction
 * (`tagsStatus`, `categoryStatus`) into toasts, so results don't linger as
 * text in the sheet:
 *
 * - a split finishing (`splitApplying` true → false) toasts "Split applied",
 *   or the error it left behind;
 * - a tag removal ("Removing tag..." → … → "") toasts "Friend tag removed";
 * - any other status that is neither progress nor success is an error.
 *
 * Category saves report only failures: the new category shows in place.
 */
export function useStatusToasts({ tagsStatus, categoryStatus, splitApplying, enabled = true }) {
  const prev = useRef({ tagsStatus, categoryStatus, splitApplying });
  const removing = useRef(false);

  useEffect(() => {
    const was = prev.current;
    prev.current = { tagsStatus, categoryStatus, splitApplying };
    if (!enabled) return;

    const tags = tagsStatus || '';
    const tagsError = tags && !isProgressStatus(tags) && !isSuccessStatus(tags);

    if (was.splitApplying && !splitApplying) {
      if (tagsError) toast.error(tags);
      else toast.success('Split applied');
    } else if (!splitApplying && tags !== (was.tagsStatus || '')) {
      if (/^removing/i.test(tags)) {
        removing.current = true;
      } else if (tagsError) {
        removing.current = false;
        toast.error(tags);
      } else if (!tags && removing.current) {
        removing.current = false;
        toast.success('Friend tag removed');
      }
    }

    const category = categoryStatus || '';
    if (category && category !== (was.categoryStatus || '') && !isProgressStatus(category)) {
      toast.error(category === 'Failed to save' ? 'Failed to save category' : category);
    }
  }, [tagsStatus, categoryStatus, splitApplying, enabled]);
}
