import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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

function directionLabel(direction) {
  if (direction === 'I_OWE') return 'I owe';
  if (direction === 'OWES_ME') return 'They owe me';
  if (direction === 'SETTLEMENT') return 'Settlement';
  return 'Nothing outstanding';
}

function rowClass(direction) {
  if (direction === 'OWES_ME') return 'ledger-row--owes';
  if (direction === 'I_OWE') return 'ledger-row--owe';
  if (direction === 'SETTLEMENT') return 'ledger-row--settlement';
  return 'ledger-row--neutral';
}

function balanceImpactCell(direction, amount) {
  if (direction === 'OWES_ME') {
    return { text: `+₹${formatNumberIn(amount)}`, className: 'ledger-impact--pos' };
  }
  if (direction === 'I_OWE') {
    return { text: `-₹${formatNumberIn(amount)}`, className: 'ledger-impact--neg' };
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

function LedgerSummaryCards({ summary }) {
  return (
    <div className="ledger-summary-panel">
      <h2 className="ledger-summary-panel__title">Summary</h2>
      <div className="ledger-summary-cards">
        <div className="ledger-sum-card ledger-sum-card--they">
          <span className="ledger-sum-card__label">Total they owe you</span>
          <span className="ledger-sum-card__value">₹{formatNumberIn(summary.totalTheyOwe)}</span>
        </div>
        <div className="ledger-sum-card ledger-sum-card--you">
          <span className="ledger-sum-card__label">Total you owe</span>
          <span className="ledger-sum-card__value">₹{formatNumberIn(summary.totalYouOwe)}</span>
        </div>
        <div className="ledger-sum-card ledger-sum-card--settle">
          <span className="ledger-sum-card__label">Settlements</span>
          <span className="ledger-sum-card__value">₹{formatNumberIn(summary.totalSettlements)}</span>
        </div>
        <div className="ledger-sum-card ledger-sum-card--net">
          <span className="ledger-sum-card__label">Net balance</span>
          <span className="ledger-sum-card__value">₹{formatNumberIn(summary.net)}</span>
        </div>
      </div>
    </div>
  );
}

function LedgerSheet({ friendName, startDate, endDate, tags, summary }) {
  const stamp = formatGeneratedStamp();

  const header = (
    <header className="ledger-sheet__title-band">
      <div className="ledger-sheet__title-band-inner">
        <span className="ledger-sheet__brand">Fintrack</span>
        <h1 className="ledger-sheet__h1">Transaction ledger</h1>
        <p className="ledger-sheet__friend">{friendName}</p>
        <div className="ledger-sheet__period">
          <span className="ledger-sheet__period-label">Statement period</span>
          <span className="ledger-sheet__period-dates">
            {formatDateLedger(startDate)} — {formatDateLedger(endDate)}
          </span>
        </div>
      </div>
    </header>
  );

  const footer = (
    <footer className="ledger-sheet__footer">
      <span className="ledger-sheet__footer-brand">Fintrack</span>
      <span className="ledger-sheet__footer-dot" aria-hidden="true">
        ·
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
                  <th className="num">Amount (₹)</th>
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
                        <span className="ledger-dir">{directionLabel(tag.direction)}</span>
                      </td>
                      <td className="num ledger-table__amount">₹{formatNumberIn(tag.amount)}</td>
                      <td className={`num ${impact.className}`}>{impact.text}</td>
                      <td>{tag.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <LedgerSummaryCards summary={summary} />
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
  const ledgerRef = useRef(null);
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

  async function exportPdf() {
    const el = ledgerRef.current;
    if (!el || !includedTags.length) return;
    setPdfBusy(true);
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      const canvas = await html2canvas(el, {
        scale: 2.25,
        useCORS: true,
        backgroundColor: '#e4eaf2',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

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

        <div className="ledger-export-steps" aria-hidden="true">
          <span className={step === 1 ? 'is-active' : ''}>1. Date range</span>
          <span className={step === 2 ? 'is-active' : ''}>2. Include rows</span>
          <span className={step === 3 ? 'is-active' : ''}>3. Preview & PDF</span>
        </div>

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
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
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
                          <td>{directionLabel(tag.direction)}</td>
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
            <div ref={ledgerRef}>
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
              onClick={() => void exportPdf()}
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
