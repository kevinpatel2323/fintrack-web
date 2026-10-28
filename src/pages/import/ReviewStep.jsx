import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Alert, Amount, Badge, Button, Checkbox, ListView, TextInput } from '../../components/ui';
import { fmtDate, fmtShortDate, matchKey, plural, previewRowAmount } from './format.js';

const PHONE_ROW_LIMIT = 20;

const STATUS = {
  new: { label: 'New', theme: 'gray' },
  merge: { label: 'Already added by you', theme: 'amber' },
  skipped: { label: 'Already imported', theme: 'gray' },
};

/**
 * Step 2: what the file holds and what will happen to each row. Counts first,
 * then anything that needs a decision (out-of-order warning, entries already
 * added by hand), then every row with its status.
 */
export default function ReviewStep({ preview, previewRows, confirmedMatchKeys, onToggleMatch, isCompact }) {
  return (
    <div className="import-review">
      <ReviewStats preview={preview} />
      <SkipWarning preview={preview} />
      <NothingNew preview={preview} />
      <MatchReview matches={preview.matches} confirmedKeys={confirmedMatchKeys} onToggle={onToggleMatch} />
      <StatementRows
        preview={preview}
        previewRows={previewRows}
        confirmedKeys={confirmedMatchKeys}
        isCompact={isCompact}
      />
    </div>
  );
}

