import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildLedgerPdf } from '../utils/ledgerPdf';
import { LEDGER_OWNER_NAME, ledgerDirectionPhrase } from '../utils/ledgerParties';
import './FriendLedgerExportModal.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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

function balanceImpactCell(direction, amount) {
  if (direction === 'OWES_ME') {
    return { text: `+Rs.${formatNumberIn(amount)}`, className: 'ledger-impact--pos' };
  }
  if (direction === 'I_OWE') {
    return { text: `-Rs.${formatNumberIn(amount)}`, className: 'ledger-impact--neg' };
  }
  if (direction === 'SETTLEMENT') {
    return { text: 'Settled', className: 'ledger-impact--settled' };
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
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag, i) => {
                  const t = tag.transaction || {};
                  const impact = balanceImpactCell(tag.direction, tag.amount);
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
                      <td className="num ledger-table__amount">Rs.{formatNumberIn(tag.amount)}</td>
                      <td className={`num ${impact.className}`}>{impact.text}</td>
                      <td>{tag.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <LedgerSummaryTable summary={summary} />
        </div>
        {footer}
      </div>
    </div>
  );
}

export default function FriendLedgerExportModal({ friend, open, onClose }) {
  const [step, setStep] = useState(1);
  const [startDate, setStartDate] = useState(() => monthBounds().start);
  const [endDate, setEndDate] = useState(() => monthBounds().end);
  const [loadedTags, setLoadedTags] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loadStatus, setLoadStatus] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const ledgerOpenIdRef = useRef(null);

  const resetForFriend = useCallback(() => {
    const b = monthBounds();
    setStep(1);
    setStartDate(b.start);
    setEndDate(b.end);
    setLoadedTags([]);
    setSelectedIds(new Set());
    setLoadStatus('');
    setPdfBusy(false);
  }, []);

  useEffect(() => {
    if (!open) {
      ledgerOpenIdRef.current = null;
      return;
    }
    if (!friend) return;
    if (ledgerOpenIdRef.current === friend.id) return;
    ledgerOpenIdRef.current = friend.id;
    resetForFriend();
  }, [open, friend?.id, resetForFriend]);

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

  async function loadTransactions() {
    if (!friend || !dateOrderOk) return;
    setLoadStatus('Loading…');
    try {
      const q = `?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
      const res = await fetch(`${API_BASE}/friends/${friend.id}/transactions${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to load transactions');
      const rows = data.data || [];
      setLoadedTags(rows);
      setSelectedIds(new Set(rows.map((r) => String(r.id))));
      setLoadStatus(rows.length ? '' : 'No transactions in this date range.');
      setStep(2);
    } catch (e) {
      setLoadStatus(e.message || 'Failed to load');
    }
  }

  const toggleId = (id) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(loadedTags.map((r) => String(r.id))));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

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
      onClick={onClose}
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
          <button type="button" className="ghost ledger-export-modal__close" onClick={onClose}>
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
                <span className="ledger-export-toolbar__count">
                  {selectedIds.size} of {loadedTags.length} selected
                </span>
              </div>
              <div className="ledger-select-table-wrap">
                <table className="ledger-select-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }} />
                      <th>Date</th>
                      <th>Direction</th>
                      <th className="num">Amount</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadedTags.map((tag) => {
                      const t = tag.transaction || {};
                      const checked = selectedIds.has(String(tag.id));
                      return (
                        <tr key={tag.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleId(tag.id)}
                              aria-label={`Include transaction ${tag.id}`}
                            />
                          </td>
                          <td>{formatDateLedger(t.transactionDate)}</td>
                          <td>{ledgerDirectionPhrase(tag.direction, friend.name)}</td>
                          <td className="num">₹{formatNumberIn(tag.amount)}</td>
                          <td>{t.upiDescription || t.narration || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
            <button type="button" className="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
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
            <button type="button" className="primary" onClick={() => setStep(3)}>
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
