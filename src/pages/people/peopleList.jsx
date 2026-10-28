// What the People list says about a person: which side their balance is on,
// when you last had an entry, the balance cell. Shared by the desktop table
// (pages/Friends.jsx) and the phone list (FriendsPhone.jsx).
import { Amount } from '../../components/ui';

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'owed', label: 'They owe' },
  { id: 'owe', label: 'You owe' },
  { id: 'settled', label: 'Settled' },
];

export const SIDE_ORDER = { owed: 0, owe: 1, settled: 2 };
export const STATUS = {
  owed: { label: 'Owes you', theme: 'green' },
  owe: { label: 'You owe', theme: 'amber' },
  settled: { label: 'Settled', theme: 'gray' },
};

// Under a rupee either way reads as settled (paise left over from splits).
const SETTLED_BELOW = 1;

export function balanceSide(bal) {
  if (Math.abs(bal) < SETTLED_BELOW) return 'settled';
  return bal > 0 ? 'owed' : 'owe';
}

/** "Today", "3 days ago", "17 Oct", "17 Oct 2025" — for the row's last activity. */
export function fmtActivity(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  }).format(d);
}

export const people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

/** The open balance; its side is in the Status column (and under the name on
 *  phones), so the figure stays a plain, sortable number. */
export function BalanceCell({ value }) {
  const side = balanceSide(value);
  if (side === 'settled') return <span className="people-cell-empty">—</span>;
  return <Amount className="people-balance" value={Math.abs(value)} tone={side === 'owed' ? 'in' : 'out'} />;
}

/** "2 settlements · balance changes" — one person's line in the review nudge. */
export const reviewDetail = (f) =>
  `${f.needingReview} ${f.needingReview === 1 ? 'settlement' : 'settlements'}${f.netChange !== 0 ? ' · balance changes' : ''}`;

export const reviewHref = (f) => `/friends/${f.friendId}?review=1`;
