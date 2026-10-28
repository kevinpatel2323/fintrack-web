import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileUp } from 'lucide-react';
import { Button, ConfirmDialog, FileUploader, PageBody, PageHeader, toast } from '../components/ui';
import StatementQueue from '../components/StatementQueue.jsx';
import { refreshImportSchedule } from '../hooks/useImportSchedule.js';
import { useIsCompact } from '../styles/breakpoints.js';
import { API_BASE, apiErrorMessage, apiFetch } from '../services/http.js';
import ImportStepper from './import/ImportStepper.jsx';
import FileRow from './import/FileRow.jsx';
import ReviewStep from './import/ReviewStep.jsx';
import ConfirmStep from './import/ConfirmStep.jsx';
import RecentImports from './import/RecentImports.jsx';
import LastBankImport from './import/LastBankImport.jsx';
import ImportPhone from './import/ImportPhone.jsx';
import { accountLabel, fmtDate, fmtPeriod, fmtShortDate, matchKey, plural } from './import/format.js';
import './StatementImport.css';

const ACCEPT = '.xlsx,.xls';
const MAX_BYTES = 10 * 1024 * 1024;
const STEPS = ['Upload', 'Review & map', 'Confirm & apply'];

const fileKey = (f) => (f ? `${f.name}-${f.size}-${f.lastModified}` : '');

