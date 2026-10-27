import {
  ArrowLeftRight, CalendarDays, CreditCard, Ellipsis, House, LayoutDashboard,
  ShieldCheck, Tags, Upload, Users,
} from 'lucide-react';
import { useImportSchedule } from '../../hooks/useImportSchedule.js';
import { useReviewSummary } from '../../hooks/useReviewSummary.js';

// One place for the app's destinations, shared by the desktop sidebar and the
// phone tab bar so the two never disagree about names, icons or routes.

export const PRIMARY_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/cards', label: 'Cards', icon: CreditCard },
  { to: '/friends', label: 'People', icon: Users },
];

export const MANAGE_NAV = [
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/import', label: 'Import statements', icon: Upload },
  { to: '/security', label: 'Security', icon: ShieldCheck, authOnly: true },
];

/** Phone tab bar. "More" (the /you page) holds everything in MANAGE_NAV. */
export const MOBILE_TABS = [
  { to: '/', label: 'Home', icon: House, match: (p) => p === '/' },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight, match: (p) => p.startsWith('/transactions') },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, match: (p) => p.startsWith('/calendar') },
  { to: '/cards', label: 'Cards', icon: CreditCard, match: (p) => p.startsWith('/cards') },
  { to: '/friends', label: 'People', icon: Users, match: (p) => p.startsWith('/friends') },
  {
    to: '/you',
    label: 'More',
    icon: Ellipsis,
    match: (p) => ['/you', '/categories', '/import', '/security'].some((r) => p.startsWith(r)),
  },
];

/**
 * Counts that need the user's attention, keyed by route: card statements out
 * but not imported (Import) and older settlements to review (People).
 */
export function useNavBadges() {
  const { data: schedule } = useImportSchedule();
  const { data: review } = useReviewSummary();
  const toImport = schedule?.pendingCount ?? 0;
  const toReview = review?.needingReview ?? 0;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return {
    '/import': toImport ? { count: toImport, label: `${plural(toImport, 'card statement')} to import` } : null,
    '/friends': toReview ? { count: toReview, label: `${plural(toReview, 'older settlement')} to review` } : null,
  };
}
