import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DynamicTable from './DynamicTable.jsx';
import { buildLedgerPdf } from '../utils/ledgerPdf';
import {
  LEDGER_OWNER_NAME,
  ledgerDirectionPhrase,
  ledgerRowAmount,
  ledgerRunningBalances,
  ledgerSettlementEntryLabel,
  ledgerSettlementIndex,
  ledgerSettlementRefLines,
} from '../utils/ledgerParties';
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

function formatDateLedger(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatNumberIn(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN').format(num);
}

function rowClass(direction) {
  if (direction === 'OWES_ME') return 'ledger-row--owes';
  if (direction === 'I_OWE') return 'ledger-row--owe';
  if (direction === 'SETTLEMENT') return 'ledger-row--settlement';
  return 'ledger-row--neutral';
}

function formatRunningBalance(value) {
  return value < 0 ? `-Rs.${formatNumberIn(Math.abs(value))}` : `Rs.${formatNumberIn(value)}`;
}

function balanceImpactCell(direction, amount) {
  if (direction === 'OWES_ME') {
    return { text: `+Rs.${formatNumberIn(amount)}`, className: 'ledger-impact--pos' };
  }
  if (direction === 'I_OWE') {
    return { text: `-Rs.${formatNumberIn(amount)}`, className: 'ledger-impact--neg' };
  }
  if (direction === 'SETTLEMENT') {
    return { text: `-Rs.${formatNumberIn(amount)}`, className: 'ledger-impact--settled' };
  }
  return { text: '—', className: '' };
}

function computeSummary(tags) {
  let totalTheyOwe = 0;
  let totalYouOwe = 0;
  let totalSettlements = 0;
  for (const tag of tags) {
    const amt = Number(tag.amount) || 0;
    if (tag.direction === 'OWES_ME') totalTheyOwe += amt;
    else if (tag.direction === 'I_OWE') totalYouOwe += amt;
    else if (tag.direction === 'SETTLEMENT') totalSettlements += amt;
  }
  const net = totalTheyOwe - totalYouOwe - totalSettlements;
  return { totalTheyOwe, totalYouOwe, totalSettlements, net };
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

function LedgerSettlementDetails({ groups }) {
  return (
    <div className="ledger-summary-table-block">
      <h2 className="ledger-summary-table-block__title">Settlement details</h2>
      <div className="ledger-summary-table-wrap">
        <table className="ledger-summary-table ledger-settlement-table">
          <thead>
            <tr>
              <th>Settlement entry</th>
              <th>Entries it settles</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const st = group.tag.transaction || {};
              return (
                <tr key={group.tag.id}>
                  <td>
                    <div className="ledger-settle-entry">
                      <span className="ledger-settle-ref">#{group.row}</span>
                      <span className="ledger-settle-sep" aria-hidden="true">
                        |
                      </span>
                      <span>{formatDateLedger(st.transactionDate)}</span>
                      <span className="ledger-settle-sep" aria-hidden="true">
                        |
                      </span>
                      <span>Rs.{formatNumberIn(group.tag.amount)}</span>
                    </div>
                  </td>
                  <td>
                    {group.settles.map((ref, idx) => {
                      const t = ref.tag?.transaction || {};
                      const desc = t.upiDescription || t.narration || t.upiName || '—';
                      const impact = balanceImpactCell(ref.tag?.direction, ref.tag?.amount);
                      return (
                        <div className="ledger-settle-entry" key={ref.tag?.id ?? idx}>
                          <span className="ledger-settle-ref">{ledgerSettlementEntryLabel(ref)}</span>
                          <span className="ledger-settle-sep" aria-hidden="true">
                            |
                          </span>
                          <span>{formatDateLedger(t.transactionDate)}</span>
                          <span className="ledger-settle-sep" aria-hidden="true">
                            |
                          </span>
                          <span className={impact.className}>{impact.text}</span>
                          <span className="ledger-settle-sep" aria-hidden="true">
                            |
                          </span>
                          <span className="ledger-settle-entry__desc">{desc}</span>
                        </div>
                      );
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LedgerSummaryTable({ summary }) {
  return (
    <div className="ledger-summary-table-block">
      <h2 className="ledger-summary-table-block__title">Summary</h2>
      <div className="ledger-summary-table-wrap">
        <table className="ledger-summary-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total they owe you</td>
              <td className="num">Rs.{formatNumberIn(summary.totalTheyOwe)}</td>
            </tr>
            <tr>
              <td>Total you owe</td>
              <td className="num">Rs.{formatNumberIn(summary.totalYouOwe)}</td>
            </tr>
            <tr>
              <td>Settlements</td>
              <td className="num">Rs.{formatNumberIn(summary.totalSettlements)}</td>
            </tr>
            <tr className="ledger-summary-table__net">
              <td>Net balance</td>
              <td className="num">Rs.{formatNumberIn(summary.net)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LedgerSheet({ friendName, startDate, endDate, tags, summary }) {
  const stamp = formatGeneratedStamp();
  const blurb = `This statement lists transactions tagged between ${LEDGER_OWNER_NAME} and ${friendName}.`;

  const header = (
    <header className="ledger-sheet__doc-header">
      <div className="ledger-sheet__doc-header-inner">
        <span className="ledger-sheet__doc-brand">FINTRACK</span>
        <h1 className="ledger-sheet__doc-title">Transaction ledger</h1>
        <p className="ledger-sheet__doc-blurb">{blurb}</p>
        <p className="ledger-sheet__doc-period">
          Statement period: {formatDateLedger(startDate)} - {formatDateLedger(endDate)}
        </p>
        <div className="ledger-sheet__doc-rule" aria-hidden="true" />
      </div>
    </header>
  );

  const footer = (
    <footer className="ledger-sheet__footer">
      <span className="ledger-sheet__footer-brand">Fintrack</span>
      <span className="ledger-sheet__footer-sep" aria-hidden="true">
        |
      </span>
      <span className="ledger-sheet__footer-meta">Generated {stamp}</span>
    </footer>
  );

  if (!tags.length) {
    return (
      <div className="ledger-sheet-outer">
        <div className="ledger-sheet">
          {header}
          <div className="ledger-sheet__body">
            <p className="ledger-empty">No transactions in this range.</p>
          </div>
          {footer}
        </div>
      </div>
    );
  }

  const runningBalances = ledgerRunningBalances(tags);
  const settlements = ledgerSettlementIndex(tags);

  return (
    <div className="ledger-sheet-outer">
      <div className="ledger-sheet">
        {header}
        <div className="ledger-sheet__body">
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th className="idx">#</th>
                  <th>Date</th>
                  <th>Name</th>
                  <th>UPI description</th>
                  <th>Bank</th>
                  <th>Direction</th>
                  <th className="num">Amount (Rs.)</th>
                  <th className="num">Balance impact</th>
                  <th className="num">Running balance</th>
                  <th>Settlement link</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag, i) => {
                  const t = tag.transaction || {};
                  const impact = balanceImpactCell(tag.direction, tag.amount);
                  const refLines = ledgerSettlementRefLines(settlements.rows[i]);
                  const name = t.upiName || '—';
                  const desc = t.upiDescription || t.narration || '—';
                  const bank = t.upiBank || '—';
                  return (
                    <tr key={tag.id} className={rowClass(tag.direction)}>
                      <td className="idx">{i + 1}</td>
                      <td>{formatDateLedger(t.transactionDate)}</td>
                      <td>{name}</td>
                      <td>{desc}</td>
                      <td>{bank}</td>
                      <td>
                        <span className="ledger-dir">
                          {ledgerDirectionPhrase(tag.direction, friendName)}
                        </span>
                      </td>
                      <td className="num ledger-table__amount">Rs.{formatNumberIn(ledgerRowAmount(tag))}</td>
                      <td className={`num ${impact.className}`}>{impact.text}</td>
                      <td className="num ledger-table__running">{formatRunningBalance(runningBalances[i])}</td>
                      <td className="ledger-table__links">
                        {refLines.length
                          ? refLines.map((line) => (
                              <span className="ledger-link-line" key={line}>
                                {line}
                              </span>
                            ))
                          : '—'}
                      </td>
                      <td>{tag.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {settlements.groups.length > 0 && (
            <LedgerSettlementDetails groups={settlements.groups} />
          )}
          <LedgerSummaryTable summary={summary} />
        </div>
        {footer}
      </div>
    </div>
  );
}

/** How long a burst of clicks settles before the pinned choices are saved. */
const PREF_SAVE_DEBOUNCE_MS = 600;

function PinIcon({ filled }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M4.5 1.75h7a.75.75 0 0 1 .55 1.26L9.25 6.2v5.05l-1.25 3-1.25-3V6.2L3.95 3.01a.75.75 0 0 1 .55-1.26Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FriendLedgerExportModal({ friend, open, onClose }) {
  const [step, setStep] = useState(1);
  const [startDate, setStartDate] = useState(() => monthBounds().start);
  const [endDate, setEndDate] = useState(() => monthBounds().end);
  const [loadedTags, setLoadedTags] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // Rows whose include/exclude choice is pinned server-side. The pinned value
  // is always whatever the checkbox currently says, so this set plus
  // `selectedIds` is the whole persisted state — no third copy to drift.
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const [prefStatus, setPrefStatus] = useState('');
  const [loadStatus, setLoadStatus] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const ledgerOpenIdRef = useRef(null);

  // Mirrors of the two sets, so a save that fires from a timer or an unmount
  // reads the live values instead of the render that scheduled it.
  const selectedRef = useRef(selectedIds);
  const pinnedRef = useRef(pinnedIds);
  const dirtyRef = useRef(new Set());
  const saveTimerRef = useRef(null);
  const flushRef = useRef(null);

  const resetForFriend = useCallback(() => {
    const b = monthBounds();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    dirtyRef.current = new Set();
    selectedRef.current = new Set();
    pinnedRef.current = new Set();
    setStep(1);
    setStartDate(b.start);
    setEndDate(b.end);
    setLoadedTags([]);
    setSelectedIds(new Set());
    setPinnedIds(new Set());
    setPrefStatus('');
    setLoadStatus('');
    setPdfBusy(false);
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
      // Covers a close driven by the parent rather than the modal's own buttons.
      void flushRef.current?.();
      return;
    }
    if (!friend) return;
    if (ledgerOpenIdRef.current === friend.id) return;
    ledgerOpenIdRef.current = friend.id;
    resetForFriend();
  }, [open, friend?.id, resetForFriend]);

  // A debounce still pending when the modal goes away would lose the edit.
  useEffect(() => () => void flushRef.current?.(), []);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const dateOrderOk = useMemo(() => {
    if (!startDate || !endDate) return false;
    return startDate <= endDate;
  }, [startDate, endDate]);

  const toggleId = useCallback((id) => {
    const key = String(id);
    const next = new Set(selectedRef.current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // A pinned row's saved value follows its checkbox; an unpinned one is
    // this export only.
    commit(next, pinnedRef.current, pinnedRef.current.has(key) ? [key] : []);
  }, [commit]);

  /** Pins the row's current choice, or forgets it if already pinned. */
  const togglePin = useCallback((id) => {
    const key = String(id);
    const next = new Set(pinnedRef.current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    commit(selectedRef.current, next, [key]);
  }, [commit]);

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

  // Step 2's picker. The two control columns are pinned and unsearchable — they
  // are controls, not data. Everything else sorts and searches.
  const selectColumns = useMemo(() => [
    {
      id: 'include',
      header: '',
      width: 44,
      minWidth: 44,
      hideable: false,
      resizable: false,
      filterable: false,
      align: 'center',
      cell: (tag) => (
        <input
          type="checkbox"
          checked={selectedIds.has(String(tag.id))}
          onChange={() => toggleId(tag.id)}
          aria-label={`Include transaction ${tag.id}`}
        />
      ),
    },
    {
      id: 'remember',
      header: 'Saved',
      width: 66,
      minWidth: 58,
      hideable: false,
      resizable: false,
      filterable: false,
      align: 'center',
      cell: (tag) => {
        const key = String(tag.id);
        const isPinned = pinnedIds.has(key);
        const label = isPinned
          ? `Always ${selectedIds.has(key) ? 'included' : 'excluded'} — click to forget`
          : 'Remember this choice for future exports';
        return (
          <button
            type="button"
            className={`ledger-pin${isPinned ? ' is-pinned' : ''}${
              isPinned && !selectedIds.has(key) ? ' is-excluded' : ''
            }`}
            onClick={() => togglePin(tag.id)}
            aria-pressed={isPinned}
            aria-label={label}
            title={label}
          >
            <PinIcon filled={isPinned} />
          </button>
        );
      },
    },
    {
      id: 'date',
      header: 'Date',
      width: 116,
      sortable: true,
      accessor: (tag) => tag.transaction?.transactionDate || '',
      cell: (tag) => formatDateLedger(tag.transaction?.transactionDate),
    },
    {
      id: 'direction',
      header: 'Direction',
      width: 150,
      sortable: true,
      accessor: (tag) => ledgerDirectionPhrase(tag.direction, friend?.name),
      cell: (tag) => ledgerDirectionPhrase(tag.direction, friend?.name),
    },
    {
      id: 'amount',
      header: 'Amount',
      width: 120,
      sortable: true,
      align: 'right',
      className: 'num',
      headerClassName: 'num',
      accessor: (tag) => Number(ledgerRowAmount(tag)) || 0,
      cell: (tag) => `₹${formatNumberIn(ledgerRowAmount(tag))}`,
    },
    {
      id: 'description',
      header: 'Description',
      width: 260,
      sortable: true,
      accessor: (tag) => tag.transaction?.upiDescription || tag.transaction?.narration || '',
      cell: (tag) => tag.transaction?.upiDescription || tag.transaction?.narration || '—',
    },
  ], [selectedIds, pinnedIds, friend?.name, toggleId, togglePin]);

  async function loadTransactions() {
    if (!friend || !dateOrderOk) return;
    setLoadStatus('Loading…');
    try {
      const q = `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
      const res = await apiFetch(`${API_BASE}/friends/${friend.id}/transactions${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to load transactions');
      const rows = data.data || [];

      // A row with a pinned choice comes back set the way it was left; the rest
      // start included, which is what the picker has always defaulted to.
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

      dirtyRef.current = new Set();
      selectedRef.current = selected;
      pinnedRef.current = pinned;
      setLoadedTags(rows);
      setSelectedIds(selected);
      setPinnedIds(pinned);
      setPrefStatus(pinned.size ? `${pinned.size} saved choice${pinned.size === 1 ? '' : 's'} applied` : '');
      setLoadStatus(rows.length ? '' : 'No transactions in this date range.');
      setStep(2);
    } catch (e) {
      setLoadStatus(e.message || 'Failed to load');
    }
  }

  // Every exit and every step change is a checkpoint — don't make the user wait
  // out the debounce to know their pins landed.
  const handleClose = useCallback(() => {
    void flushPrefs();
    onClose?.();
  }, [flushPrefs, onClose]);

  const goToStep = useCallback((next) => {
    void flushRef.current?.();
    setStep(next);
  }, []);

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
      pdf.save(`Transaction-Ledger-${part}-${startDate}-to-${endDate}.pdf`);
    } catch (e) {
      setLoadStatus(e.message || 'PDF export failed');
    } finally {
      setPdfBusy(false);
    }
  }

  if (!open || !friend) return null;

  return createPortal(
    <div
      className="ledger-export-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Export ledger"
      onClick={handleClose}
    >
      <div className="ledger-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ledger-export-modal__header">
          <div>
            <h3>Export transaction ledger</h3>
            <p>
              {friend.name} — PDF with spreadsheet-style layout. Choose a range, exclude rows, then preview
              and export.
            </p>
          </div>
          <button type="button" className="ghost ledger-export-modal__close" onClick={handleClose}>
            Close
          </button>
        </div>

        <nav className="ledger-export-stepper" aria-label="Export steps">
          <div className="ledger-export-stepper__track" aria-hidden="true">
            <div
              className="ledger-export-stepper__track-fill"
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            />
          </div>
          <ol className="ledger-export-stepper__list">
            <li
              className={`ledger-export-stepper__item${step === 1 ? ' is-active' : ''}${step > 1 ? ' is-complete' : ''}`}
              aria-current={step === 1 ? 'step' : undefined}
            >
              <span className="ledger-export-stepper__node" aria-hidden="true">
                {step > 1 ? (
                  <svg className="ledger-export-stepper__check" viewBox="0 0 16 16" width="16" height="16" fill="none">
                    <path
                      d="M3 8.5 6.2 11 13 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  '1'
                )}
              </span>
              <span className="ledger-export-stepper__text">
                <span className="ledger-export-stepper__title">Date range</span>
                <span className="ledger-export-stepper__hint">Pick dates</span>
              </span>
            </li>
            <li
              className={`ledger-export-stepper__item${step === 2 ? ' is-active' : ''}${step > 2 ? ' is-complete' : ''}`}
              aria-current={step === 2 ? 'step' : undefined}
            >
              <span className="ledger-export-stepper__node" aria-hidden="true">
                {step > 2 ? (
                  <svg className="ledger-export-stepper__check" viewBox="0 0 16 16" width="16" height="16" fill="none">
                    <path
                      d="M3 8.5 6.2 11 13 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  '2'
                )}
              </span>
              <span className="ledger-export-stepper__text">
                <span className="ledger-export-stepper__title">Include rows</span>
                <span className="ledger-export-stepper__hint">Choose transactions</span>
              </span>
            </li>
            <li
              className={`ledger-export-stepper__item${step === 3 ? ' is-active' : ''}`}
              aria-current={step === 3 ? 'step' : undefined}
            >
              <span className="ledger-export-stepper__node" aria-hidden="true">
                3
              </span>
              <span className="ledger-export-stepper__text">
                <span className="ledger-export-stepper__title">Preview &amp; PDF</span>
                <span className="ledger-export-stepper__hint">Review &amp; download</span>
              </span>
            </li>
          </ol>
        </nav>

        <div className="ledger-export-body">
          {step === 1 && (
            <div className="ledger-export-dates">
              <label>
                <span>Start date</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                <span>End date</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              {!dateOrderOk && <p className="status">End date must be on or after start date.</p>}
            </div>
          )}

          {step === 2 && (
            <>
              <div className="ledger-export-toolbar">
                <button type="button" className="ghost" onClick={selectAll}>
                  Select all
                </button>
                <button type="button" className="ghost" onClick={selectNone}>
                  Clear all
                </button>
                <span className="ledger-export-toolbar__sep" aria-hidden="true" />
                <button
                  type="button"
                  className="ghost"
                  onClick={rememberAll}
                  disabled={!loadedTags.length || pinnedIds.size === loadedTags.length}
                >
                  Remember all
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={forgetAll}
                  disabled={!pinnedIds.size}
                >
                  Forget saved
                </button>
                <span className="ledger-export-toolbar__count">
                  {selectedIds.size} of {loadedTags.length} selected
                  {pinnedIds.size > 0 && ` · ${pinnedIds.size} saved`}
                </span>
                {prefStatus && (
                  <span className="ledger-export-toolbar__pref-status">{prefStatus}</span>
                )}
              </div>
              <p className="ledger-export-hint">
                Checkboxes apply to this export only. Use the <PinIcon /> pin to keep a row's
                choice for every future export of {friend.name}'s ledger.
              </p>
              <div className="ledger-select-table-wrap">
                <DynamicTable
                  columns={selectColumns}
                  rows={loadedTags}
                  getRowKey={(tag) => String(tag.id)}
                  aria-label="Transactions to include in the export"
                  tableClassName="ledger-select-table"
                  storageKey="fintrack.ledger-export-select"
                  enableGlobalFilter
                  searchPlaceholder="Search transactions…"
                  defaultPageSize={25}
                  maxHeight="46vh"
                  emptyMessage="No transactions in this date range."
                  filteredEmptyMessage="No transactions match your search."
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="ledger-export-preview">
              <LedgerSheet
                friendName={friend.name}
                startDate={startDate}
                endDate={endDate}
                tags={includedTags}
                summary={previewSummary}
              />
            </div>
          )}

          {loadStatus && step !== 1 && <p className="status">{loadStatus}</p>}
        </div>

        <div className="ledger-export-actions">
          {step > 1 && (
            <button type="button" className="ghost" onClick={() => goToStep(step - 1)}>
              Back
            </button>
          )}
          <button type="button" className="ghost" onClick={handleClose}>
            Cancel
          </button>
          {step === 1 && (
            <button
              type="button"
              className="primary"
              disabled={!dateOrderOk}
              onClick={() => void loadTransactions()}
            >
              Load transactions
            </button>
          )}
          {step === 2 && (
            <button type="button" className="primary" onClick={() => goToStep(3)}>
              Preview
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="primary"
              disabled={!includedTags.length || pdfBusy}
              onClick={() => exportPdf()}
            >
              {pdfBusy ? 'Exporting…' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
