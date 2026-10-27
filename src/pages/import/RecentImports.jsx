import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Button, Card, EmptyState, ErrorMessage, ListView } from '../../components/ui';
import { accountLabel, fmtDate, fmtPeriod, fmtShortDate } from './format.js';

/** The latest bank statement imports, each revertable. */
export default function RecentImports({ imports, loading, error, revertingId, onRevert, onRefresh, className }) {
  const columns = [
    {
      key: 'account',
      label: 'Account',
      width: 'minmax(140px, 2fr)',
      render: (imp) => {
        const skipped = imp.totalRows - imp.insertedRows;
        return (
          <span className="import-hist__account">
            <span className="import-hist__name truncate">{accountLabel(imp.accountNumber)}</span>
            <span className="import-hist__file truncate" title={imp.filename || undefined}>
              {imp.filename || 'Unnamed file'}
            </span>
            <span className="import-hist__phone-meta">
              {fmtPeriod(imp.periodStart, imp.periodEnd)} · {imp.insertedRows} added
              {skipped > 0 ? ` · ${skipped} skipped` : ''}
            </span>
          </span>
        );
      },
    },
    {
      key: 'period',
      label: 'Date range',
      width: 'minmax(124px, 1.4fr)',
      hideBelow: 'sm',
      render: (imp) => <span className="import-hist__muted truncate">{fmtPeriod(imp.periodStart, imp.periodEnd)}</span>,
    },
    {
      key: 'rows',
      label: 'Rows',
      width: 96,
      hideBelow: 'sm',
      render: (imp) => {
        const skipped = imp.totalRows - imp.insertedRows;
        return (
          <span className="import-hist__rows">
            <span className="tabular-nums">{imp.insertedRows} added</span>
            {skipped > 0 && <span className="import-hist__muted tabular-nums">{skipped} skipped</span>}
          </span>
        );
      },
    },
    {
      key: 'uploadedAt',
      label: 'Imported',
      width: 76,
      hideBelow: 'sm',
      render: (imp) => (
        <span className="import-hist__muted tabular-nums" title={fmtDate(imp.uploadedAt)}>
          {fmtShortDate(imp.uploadedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: <span className="sr-only">Actions</span>,
      width: 80,
      align: 'right',
      render: (imp) => (
        <Button
          size="sm"
          label="Revert"
          loading={revertingId === imp.id}
          onClick={() => onRevert(imp)}
        />
      ),
    },
  ];

  return (
    <Card
      as="section"
      title="Recent imports"
      padding="none"
      className={`import-hist ${className || ''}`.trim()}
      actions={
        <Button variant="ghost" icon={RefreshCw} label="Refresh imports" tooltip="Refresh" loading={loading} onClick={onRefresh} />
      }
    >
      <ListView
        aria-label="Recent imports"
        columns={columns}
        rows={imports}
        loading={loading && imports.length === 0}
        skeletonRows={3}
        emptyState={
          error ? (
            <ErrorMessage message={error} />
          ) : (
            <EmptyState
              size="sm"
              icon={FileSpreadsheet}
              title="No imports yet"
              description="Bank statements you import show up here, and can be reverted."
            />
          )
        }
      />
      {error && imports.length > 0 && (
        <div className="import-hist__error">
          <ErrorMessage message={error} />
        </div>
      )}
    </Card>
  );
}