function ReviewStats({ preview }) {
  // Only card statements can merge into entries added by hand.
  const stats = [
    { label: 'New', value: preview.willInsert ?? 0 },
    preview.kind === 'card' && { label: 'Already added by you', value: preview.matchedRows ?? 0 },
    { label: 'Skipped', value: preview.skippedRows ?? 0, hint: 'already imported' },
  ].filter(Boolean);
  return (
    <dl className="import-stats">
      {stats.map((s) => (
        <div key={s.label} className="import-stat">
          <dt className="import-stat__label">{s.label}</dt>
          <dd className="import-stat__value tabular-nums">
            {s.value}
            {s.hint && <span className="import-stat__hint">{s.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
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
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0];
  const many = labels.length > 1;
  return (
    <Alert
      theme="amber"
      title="Out of order"
      description={`${list} ${many ? 'are' : 'is'} out but not imported yet, and this statement comes after ${
        many ? 'them' : 'it'
      }. You can still import it, or go back and import ${list} first.`}
    />
  );
}

function NothingNew({ preview }) {
  if ((preview.willInsert ?? 0) > 0) return null;
  let description;
  if (preview.alreadyImported) description = 'This statement has already been imported.';
  else if ((preview.matchedRows ?? 0) > 0 && !preview.skippedRows) description = 'Every row on it is an entry you already added.';
  else description = `All ${plural(preview.skippedRows ?? 0, 'row is', 'rows are')} already imported.`;
  return <Alert title="Nothing new to import" description={`${description} Choose another file to continue.`} />;
}

/**
 * Rows on this statement that look like transactions already entered by hand —
 * the mid-cycle spend added before the statement existed. Merging bills the
 * existing row in place, so its category, notes and friend tags survive;
 * importing it as a new row instead would double-count the spend in every
 * ledger it is tagged into.
 */
function MatchReview({ matches, confirmedKeys, onToggle }) {
  const headingId = useId();
  if (!matches || matches.length === 0) return null;
  return (
    <section className="import-section" aria-labelledby={headingId}>
      <div className="import-section__head">
        <h3 id={headingId} className="import-section__title">
          Already added by you
        </h3>
        <p className="import-section__description">
          {confirmedKeys.size} of {matches.length} will merge into the entry you already made instead of being added
          again. Untick any that are separate charges.
        </p>
      </div>
      <div className="import-matches">
        {matches.map((m) => {
          const key = matchKey(m);
          const apart = m.dateDeltaDays > 0;
          return (
            <Checkbox
              key={key}
              padded
              className="import-match"
              checked={confirmedKeys.has(key)}
              onChange={() => onToggle(key)}
              label={
                <span className="import-match__label">
                  <span className="truncate">
                    {fmtShortDate(m.statementRow.txnDate)} · {m.statementRow.merchant}
                  </span>
                  <Amount value={m.statementRow.amount} sign="never" tone="inherit" />
                  {m.statementRow.isRefund && <span className="import-match__refund">refund</span>}
                </span>
              }
              description={
                <>
                  Merges into your entry “{m.existingRow.merchant}” of {fmtShortDate(m.existingRow.txnDate)}
                  {apart && (
                    <span className="import-match__apart">
                      {' '}
                      · {plural(m.dateDeltaDays, 'day', 'days')} apart
                    </span>
                  )}
                </>
              }
            />
          );
        })}
      </div>
    </section>
  );
}

function rowText(row) {
  return row.upiName || row.narration || '';
}

function StatementRows({ preview, previewRows, confirmedKeys, isCompact }) {
  const headingId = useId();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Statement rows a ticked merge points at (card statements list every
  // parsed row, so `parsedIndex` is the row's index here).
  const mergedIndexes = useMemo(
    () =>
      new Set(
        (preview.matches || []).filter((m) => confirmedKeys.has(matchKey(m))).map((m) => m.parsedIndex),
      ),
    [preview.matches, confirmedKeys],
  );

  const items = useMemo(
    () =>
      previewRows.map((row, index) => ({
        index,
        row,
        amount: previewRowAmount(row),
        status: preview.alreadyImported ? 'skipped' : mergedIndexes.has(index) ? 'merge' : 'new',
      })),
    [previewRows, preview.alreadyImported, mergedIndexes],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? items.filter((it) =>
          [it.row.upiName, it.row.narration, fmtDate(it.row.transactionDate), String(Math.abs(it.amount))]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : items;
    if (sort) {
      const value = {
        date: (it) => it.row.transactionDate || '',
        description: (it) => rowText(it.row).toLowerCase(),
        status: (it) => STATUS[it.status].label,
        amount: (it) => it.amount,
      }[sort.key];
      const dir = sort.direction === 'desc' ? -1 : 1;
      list = [...list].sort((a, b) => {
        const va = value(a);
        const vb = value(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * dir || a.index - b.index;
      });
    }
    return list;
  }, [items, query, sort]);

  const limited = isCompact && !showAll && visible.length > PHONE_ROW_LIMIT;
  const shown = limited ? visible.slice(0, PHONE_ROW_LIMIT) : visible;

  const columns = [
    {
      key: 'date',
      label: 'Date',
      width: 100,
      minWidth: 88,
      sortable: true,
      sortFirst: 'desc',
      hideBelow: 'sm',
      render: (it) => <span className="import-muted tabular-nums">{fmtDate(it.row.transactionDate)}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(136px, 1fr)',
      flex: true,
      sortable: true,
      render: (it) => (
        <span className="import-row-desc">
          <span className="truncate" title={it.row.narration || undefined}>
            {rowText(it.row)}
          </span>
          <span className="import-row-desc__phone">
            {fmtShortDate(it.row.transactionDate)}
            {it.status !== 'new' && ` · ${STATUS[it.status].label}`}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 156,
      minWidth: 96,
      hideBelow: 'sm',
      sortable: true,
      render: (it) => <Badge theme={STATUS[it.status].theme} label={STATUS[it.status].label} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      width: 108,
      minWidth: 96,
      align: 'right',
      sortable: true,
      render: (it) => <Amount value={it.amount} sign="always" />,
    },
  ];

  let emptyState;
  if (previewRows.length === 0) {
    emptyState = `All ${preview.skippedRows ?? 0} rows already imported. Nothing new to add.`;
  } else {
    emptyState = `No rows match “${query.trim()}”.`;
  }

  return (
    <section className="import-section" aria-labelledby={headingId}>
      <div className="import-rows__toolbar">
        <h3 id={headingId} className="import-section__title">
          Rows in this statement <span className="import-muted tabular-nums">{previewRows.length}</span>
        </h3>
        {previewRows.length > 0 && (
          <TextInput
            className="import-rows__search"
            prefix={Search}
            type="search"
            placeholder="Search rows"
            aria-label="Search rows"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>
      <div className="import-rows__scroll">
        <ListView
          aria-label="Statement rows to import"
          columns={columns}
          rows={shown}
          rowKey="index"
          // Ordered here, before the phone's first-rows cut, so the cut
          // shows the top of the sorted list.
          sort={sort}
          onSortChange={setSort}
          storageKey="fintrack.import.review"
          stickyHeader={!isCompact}
          emptyState={emptyState}
          footer={
            limited ? (
              <Button
                variant="ghost"
                label={`Show all ${visible.length} rows`}
                onClick={() => setShowAll(true)}
              />
            ) : undefined
          }
        />
      </div>
    </section>
  );
}
