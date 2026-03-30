export function compareForSort(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }
  const ta = typeof a === 'string' ? a : String(a);
  const tb = typeof b === 'string' ? b : String(b);
  return ta.localeCompare(tb, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortTableRows(rows, columnDefs, sort) {
  if (!sort?.columnId) return rows;
  const col = columnDefs.find((c) => c.id === sort.columnId);
  if (!col?.sortable) return rows;
  const acc =
    col.accessor ??
    ((row) => {
      const v = row?.[col.id];
      return v;
    });
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => dir * compareForSort(acc(a), acc(b)));
}
