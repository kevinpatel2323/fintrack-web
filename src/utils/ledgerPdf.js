import { jsPDF } from 'jspdf';
import {
  LEDGER_OWNER_NAME,
  ledgerDirectionPhrase,
  ledgerRowAmount,
  ledgerRunningBalances,
} from './ledgerParties';

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

/** ASCII-safe for built-in PDF fonts (Helvetica). */
function cellStr(v) {
  if (v === null || v === undefined) return '-';
  return String(v)
    .replace(/\u2014/g, '-')
    .replace(/\u2212/g, '-')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function balanceImpactPdf(direction, amount) {
  if (direction === 'OWES_ME') return `+Rs.${formatNumberPdf(amount)}`;
  if (direction === 'I_OWE') return `-Rs.${formatNumberPdf(amount)}`;
  if (direction === 'SETTLEMENT') return 'Settled';
  return '-';
}

// + entries (money owed to the owner) render red; - entries (owner owes) render green.
const IMPACT_POS_COLOR = [190, 18, 60];
const IMPACT_NEG_COLOR = [21, 128, 61];
const IMPACT_SETTLED_COLOR = [161, 98, 7];

function balanceImpactColorPdf(direction) {
  if (direction === 'OWES_ME') return IMPACT_POS_COLOR;
  if (direction === 'I_OWE') return IMPACT_NEG_COLOR;
  if (direction === 'SETTLEMENT') return IMPACT_SETTLED_COLOR;
  return null;
}

function formatRunningBalancePdf(value) {
  return value < 0 ? `-Rs.${formatNumberPdf(Math.abs(value))}` : `Rs.${formatNumberPdf(value)}`;
}

function formatNumberPdf(value) {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN').format(num);
}

function formatDatePdf(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return cellStr(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

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

  const rawWidths = [24, 58, 86, 158, 56, 92, 54, 54, 64, 116];
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

  function rowCells(tag, index, runningBalance) {
    const t = tag.transaction || {};
    const name = t.upiName || '-';
    const desc = t.upiDescription || t.narration || '-';
    const bank = t.upiBank || '-';
    return [
      String(index + 1),
      formatDatePdf(t.transactionDate),
      cellStr(name),
      cellStr(desc),
      cellStr(bank),
      cellStr(ledgerDirectionPhrase(tag.direction, friendName)),
      `Rs.${formatNumberPdf(ledgerRowAmount(tag))}`,
      balanceImpactPdf(tag.direction, tag.amount),
      formatRunningBalancePdf(runningBalance),
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

  function drawSummary(yStart) {
    const pad = 8;
    const labelW = contentW * 0.58;
    const rowH = 22;
    const headerH = 22;
    const titleGap = 20;
    const rows = [
      ['Total they owe you', formatNumberPdf(summary.totalTheyOwe), false],
      ['Total you owe', formatNumberPdf(summary.totalYouOwe), false],
      ['Settlements', formatNumberPdf(summary.totalSettlements), false],
      ['Net balance', formatNumberPdf(summary.net), true],
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

  const runningBalances = ledgerRunningBalances(tags);

  let y = drawPageHeader(true);
  y = drawTableHeaderRow(y);

  for (let i = 0; i < tags.length; i++) {
    const cells = rowCells(tags[i], i, runningBalances[i]);
    const pad = 4;
    const lineBundles = cells.map((c, j) => pdf.splitTextToSize(c, colW[j] - pad * 2));
    const maxL = Math.max(...lineBundles.map((l) => l.length), 1);
    const estH = maxL * TABLE_LINE + pad * 2;

    if (y + estH > bottomLimit) {
      pdf.addPage();
      y = drawPageHeader(false);
      y = drawTableHeaderRow(y);
    }

    y = drawDataRow(y, cells, balanceImpactColorPdf(tags[i].direction));
  }

  y += 16;
  const summaryBlockH = 170;
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
