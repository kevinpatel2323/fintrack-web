import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Dialog, FormControl, LoadingIndicator, toast } from './ui';
import LedgerPaper from './ledger-export/LedgerPaper.jsx';
import LedgerRowPicker from './ledger-export/LedgerRowPicker.jsx';
import { buildLedgerPdf } from '../utils/ledgerPdf';
import { ledgerBalanceDelta, ledgerOpenTotals } from '../utils/ledgerParties';
import { groupIdOf } from '../utils/entryGroups.js';
import './FriendLedgerExportModal.css';

import { API_BASE, apiFetch } from '../services/http.js';

function monthBounds(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  const last = new Date(y, m + 1, 0).getDate();
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(last)}`,
  };
}

/** Statement-period shortcuts, in whole months like the default. */
function periodPresets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisMonth = monthBounds(now);
  return [
    { label: 'This month', value: thisMonth },
    { label: 'Last month', value: monthBounds(new Date(y, m - 1, 1)) },
    { label: 'Last 3 months', value: { start: monthBounds(new Date(y, m - 2, 1)).start, end: thisMonth.end } },
    { label: 'This year', value: { start: `${y}-01-01`, end: `${y}-12-31` } },
  ];
}

function computeSummary(tags) {
  let totalTheyOwe = 0;
  let totalYouOwe = 0;
  let totalSettlements = 0;
  let net = 0;
  for (const tag of tags) {
    const amt = Number(tag.amount) || 0;
    if (tag.direction === 'OWES_ME') totalTheyOwe += amt;
    else if (tag.direction === 'I_OWE') totalYouOwe += amt;
    else if (tag.direction === 'SETTLEMENT') totalSettlements += amt;
    net += ledgerBalanceDelta(tag);
  }
  return { totalTheyOwe, totalYouOwe, totalSettlements, net, open: ledgerOpenTotals(tags) };
}

function sanitizeFilePart(name) {
  return String(name || 'friend')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'friend';
}

function formatGeneratedStamp() {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
}

/** How long a burst of clicks settles before the pinned choices are saved. */
const PREF_SAVE_DEBOUNCE_MS = 600;

/**
 * Exports a person's ledger as a PDF statement. Options on the left (period
 * and which rows to include), a live preview of the PDF on the right; the
 * rows reload whenever the period changes.
 */
export default function FriendLedgerExportModal({ friend, open, onClose }) {
  const [startDate, setStartDate] = useState(() => monthBounds().start);
  const [endDate, setEndDate] = useState(() => monthBounds().end);
  const [loadedTags, setLoadedTags] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // Rows whose include/exclude choice is pinned server-side. The pinned value
  // is always whatever the checkbox currently says, so this set plus
  // `selectedIds` is the whole persisted state — no third copy to drift.
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const [prefStatus, setPrefStatus] = useState('');
  // 'idle' until the first load of a session, then 'loading' | 'ready' | 'error'.
  const [loadState, setLoadState] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // One per opening of the dialog; rows load only once it is set, so a
  // reopen never fetches with the previous session's dates.
  const [session, setSession] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const ledgerOpenIdRef = useRef(null);

  // Mirrors of the two sets, so a save that fires from a timer or an unmount
  // reads the live values instead of the render that scheduled it.
  const selectedRef = useRef(selectedIds);
  const pinnedRef = useRef(pinnedIds);
  const dirtyRef = useRef(new Set());
  const saveTimerRef = useRef(null);
  const flushRef = useRef(null);

  const resetForFriend = useCallback((friendId) => {
    const b = monthBounds();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    dirtyRef.current = new Set();
    selectedRef.current = new Set();
    pinnedRef.current = new Set();
    setStartDate(b.start);
    setEndDate(b.end);
    setLoadedTags([]);
    setSelectedIds(new Set());
    setPinnedIds(new Set());
    setPrefStatus('');
    setLoadState('idle');
    setLoadError('');
    setPdfBusy(false);
    setSession({ friendId });
  }, []);

  /**
   * Writes the pinned rows the user has touched since the last save. Only
   * pinned rows carry a value; un-pinning sends `null`, which is how the API
   * forgets a choice. A failed save puts the ids back so the next flush
   * retries them rather than silently dropping the edit.
   */
  const flushPrefs = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const ids = [...dirtyRef.current];
    if (!ids.length || !friend?.id) return;
    dirtyRef.current = new Set();

    const preferences = ids.map((id) => ({
      tagId: Number(id),
      included: pinnedRef.current.has(id) ? selectedRef.current.has(id) : null,
    }));

    setPrefStatus('Saving…');
    try {
      const res = await apiFetch(`${API_BASE}/friends/${friend.id}/ledger-preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Could not save your choices.');
      setPrefStatus('Saved for next time');
    } catch (e) {
      for (const id of ids) dirtyRef.current.add(id);
      setPrefStatus(e.message || 'Could not save your choices.');
    }
  }, [friend?.id]);

  flushRef.current = flushPrefs;

  /**
   * Single write path for both sets. `touched` lists the rows whose *persisted*
   * value changed — unchecking an unpinned row changes nothing on the server,
   * so it must not schedule a save.
   */
  const commit = useCallback((nextSelected, nextPinned, touched) => {
    selectedRef.current = nextSelected;
    pinnedRef.current = nextPinned;
    setSelectedIds(nextSelected);
    setPinnedIds(nextPinned);
    if (!touched.length) return;
    for (const id of touched) dirtyRef.current.add(id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void flushRef.current?.();
    }, PREF_SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!open) {
      ledgerOpenIdRef.current = null;
      setSession(null);
      // Covers a close driven by the parent rather than the dialog's own buttons.
      void flushRef.current?.();
      return;
    }
    if (!friend) return;
    if (ledgerOpenIdRef.current === friend.id) return;
    ledgerOpenIdRef.current = friend.id;
    resetForFriend(friend.id);
  }, [open, friend?.id, resetForFriend]);

  // A debounce still pending when the dialog goes away would lose the edit.
  useEffect(() => () => void flushRef.current?.(), []);

  const dateOrderOk = useMemo(() => {
    if (!startDate || !endDate) return false;
    return startDate <= endDate;
  }, [startDate, endDate]);

  // Loads the period's rows whenever it changes. A row with a pinned choice
  // comes back set the way it was left; the rest start included, which is
  // what the picker has always defaulted to.
  useEffect(() => {
    if (!open || !friend?.id || !session || session.friendId !== friend.id || !dateOrderOk) return undefined;
    let cancelled = false;
    setLoadState('loading');
    setLoadError('');
    (async () => {
      // Pins still waiting on the debounce land before we read them back.
      await flushRef.current?.();
      if (cancelled) return;
      try {
        const q = `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
        const res = await apiFetch(`${API_BASE}/friends/${friend.id}/transactions${q}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'Failed to load transactions');
        if (cancelled) return;
        const rows = data.data || [];

        const selected = new Set();
        const pinned = new Set();
        for (const row of rows) {
          const key = String(row.id);
          const saved = row.ledgerIncluded;
          if (saved === true || saved === false) {
            pinned.add(key);
            if (saved) selected.add(key);
          } else {
            selected.add(key);
          }
        }

        // A pin made while this was loading belongs to the old rows: save it
        // against them before the sets are replaced.
        if (dirtyRef.current.size) void flushRef.current?.();
        dirtyRef.current = new Set();
        selectedRef.current = selected;
        pinnedRef.current = pinned;
        setLoadedTags(rows);
        setSelectedIds(selected);
        setPinnedIds(pinned);
        setPrefStatus(pinned.size ? `${pinned.size} saved choice${pinned.size === 1 ? '' : 's'} applied` : '');
        setLoadState('ready');
      } catch (e) {
        if (cancelled) return;
        setLoadError(e.message || 'Failed to load');
        setLoadState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, friend?.id, session, startDate, endDate, dateOrderOk, reloadKey]);

  // A group's entries print as one row, so they go in or out together.
  const groupMates = useMemo(() => {
    const byGroup = new Map();
    for (const tag of loadedTags) {
      const groupId = groupIdOf(tag);
      if (groupId) byGroup.set(groupId, [...(byGroup.get(groupId) || []), String(tag.id)]);
    }
    const mates = new Map();
    for (const ids of byGroup.values()) for (const id of ids) mates.set(id, ids);
    return mates;
  }, [loadedTags]);

  const toggleId = useCallback((id) => {
    const key = String(id);
    const keys = groupMates.get(key) ?? [key];
    const include = !selectedRef.current.has(key);
    const next = new Set(selectedRef.current);
    for (const k of keys) {
      if (include) next.add(k);
      else next.delete(k);
    }
    // A pinned row's saved value follows its checkbox; an unpinned one is
    // this export only.
    commit(next, pinnedRef.current, keys.filter((k) => pinnedRef.current.has(k)));
  }, [commit, groupMates]);

  /** Pins the row's current choice, or forgets it if already pinned. */
  const togglePin = useCallback((id) => {
    const key = String(id);
    const keys = groupMates.get(key) ?? [key];
    const pin = !pinnedRef.current.has(key);
    const next = new Set(pinnedRef.current);
    for (const k of keys) {
      if (pin) next.add(k);
      else next.delete(k);
    }
    commit(selectedRef.current, next, keys);
  }, [commit, groupMates]);

  const selectAll = useCallback(() => {
    const next = new Set(loadedTags.map((r) => String(r.id)));
    const touched = [...pinnedRef.current].filter((k) => !selectedRef.current.has(k));
    commit(next, pinnedRef.current, touched);
  }, [loadedTags, commit]);

  const selectNone = useCallback(() => {
    const touched = [...pinnedRef.current].filter((k) => selectedRef.current.has(k));
    commit(new Set(), pinnedRef.current, touched);
  }, [commit]);

  const rememberAll = useCallback(() => {
    const all = new Set(loadedTags.map((r) => String(r.id)));
    const touched = [...all].filter((k) => !pinnedRef.current.has(k));
    commit(selectedRef.current, all, touched);
  }, [loadedTags, commit]);

  const forgetAll = useCallback(() => {
    const touched = [...pinnedRef.current];
    commit(selectedRef.current, new Set(), touched);
  }, [commit]);

  // Every exit is a checkpoint — don't make the user wait out the debounce
  // to know their pins landed.
  const handleClose = useCallback(() => {
    void flushPrefs();
    onClose?.();
  }, [flushPrefs, onClose]);

  const includedTags = useMemo(() => {
    return loadedTags.filter((t) => selectedIds.has(String(t.id)));
  }, [loadedTags, selectedIds]);

  const previewSummary = useMemo(() => computeSummary(includedTags), [includedTags]);

  function exportPdf() {
    if (!includedTags.length) return;
    setPdfBusy(true);
    try {
      const pdf = buildLedgerPdf({
        friendName: friend.name,
        startDate,
        endDate,
        tags: includedTags,
        summary: previewSummary,
        generatedStamp: formatGeneratedStamp(),
      });
      const part = sanitizeFilePart(friend?.name);
      const filename = `Transaction-Ledger-${part}-${startDate}-to-${endDate}.pdf`;
      pdf.save(filename);
      toast.success({ title: 'Ledger downloaded', description: filename });
      handleClose();
    } catch (e) {
      toast.error({ title: 'PDF export failed', description: e.message || undefined });
    } finally {
      setPdfBusy(false);
    }
  }

  if (!friend) return null;

  const ready = loadState === 'ready';
  let preview;
  if (!dateOrderOk) {
    preview = <p className="lx-preview__state">Pick a statement period to see the preview.</p>;
  } else if (loadState === 'error') {
    preview = <p className="lx-preview__state">The preview appears once the transactions load.</p>;
  } else if (!ready && !loadedTags.length) {
    preview = (
      <div className="lx-preview__state">
        <LoadingIndicator text="Loading transactions…" />
      </div>
    );
  } else {
    preview = (
      <LedgerPaper
        friendName={friend.name}
        startDate={startDate}
        endDate={endDate}
        tags={includedTags}
        summary={previewSummary}
        generatedStamp={formatGeneratedStamp()}
        emptyText={loadedTags.length ? 'No transactions included. Tick at least one to export.' : undefined}
      />
    );
  }

  const footer = (
    <>
      <span className="lx-footer__status text-sm" role="status">
        {prefStatus}
      </span>
      <Button label="Cancel" onClick={handleClose} />
      <Button
        variant="solid"
        iconLeft={Download}
        label="Download PDF"
        loading={pdfBusy}
        disabled={!ready || !dateOrderOk || !includedTags.length}
        onClick={exportPdf}
      />
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      size="7xl"
      title={`Export ledger · ${friend.name}`}
      className="lx-dialog"
      bodyClassName="lx-body"
      footer={footer}
    >
      <div className="lx-options">
        <FormControl
          type="daterange"
          label="Statement period"
          value={{ start: startDate, end: endDate }}
          presets={periodPresets()}
          onChange={({ start, end }) => {
            setStartDate(start);
            setEndDate(end);
          }}
          error={dateOrderOk ? undefined : 'Pick a start and end date.'}
        />
        <LedgerRowPicker
          tags={loadedTags}
          friendName={friend.name}
          selectedIds={selectedIds}
          pinnedIds={pinnedIds}
          status={!dateOrderOk ? 'idle' : loadState === 'idle' ? 'loading' : loadState}
          error={loadError}
          onRetry={() => setReloadKey((k) => k + 1)}
          onToggle={toggleId}
          onTogglePin={togglePin}
          onSelectAll={selectAll}
          onSelectNone={selectNone}
          onRememberAll={rememberAll}
          onForgetAll={forgetAll}
        />
      </div>

      <section className="lx-preview" aria-label="Preview" aria-busy={loadState === 'loading' || undefined}>
        <div className="lx-preview__head">
          <h3 className="lx-section-title">Preview</h3>
          {dateOrderOk && loadState === 'loading' && loadedTags.length > 0 && <LoadingIndicator text="Updating…" />}
        </div>
        <div className="lx-preview__desk">{preview}</div>
      </section>
    </Dialog>
  );
}
