import { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DynamicTable from '../components/DynamicTable.jsx';
import {
  Card, Num, GhostBtn, PrimaryBtn, Overline,
} from '../components/ui/primitives.jsx';
import {
  IcUpload, IcCheck, IcChevR, IcSparkle, IcReceipt, IcRefresh, IcTrash,
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
    await Promise.all([loadLastImport(selectedAccount), loadHistory()]);
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

      <div className="ft-split" style={{ '--ft-split-aside': '320px', gap: 14 }}>
        {/* ── Left: main wizard card ── */}
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

          {/* Step 1 — drop zone */}
          {step === 1 && (
            <label
              className={`imp-drop-full${isDragging ? ' imp-drop-full--drag' : ''}`}
              htmlFor="imp-file-desktop"
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileInput(e.dataTransfer.files?.[0]); }}
            >
              <IcUpload size={32} style={{ color: 'var(--ft-text-faint)', marginBottom: 10 }} />
              <div style={{ color: 'var(--ft-text)', fontWeight: 600, fontSize: 15 }}>Drop your HDFC statement here</div>
              <div style={{ color: 'var(--ft-text-dim)', fontSize: 13, marginTop: 4 }}>XLSX or XLS · up to 10 MB</div>
              <div style={{ marginTop: 16 }}>
                <span className="imp-browse-btn">Browse file</span>
              </div>
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

        {/* ── Right: summary panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <LastImportCard
            lastImport={lastImport}
            accounts={accounts}
            selectedAccount={selectedAccount}
            onAccountChange={setSelectedAccount}
          />
          <SummaryCard uploadPreview={uploadPreview} net={net} period={period} debits={debits} credits={credits} />

          {/* Rows breakdown (only when preview loaded) */}
          {uploadPreview && (
            <Card pad={18}>
              <Overline style={{ marginBottom: 10 }}>Rows</Overline>
              <ProgressRow label="Will import" value={uploadPreview.willInsert} total={uploadPreview.totalParsed} color="var(--ft-accent)" />
              <ProgressRow label="Duplicates skipped" value={uploadPreview.skippedRows} total={uploadPreview.totalParsed} color="var(--ft-text-faint)" />
            </Card>
          )}

          {/* Smart match card */}
          <div style={{
            padding: 14, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--ft-accent-soft), transparent)',
            border: '1px solid var(--ft-accent-hairline)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <IcSparkle size={14} style={{ color: 'var(--ft-accent-fg)' }} />
              <Overline style={{ color: 'var(--ft-accent-fg)', letterSpacing: 0.6 }}>Smart match</Overline>
            </div>
            <p style={{ margin: 0, color: 'var(--ft-text)', fontSize: 12.5, lineHeight: 1.5 }}>
              We match counterparty names against your friends list and suggest categories automatically.
            </p>
          </div>

          {/* Success banner */}
          {uploadResult && (
            <div style={{ padding: '12px 14px', background: 'var(--ft-income-soft)', color: 'var(--ft-income)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
              <IcCheck size={16} /> Imported {uploadResult.insertedCount ?? uploadResult.added ?? uploadResult.insertedRows ?? '?'} transactions{uploadResult.card ? ` to ${uploadResult.card.nickname || uploadResult.card.name}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Recent imports — below the grid */}
      <div style={{ marginTop: 20 }}>
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

        <LastImportCard
          lastImport={lastImport}
          accounts={accounts}
          selectedAccount={selectedAccount}
          onAccountChange={onAccountChange}
        />
        <SummaryCard uploadPreview={uploadPreview} net={net} period={period} debits={debits} credits={credits} />

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
        {uploadResult && (
          <div style={{ padding: '12px 14px', background: 'var(--ft-income-soft)', color: 'var(--ft-income)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
            <IcCheck size={16} /> Imported {uploadResult.insertedCount ?? uploadResult.added ?? uploadResult.insertedRows ?? '?'} transactions{uploadResult.card ? ` to ${uploadResult.card.nickname || uploadResult.card.name}` : ''}
          </div>
        )}

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

function LastImportCard({ lastImport, accounts, selectedAccount, onAccountChange }) {
  return (
    <Card pad={18}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Overline>Last import</Overline>
        <select
          value={selectedAccount}
          onChange={(e) => onAccountChange(e.target.value)}
          style={{
            background: 'var(--ft-surface-2)',
            border: '1px solid var(--ft-border)',
            color: 'var(--ft-text)',
            borderRadius: 6,
            padding: '3px 6px',
            fontSize: 11,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <p style={{ margin: '0 0 12px', color: 'var(--ft-text-faint)', fontSize: 11 }}>
        Select an account to see the most recent import.
      </p>
      {lastImport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { l: 'Account',          v: lastImport.account?.accountNumber || '—' },
            { l: 'Inserted',         v: lastImport.insertedRows },
            { l: 'Rows',             v: lastImport.totalRows },
            { l: 'Period',           v: `${fmtDate(lastImport.periodStart)} → ${fmtDate(lastImport.periodEnd)}` },
            { l: 'Last date before', v: fmtDate(lastImport.lastTxDateBefore) },
            { l: 'Uploaded',         v: fmtDate(lastImport.uploadedAt) },
          ].map(({ l, v }) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, flexShrink: 0 }}>{l}</span>
              <span style={{ color: 'var(--ft-text)', fontSize: 12, fontWeight: 500, textAlign: 'right' }}>{String(v)}</span>
            </div>
          ))}
          {lastImport.periodEnd && (() => {
            const cutoff = isoDateMinusDays(lastImport.periodEnd, 2);
            return (
              <div style={{
                marginTop: 4,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--ft-accent-soft)',
                border: '1px solid var(--ft-accent-hairline)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
              }}>
                <span style={{ color: 'var(--ft-text-dim)', fontSize: 11.5, flexShrink: 0 }}>Next start</span>
                <strong style={{ color: 'var(--ft-accent-fg)', fontSize: 12, fontWeight: 700, textAlign: 'right' }}>
                  On or before {fmtDate(cutoff)}
                </strong>
              </div>
            );
          })()}
        </div>
      ) : (
        <p style={{ margin: 0, color: 'var(--ft-text-faint)', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>No imports found.</p>
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
    <Card pad={18}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ft-text)', letterSpacing: '-0.2px' }}>Recent imports</h3>
        <GhostBtn onClick={onRefresh}><IcRefresh size={12} /> Refresh</GhostBtn>
      </div>
      {importsLoading ? (
        <p className="status">Loading…</p>
      ) : imports.length === 0 ? (
        <p className="empty">No imports yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {imports.map((imp) => (
            <div key={imp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--ft-surface-2)', borderRadius: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ft-accent-soft)', color: 'var(--ft-accent-fg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IcReceipt size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--ft-text)', fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{imp.filename}</div>
                <div style={{ color: 'var(--ft-text-dim)', fontSize: 11.5 }}>
                  {fmtDate(imp.uploadedAt)} · {imp.insertedRows} transactions
                </div>
              </div>
              <GhostBtn
                disabled={revertingImportId === imp.id}
                onClick={() => onRevert(imp.id)}
                style={{ color: 'var(--ft-spend)', flexShrink: 0 }}
              >
                Revert
              </GhostBtn>
            </div>
          ))}
        </div>
      )}
      {importsStatus && <p className="status">{importsStatus}</p>}
      {importsError && <p className="status" style={{ color: 'var(--ft-spend)' }}>{importsError}</p>}
    </Card>
  );
}
