import { describe, expect, it } from 'vitest';
import {
  clampWidth,
  columnName,
  flattenRows,
  flexColumnKey,
  getPaginationItems,
  listColumnChoices,
  nextSort,
  paginateRows,
  resizeHandles,
  resolveWidth,
  sortRows,
  templateVars,
  toTrack,
  // @ts-expect-error — plain JS module, no type declarations
} from '../internal/listModel.js';

type Row = { id: number; name: string; amount: number; note?: string | null };

const rows: Row[] = [
  { id: 1, name: 'Chai stall', amount: 40, note: 'zeta' },
  { id: 2, name: 'Metro card', amount: 500, note: 'alpha' },
  { id: 3, name: 'Rent', amount: 24000, note: null },
];

// The Transactions ledger's layout: Date, Description (flexible), Category, Amount, a row menu.
const ledger = [
  { key: 'date', label: 'Date', width: 88, minWidth: 72, sortFirst: 'desc' },
  { key: 'description', label: 'Description', width: 240, minWidth: 200, flex: true, pinned: true },
  { key: 'category', label: 'Category', width: 168 },
  { key: 'amount', label: 'Amount', width: 120, align: 'right' },
  { key: 'actions', label: '', width: 36 },
];

describe('tracks', () => {
  it('turns widths into grid tracks, flooring bare fractions', () => {
    expect(toTrack(88)).toBe('88px');
    expect(toTrack('2fr')).toBe('minmax(96px, 2fr)');
    expect(toTrack(undefined)).toBe('minmax(96px, 1fr)');
    expect(toTrack('minmax(140px, 1fr)')).toBe('minmax(140px, 1fr)');
  });

  it('sums the fixed tracks into the minimum table width per breakpoint', () => {
    const vars = templateVars(
      [{ key: 'a', width: 100 }, { key: 'b', width: 'minmax(200px, 1fr)' }, { key: 'c', width: 50, hideBelow: 'md' }],
      false,
    );
    expect(vars['--ui-list-cols-lg']).toBe('100px minmax(200px, 1fr) 50px');
    expect(vars['--ui-list-cols-sm']).toBe('100px minmax(200px, 1fr)');
    expect(vars['--ui-list-min-lg']).toContain('350px');
  });
});

describe('resizing', () => {
  it('flexes the marked column, else the first fractional one, else none', () => {
    expect(flexColumnKey(ledger)).toBe('description');
    expect(flexColumnKey([{ key: 'a', width: 80 }, { key: 'b', width: 'minmax(120px, 2fr)' }])).toBe('b');
    expect(flexColumnKey([{ key: 'a', width: 80 }, { key: 'b' }])).toBe('b');
    expect(flexColumnKey([{ key: 'a', width: 80 }, { key: 'b', width: 90 }])).toBeNull();
  });

  it('puts handles on the edge the flexible column gives way at', () => {
    const sides = resizeHandles(ledger, true);
    expect(sides.get('date')).toBe('end');
    expect(sides.get('category')).toBe('start');
    expect(sides.get('amount')).toBe('start');
    expect(sides.has('description')).toBe(false); // flexible: takes what's left
    expect(sides.has('actions')).toBe(false); // no name, nothing to resize
  });

  it('has no handles when the list is not resizable or a column opts out', () => {
    expect(resizeHandles(ledger, false).size).toBe(0);
    const cols = ledger.map((c) => (c.key === 'date' ? { ...c, resizable: false } : c));
    expect(resizeHandles(cols, true).has('date')).toBe(false);
  });

  it('uses right-edge handles everywhere when no column flexes', () => {
    const sides = resizeHandles([{ key: 'a', label: 'A', width: 80 }, { key: 'b', label: 'B', width: 90 }], true);
    expect([sides.get('a'), sides.get('b')]).toEqual(['end', 'end']);
  });

  it('renders a dragged width, and keeps the flexible column fractional', () => {
    const widths = { category: 210, description: 999 };
    expect(resolveWidth(ledger[2], { flexKey: 'description', resizable: true, widths })).toBe(210);
    expect(resolveWidth(ledger[2], { flexKey: 'description', resizable: false, widths })).toBe(168);
    expect(resolveWidth(ledger[1], { flexKey: 'description', resizable: true, widths })).toBe('minmax(200px, 1fr)');
  });

  it('never drags a column below its floor', () => {
    expect(clampWidth(ledger[0], 10)).toBe(72);
    expect(clampWidth({ key: 'x' }, 10)).toBe(64);
    expect(clampWidth({ key: 'x' }, 150.6)).toBe(151);
  });
});

