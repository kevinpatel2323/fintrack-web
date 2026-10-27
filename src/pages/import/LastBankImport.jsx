import { FileSpreadsheet } from 'lucide-react';
import { Alert, Card, EmptyState, Select } from '../../components/ui';
import { accountLabel, fmtDate, fmtPeriod, isoDateMinusDays } from './format.js';

/**
 * The newest bank statement import (for one account, or any), and where the
 * next download from the bank should start so no days fall in a gap.
 */
export default function LastBankImport({ lastImport, accounts, selectedAccount, onAccountChange }) {
  // Two days of overlap: the bank's export day is often still settling, and
  // overlapping rows are skipped as duplicates anyway.
  const cutoff = lastImport?.periodEnd ? isoDateMinusDays(lastImport.periodEnd, 2) : null;

  return (
    <Card
      as="section"
      title="Last bank import"
      className="import-last"
      actions={
        accounts.length > 1 ? (
          <Select
            className="import-last__account"
            aria-label="Account"
            value={selectedAccount}
            onChange={(e) => onAccountChange(e.target.value)}
            options={[{ label: 'All accounts', value: '' }, ...accounts.map((a) => ({ label: accountLabel(a), value: a }))]}
          />
        ) : null
      }
    >
      {lastImport ? (
        <div className="import-last__body">
          <div className="import-last__head">
            <span className="import-last__account-name">{accountLabel(lastImport.accountNumber)}</span>
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
