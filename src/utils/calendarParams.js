import { isIsoDate } from './transactionsListParams.js';

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** @param {string | null | undefined} value */
export function parseMonthParam(value) {
  if (typeof value !== 'string') return null;
  const m = MONTH_RE.exec(value);
  if (!m) return null;
  const viewYear = Number(m[1]);
  const viewMonth = Number(m[2]) - 1;
  if (!Number.isFinite(viewYear) || viewMonth < 0 || viewMonth > 11) return null;
  return { viewYear, viewMonth };
}

/** @param {URLSearchParams} searchParams */
export function parseCalendarParams(searchParams, defaults) {
  const monthFromUrl = parseMonthParam(searchParams.get('month'));
  const dayRaw = searchParams.get('day');
  const dayIso = isIsoDate(dayRaw) ? dayRaw : null;

  let viewYear = monthFromUrl?.viewYear ?? defaults.viewYear;
  let viewMonth = monthFromUrl?.viewMonth ?? defaults.viewMonth;

  if (!monthFromUrl && dayIso) {
    const d = new Date(`${dayIso}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      viewYear = d.getFullYear();
      viewMonth = d.getMonth();
    }
  }

  const selectedIso = dayIso ?? defaults.selectedIso;

  return { viewYear, viewMonth, selectedIso };
}

export const CALENDAR_VIEWS = ['transactions', 'subscriptions'];

/**
 * Which tab the calendar shows: `?view=subscriptions`, else transactions.
 * @param {URLSearchParams} searchParams
 */
export function parseCalendarView(searchParams) {
  return searchParams.get('view') === 'subscriptions' ? 'subscriptions' : 'transactions';
}

/** @param {URLSearchParams} prev */
export function patchCalendarParams(prev, patch) {
  const next = new URLSearchParams(prev);

  if ('viewYear' in patch && 'viewMonth' in patch) {
    const { viewYear, viewMonth } = patch;
    if (Number.isFinite(viewYear) && Number.isFinite(viewMonth) && viewMonth >= 0 && viewMonth <= 11) {
      next.set('month', `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`);
    } else {
      next.delete('month');
    }
  }

  if ('selectedIso' in patch) {
    const value = patch.selectedIso;
    if (isIsoDate(value)) next.set('day', value);
    else next.delete('day');
  }

  // Transactions is the default view, so it leaves no param behind.
  if ('view' in patch) {
    if (patch.view === 'subscriptions') next.set('view', 'subscriptions');
    else next.delete('view');
  }

  return next;
}

export function calendarPath(calendarSearch) {
  const raw = typeof calendarSearch === 'string' ? calendarSearch.trim() : '';
  if (!raw) return '/calendar';
  return raw.startsWith('?') ? `/calendar${raw}` : `/calendar?${raw}`;
}
