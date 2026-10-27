import {
  LEDGER_OWNER_NAME,
  ledgerBalanceDelta,
  ledgerDate,
  ledgerDirectionPhrase,
  ledgerGroupDateText,
  ledgerGroupDirectionText,
  ledgerGroupHeadParts,
  ledgerGroupImpactText,
  ledgerGroupMemberParts,
  ledgerGroupOpenText,
  ledgerImpactText,
  ledgerNumber,
  ledgerOpenText,
  ledgerRowAmount,
  ledgerRs,
  ledgerSettledEntryParts,
  ledgerSettlementCheck,
  ledgerSettlementHeadParts,
  ledgerSettlementRefLines,
} from '../../utils/ledgerParties';
import { ledgerStatement } from '../../utils/entryGroups.js';
import { cellStr } from '../../utils/ledgerPdf.js';
import './LedgerPaper.css';

// A proof of the PDF that utils/ledgerPdf.js draws. Every cell is built the
// way that file builds it, from the shared ledger text helpers — nothing here
// formats an amount, date or settlement line of its own — so the preview says
// exactly what the exported file will say. Layout follows the PDF too: the
// same columns at the same relative widths, left-aligned and wrapping, with
// colour only on the balance impact.

/** The PDF's ledger columns (`headers`). Their widths, the PDF's `rawWidths`
 *  as shares of the table, are in LedgerPaper.css. */
const COLUMNS = [
  '#',
  'Date',
  'Name',
  'UPI description',
  'Bank',
  'Direction',
  'Amount (Rs.)',
  'Balance impact',
  'Running balance',
  'Still open (today)',
  'Settlement link',
  'Note',
];
const IMPACT_COL = 7;

const MOVES_BALANCE = new Set(['OWES_ME', 'I_OWE', 'SETTLEMENT']);

/** The PDF paints + impacts red and - impacts green; rows that move nothing stay ink. */
function impactTone(delta) {
  return delta >= 0 ? 'lxp-impact--pos' : 'lxp-impact--neg';
}

function rowCells(row, friendName) {
  return rawRowCells(row, friendName).map(cellStr);
}

function rawRowCells(row, friendName) {
  if (row.kind === 'group') {
    const { totals } = row;
    return [
      String(row.no),
      ledgerGroupDateText(totals),
      row.group.title,
      `${totals.count} entries - see Group details`,
      '-',
      ledgerGroupDirectionText(totals, friendName),
      ledgerRs(Math.abs(totals.totalAmount)),
      ledgerGroupImpactText(totals),
      ledgerRs(row.running),
      ledgerGroupOpenText(totals, friendName),
      ledgerSettlementRefLines(row.links, null).join('\n') || '-',
      '-',
    ];
  }
  const { tag, links } = row;
  const t = tag.transaction || {};
  return [
    String(row.no),
    ledgerDate(t.transactionDate),
    t.upiName || '-',
    t.upiDescription || t.narration || '-',
    t.upiBank || '-',
    ledgerDirectionPhrase(tag.direction, friendName),
    ledgerRs(ledgerRowAmount(tag)),
    ledgerImpactText(tag),
    ledgerRs(row.running),
    ledgerOpenText(tag),
    ledgerSettlementRefLines(links, tag).join('\n') || '-',
    tag.note || '-',
  ];
}

function rowImpactClass(row) {
  if (row.kind === 'group') return impactTone(row.totals.balanceDelta);
  return MOVES_BALANCE.has(row.tag?.direction) ? impactTone(ledgerBalanceDelta(row.tag)) : '';
}

function settlementDetailCells(group) {
  const check = ledgerSettlementCheck(group);
  return rawSettlementDetailCells(group, check).map(cellStr);
}

function rawSettlementDetailCells(group, check) {
  return [
    [ledgerSettlementHeadParts(group).join(' | '), check ? `Check: ${check}` : null].filter(Boolean).join('\n'),
    group.settles.map((ref) => ledgerSettledEntryParts(group, ref).join(' | ')).join('\n'),
  ];
}

