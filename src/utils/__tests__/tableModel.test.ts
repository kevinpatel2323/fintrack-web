import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain JS module, no type declarations
import { getPaginationItems, paginateRows } from '../tableModel.js';

type Row = { id: number; name: string; amount: number; note?: string | null };

const rows: Row[] = [
  { id: 1, name: 'Chai stall', amount: 40, note: 'zeta' },
  { id: 2, name: 'Metro card', amount: 500, note: 'alpha' },
  { id: 3, name: 'Rent', amount: 24000, note: null },
];

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
