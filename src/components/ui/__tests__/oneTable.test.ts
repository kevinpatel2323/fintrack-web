import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Every table of records renders through the kit ListView
 * (`components/ui/ListView.jsx`), so sorting, resizing, column choices,
 * paging, loading and empty states behave the same everywhere. This guard
 * fails when table markup or column resizing appears anywhere else.
 *
 * The exceptions are documented in `components/ui/docs/DESIGN.md`
 * ("One table for every list of records"); add one there before adding it
 * here.
 */
const SRC = fileURLToPath(new URL('../../../', import.meta.url));

const EXCEPTIONS: Record<string, string> = {
  'components/ui/ListView.jsx': 'the table itself',
  'components/ui/ListView.css': 'the table itself',
  'components/ui/DatePicker.jsx': 'a month grid, not records',
  'components/people/AllocTable.jsx': 'editable allocation form inside settlement dialogs and sheets',
  'components/ledger-export/LedgerPaper.jsx': 'preview of the exported PDF page, laid out like the PDF',
  'components/charts/parts.jsx': "screen-reader data table behind a chart",
};

const TABLE_MARKUP = /<table\b|role=["'](?:table|grid|row|columnheader|rowheader|cell|gridcell)["']/;
const RESIZING = /col-resize/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(jsx?|tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe('one table component', () => {
  const files = sourceFiles(SRC).map((path) => ({ rel: relative(SRC, path), text: readFileSync(path, 'utf8') }));

  it('finds the sources', () => {
    expect(files.some((f) => f.rel === 'components/ui/ListView.jsx')).toBe(true);
  });

  it('builds tables only through ListView', () => {
    const offenders = files
      .filter((f) => !EXCEPTIONS[f.rel] && /\.(jsx?|tsx?)$/.test(f.rel) && TABLE_MARKUP.test(f.text))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('resizes columns only in ListView', () => {
    const offenders = files.filter((f) => !EXCEPTIONS[f.rel] && RESIZING.test(f.text)).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('lists no exception that no longer exists', () => {
    const present = new Set(files.map((f) => f.rel));
    expect(Object.keys(EXCEPTIONS).filter((rel) => !present.has(rel))).toEqual([]);
  });
});