function groupDetailCells(row, friendName) {
  return [
    ledgerGroupHeadParts(row, friendName).join(' | '),
    row.members.map((tag, i) => ledgerGroupMemberParts(tag, row.memberLinks[i], friendName).join(' | ')).join('\n'),
  ].map(cellStr);
}

/** "Group details" / "Settlement details": a titled two-column table, 34% / 66%. */
function DetailTable({ title, headers, rows }) {
  return (
    <section className="lxp-block">
      <h3 className="lxp-block__title">{title}</h3>
      <table className="lxp-table lxp-table--detail">
        <colgroup>
          <col className="lxp-col-34" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>{headers[0]}</th>
            <th>{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([left, right], i) => (
            <tr key={i}>
              <td>{left}</td>
              <td>{right}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SummaryTable({ summary }) {
  const open = summary.open || {};
  const rows = [
    ['Total they owe you', ledgerNumber(summary.totalTheyOwe), false],
    ['Total you owe', ledgerNumber(summary.totalYouOwe), false],
    ['Settlements', ledgerNumber(summary.totalSettlements), false],
    ['Net balance', ledgerNumber(summary.net), true],
    ['Still open today: they owe you', ledgerNumber(open.theyOwe ?? 0), false],
    ['Still open today: you owe', ledgerNumber(open.youOwe ?? 0), false],
    ...(open.onAccount > 0 ? [['Money on account (not applied yet)', ledgerNumber(open.onAccount), false]] : []),
  ];
  return (
    <section className="lxp-block">
      <h3 className="lxp-block__title">Summary</h3>
      <table className="lxp-table lxp-table--summary">
        <colgroup>
          <col className="lxp-col-58" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Item</th>
            <th className="lxp-right">Amount (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value, isNet]) => (
            <tr key={label} className={isNet ? 'lxp-summary-net' : undefined}>
              <td>{label}</td>
              <td className="lxp-right">Rs.{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * The statement as the PDF prints it. `emptyText` replaces the body when
 * there is nothing to print.
 */
export default function LedgerPaper({ friendName, startDate, endDate, tags, summary, generatedStamp, emptyText }) {
  const blurb = `This statement lists transactions tagged between ${LEDGER_OWNER_NAME} and ${friendName}.`;
  const statement = tags.length ? ledgerStatement(tags) : null;
  const groupRows = statement ? statement.rows.filter((row) => row.kind === 'group') : [];

  return (
    <article className="lxp-paper" aria-label="Ledger PDF preview">
      <header className="lxp-head">
        <div className="lxp-brand">FINTRACK</div>
        <h2 className="lxp-title">Transaction ledger</h2>
        <p className="lxp-blurb">{blurb}</p>
        <p className="lxp-period">
          Statement period: {ledgerDate(startDate)} - {ledgerDate(endDate)}
        </p>
        <hr className="lxp-rule" />
      </header>

      {!statement ? (
        <p className="lxp-empty">{emptyText || 'No transactions in this range.'}</p>
      ) : (
        <>
          <table className="lxp-table lxp-table--ledger">
            <colgroup>
              {COLUMNS.map((label) => (
                <col key={label} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statement.rows.map((row) => {
                const cells = rowCells(row, friendName);
                const impactClass = rowImpactClass(row);
                return (
                  <tr key={row.kind === 'group' ? `group-${row.group.id}` : row.tag.id}>
                    {cells.map((text, i) => (
                      <td key={i} className={i === IMPACT_COL ? impactClass || undefined : undefined}>
                        {text}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {groupRows.length > 0 && (
            <DetailTable
              title="Group details"
              headers={['Group', 'Entries in it']}
              rows={groupRows.map((row) => groupDetailCells(row, friendName))}
            />
          )}
          {statement.settlements.length > 0 && (
            <DetailTable
              title="Settlement details"
              headers={['Settlement entry', 'Entries it settles']}
              rows={statement.settlements.map(settlementDetailCells)}
            />
          )}
          <SummaryTable summary={summary} />
        </>
      )}

      <footer className="lxp-foot">Fintrack | Generated {generatedStamp}</footer>
    </article>
  );
}
