const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
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

  return next;
}

export function transactionsListPath(listSearch) {
  const raw = typeof listSearch === 'string' ? listSearch.trim() : '';
  if (!raw) return '/transactions';
  return raw.startsWith('?') ? `/transactions${raw}` : `/transactions?${raw}`;
}
