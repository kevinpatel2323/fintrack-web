import { useEffect, useState } from 'react';
import Portal from './Portal.jsx';
import { GhostBtn, PrimaryBtn, Pill } from './ui/primitives.jsx';
import { IcDownload } from './ui/Icon.jsx';
import { downloadCategoryCsv } from '../services/categoriesApi.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetRange(preset) {
  const today = new Date();
  switch (preset) {
    case 'thisMonth':
      return { start: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), end: ymd(today) };
    case '30days': {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      return { start: ymd(start), end: ymd(today) };
    }
    case 'thisYear':
      return { start: ymd(new Date(today.getFullYear(), 0, 1)), end: ymd(today) };
    default:
      return { start: '', end: '' };
  }
}

export default function CategoryExportModal({ category, open, onClose }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // Reset to the "all time" default whenever the modal opens for a category.
  useEffect(() => {
    if (open) {
      setStart('');
      setEnd('');
      setBusy(false);
      setStatus('');
    }
  }, [open, category?.id]);

  if (!open || !category) return null;

  const dateOrderOk = !start || !end || start <= end;
  const isAllTime = !start && !end;

  function applyPreset(preset) {
    const r = presetRange(preset);
    setStart(r.start);
    setEnd(r.end);
  }

  async function exportCsv() {
    if (!dateOrderOk) return;
    setBusy(true);
    setStatus('');
    try {
      await downloadCategoryCsv(category.id, {
        start: start || undefined,
        end: end || undefined,
      });
      onClose();
    } catch (e) {
      setStatus(e.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
      <div
        className="calendar-sheet-backdrop"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="calendar-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Export category transactions"
        >
          <div className="ft-sheet__grabber" />
          <h3 className="ft-sheet__title">Export “{category.name}”</h3>
          <p className="ft-sheet__sub">
            Download this category’s transactions as a CSV. Leave the dates empty to export
            everything.
          </p>

          <div className="form-grid">
            <label className="field">
              <span>Start date</span>
              <input
                type="date"
                value={start}
                max={end || undefined}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="field">
              <span>End date</span>
              <input
                type="date"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Quick ranges</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <Pill active={isAllTime} onClick={() => applyPreset('all')}>
                  All time
                </Pill>
                <Pill onClick={() => applyPreset('thisMonth')}>This month</Pill>
                <Pill onClick={() => applyPreset('30days')}>Last 30 days</Pill>
                <Pill onClick={() => applyPreset('thisYear')}>This year</Pill>
              </div>
            </div>

            {!dateOrderOk && (
              <p className="status" style={{ gridColumn: '1 / -1' }}>
                End date must be on or after start date.
              </p>
            )}

            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 6,
              }}
            >
              <GhostBtn onClick={onClose} disabled={busy}>
                Cancel
              </GhostBtn>
              <PrimaryBtn onClick={exportCsv} disabled={busy || !dateOrderOk}>
                <IcDownload size={16} /> {busy ? 'Exporting…' : 'Export CSV'}
              </PrimaryBtn>
            </div>

            {status && (
              <p className="status" style={{ gridColumn: '1 / -1' }}>
                {status}
              </p>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
