import { jsPDF } from 'jspdf';
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
  ledgerOpenTotals,
  ledgerRowAmount,
  ledgerRs,
  ledgerSettledEntryParts,
  ledgerSettlementCheck,
  ledgerSettlementHeadParts,
  ledgerSettlementRefLines,
} from './ledgerParties';
import { ledgerStatement } from './entryGroups.js';

const MARGIN = 40;
const TABLE_FONT = 8;
const TABLE_LINE = 10;
const HEADER_FONT = 9;
const TITLE_SIZE = 20;
const FOOTER_H = 22;

function scaleWidthsToTotal(widths, total) {
  const s = widths.reduce((a, b) => a + b, 0);
  return widths.map((w) => (w / s) * total);
}

/** ASCII-safe for built-in PDF fonts (Helvetica). Exported so the on-screen
 *  preview (ledger-export/LedgerPaper.jsx) prints exactly what the PDF does. */
export function cellStr(v) {
  if (v === null || v === undefined) return '-';
  return String(v)
    .replace(/\u2014/g, '-')
    .replace(/\u2212/g, '-')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

const MOVES_BALANCE = new Set(['OWES_ME', 'I_OWE', 'SETTLEMENT']);

// + entries (money owed to the owner) render red; - entries (owner owes, settlements) render green.
const IMPACT_POS_COLOR = [190, 18, 60];
const IMPACT_NEG_COLOR = [21, 128, 61];

function balanceImpactColorPdf(tag) {
  if (!MOVES_BALANCE.has(tag?.direction)) return null;
  return ledgerBalanceDelta(tag) >= 0 ? IMPACT_POS_COLOR : IMPACT_NEG_COLOR;
}

// Dates, amounts and settlement lines all come from the shared ledger text
// helpers in ledgerParties.js, which the export preview renders too.
const formatDatePdf = (value) => cellStr(ledgerDate(value));

/**
 * Multi-page landscape ledger PDF (vector text + ruled table), independent of viewport.
 */
export function buildLedgerPdf({
  friendName,
  startDate,
  endDate,
  tags,
  summary,
  generatedStamp,
}) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const bottomLimit = pageH - MARGIN - FOOTER_H;

  const rawWidths = [22, 54, 78, 120, 48, 84, 52, 54, 60, 58, 104, 82];
  const colW = scaleWidthsToTotal(rawWidths, contentW);
  const IMPACT_COL = 7;

  const headers = [
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

  const owner = cellStr(LEDGER_OWNER_NAME);
  const friend = cellStr(friendName);

  function drawPageHeader(isFirstPage) {
    if (!isFirstPage) {
      let y = MARGIN;
      pdf.setTextColor(92, 107, 126);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('FINTRACK', MARGIN, y);
      y += 18;
      pdf.setTextColor(12, 25, 41);
      pdf.setFontSize(14);
      pdf.text('Transaction ledger (continued)', MARGIN, y);
      y += 18;
      pdf.setDrawColor(180, 188, 200);
      pdf.line(MARGIN, y, MARGIN + contentW, y);
      y += 14;
      pdf.setTextColor(12, 25, 41);
      return y;
    }

    let y = MARGIN;
    pdf.setTextColor(92, 107, 126);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('FINTRACK', MARGIN, y);
    y += 26;

    pdf.setTextColor(12, 25, 41);
    pdf.setFontSize(TITLE_SIZE);
    pdf.text('Transaction ledger', MARGIN, y);
    y += 36;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(55, 65, 81);
    const blurb = `This statement lists transactions tagged between ${owner} and ${friend}.`;
    const blurbLines = pdf.splitTextToSize(blurb, contentW);
    for (const line of blurbLines) {
      pdf.text(line, MARGIN, y);
      y += 13;
    }
    y += 20;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80, 90, 102);
    pdf.text(
      `Statement period: ${formatDatePdf(startDate)} - ${formatDatePdf(endDate)}`,
      MARGIN,
      y,
    );
    y += 22;
    pdf.setDrawColor(180, 188, 200);
    pdf.line(MARGIN, y, MARGIN + contentW, y);
    y += 18;
    pdf.setTextColor(12, 25, 41);
    return y;
  }

  function drawTableHeaderRow(y) {
    const pad = 4;
    const headerLines = headers.map((h, i) => pdf.splitTextToSize(h, colW[i] - pad * 2));
    const hdrLines = Math.max(...headerLines.map((l) => l.length), 1);
    const rowH = hdrLines * TABLE_LINE + pad * 2;

    pdf.setFillColor(236, 239, 244);
    pdf.rect(MARGIN, y, contentW, rowH, 'F');
    pdf.setDrawColor(200, 206, 214);
    pdf.rect(MARGIN, y, contentW, rowH, 'S');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(HEADER_FONT);
    pdf.setTextColor(30, 41, 59);
    let cx = MARGIN;
    for (let i = 0; i < headers.length; i++) {
      pdf.rect(cx, y, colW[i], rowH, 'S');
      const lines = headerLines[i];
      const tx = cx + pad;
      let ly = y + pad + TABLE_LINE - 2;
      for (const line of lines) {
        pdf.text(line, tx, ly);
        ly += TABLE_LINE;
      }
      cx += colW[i];
    }

    pdf.setFont('helvetica', 'normal');
    return y + rowH;
  }

  function rowCells(row) {
    if (row.kind === 'group') {
      const { totals } = row;
      return [
        String(row.no),
        cellStr(ledgerGroupDateText(totals)),
        cellStr(row.group.title),
        `${totals.count} entries - see Group details`,
        '-',
        cellStr(ledgerGroupDirectionText(totals, friendName)),
        ledgerRs(Math.abs(totals.totalAmount)),
        ledgerGroupImpactText(totals),
        ledgerRs(row.running),
        cellStr(ledgerGroupOpenText(totals, friendName)),
        cellStr(ledgerSettlementRefLines(row.links, null).join('\n') || '-'),
        '-',
      ];
    }
    const { tag, links } = row;
    const t = tag.transaction || {};
    const name = t.upiName || '-';
    const desc = t.upiDescription || t.narration || '-';
    const bank = t.upiBank || '-';
    return [
      String(row.no),
      formatDatePdf(t.transactionDate),
      cellStr(name),
      cellStr(desc),
      cellStr(bank),
      cellStr(ledgerDirectionPhrase(tag.direction, friendName)),
      ledgerRs(ledgerRowAmount(tag)),
      ledgerImpactText(tag),
      ledgerRs(row.running),
      cellStr(ledgerOpenText(tag)),
      cellStr(ledgerSettlementRefLines(links, tag).join('\n') || '-'),
      cellStr(tag.note || '-'),
    ];
  }

  function drawDataRow(y, cells, impactColor) {
    const pad = 4;
    const lineBundles = cells.map((c, i) => pdf.splitTextToSize(c, colW[i] - pad * 2));
    const linesPerCell = lineBundles.map((l) => l.length);
    const maxL = Math.max(...linesPerCell, 1);
    const rowH = maxL * TABLE_LINE + pad * 2;

    pdf.setDrawColor(220, 224, 230);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(TABLE_FONT);

    let cx = MARGIN;
    for (let i = 0; i < cells.length; i++) {
      pdf.rect(cx, y, colW[i], rowH, 'S');
      const color = i === IMPACT_COL && impactColor ? impactColor : [12, 25, 41];
      pdf.setTextColor(...color);
      const lines = lineBundles[i];
      const tx = cx + pad;
      let ly = y + pad + TABLE_LINE - 2;
      for (const line of lines) {
        pdf.text(line, tx, ly);
        ly += TABLE_LINE;
      }
      cx += colW[i];
    }

    return y + rowH;
  }

  /**
   * A titled two-column table under the ledger — "Group details" and
   * "Settlement details" — repeating its title and header on a new page.
   * `cells` is one [left, right] pair of text per row.
   */
  function drawDetailTable(yStart, title, detailHeaders, cells) {
    const pad = 4;
    const widths = [contentW * 0.34, contentW * 0.66];

    const bundlesFor = (cells) =>
      cells.map((c, i) => pdf.splitTextToSize(c, widths[i] - pad * 2));
    const heightOf = (bundles) =>
      Math.max(...bundles.map((b) => b.length), 1) * TABLE_LINE + pad * 2;

    function paint(y, bundles, height, isHeader) {
      if (isHeader) {
        pdf.setFillColor(236, 239, 244);
        pdf.rect(MARGIN, y, contentW, height, 'F');
        pdf.setDrawColor(200, 206, 214);
        pdf.setTextColor(30, 41, 59);
      } else {
        pdf.setDrawColor(220, 224, 230);
        pdf.setTextColor(12, 25, 41);
      }
      let cx = MARGIN;
      for (let i = 0; i < bundles.length; i++) {
        pdf.rect(cx, y, widths[i], height, 'S');
        let ly = y + pad + TABLE_LINE - 2;
        for (const line of bundles[i]) {
          pdf.text(line, cx + pad, ly);
          ly += TABLE_LINE;
        }
        cx += widths[i];
      }
      return y + height;
    }

    function drawTitle(y) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(12, 25, 41);
      pdf.text(title, MARGIN, y + 12);
      return y + 20;
    }

    function drawHeader(y) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(HEADER_FONT);
      const bundles = bundlesFor(detailHeaders);
      return paint(y, bundles, heightOf(bundles), true);
    }

    let y = drawTitle(yStart);
    y = drawHeader(y);

    for (const pair of cells) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(TABLE_FONT);
      const bundles = bundlesFor(pair);
      const rowH = heightOf(bundles);

      if (y + rowH > bottomLimit) {
        pdf.addPage();
        y = drawPageHeader(false);
        y = drawTitle(y);
        y = drawHeader(y);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(TABLE_FONT);
      }

      y = paint(y, bundles, rowH, false);
    }

    return y;
  }

  function drawSummary(yStart) {
    const pad = 8;
    const labelW = contentW * 0.58;
    const rowH = 22;
    const headerH = 22;
    const titleGap = 20;
    // What is still open today, entry by entry, across the rows in this
    // statement — the same figures the "Still open" column shows.
    const open = ledgerOpenTotals(tags);
    const rows = [
      ['Total they owe you', ledgerNumber(summary.totalTheyOwe), false],
      ['Total you owe', ledgerNumber(summary.totalYouOwe), false],
      ['Settlements', ledgerNumber(summary.totalSettlements), false],
      ['Net balance', ledgerNumber(summary.net), true],
      ['Still open today: they owe you', ledgerNumber(open.theyOwe), false],
      ['Still open today: you owe', ledgerNumber(open.youOwe), false],
      ...(open.onAccount > 0 ? [['Money on account (not applied yet)', ledgerNumber(open.onAccount), false]] : []),
    ];
    const bodyH = rows.length * rowH;
    const tableH = headerH + bodyH;

    let y = yStart;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(12, 25, 41);
    pdf.text('Summary', MARGIN, y + 12);
    y += titleGap;

    const tableTop = y;

    pdf.setDrawColor(200, 206, 214);
    pdf.rect(MARGIN, tableTop, contentW, tableH, 'S');

    pdf.setFillColor(236, 239, 244);
    pdf.rect(MARGIN, tableTop, contentW, headerH, 'F');
    pdf.setDrawColor(200, 206, 214);
    pdf.line(MARGIN, tableTop + headerH, MARGIN + contentW, tableTop + headerH);
    pdf.line(MARGIN + labelW, tableTop, MARGIN + labelW, tableTop + tableH);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Item', MARGIN + pad, tableTop + 14);
    pdf.text('Amount (Rs.)', MARGIN + contentW - pad, tableTop + 14, { align: 'right' });

    let ry = tableTop + headerH;
    pdf.setFontSize(10);
    pdf.setTextColor(12, 25, 41);

    for (let i = 0; i < rows.length; i++) {
      const [label, val, isNet] = rows[i];
      if (i > 0) {
        pdf.setDrawColor(220, 224, 230);
        pdf.line(MARGIN, ry, MARGIN + contentW, ry);
      }
      pdf.setFont('helvetica', isNet ? 'bold' : 'normal');
      pdf.text(label, MARGIN + pad, ry + 14);
      pdf.text(`Rs.${val}`, MARGIN + contentW - pad, ry + 14, { align: 'right' });
      ry += rowH;
    }

    return tableTop + tableH + 16;
  }

  /**
   * Spells out each settlement: how much of it went to each entry (share first,
   * then what that entry still has open today), with the row numbers the
   * "Settlement link" column points at, and the sum that shows the split — so
   * a settlement can be audited without cross-checking the app.
   */
  function settlementDetailCells(group) {
    const check = ledgerSettlementCheck(group);
    return [
      cellStr(
        [ledgerSettlementHeadParts(group).join(' | '), check ? `Check: ${check}` : null]
          .filter(Boolean)
          .join('\n'),
      ),
      group.settles.map((ref) => cellStr(ledgerSettledEntryParts(group, ref).join(' | '))).join('\n'),
    ];
  }

  /** A group's one row, opened up: every entry in it. */
  function groupDetailCells(row) {
    return [
      cellStr(ledgerGroupHeadParts(row, friendName).join(' | ')),
      row.members
        .map((tag, i) => cellStr(ledgerGroupMemberParts(tag, row.memberLinks[i], friendName).join(' | ')))
        .join('\n'),
    ];
  }

  const statement = ledgerStatement(tags);
  const groupRows = statement.rows.filter((row) => row.kind === 'group');

  let y = drawPageHeader(true);
  y = drawTableHeaderRow(y);

  for (const row of statement.rows) {
    const cells = rowCells(row);
    const pad = 4;
    const lineBundles = cells.map((c, j) => pdf.splitTextToSize(c, colW[j] - pad * 2));
    const maxL = Math.max(...lineBundles.map((l) => l.length), 1);
    const estH = maxL * TABLE_LINE + pad * 2;

    if (y + estH > bottomLimit) {
      pdf.addPage();
      y = drawPageHeader(false);
      y = drawTableHeaderRow(y);
    }

    const impactColor = row.kind === 'group'
      ? row.totals.balanceDelta >= 0 ? IMPACT_POS_COLOR : IMPACT_NEG_COLOR
      : balanceImpactColorPdf(row.tag);
    y = drawDataRow(y, cells, impactColor);
  }

  y += 16;
  const detailTables = [
    groupRows.length > 0 && ['Group details', ['Group', 'Entries in it'], groupRows.map(groupDetailCells)],
    statement.settlements.length > 0 && [
      'Settlement details',
      ['Settlement entry', 'Entries it settles'],
      statement.settlements.map(settlementDetailCells),
    ],
  ].filter(Boolean);
  for (const [title, detailHeaders, cells] of detailTables) {
    // Title + header row + one row of body needs to clear the fold together.
    if (y + 74 > bottomLimit) {
      pdf.addPage();
      y = drawPageHeader(false);
    }
    y = drawDetailTable(y, title, detailHeaders, cells) + 16;
  }

  const summaryBlockH = 230;
  if (y + summaryBlockH > bottomLimit) {
    pdf.addPage();
    y = drawPageHeader(false);
  }
  drawSummary(y);

  const totalPages = pdf.internal.getNumberOfPages();
  const stamp = generatedStamp || '';
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120, 130, 142);
    const footer = `Fintrack | Generated ${stamp} | Page ${p} of ${totalPages}`;
    pdf.text(footer, MARGIN, pageH - MARGIN + 8);
  }

  return pdf;
}