export default function StatementImport() {
  const isCompact = useIsCompact();
  const navigate = useNavigate();

  const [lastImport, setLastImport] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [imports, setImports] = useState([]);
  const [importsLoading, setImportsLoading] = useState(false);
  const [importsError, setImportsError] = useState('');
  const [revertingImportId, setRevertingImportId] = useState(null);
  // The import being reverted; kept after the dialog closes so its text does
  // not blank out during the close animation.
  const [revertTarget, setRevertTarget] = useState(null);
  const [revertOpen, setRevertOpen] = useState(false);

  const [uploadFile, setUploadFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [uploadPreview, setUploadPreview] = useState(null);
  // Which proposed merges the user has left ticked, as `parsedIndex:existingId`.
  const [confirmedMatchKeys, setConfirmedMatchKeys] = useState(() => new Set());
  const [previewFileKey, setPreviewFileKey] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  // The preview is read as soon as a file is chosen; it is the same request
  // the old "Generate preview" button made.
  async function handlePreview(file = uploadFile) {
    if (!file) return;
    setPreviewing(true);
    setPreviewError('');
    setUploadPreview(null);
    try {
      const fd = new FormData();
      fd.append('statement', file);
      const res = await apiFetch(`${API_BASE}/imports/hdfc/preview`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Preview failed'));
      setUploadPreview(data);
      setConfirmedMatchKeys(new Set((data.matches || []).map(matchKey)));
      setPreviewFileKey(fileKey(file));
    } catch (e) { setPreviewError(e.message || 'Preview failed'); }
    finally { setPreviewing(false); }
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
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Import failed'));
      announceImport(data);
      resetUpload();
      await refreshAfterUpload();
    } catch (e) {
      toast.error({ title: 'Import failed', description: e.message || 'Import failed' });
    } finally { setIsUploading(false); }
  }

  function announceImport(result) {
    const count = result.insertedCount ?? result.added ?? result.insertedRows ?? '?';
    const merged = result.matchedRows > 0 ? ` · ${plural(result.matchedRows, 'entry', 'entries')} merged` : '';
    const card = result.card;
    toast.success({
      title: `Imported ${count} transactions`,
      description: card
        ? `To ${card.nickname || card.name} •• ${card.last4}${merged}`
        : result.accountNumber
          ? `To ${accountLabel(result.accountNumber)}`
          : undefined,
      action: card
        ? { label: 'View card', onClick: () => navigate(`/cards/${card.id}`) }
        : { label: 'View transactions', onClick: () => navigate('/transactions') },
    });
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
    setPreviewError('');
    setFileError('');
    setConfirming(false);
    setConfirmedMatchKeys(new Set());
  }

  function handleFiles(files) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setFileError(`${f.name} is larger than 10 MB.`);
      return;
    }
    setFileError('');
    setUploadFile(f);
    setConfirming(false);
    handlePreview(f);
  }

  function rejectFile() {
    setFileError('Choose an XLSX or XLS file exported from HDFC.');
  }

  function askRevert(imp) {
    setRevertTarget(imp);
    setRevertOpen(true);
  }

  // Revert: the dialog shows a failure inline and stays open; success closes
  // it and says so in a toast.
  async function runRevert(imp) {
    setRevertingImportId(imp.id);
    try {
      const res = await apiFetch(`${API_BASE}/imports/${imp.id}/revert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Revert failed'));
      setRevertOpen(false);
      toast.success(`Reverted ${plural(data.removedTransactions || 0, 'transaction', 'transactions')}`);
      await refreshAfterUpload();
    } finally {
      setRevertingImportId(null);
    }
  }

  // Derived state
  const previewReady = Boolean(uploadPreview) && previewFileKey === fileKey(uploadFile);
  const step = !previewReady ? 1 : confirming ? 3 : 2;
  const previewRows = uploadPreview?.previewRows || [];
  const { net, debits, credits } = useMemo(
    () => ({
      net: previewRows.reduce((s, r) => s + Number(r.deposit || 0) - Number(r.withdrawal || 0), 0),
      debits: previewRows.reduce((s, r) => s + Number(r.withdrawal || 0), 0),
      credits: previewRows.reduce((s, r) => s + Number(r.deposit || 0), 0),
    }),
    [previewRows],
  );
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
      ? `${uploadPreview.card?.nickname || uploadPreview.card?.name || 'Card'} •• ${lastFour}`
      : `HDFC Bank · Acct •• ${lastFour}`;
  const fileDetail = uploadPreview
    ? `${destination} · ${period} · ${plural(uploadPreview.totalParsed ?? previewRows.length, 'row', 'rows')} in file`
    : '';
  const willInsert = uploadPreview?.willInsert ?? 0;

  // The newest bank import overall (the history is newest first); the side
  // panel's figure follows its own account picker.
  const latest = imports[0] || lastImport;

  return (
    <>
      <PageHeader
        title="Import statement"
        actions={
          latest ? <span className="import-header-note">Last import {fmtDate(latest.uploadedAt)}</span> : null
        }
      />
      {isCompact ? (
        <ImportPhone
          steps={STEPS}
          step={step}
          latest={latest}
          accept={ACCEPT}
          uploadFile={uploadFile}
          fileError={fileError}
          previewing={previewing}
          previewError={previewError}
          onFiles={handleFiles}
          onRejectFile={rejectFile}
          onRetryPreview={() => handlePreview()}
          onReset={resetUpload}
          fileDetail={fileDetail}
          preview={uploadPreview}
          previewRows={previewRows}
          confirmedMatchKeys={confirmedMatchKeys}
          onToggleMatch={toggleMatch}
          destination={destination}
          period={period}
          debits={debits}
          credits={credits}
          net={net}
          willInsert={willInsert}
          onContinue={() => setConfirming(true)}
          onBack={() => setConfirming(false)}
          onImport={handleUpload}
          isUploading={isUploading}
          imports={imports}
          importsLoading={importsLoading}
          importsError={importsError}
          revertingId={revertingImportId}
          onRevert={askRevert}
          onRefreshImports={loadHistory}
          lastImport={lastImport}
          accounts={accounts}
          selectedAccount={selectedAccount}
          onAccountChange={setSelectedAccount}
        />
      ) : (
        <PageBody className="import-page">
          <div className="import-layout">
            <div className="import-main">
              <section className="import-flow" aria-label="Import a statement">
                <div className="import-flow__steps">
                  <ImportStepper steps={STEPS} current={step} />
                </div>

                <div className="import-flow__body">
                  {step === 1 && !uploadFile && (
                    <FileUploader
                      className="import-drop"
                      accept={ACCEPT}
                      onFiles={handleFiles}
                      onReject={rejectFile}
                      icon={FileUp}
                      title="Drop your HDFC statement here"
                      description={
                        <>
                          Bank account or credit card: we work out which and skip rows you've already added
                          <br />
                          XLSX or XLS, up to 10 MB
                        </>
                      }
                      error={fileError || undefined}
                    />
                  )}

                  {step === 1 && uploadFile && (
                    <FileRow
                      file={uploadFile}
                      reading={previewing}
                      error={previewError}
                      onRetry={() => handlePreview()}
                      onRemove={resetUpload}
                    />
                  )}

                  {step >= 2 && (
                    <FileRow file={uploadFile} detail={fileDetail} />
                  )}

                  {step === 2 && (
                    <ReviewStep
                      preview={uploadPreview}
                      previewRows={previewRows}
                      confirmedMatchKeys={confirmedMatchKeys}
                      onToggleMatch={toggleMatch}
                    />
                  )}

                  {step === 3 && (
                    <ConfirmStep
                      preview={uploadPreview}
                      destination={destination}
                      period={period}
                      debits={debits}
                      credits={credits}
                      net={net}
                    />
                  )}
                </div>

                {step === 2 && (
                  <div className="import-flow__footer">
                    <Button variant="ghost" label="Choose another file" onClick={resetUpload} />
                    <Button
                      variant="solid"
                      label="Continue"
                      iconRight={ArrowRight}
                      disabled={willInsert === 0}
                      onClick={() => setConfirming(true)}
                    />
                  </div>
                )}

                {step === 3 && (
                  <div className="import-flow__footer">
                    <Button
                      variant="ghost"
                      iconLeft={ArrowLeft}
                      label="Back"
                      disabled={isUploading}
                      onClick={() => setConfirming(false)}
                    />
                    <Button
                      variant="solid"
                      label={`Import ${plural(willInsert, 'transaction', 'transactions')}`}
                      loading={isUploading}
                      loadingText="Importing…"
                      disabled={willInsert === 0}
                      onClick={handleUpload}
                    />
                  </div>
                )}
              </section>

              <RecentImports
                className="import-main__history"
                imports={imports}
                loading={importsLoading}
                error={importsError}
                revertingId={revertingImportId}
                onRevert={askRevert}
                onRefresh={loadHistory}
              />
            </div>

            <aside className="import-aside" aria-label="Statement status">
              <StatementQueue />
              <LastBankImport
                lastImport={lastImport}
                accounts={accounts}
                selectedAccount={selectedAccount}
                onAccountChange={setSelectedAccount}
              />
            </aside>
          </div>
        </PageBody>
      )}

      <ConfirmDialog
        open={revertOpen}
        title="Revert this import?"
        message="All transactions created by this import will be removed."
        confirmLabel="Revert"
        onConfirm={() => runRevert(revertTarget)}
        onCancel={() => setRevertOpen(false)}
      >
        {revertTarget && (
          <p className="import-revert-detail">
            {accountLabel(revertTarget.accountNumber)} · {fmtPeriod(revertTarget.periodStart, revertTarget.periodEnd)}
            {revertTarget.filename && (
              <>
                <br />
                <span className="import-revert-detail__file">{revertTarget.filename}</span>
              </>
            )}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