describe('sorting', () => {
  it('starts a new column in its first direction, then flips', () => {
    expect(nextSort(null, ledger[0])).toEqual({ key: 'date', direction: 'desc' });
    expect(nextSort({ key: 'date', direction: 'desc' }, ledger[2])).toEqual({ key: 'category', direction: 'asc' });
    expect(nextSort({ key: 'category', direction: 'asc' }, ledger[2])).toEqual({ key: 'category', direction: 'desc' });
    expect(nextSort({ key: 'category', direction: 'desc' }, ledger[2])).toEqual({ key: 'category', direction: 'asc' });
  });

  const cols = [
    { key: 'name' },
    { key: 'amount' },
    { key: 'note', sortValue: (r: Row) => r.note },
  ];

  it('orders by the column value, numbers as numbers', () => {
    expect(sortRows(rows, cols, { key: 'amount', direction: 'desc' }).map((r: Row) => r.id)).toEqual([3, 2, 1]);
    expect(sortRows(rows, cols, { key: 'name', direction: 'asc' }).map((r: Row) => r.id)).toEqual([1, 2, 3]);
  });

  it('puts blank values last in either direction', () => {
    expect(sortRows(rows, cols, { key: 'note', direction: 'asc' }).map((r: Row) => r.id)).toEqual([2, 1, 3]);
    expect(sortRows(rows, cols, { key: 'note', direction: 'desc' }).map((r: Row) => r.id)).toEqual([1, 2, 3]);
  });

  it('keeps ties in their given order and compares text naturally', () => {
    const items = [
      { id: 1, v: 'Item 10' },
      { id: 2, v: 'item 2' },
      { id: 3, v: 'Item 2' },
    ];
    expect(sortRows(items, [{ key: 'v' }], { key: 'v', direction: 'asc' }).map((r: { id: number }) => r.id)).toEqual([2, 3, 1]);
  });

  it('leaves the rows alone with no sort or an unknown column', () => {
    expect(sortRows(rows, cols, null)).toBe(rows);
    expect(sortRows(rows, cols, { key: 'nope', direction: 'asc' })).toBe(rows);
  });
});

describe('sub-rows', () => {
  it('puts each row\'s sub-rows right after it', () => {
    const parents = [{ id: 'a' }, { id: 'b' }];
    const out = flattenRows(parents, (r: { id: string }) => (r.id === 'a' ? [{ id: 'a1' }, { id: 'a2' }] : null));
    expect(out.map((r: { id: string }) => r.id)).toEqual(['a', 'a1', 'a2', 'b']);
    expect(flattenRows(parents, undefined)).toBe(parents);
  });
});

describe('columns menu', () => {
  it('lists named, unpinned columns', () => {
    expect(listColumnChoices(ledger)).toEqual([
      { id: 'date', label: 'Date' },
      { id: 'category', label: 'Category' },
      { id: 'amount', label: 'Amount' },
    ]);
    expect(listColumnChoices([{ id: 'note', label: 'Note' }])).toEqual([{ id: 'note', label: 'Note' }]);
  });

  it('names a column by its menu or sort label when the header is not text', () => {
    expect(columnName({ key: 'x', label: 'Share of Oct', sortLabel: 'Share' })).toBe('Share');
    expect(columnName({ key: 'x', label: { type: 'span' } })).toBe('');
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
