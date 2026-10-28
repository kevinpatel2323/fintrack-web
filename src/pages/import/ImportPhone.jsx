import { useEffect, useRef } from 'react';
import { FileUp } from 'lucide-react';
import { Button, FileUploader, MobileActionBar, PageBody } from '../../components/ui';
import StatementQueue from '../../components/StatementQueue.jsx';
import { ImportStepperPhone } from './ImportStepper.jsx';
import FileRow from './FileRow.jsx';
import ReviewStep from './ReviewStep.jsx';
import ConfirmStep from './ConfirmStep.jsx';
import RecentImports from './RecentImports.jsx';
import LastBankImport from './LastBankImport.jsx';
import { fmtDate, plural } from './format.js';

/**
 * The import page on a phone (< 768px), as a focused flow: a one-line step
 * indicator, then the step itself. Upload shows one big target and, under it,
 * what to import next (card statements, the last bank import, recent
 * imports). Review and confirm take the screen, with their buttons pinned in
 * the action bar. StatementImport.jsx owns every bit of state and request.
 */
export default function ImportPhone({
  steps,
  step,
  latest,
  accept,
  uploadFile,
  fileError,
  previewing,
  previewError,
  onFiles,
  onRejectFile,
  onRetryPreview,
  onReset,
  fileDetail,
  preview,
  previewRows,
  confirmedMatchKeys,
  onToggleMatch,
  destination,
  period,
  debits,
  credits,
  net,
  willInsert,
  onContinue,
  onBack,
  onImport,
  isUploading,
  imports,
  importsLoading,
  importsError,
  revertingId,
  onRevert,
  onRefreshImports,
  lastImport,
  accounts,
  selectedAccount,
  onAccountChange,
}) {
  // A new step starts at the top of the screen, not wherever the last one
  // was scrolled to.
  const topRef = useRef(null);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  return (
    <PageBody className="import-ph">
      <div ref={topRef} className="import-ph-top" aria-hidden />
      <ImportStepperPhone
        steps={steps}
        current={step}
        note={step === 1 && latest ? `Last import ${fmtDate(latest.uploadedAt)}` : null}
      />

      <div className="import-ph-flow">
        {step === 1 && !uploadFile && (
          <>
            <FileUploader
              className="import-ph-drop"
              accept={accept}
              onFiles={onFiles}
              onReject={onRejectFile}
              icon={FileUp}
              title="Choose a statement file"
              description="XLSX or XLS, up to 10 MB"
              error={fileError || undefined}
            />
            <p className="import-ph-hint">
              An HDFC bank account or credit card statement. We work out which, and skip rows you've already added.
            </p>
          </>
        )}

        {step === 1 && uploadFile && (
          <FileRow
            file={uploadFile}
            reading={previewing}
            error={previewError}
            onRetry={onRetryPreview}
            onRemove={onReset}
          />
        )}

        {step >= 2 && <FileRow file={uploadFile} detail={fileDetail} />}

        {step === 2 && (
          <ReviewStep
            preview={preview}
            previewRows={previewRows}
            confirmedMatchKeys={confirmedMatchKeys}
            onToggleMatch={onToggleMatch}
            isCompact
          />
        )}

        {step === 3 && (
          <ConfirmStep
            preview={preview}
            destination={destination}
            period={period}
            debits={debits}
            credits={credits}
            net={net}
            isCompact
          />
        )}
      </div>

      {/* What to import next, and what came in last: only while choosing a file. */}
      {step === 1 && (
        <div className="import-ph-status">
          <StatementQueue />
          <LastBankImport
            lastImport={lastImport}
            accounts={accounts}
            selectedAccount={selectedAccount}
            onAccountChange={onAccountChange}
          />
          <RecentImports
            imports={imports}
            loading={importsLoading}
            error={importsError}
            revertingId={revertingId}
            onRevert={onRevert}
            onRefresh={onRefreshImports}
          />
        </div>
      )}

      {step === 2 && (
        <MobileActionBar className="import-ph-bar">
          <Button size="lg" className="import-ph-bar__secondary" label="Change file" onClick={onReset} />
          <Button size="lg" variant="solid" label="Continue" disabled={willInsert === 0} onClick={onContinue} />
        </MobileActionBar>
      )}

      {step === 3 && (
        <MobileActionBar className="import-ph-bar">
          <Button size="lg" className="import-ph-bar__secondary" label="Back" disabled={isUploading} onClick={onBack} />
          <Button
            size="lg"
            variant="solid"
            label={`Import ${plural(willInsert, 'transaction', 'transactions')}`}
            loading={isUploading}
            loadingText="Importing…"
            disabled={willInsert === 0}
            onClick={onImport}
          />
        </MobileActionBar>
      )}
    </PageBody>
  );
}
