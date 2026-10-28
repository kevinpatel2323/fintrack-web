// Pieces the Categories page's desktop table and its phone list share.
import { Amount, Skeleton } from '../../components/ui';

/** Colour for spending that has no category (list bar and donut slice). */
export const UNCATEGORISED_COLOR = 'var(--ink-gray-6)';

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export function pctText(pct) {
  return `${pct < 1 ? '<1' : pct.toFixed(0)}%`;
}

/**
 * The muted lines under a category's name.
 * - `hint`: why there is no figure (unused, or the uncategorised row).
 * - `usage`: the month's figures ("3 transactions · 12%", "Money in · …").
 * - `meta`: the one line that carries both, where the share and count
 *   columns are hidden.
 */
export function categoryRowText(row, loading) {
  const { cat, stat, uncategorised } = row;
  const amount = stat?.totalAmount || 0;
  const used = stat && amount !== 0;
  let hint = null;
  if (uncategorised) hint = 'Not in any category yet';
  else if (!used && !loading) {
    hint = cat.transactionCount ? `${plural(cat.transactionCount, 'transaction', 'transactions')} all time` : 'Not used yet';
  }

  let usage = null;
  if (used) {
    usage = amount < 0
      ? `Money in · ${plural(stat.transactionCount, 'transaction', 'transactions')}`
      : `${plural(stat.transactionCount, 'transaction', 'transactions')} · ${pctText(Math.max(0, stat.percentage || 0))}`;
  }

  let meta = hint;
  if (usage) meta = uncategorised ? `${hint} · ${usage}` : usage;
  return { hint, usage, meta };
}

/**
 * A category can net to a credit (refunds, a card bill paid from the account)
 * — that shows as money in, outside the month's spend.
 */
export function SpentCell({ stat, loading }) {
  if (loading) return <Skeleton as="span" width={56} height={12} />;
  if (!stat || stat.totalAmount === 0) return <span className="catg-muted">—</span>;
  if (stat.totalAmount < 0) return <Amount value={-stat.totalAmount} sign="always" />;
  return <Amount value={stat.totalAmount} tone="out" />;
}
