import { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DynamicTable from '../components/DynamicTable.jsx';
import StatementQueue from '../components/StatementQueue.jsx';
import { refreshImportSchedule } from '../hooks/useImportSchedule.js';
import {
  Card, Num, GhostBtn, PrimaryBtn, Overline,
} from '../components/ui/primitives.jsx';
import {
  IcUpload, IcCheck, IcChevR, IcReceipt, IcRefresh, IcTrash,
} from '../components/ui/Icon.jsx';
import { useIsCompact } from '../styles/breakpoints.js';
import { inr } from '../utils/inr.js';
import './import-redesign.css';

import { API_BASE, apiFetch } from '../services/http.js';

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function fmtShortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(d);
}

const matchKey = (m) => `${m.parsedIndex}:${m.existingId}`;

/**
 * Rows on this statement that look like transactions already entered by hand —
 * the mid-cycle spend added before the statement existed. Merging bills the
 * existing row in place, so its category, notes and friend tags survive;
 * importing it as a new row instead would double-count the spend in every
 * ledger it is tagged into.
 */
function MatchReview({ matches, confirmedKeys, onToggle }) {
  if (!matches || matches.length === 0) return null;
  return (
    <Card pad={14} style={{ marginBottom: 14 }}>
      <Overline>Already added by you</Overline>
      <p style={{ margin: '6px 0 12px', fontSize: 13, color: 'var(--ft-text-dim)' }}>
        {confirmedKeys.size} of {matches.length} will merge into the entry you
        already made instead of being added again. Untick any that are actually
        separate charges.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {matches.map((m) => {
          const key = matchKey(m);
          const checked = confirmedKeys.has(key);
          return (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '9px 11px',
                borderRadius: 10,
                border: '1px solid var(--ft-border)',
                background: checked ? 'var(--ft-surface-2)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(key)}
                style={{ marginTop: 3 }}
              />
              <span style={{ display: 'grid', gap: 2, fontSize: 13, minWidth: 0 }}>
                <span style={{ color: 'var(--ft-text)' }}>
                  {fmtShortDate(m.statementRow.txnDate)} · {m.statementRow.merchant}
                  {' · '}
                  <Num size={13} weight={600}>{inr(m.statementRow.amount)}</Num>
                  {m.statementRow.isRefund ? ' (refund)' : ''}
                </span>
                <span style={{ color: 'var(--ft-text-dim)' }}>
                  merges into your entry “{m.existingRow.merchant}” of{' '}
                  {fmtShortDate(m.existingRow.txnDate)}
                  {m.dateDeltaDays > 0 && (
                    <span style={{ color: 'var(--ft-warn)' }}>
                      {' '}· {m.dateDeltaDays} day{m.dateDeltaDays === 1 ? '' : 's'} apart
                    </span>
                  )}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * The card statement being previewed jumps past ones that are already out but
 * not imported. Importing out of order works, but it is usually a slip — the
 * skipped months then show as missing until they are imported too.
 */
function SkipWarning({ preview }) {
  const skipped = preview?.skippedStatements || [];
  if (skipped.length === 0) return null;
  const labels = skipped.map((s) => s.label);
  const list = labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
    : labels[0];
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: 'var(--ft-warn-soft)', color: 'var(--ft-text)',
      fontSize: 12.5, lineHeight: 1.5,
    }}>
      <strong style={{ color: 'var(--ft-warn)' }}>Out of order.</strong>{' '}
      {list} {labels.length > 1 ? 'are' : 'is'} out but not imported yet, and this
      statement comes after {labels.length > 1 ? 'them' : 'it'}. You can still
      import it — or go back and import {list} first.
    </div>
  );
}

function isoDateMinusDays(isoDate, days) {
  if (!isoDate) return null;
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** A parsed statement row's signed amount — deposits credit, withdrawals debit. */
function previewRowAmount(row) {
  const deposit = Number(row.deposit || 0);
  return deposit > 0 ? deposit : -Number(row.withdrawal || 0);
}

/** Columns for the pre-import preview of the parsed statement. */
const PREVIEW_COLUMNS = [
  {
    id: 'transactionDate',
    header: 'Date',
    width: 120,
    minWidth: 96,
    sortable: true,
    accessor: (row) => row.transactionDate || '',
    filterValue: (row) => fmtDate(row.transactionDate),
    cell: (row) => (
      <span style={{ color: 'var(--ft-text-dim)', fontSize: 12.5 }}>{fmtDate(row.transactionDate)}</span>
    ),
  },
  {
    id: 'narration',
    header: 'Narration',
    width: 360,
    minWidth: 180,
    sortable: true,
    hideable: false,
    accessor: (row) => (row.upiName || row.narration || '').toLowerCase(),
    filterValue: (row) => `${row.upiName || ''} ${row.narration || ''}`,
    cell: (row) => (
      <span
        title={row.narration || undefined}
        style={{
          display: 'block',
          color: 'var(--ft-text-dim)',
          fontFamily: 'var(--ft-font-mono)',
          fontSize: 11.5,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.upiName || row.narration}
      </span>
    ),
  },
  {
    id: 'amount',
    header: 'Amount',
    width: 130,
    minWidth: 100,
    sortable: true,
    align: 'right',
    accessor: previewRowAmount,
    filterValue: (row) => String(Math.abs(previewRowAmount(row))),
    cell: (row) => {
      const amount = previewRowAmount(row);
      const isIncome = amount > 0;
      return (
        <Num size={13} weight={600} color={isIncome ? 'var(--ft-income)' : 'var(--ft-text)'}>
          {inr(amount, { sign: isIncome })}
        </Num>
      );
    },
  },
];

export default function StatementImport() {
  const isMobile = useIsCompact();

  const [lastImport, setLastImport] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [imports, setImports] = useState([]);
  const [importsLoading, setImportsLoading] = useState(false);
  const [importsError, setImportsError] = useState('');
  const [importsStatus, setImportsStatus] = useState('');
  const [revertingImportId, setRevertingImportId] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  // Which proposed merges the user has left ticked, as `parsedIndex:existingId`.
  const [confirmedMatchKeys, setConfirmedMatchKeys] = useState(() => new Set());
  const [previewFileKey, setPreviewFileKey] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileKey = (f) => (f ? `${f.name}-${f.size}-${f.lastModified}` : '');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/imports/accounts`);
        if (res.ok) {
          const data = await res.json();
          setAccounts(Array.isArray(data) ? data : (data?.data ?? []));
        }
      } catch {}
    })();
    loadHistory();
  }, []);

  useEffect(() => {
    loadLastImport(selectedAccount);
  }, [selectedAccount]);

  async function loadLastImport(acct) {
    try {
      const url = acct
        ? `${API_BASE}/imports/last?accountNumber=${encodeURIComponent(acct)}`
        : `${API_BASE}/imports/last`;
      const res = await apiFetch(url);
      if (res.status === 404) { setLastImport(null); return; }
      if (res.ok) setLastImport(await res.json());
    } catch {}
  }

  async function loadHistory() {
    setImportsLoading(true);
    setImportsError('');
    try {
      const res = await apiFetch(`${API_BASE}/imports?page=1&limit=6`);
      if (!res.ok) throw new Error('Failed to fetch imports');
      const data = await res.json();
      setImports(data.data || []);
    } catch (e) { setImportsError(e.message || 'Failed to fetch imports'); }
    finally { setImportsLoading(false); }
  }

  async function handlePreview() {
    if (!uploadFile) return;
    setUploadStatus('Generating preview…');
    setUploadResult(null);
    setUploadPreview(null);
    try {
      const fd = new FormData();
      fd.append('statement', uploadFile);
      const res = await apiFetch(`${API_BASE}/imports/hdfc/preview`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setUploadPreview(data);
      setConfirmedMatchKeys(new Set((data.matches || []).map(matchKey)));
      setPreviewFileKey(fileKey(uploadFile));
      setUploadStatus('');
    } catch (e) { setUploadStatus(e.message || 'Preview failed'); }
  }

  // Unticking a merge turns that statement row back into a fresh insert, so the
  // preview's own counts have to move with it.
  function toggleMatch(key) {
    setConfirmedMatchKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setUploadPreview((p) => {
        if (!p || p.kind !== 'card') return p;
        const matchedRows = next.size;
        const newRows = (p.totalParsed ?? 0) - matchedRows;
        return {
          ...p,
          matchedRows,
          newRows,
          willInsert: p.alreadyImported ? 0 : newRows,
        };
      });
      return next;
    });
  }

  async function handleUpload() {
    if (!uploadFile || !uploadPreview || previewFileKey !== fileKey(uploadFile)) return;
    setIsUploading(true);
    setUploadStatus('Importing…');
    try {
      const fd = new FormData();
      fd.append('statement', uploadFile);
      if (uploadPreview.kind === 'card' && (uploadPreview.matches || []).length > 0) {
        fd.append(
          'confirmedMatches',
          JSON.stringify(
            uploadPreview.matches
              .filter((m) => confirmedMatchKeys.has(matchKey(m)))
              .map(({ parsedIndex, existingId }) => ({ parsedIndex, existingId })),
          ),
        );
      }
      const res = await apiFetch(`${API_BASE}/imports/hdfc`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setUploadResult(data);
      setUploadPreview(null);
      setConfirmedMatchKeys(new Set());
      setPreviewFileKey('');
      setUploadFile(null);
      setUploadStatus('');
      await refreshAfterUpload();
    } catch (e) { setUploadStatus(e.message || 'Import failed'); }
    finally { setIsUploading(false); }
  }

  async function refreshAfterUpload() {
    await Promise.all([
      loadLastImport(selectedAccount),
      loadHistory(),
      refreshImportSchedule(),
    ]);
  }

  function resetUpload() {
    setUploadFile(null);
    setUploadPreview(null);
    setPreviewFileKey('');
    setUploadStatus('');
    setUploadResult(null);
  }

  function handleFileInput(f) {
    if (!f) return;
    setUploadFile(f);
    setUploadPreview(null);
    setPreviewFileKey('');
    setUploadStatus('');
    setUploadResult(null);
  }

  function askRevert(id) {
    setConfirmState({
      open: true,
      title: `Revert import #${id}?`,
      message: 'All transactions created by this import will be removed.',
      confirmLabel: 'Revert',
      onConfirm: async () => {
        setConfirmState({ open: false });
        await runRevert(id);
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  async function runRevert(id) {
    setImportsError('');
    setImportsStatus(`Reverting…`);
    setRevertingImportId(id);
    try {
      const res = await apiFetch(`${API_BASE}/imports/${id}/revert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Revert failed');
      setImportsStatus(`Reverted ${data.removedTransactions || 0} transactions.`);
      await refreshAfterUpload();
    } catch (e) { setImportsError(e.message || 'Revert failed'); setImportsStatus(''); }
    finally { setRevertingImportId(null); }
  }

  // Derived state
  const step = !uploadFile ? 1 : (!uploadPreview || previewFileKey !== fileKey(uploadFile)) ? 2 : 3;
  const previewRows = uploadPreview?.previewRows || [];
  const net = previewRows.reduce((s, r) => s + Number(r.deposit || 0) - Number(r.withdrawal || 0), 0);
  const debits = previewRows.reduce((s, r) => s + Number(r.withdrawal || 0), 0);
  const credits = previewRows.reduce((s, r) => s + Number(r.deposit || 0), 0);
  const period = uploadPreview?.periodStart && uploadPreview?.periodEnd
    ? `${fmtShortDate(uploadPreview.periodStart)} – ${fmtShortDate(uploadPreview.periodEnd)}`
    : '—';
  // The API detects whether the upload is a bank or credit card statement and
  // resolves the target itself, so the label follows whatever came back.
  const isCardStatement = uploadPreview?.kind === 'card';
  const lastFour = (isCardStatement
    ? uploadPreview?.card?.last4
    : uploadPreview?.accountNumber?.slice(-4)) || '';
  const destination = !uploadPreview
    ? ''
    : isCardStatement
      ? `${uploadPreview.card?.nickname || uploadPreview.card?.name || 'Card'} · •••• ${lastFour}`
      : `HDFC Bank · Acct •••• ${lastFour}`;

  const STEPS = [
    { label: 'Upload file',      done: step > 1, active: step === 1 },
    { label: 'Review & map',     done: step > 2, active: step === 2 },
    { label: 'Confirm & apply',  done: false,    active: step === 3 },
  ];

  if (isMobile) return (
    <MobileView
      step={step}
      uploadFile={uploadFile}
      uploadPreview={uploadPreview}
      uploadStatus={uploadStatus}
      uploadResult={uploadResult}
      isUploading={isUploading}
      confirmedMatchKeys={confirmedMatchKeys}
      onToggleMatch={toggleMatch}
      isDragging={isDragging}
      previewRows={previewRows}
      net={net} debits={debits} credits={credits} period={period} lastFour={lastFour} destination={destination}
      imports={imports} importsLoading={importsLoading} importsError={importsError} importsStatus={importsStatus}
      revertingImportId={revertingImportId}
      lastImport={lastImport}
      accounts={accounts}
      selectedAccount={selectedAccount}
      onAccountChange={setSelectedAccount}
      confirmState={confirmState}
      STEPS={STEPS}
      onFileInput={handleFileInput}
      onPreview={handlePreview}
      onUpload={handleUpload}
      onReset={resetUpload}
      onRevert={askRevert}
      onRefresh={loadHistory}
      setIsDragging={setIsDragging}
    />
  );

  return (
    <>
      <ConfirmDialog {...confirmState} />

      <header className="ft-page-header">
        <div>
          <p className="ft-page-header__sub">
            {lastImport
              ? `Last import · ${fmtDate(lastImport.uploadedAt)}`
              : 'No imports yet'}
          </p>
          <h1 className="ft-page-header__title">Import statement</h1>
        </div>
      </header>

      <div className="ft-split" style={{ '--ft-split-aside': '340px', gap: 16 }}>
        {/* ── Left: wizard, then history — the two things this page is for ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ background: 'var(--ft-surface)', borderRadius: 18, border: '1px solid var(--ft-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Step bar */}
            <div className="imp-step-bar">
              {STEPS.map((s, i) => (
                <div key={i} className="imp-step-bar__item">
                  <div className={`imp-step-bar__node ${s.done ? 'imp-step-bar__node--done' : s.active ? 'imp-step-bar__node--active' : ''}`}>
                    {s.done ? <IcCheck size={13} /> : i + 1}
                  </div>
                  <span className={`imp-step-bar__label ${s.active ? 'imp-step-bar__label--active' : ''}`}>{s.label}</span>
                  {i < 2 && <div className="imp-step-bar__line" />}
                </div>
              ))}
            </div>

            {uploadResult && <ImportedBanner uploadResult={uploadResult} style={{ margin: '16px 16px 0' }} />}

            {/* Step 1 — drop zone */}
            {step === 1 && (
              <label
                className={`imp-drop-full${isDragging ? ' imp-drop-full--drag' : ''}`}
                htmlFor="imp-file-desktop"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileInput(e.dataTransfer.files?.[0]); }}
              >
                <div className="imp-drop-full__icon"><IcUpload size={22} /></div>
                <div style={{ color: 'var(--ft-text)', fontWeight: 600, fontSize: 15 }}>Drop your HDFC statement here</div>
                <div style={{ color: 'var(--ft-text-dim)', fontSize: 13, marginTop: 4, maxWidth: 380, lineHeight: 1.5 }}>
                  Bank account or credit card — we work out which, and skip rows you already have.
                </div>
                <div style={{ marginTop: 16 }}>
                  <span className="imp-browse-btn">Browse file</span>
                </div>
                <div style={{ color: 'var(--ft-text-faint)', fontSize: 11.5, marginTop: 10 }}>XLSX or XLS · up to 10 MB</div>
                <input
                  id="imp-file-desktop"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileInput(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
              </label>
            )}

            {/* Step 2 — file selected, no preview yet */}
            {step === 2 && (
              <>
                <FileInfoRow
                  uploadFile={uploadFile}
                  uploadPreview={uploadPreview}
                  destination={destination}
                  onRemove={resetUpload}
                />
                <div style={{ padding: '14px 22px', borderTop: '1px solid var(--ft-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <PrimaryBtn onClick={handlePreview}>Generate preview</PrimaryBtn>
                  <GhostBtn onClick={resetUpload}>Cancel</GhostBtn>
                  {uploadStatus && <span style={{ color: 'var(--ft-spend)', fontSize: 13 }}>{uploadStatus}</span>}
                </div>
              </>
            )}

            {/* Step 3 — preview ready */}
            {step === 3 && (
              <>
                <FileInfoRow
                  uploadFile={uploadFile}
                  uploadPreview={uploadPreview}
                  destination={destination}
                  onRemove={resetUpload}
                />

                {uploadPreview.skippedStatements?.length > 0 && (
                  <div style={{ padding: '0 22px 14px' }}>
                    <SkipWarning preview={uploadPreview} />
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--ft-border)' }}>
                  <DynamicTable
                    columns={PREVIEW_COLUMNS}
                    rows={previewRows}
                    getRowKey={(row, index) => index}
                    aria-label="Statement rows to import"
                    tableClassName="imp-preview-table"
                    storageKey="fintrack.import-preview"
                    enableGlobalFilter
                    searchPlaceholder="Search narration…"
                    defaultPageSize={25}
                    maxHeight="52vh"
                    emptyMessage={`All ${uploadPreview.skippedRows} rows already imported — nothing new to add.`}
                  />
                </div>

                <div style={{ padding: '14px 22px 0' }}>
                  <MatchReview
                    matches={uploadPreview.matches}
                    confirmedKeys={confirmedMatchKeys}
                    onToggle={toggleMatch}
                  />
                </div>

                {/* Footer */}
                <div className="imp-tbl-footer">
                  <span style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>
                    {[
                      previewRows.length > 0 ? `${uploadPreview.willInsert} new` : null,
                      uploadPreview.matchedRows > 0 ? `${uploadPreview.matchedRows} merged` : null,
                      `${uploadPreview.skippedRows} duplicates skipped`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {uploadStatus && <span style={{ color: 'var(--ft-spend)', fontSize: 13 }}>{uploadStatus}</span>}
                    <GhostBtn onClick={() => { setUploadPreview(null); setPreviewFileKey(''); }}>Back</GhostBtn>
                    <PrimaryBtn
                      onClick={handleUpload}
                      disabled={isUploading || uploadPreview.willInsert === 0}
                    >
                      {isUploading ? 'Importing…' : `Import ${uploadPreview.willInsert} transactions`} <IcChevR size={14} />
                    </PrimaryBtn>
                  </div>
                </div>
              </>
            )}
          </div>

          <HistoryCard
            imports={imports}
            importsLoading={importsLoading}
            importsError={importsError}
            importsStatus={importsStatus}
            revertingImportId={revertingImportId}
            onRevert={askRevert}
            onRefresh={loadHistory}
          />
        </div>

        {/* ── Right: what to import next, or what this file holds ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {uploadPreview && (
            <SummaryCard uploadPreview={uploadPreview} net={net} period={period} debits={debits} credits={credits} />
          )}

          {/* Rows breakdown (only when preview loaded) */}
          {uploadPreview && (
            <Card pad={18}>
              <Overline style={{ marginBottom: 10 }}>Rows</Overline>
              <ProgressRow label="Will import" value={uploadPreview.willInsert} total={uploadPreview.totalParsed} color="var(--ft-accent)" />
              <ProgressRow label="Duplicates skipped" value={uploadPreview.skippedRows} total={uploadPreview.totalParsed} color="var(--ft-text-faint)" />
            </Card>
          )}

          <StatementQueue />
          <LastImportCard
            lastImport={lastImport}
            accounts={accounts}
            selectedAccount={selectedAccount}
            onAccountChange={setSelectedAccount}
          />
        </div>
      </div>
    </>
  );
}

// ── Mobile view ─────────────────────────────────────────────────────────────

function MobileView({
  step, uploadFile, uploadPreview, uploadStatus, uploadResult, isUploading,
  confirmedMatchKeys, onToggleMatch,
  isDragging, previewRows, net, debits, credits, period, lastFour, destination,
  imports, importsLoading, importsError, importsStatus, revertingImportId,
  lastImport, accounts, selectedAccount, onAccountChange,
  confirmState, STEPS, onFileInput, onPreview, onUpload, onReset, onRevert, onRefresh,
  setIsDragging,
}) {
  return (
    <>
      <ConfirmDialog {...confirmState} />
      <header className="ft-mobile__header">
        <h1 className="ft-mobile__title">Import</h1>
        <span style={{ width: 40 }} />
      </header>
      <main className="ft-mobile__content">

        {/* Step indicator — wraps onto a second line rather than pushing the
            page sideways on the narrowest phones, where the three labels are
            together wider than the content column. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 10 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: i < 2 ? '0 1 auto' : '1 1 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: s.done ? 'var(--ft-accent)' : s.active ? 'var(--ft-surface-2)' : 'transparent',
                  border: s.active ? '1.5px solid var(--ft-accent)' : s.done ? 'none' : '1.5px solid var(--ft-border)',
                  color: s.done ? 'var(--ft-text-on-accent)' : s.active ? 'var(--ft-accent)' : 'var(--ft-text-faint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--ft-font-mono)', fontSize: 11, fontWeight: 700,
                }}>
                  {s.done ? <IcCheck size={12} /> : i + 1}
                </div>
                <span style={{ color: s.active ? 'var(--ft-text)' : 'var(--ft-text-dim)', fontSize: 13, fontWeight: s.active ? 600 : 500 }}>
                  {s.label}
                </span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: 'var(--ft-border)' }} />}
            </div>
          ))}
        </div>

        {/* What to upload is only a question before a file is picked. */}
        {step === 1 && <StatementQueue />}

        <LastImportCard
          lastImport={lastImport}
          accounts={accounts}
          selectedAccount={selectedAccount}
          onAccountChange={onAccountChange}
        />
        {uploadPreview && (
          <SummaryCard uploadPreview={uploadPreview} net={net} period={period} debits={debits} credits={credits} />
        )}

        {/* Step 1 — drop zone */}
        {step === 1 && (
          <label
            className={`imp-drop${isDragging ? ' imp-drop--dragging' : ''}`}
            htmlFor="imp-file-mobile"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFileInput(e.dataTransfer.files?.[0]); }}
          >
            <IcUpload size={28} style={{ color: 'var(--ft-text-dim)', marginBottom: 8 }} />
            <div style={{ color: 'var(--ft-text)', fontWeight: 500 }}>Drop HDFC statement or tap to browse</div>
            <div style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>XLSX or XLS · up to 10 MB</div>
            <input id="imp-file-mobile" type="file" accept=".xlsx,.xls" onChange={(e) => onFileInput(e.target.files?.[0])} style={{ display: 'none' }} />
          </label>
        )}

        {/* Step 2 & 3 — file summary card */}
        {step >= 2 && (
          <Card pad={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="imp-xlsx-icon">XLSX</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--ft-text)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {uploadFile?.name}
                </div>
                <div style={{ color: 'var(--ft-text-dim)', fontSize: 12, marginTop: 2 }}>
                  {uploadPreview
                    ? `${destination} · ${period}`
                    : `${((uploadFile?.size || 0) / 1024).toFixed(1)} KB`}
                </div>
              </div>
              {step === 3 ? (
                <IcCheck size={20} style={{ color: 'var(--ft-income)', flexShrink: 0 }} />
              ) : (
                <button type="button" onClick={onReset} style={{ background: 'none', border: 0, color: 'var(--ft-text-faint)', cursor: 'pointer', padding: 4 }}>
                  <IcTrash size={16} />
                </button>
              )}
            </div>

            {/* 3-up stats (step 3 only) */}
            {step === 3 && uploadPreview && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--ft-surface-2)', borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { l: 'New',       v: uploadPreview.willInsert,  c: 'var(--ft-accent)' },
                  { l: 'Merged',    v: uploadPreview.matchedRows ?? 0, c: 'var(--ft-warn)' },
                  { l: 'Duplicate', v: uploadPreview.skippedRows, c: 'var(--ft-text-dim)' },
                ].map((s) => (
                  <div key={s.l}>
                    <Num size={18} weight={600} color={s.c} style={{ display: 'block' }}>{s.v}</Num>
                    <div style={{ color: 'var(--ft-text-dim)', fontSize: 11, marginTop: 1 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {step === 3 && uploadPreview && <SkipWarning preview={uploadPreview} />}

        {step === 3 && uploadPreview && (
          <MatchReview
            matches={uploadPreview.matches}
            confirmedKeys={confirmedMatchKeys}
            onToggle={onToggleMatch}
          />
        )}

        {/* Preview rows (step 3) */}
        {step === 3 && previewRows.length > 0 && (
          <>
            <div style={{ color: 'var(--ft-text)', fontSize: 15, fontWeight: 600, margin: '4px 0 6px' }}>
              Preview · {Math.min(previewRows.length, 10)} of {uploadPreview.willInsert}
            </div>
            <Card pad={0}>
              {previewRows.slice(0, 10).map((r, i) => {
                const w = Number(r.withdrawal || 0);
                const d = Number(r.deposit || 0);
                const isIncome = d > 0;
                const amt = isIncome ? d : w;
                return (
                  <div key={i} style={{ padding: '12px 16px', borderBottom: i < Math.min(previewRows.length, 10) - 1 ? '1px solid var(--ft-border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Num size={11} weight={500} color="var(--ft-text-dim)">{fmtShortDate(r.transactionDate)}</Num>
                      <Num size={14} weight={600} color={isIncome ? 'var(--ft-income)' : 'var(--ft-text)'}>
                        {inr(isIncome ? amt : -amt, { sign: isIncome })}
                      </Num>
                    </div>
                    <div style={{ color: 'var(--ft-text-dim)', fontFamily: 'var(--ft-font-mono)', fontSize: 11, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.upiName || r.narration}
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        )}

        {step === 3 && previewRows.length === 0 && uploadPreview && (
          <div style={{ textAlign: 'center', color: 'var(--ft-text-dim)', fontSize: 14, padding: '20px 0' }}>
            All {uploadPreview.skippedRows} rows already imported.
          </div>
        )}

        {uploadStatus && <p className="status" style={{ textAlign: 'center' }}>{uploadStatus}</p>}
        {uploadResult && <ImportedBanner uploadResult={uploadResult} />}

        {/* CTAs */}
        {step === 2 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn style={{ flex: 1 }} onClick={onReset}>Cancel</GhostBtn>
            <PrimaryBtn style={{ flex: 2 }} onClick={onPreview}>Generate preview</PrimaryBtn>
          </div>
        )}
        {step === 3 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn style={{ flex: 1 }} onClick={() => { setIsDragging(false); onReset(); }}>Cancel</GhostBtn>
            <PrimaryBtn
              style={{ flex: 2 }}
              onClick={onUpload}
              disabled={isUploading || (uploadPreview && uploadPreview.willInsert === 0)}
            >
              {isUploading ? 'Importing…' : `Import ${uploadPreview?.willInsert ?? 0} transactions`}
            </PrimaryBtn>
          </div>
        )}

        <HistoryCard
          imports={imports}
          importsLoading={importsLoading}
          importsError={importsError}
          importsStatus={importsStatus}
          revertingImportId={revertingImportId}
          onRevert={onRevert}
          onRefresh={onRefresh}
        />
      </main>
    </>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function FileInfoRow({ uploadFile, uploadPreview, destination, onRemove }) {
  return (
    <div style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="imp-xlsx-icon">XLSX</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--ft-text)', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {uploadFile?.name}
        </div>
        <div style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, marginTop: 2 }}>
          {uploadPreview
            ? `${destination} · ${uploadPreview.totalParsed} detected · ${uploadPreview.skippedRows} duplicates skipped`
            : `${((uploadFile?.size || 0) / 1024).toFixed(1)} KB · Ready to preview`}
        </div>
      </div>
      {uploadPreview ? (
        <span style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--ft-income-soft)', color: 'var(--ft-income)', fontSize: 11.5, fontWeight: 600, flexShrink: 0 }}>
          Auto-mapped
        </span>
      ) : (
        <button type="button" onClick={onRemove} style={{ background: 'none', border: 0, color: 'var(--ft-text-faint)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
          <IcTrash size={16} />
        </button>
      )}
    </div>
  );
}

/** "•• 6714" for a bank account number; anything else (e.g. "Wallet") as is. */
function accountLabel(accountNumber) {
  if (!accountNumber) return '—';
  return /^\d{5,}$/.test(accountNumber) ? `Acct •• ${accountNumber.slice(-4)}` : accountNumber;
}

/** "10 Sep → 18 Oct 2026", the year once when both ends share it. */
function fmtPeriod(start, end) {
  if (!start || !end) return '—';
  return start.slice(0, 4) === end.slice(0, 4)
    ? `${fmtShortDate(start)} → ${fmtDate(end)}`
    : `${fmtDate(start)} → ${fmtDate(end)}`;
}

function ImportedBanner({ uploadResult, style }) {
  const count = uploadResult.insertedCount ?? uploadResult.added ?? uploadResult.insertedRows ?? '?';
  return (
    <div style={{ padding: '12px 14px', background: 'var(--ft-income-soft)', color: 'var(--ft-income)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, ...style }}>
      <IcCheck size={16} /> Imported {count} transactions{uploadResult.card ? ` to ${uploadResult.card.nickname || uploadResult.card.name}` : ''}
    </div>
  );
}

function LastImportCard({ lastImport, accounts, selectedAccount, onAccountChange }) {
  // Two days of overlap: the bank's export day is often still settling, and
  // overlapping rows are skipped as duplicates anyway.
  const cutoff = lastImport?.periodEnd ? isoDateMinusDays(lastImport.periodEnd, 2) : null;
  return (
    <Card pad={18}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <Overline>Last bank import</Overline>
        {accounts.length > 1 && (
          <select
            className="imp-select"
            value={selectedAccount}
            onChange={(e) => onAccountChange(e.target.value)}
            aria-label="Account"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a} value={a}>{accountLabel(a)}</option>)}
          </select>
        )}
      </div>
      {lastImport ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ color: 'var(--ft-text)', fontSize: 16, fontWeight: 600, letterSpacing: '-0.2px' }}>
              {accountLabel(lastImport.accountNumber)}
            </span>
            <span style={{ color: 'var(--ft-text-dim)', fontSize: 12 }}>{fmtDate(lastImport.uploadedAt)}</span>
          </div>
          <div style={{ color: 'var(--ft-text-dim)', fontSize: 12.5, marginTop: 2 }}>
            {fmtPeriod(lastImport.periodStart, lastImport.periodEnd)}
          </div>

          <div className="imp-stat-grid">
            <div>
              <Num size={16} weight={600}>{lastImport.insertedRows}</Num>
              <span>added</span>
            </div>
            <div>
              <Num size={16} weight={600} color="var(--ft-text-dim)">{lastImport.totalRows - lastImport.insertedRows}</Num>
              <span>already had</span>
            </div>
            <div>
              <Num size={16} weight={600} color="var(--ft-text-dim)">{lastImport.totalRows}</Num>
              <span>rows in file</span>
            </div>
          </div>

          {cutoff && (
            <div className="imp-next-hint">
              Next download should start on or before{' '}
              <strong>{fmtDate(cutoff)}</strong> so nothing falls in a gap.
            </div>
          )}
        </>
      ) : (
        <p style={{ margin: 0, color: 'var(--ft-text-faint)', fontSize: 12.5 }}>No bank statements imported yet.</p>
      )}
    </Card>
  );
}

function SummaryCard({ uploadPreview, net, period, debits, credits }) {
  return (
    <Card pad={18}>
      <Overline style={{ marginBottom: 12 }}>Summary</Overline>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SumCell label="Net" dimmed={!uploadPreview}>
          <Num size={20} weight={600} color={net >= 0 ? 'var(--ft-income)' : 'var(--ft-spend)'}>
            {uploadPreview ? inr(net, { sign: net >= 0 }) : '—'}
          </Num>
        </SumCell>
        <SumCell label="Period" dimmed={!uploadPreview}>
          <span style={{ color: 'var(--ft-text)', fontSize: 13, fontWeight: 500 }}>{uploadPreview ? period : '—'}</span>
        </SumCell>
        <SumCell label="Debits" dimmed={!uploadPreview}>
          <Num size={14} weight={600} color="var(--ft-spend)">{uploadPreview ? inr(-debits) : '—'}</Num>
        </SumCell>
        <SumCell label="Credits" dimmed={!uploadPreview}>
          <Num size={14} weight={600} color="var(--ft-income)">{uploadPreview ? inr(credits, { sign: true }) : '—'}</Num>
        </SumCell>
      </div>
    </Card>
  );
}

function SumCell({ label, children, dimmed }) {
  return (
    <div style={{ opacity: dimmed ? 0.4 : 1, transition: 'opacity 0.2s' }}>
      <div style={{ color: 'var(--ft-text-dim)', fontSize: 11, marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

function ProgressRow({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: 'var(--ft-text)', fontSize: 12.5 }}>{label}</span>
        <Num size={12} weight={600} color="var(--ft-text-dim)">{value}/{total}</Num>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--ft-surface-2)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function HistoryCard({ imports, importsLoading, importsError, importsStatus, revertingImportId, onRevert, onRefresh }) {
  return (
    <Card pad={0}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ft-text)', letterSpacing: '-0.2px' }}>Recent imports</h3>
        <GhostBtn onClick={onRefresh} disabled={importsLoading} style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}>
          <IcRefresh size={12} /> Refresh
        </GhostBtn>
      </div>
      {importsLoading && imports.length === 0 ? (
        <p className="status" style={{ padding: '0 18px 16px' }}>Loading…</p>
      ) : imports.length === 0 ? (
        <p className="empty" style={{ padding: '0 18px 16px' }}>No imports yet.</p>
      ) : (
        <div className="imp-hist">
          {imports.map((imp) => (
            <div key={imp.id} className="imp-hist__row">
              <div className="imp-hist__icon"><IcReceipt size={14} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="imp-hist__title">
                  {accountLabel(imp.accountNumber)}
                  <span>{imp.insertedRows} added{imp.totalRows > imp.insertedRows ? ` · ${imp.totalRows - imp.insertedRows} skipped` : ''}</span>
                </div>
                <div className="imp-hist__file" title={imp.filename}>{imp.filename}</div>
              </div>
              <div className="imp-hist__period">{fmtPeriod(imp.periodStart, imp.periodEnd)}</div>
              <div className="imp-hist__date">{fmtShortDate(imp.uploadedAt)}</div>
              <button
                type="button"
                className="imp-hist__revert"
                disabled={revertingImportId === imp.id}
                onClick={() => onRevert(imp.id)}
              >
                {revertingImportId === imp.id ? 'Reverting…' : 'Revert'}
              </button>
            </div>
          ))}
        </div>
      )}
      {(importsStatus || importsError) && (
        <p className="status" style={{ padding: '0 18px 14px', margin: 0, color: importsError ? 'var(--ft-spend)' : undefined }}>
          {importsError || importsStatus}
        </p>
      )}
    </Card>
  );
}
