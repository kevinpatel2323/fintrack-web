import {
  ArrowLeftRight, CalendarDays, CreditCard, House, LayoutDashboard,
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

/**
 * Phone tab bar: the five places people go every day. Everything in
 * MANAGE_NAV (plus appearance) lives on the You page, opened from the button
 * at the left of every tab's header — iOS keeps a tab bar to five items.
 */
export const MOBILE_TABS = [
  { to: '/', label: 'Home', icon: House, match: (p) => p === '/' },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight, match: (p) => p.startsWith('/transactions') },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, match: (p) => p.startsWith('/calendar') },
  { to: '/cards', label: 'Cards', icon: CreditCard, match: (p) => p.startsWith('/cards') },
  { to: '/friends', label: 'People', icon: Users, match: (p) => p.startsWith('/friends') },
];

/** Pages under You on phones; their back button falls back to /you. */
export const YOU_PATHS = ['/you', '/categories', '/import', '/security'];

/** The tab bar shows on a tab's own page only; pushed pages get a back button instead. */
export function isTabRoot(pathname) {
  return MOBILE_TABS.some((tab) => tab.to === pathname);
}

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
