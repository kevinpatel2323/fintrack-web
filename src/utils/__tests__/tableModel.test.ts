import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain JS module, no type declarations
import { columnText, filterTableRows, getPaginationItems, paginateRows } from '../tableModel.js';
// @ts-expect-error — plain JS module, no type declarations
import { sortTableRows } from '../tableSort.js';

type Row = { id: number; name: string; amount: number; note?: string | null };

const columns = [
  { id: 'name', header: 'Name', sortable: true },
  { id: 'amount', header: 'Amount', sortable: true },
  { id: 'note', header: 'Note', filterable: false },
];

const rows: Row[] = [
  { id: 1, name: 'Chai stall', amount: 40, note: 'zeta' },
  { id: 2, name: 'Metro card', amount: 500, note: 'alpha' },
  { id: 3, name: 'Rent', amount: 24000, note: null },
];

describe('columnText', () => {
  it('prefers filterValue over accessor', () => {
    const col = { id: 'name', accessor: (r: Row) => r.name, filterValue: () => 'override' };
    expect(columnText(col, rows[0])).toBe('override');
  });

  it('falls back to the raw field and renders nullish as empty', () => {
    expect(columnText({ id: 'name' }, rows[0])).toBe('Chai stall');
    expect(columnText({ id: 'note' }, rows[2])).toBe('');
  });
});

describe('filterTableRows', () => {
  it('returns the same array reference when nothing is filtered', () => {
    expect(filterTableRows(rows, columns, '', {})).toBe(rows);
  });

  it('matches the global filter case-insensitively across filterable columns', () => {
    expect(filterTableRows(rows, columns, 'metro', {}).map((r: Row) => r.id)).toEqual([2]);
    expect(filterTableRows(rows, columns, 'RENT', {}).map((r: Row) => r.id)).toEqual([3]);
  });

  it('skips columns marked filterable: false', () => {
    // "alpha" only exists in the note column, which opts out of search.
    expect(filterTableRows(rows, columns, 'alpha', {})).toHaveLength(0);
  });

  it('applies per-column filters and ANDs them with the global filter', () => {
    expect(filterTableRows(rows, columns, '', { name: 'card' }).map((r: Row) => r.id)).toEqual([2]);
    expect(filterTableRows(rows, columns, 'rent', { name: 'card' })).toHaveLength(0);
  });

  it('ignores blank column filters', () => {
    expect(filterTableRows(rows, columns, '', { name: '   ' })).toHaveLength(3);
  });
});

describe('getPaginationItems', () => {
  it('lists every page when there are five or fewer', () => {
    expect(getPaginationItems(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it('keeps first, last and the current page neighbours, with gap sentinels', () => {
    const items = getPaginationItems(5, 10);
    expect(items[0]).toBe(1);
    expect(items[items.length - 1]).toBe(10);
    expect(items).toContain(4);
    expect(items).toContain(6);
    expect(items.filter((i: number | string) => typeof i === 'string')).toHaveLength(2);
  });

  it('does not emit a gap sentinel for adjacent pages', () => {
    expect(getPaginationItems(2, 10).filter((i: number | string) => typeof i === 'string')).toHaveLength(1);
  });
});

describe('paginateRows', () => {
  it('slices the requested page and reports the range', () => {
    const r = paginateRows(rows, 2, 2);
    expect(r.pageRows.map((x: Row) => x.id)).toEqual([3]);
    expect([r.currentPage, r.totalPages, r.pageStart, r.pageEnd]).toEqual([2, 2, 3, 3]);
  });

  it('clamps a page past the end back into range', () => {
    expect(paginateRows(rows, 99, 2).currentPage).toBe(2);
  });

  it('treats a zero page size as unpaginated', () => {
    expect(paginateRows(rows, 1, 0).pageRows).toHaveLength(3);
  });

  it('reports an empty range for no rows', () => {
    const r = paginateRows([], 1, 10);
    expect([r.pageStart, r.pageEnd, r.totalPages]).toEqual([0, 0, 1]);
  });
});

describe('sortTableRows', () => {
  it('sorts numerically in both directions', () => {
    const asc = sortTableRows(rows, columns, { columnId: 'amount', dir: 'asc' });
    expect(asc.map((r: Row) => r.amount)).toEqual([40, 500, 24000]);
    const desc = sortTableRows(rows, columns, { columnId: 'amount', dir: 'desc' });
    expect(desc.map((r: Row) => r.amount)).toEqual([24000, 500, 40]);
  });

  it('leaves rows untouched for a missing or non-sortable column', () => {
    expect(sortTableRows(rows, columns, null)).toBe(rows);
    expect(sortTableRows(rows, columns, { columnId: 'note', dir: 'asc' })).toBe(rows);
  });

  it('does not mutate the input array', () => {
    const input = [...rows];
    sortTableRows(input, columns, { columnId: 'amount', dir: 'desc' });
    expect(input.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});
