const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

/** The list's "Uncategorised" filter value; `category=none` in the URL. */
export const UNCATEGORISED_FILTER = '__none__';

/** `category` URL param → category filter value ('' for all, '__none__', or a category id). */
function parseCategoryParam(raw) {
  const value = raw?.trim() ?? '';
  if (!value) return '';
  return value === 'none' ? UNCATEGORISED_FILTER : value;
}

/** @param {URLSearchParams} searchParams */
export function parseTransactionsListParams(searchParams, defaults) {
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const tab = searchParams.get('tab');
  return {
    rangeStart: isIsoDate(start) ? start : defaults.startIso,
    rangeEnd: isIsoDate(end) ? end : defaults.endIso,
    filterTab: tab === 'spent' || tab === 'earned' ? tab : 'all',
    search: searchParams.get('q') ?? '',
    categoryFilter: parseCategoryParam(searchParams.get('category')),
  };
}

/** @param {URLSearchParams} prev */
export function patchTransactionsListParams(prev, patch) {
  const next = new URLSearchParams(prev);

  if ('rangeStart' in patch) {
    const value = patch.rangeStart;
    if (isIsoDate(value)) next.set('start', value);
    else next.delete('start');
  }
  if ('rangeEnd' in patch) {
    const value = patch.rangeEnd;
    if (isIsoDate(value)) next.set('end', value);
    else next.delete('end');
  }
  if ('filterTab' in patch) {
    const value = patch.filterTab;
    if (value === 'spent' || value === 'earned') next.set('tab', value);
    else next.delete('tab');
  }
  if ('search' in patch) {
    const value = patch.search?.trim() ?? '';
    if (value) next.set('q', value);
    else next.delete('q');
  }
  if ('categoryFilter' in patch) {
    const value = patch.categoryFilter == null ? '' : String(patch.categoryFilter).trim();
    if (value === UNCATEGORISED_FILTER || value === 'none') next.set('category', 'none');
    else if (value) next.set('category', value);
    else next.delete('category');
  }

  return next;
}

export function transactionsListPath(listSearch) {
  const raw = typeof listSearch === 'string' ? listSearch.trim() : '';
  if (!raw) return '/transactions';
  return raw.startsWith('?') ? `/transactions${raw}` : `/transactions?${raw}`;
}
