export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);
  return { startIso, endIso };
}

/** Local time-of-day greeting for dashboard headers. */
export function timeOfDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function getTodayIso(date = new Date()) {
  return formatLocalIsoDate(date);
}

/** YYYY-MM-DD in the user's local calendar (matches `<input type="date">`). */
export function formatLocalIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Rolling window ending today (local), same convention as DateRangePicker "30days". */
export function getLast30DayRange(referenceDate = new Date()) {
  const end = new Date(referenceDate);
  const start = new Date(end);
  start.setDate(end.getDate() - 30);
  return { startIso: formatLocalIsoDate(start), endIso: formatLocalIsoDate(end) };
}
