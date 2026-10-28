import { Ellipsis, FileSpreadsheet, RefreshCw, Undo2 } from 'lucide-react';
import {
  Button, Card, Dropdown, EmptyState, ErrorMessage, ListView, MobileSection, Spinner,
} from '../../components/ui';
import { useIsCompact } from '../../styles/breakpoints.js';
import { accountLabel, fmtDate, fmtPeriod, fmtShortDate } from './format.js';

/** The latest bank statement imports, each revertable. */
export default function RecentImports({ imports, loading, error, revertingId, onRevert, onRefresh, className }) {
  const isMobile = useIsCompact();
  if (isMobile) {
    return (
      <RecentImportsPhone
        imports={imports}
        loading={loading}
        error={error}
        revertingId={revertingId}
        onRevert={onRevert}
        onRefresh={onRefresh}
      />
    );
  }

  const columns = [
    {
      key: 'account',
      label: 'Account',
      width: 'minmax(140px, 2fr)',
      flex: true,
      sortable: true,
      sortValue: (imp) => accountLabel(imp.accountNumber),
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
      sortable: true,
      sortFirst: 'desc',
      sortValue: (imp) => imp.periodEnd || imp.periodStart || '',
      render: (imp) => <span className="import-hist__muted truncate">{fmtPeriod(imp.periodStart, imp.periodEnd)}</span>,
    },
    {
      key: 'rows',
      label: 'Rows',
      width: 96,
      hideBelow: 'sm',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (imp) => imp.insertedRows,
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
      width: 88,
      minWidth: 76,
      hideBelow: 'sm',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (imp) => imp.uploadedAt || '',
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
        defaultSort={{ key: 'uploadedAt', direction: 'desc' }}
        storageKey="fintrack.import.history"
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

function EmptyImports({ error }) {
  return error ? (
    <ErrorMessage message={error} />
  ) : (
    <EmptyState
      size="sm"
      icon={FileSpreadsheet}
      title="No imports yet"
      description="Bank statements you import show up here, and can be reverted."
    />
  );
}

/**
 * Phones: a row per import — the account over its period, how many rows it
 * added and when on the right — with Revert in the row's `…` (confirmed by
 * the page's dialog, as on desktop).
 */
function RecentImportsPhone({ imports, loading, error, revertingId, onRevert, onRefresh }) {
  const columns = [
    {
      key: 'account',
      label: 'Account',
      width: 'minmax(0, 1fr)',
      flex: true,
      sortable: true,
      sortValue: (imp) => accountLabel(imp.accountNumber),
      render: (imp) => {
        const skipped = imp.totalRows - imp.insertedRows;
        return (
          <span className="import-ph-hist">
            <span className="import-ph-hist__title">{accountLabel(imp.accountNumber)}</span>
            <span className="import-ph-hist__sub">
              {fmtPeriod(imp.periodStart, imp.periodEnd)}
              {skipped > 0 ? ` · ${skipped} skipped` : ''}
            </span>
          </span>
        );
      },
    },
    {
      key: 'period',
      label: 'Date range',
      width: 0,
      hideBelow: 'md',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (imp) => imp.periodEnd || imp.periodStart || '',
      render: () => null,
    },
    {
      key: 'rows',
      label: 'Rows',
      width: 0,
      hideBelow: 'md',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (imp) => imp.insertedRows,
      render: () => null,
    },
    {
      key: 'uploadedAt',
      label: 'Imported',
      width: 'auto',
      align: 'right',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (imp) => imp.uploadedAt || '',
      render: (imp) => (
        <span className="import-ph-hist__end">
          <span className="import-ph-hist__value tabular-nums">{imp.insertedRows} added</span>
          <span className="import-ph-hist__date tabular-nums">{fmtShortDate(imp.uploadedAt)}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      label: <span className="sr-only">Actions</span>,
      width: 36,
      align: 'right',
      render: (imp) =>
        revertingId === imp.id ? (
          <span className="import-ph-hist__busy" role="status" aria-label="Reverting">
            <Spinner size="sm" />
          </span>
        ) : (
          <Dropdown
            label={imp.filename || accountLabel(imp.accountNumber)}
            options={[
              {
                label: 'Revert import',
                icon: Undo2,
                theme: 'red',
                onClick: () => onRevert(imp),
              },
            ]}
          >
            <Button
              variant="ghost"
              size="md"
              icon={Ellipsis}
              label={`Actions for ${accountLabel(imp.accountNumber)}, ${fmtPeriod(imp.periodStart, imp.periodEnd)}`}
            />
          </Dropdown>
        ),
    },
  ];

  return (
    <MobileSection
      title="Recent imports"
      aside={
        <Button variant="ghost" size="md" icon={RefreshCw} label="Refresh imports" loading={loading} onClick={onRefresh} />
      }
    >
      <ListView
        className="phone-bleed import-ph-list"
        aria-label="Recent imports"
        columns={columns}
        rows={imports}
        defaultSort={{ key: 'uploadedAt', direction: 'desc' }}
        loading={loading && imports.length === 0}
        skeletonRows={3}
        emptyState={<EmptyImports error={error} />}
      />
      {error && imports.length > 0 && <ErrorMessage message={error} />}
    </MobileSection>
  );
}
