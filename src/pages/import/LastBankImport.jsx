import { FileSpreadsheet, Info } from 'lucide-react';
import { Alert, Card, EmptyState, MobileField, MobileList, MobileSection, Select } from '../../components/ui';
import { useIsCompact } from '../../styles/breakpoints.js';
import { useAccountNames } from '../../hooks/useAccounts.js';
import { accountChoices, accountLabel } from '../../utils/accounts.js';
import { fmtDate, fmtPeriod, isoDateMinusDays } from './format.js';

/**
 * The newest bank statement import (for one account, or any), and where the
 * next download from the bank should start so no days fall in a gap.
 */
export default function LastBankImport({ lastImport, selectedAccount, onAccountChange }) {
  // Two days of overlap: the bank's export day is often still settling, and
  // overlapping rows are skipped as duplicates anyway.
  const cutoff = lastImport?.periodEnd ? isoDateMinusDays(lastImport.periodEnd, 2) : null;
  const isMobile = useIsCompact();
  const accountNames = useAccountNames();
  const accounts = accountChoices(accountNames);

  const accountPicker =
    accounts.length > 1 ? (
      <Select
        className={isMobile ? 'import-ph-last__account' : 'import-last__account'}
        size={isMobile ? 'md' : undefined}
        aria-label="Account"
        value={selectedAccount}
        onChange={(e) => onAccountChange(e.target.value)}
        options={[{ label: 'All accounts', value: '' }, ...accounts]}
      />
    ) : null;

  if (isMobile) {
    // Phones: the facts as label/value rows, the counts as a strip of three,
    // and the next-download advice as a quiet line.
    return (
      <MobileSection title="Last bank import" aside={accountPicker}>
        {lastImport ? (
          <>
            <MobileList variant="inset" aria-label="Last bank import">
              <MobileField label="Account">{accountLabel(lastImport.accountNumber, accountNames)}</MobileField>
              <MobileField label="Period">{fmtPeriod(lastImport.periodStart, lastImport.periodEnd)}</MobileField>
              <MobileField label="Imported on">{fmtDate(lastImport.uploadedAt)}</MobileField>
            </MobileList>
            <dl className="import-ph-strip">
              <div>
                <dt>Added</dt>
                <dd className="tabular-nums">{lastImport.insertedRows}</dd>
              </div>
              <div>
                <dt>Already had</dt>
                <dd className="tabular-nums">{lastImport.totalRows - lastImport.insertedRows}</dd>
              </div>
              <div>
                <dt>Rows in file</dt>
                <dd className="tabular-nums">{lastImport.totalRows}</dd>
              </div>
            </dl>
            {cutoff && (
              <p className="import-ph-callout">
                <Info size={16} strokeWidth={1.5} aria-hidden />
                <span>
                  Next download: start it on or before <span className="font-medium">{fmtDate(cutoff)}</span> so
                  nothing falls in a gap.
                </span>
              </p>
            )}
          </>
        ) : (
          <EmptyState
            size="sm"
            icon={FileSpreadsheet}
            title="No bank statements imported yet"
            description="Once you import one, its period and the next download date show here."
          />
        )}
      </MobileSection>
    );
  }

  return (
    <Card
      as="section"
      title="Last bank import"
      className="import-last"
      actions={accountPicker}
    >
      {lastImport ? (
        <div className="import-last__body">
          <div className="import-last__head">
            <span className="import-last__account-name">{accountLabel(lastImport.accountNumber, accountNames)}</span>
            <span className="import-muted">{fmtDate(lastImport.uploadedAt)}</span>
          </div>
          <div className="import-muted">{fmtPeriod(lastImport.periodStart, lastImport.periodEnd)}</div>

          <dl className="import-mini-stats">
            <div>
              <dt>Added</dt>
              <dd className="tabular-nums">{lastImport.insertedRows}</dd>
            </div>
            <div>
              <dt>Already had</dt>
              <dd className="tabular-nums">{lastImport.totalRows - lastImport.insertedRows}</dd>
            </div>
            <div>
              <dt>Rows in file</dt>
              <dd className="tabular-nums">{lastImport.totalRows}</dd>
            </div>
          </dl>

          {cutoff && (
            <Alert
              title="Next download"
              description={
                <>
                  Start it on or before <span className="font-medium">{fmtDate(cutoff)}</span> so nothing falls in a
                  gap.
                </>
              }
            />
          )}
        </div>
      ) : (
        <EmptyState
          size="sm"
          icon={FileSpreadsheet}
          title="No bank statements imported yet"
          description="Once you import one, its period and the next download date show here."
        />
      )}
    </Card>
  );
}
