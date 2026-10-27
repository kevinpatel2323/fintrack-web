import { Amount } from '../../components/ui';
import { plural } from './format.js';

/**
 * Step 3: one plain summary of what applying the import will do, so the
 * button underneath is the only thing left to decide.
 */
export default function ConfirmStep({ preview, destination, period, debits, credits, net }) {
  const isCard = preview.kind === 'card';
  const willInsert = preview.willInsert ?? 0;
  const merged = preview.matchedRows ?? 0;
  return (
    <div className="import-confirm">
      <p className="import-confirm__lead">
        {plural(willInsert, 'new transaction', 'new transactions')} will be added to{' '}
        <span className="font-medium">{destination}</span>
        {isCard && merged > 0 && `, and ${plural(merged, 'entry', 'entries')} you added by hand will be billed to this statement`}
        .
      </p>
      <dl className="import-summary">
        <SummaryRow label="Import to">{destination}</SummaryRow>
        <SummaryRow label="Statement period">{period}</SummaryRow>
        <SummaryRow label="New transactions">
          <span className="tabular-nums">{willInsert}</span>
        </SummaryRow>
        {isCard && (
          <SummaryRow label="Merged into your entries">
            <span className="tabular-nums">{merged}</span>
          </SummaryRow>
        )}
        <SummaryRow label="Skipped, already imported">
          <span className="tabular-nums">{preview.skippedRows ?? 0}</span>
        </SummaryRow>
        <SummaryRow label="Debits">
          <Amount value={-debits} />
        </SummaryRow>
        <SummaryRow label="Credits">
          <Amount value={credits} sign="always" />
        </SummaryRow>
        <SummaryRow label="Net">
          <Amount value={net} sign="always" />
        </SummaryRow>
      </dl>
    </div>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="import-summary__row">
      <dt className="import-summary__label">{label}</dt>
      <dd className="import-summary__value">{children}</dd>
    </div>
  );
}
