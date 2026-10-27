import {
  ArrowLeftRight, Banknote, Car, Clapperboard, HeartPulse, House, ShoppingBag,
  ShoppingCart, Tag, UtensilsCrossed, Zap,
} from 'lucide-react';
import { categoryColor, categoryKey } from '../../utils/categoryColors.js';
import './Category.css';

const ICONS = {
  food: UtensilsCrossed,
  transport: Car,
  shopping: ShoppingBag,
  bills: Zap,
  grocery: ShoppingCart,
  rent: House,
  entmt: Clapperboard,
  transfer: ArrowLeftRight,
  salary: Banknote,
  health: HeartPulse,
};

/** Lucide icon for a category, from its name (falls back to a tag). */
export function categoryIcon(category) {
  if (!category) return Tag;
  return ICONS[categoryKey(category)] || Tag;
}

/**
 * Category as a coloured dot and its name — how a category reads inside
 * tables, rows and pickers. `null` renders "Uncategorised" with a hollow dot.
 */
export function CategoryBadge({ category, label, size = 'md', className = '', ...rest }) {
  const name = label ?? category?.name;
  if (!category && !label) {
    return (
      <span className={`category-badge category-badge--${size} is-empty ${className}`.trim()} {...rest}>
        <span className="category-badge__dot" aria-hidden />
        <span className="category-badge__name truncate">Uncategorised</span>
      </span>
    );
  }
  return (
    <span className={`category-badge category-badge--${size} ${className}`.trim()} {...rest}>
      <span className="category-badge__dot" style={{ background: categoryColor(category) }} aria-hidden />
      <span className="category-badge__name truncate">{name}</span>
    </span>
  );
}

/**
 * Square category tile: the user's emoji if they set one, else the lucide
 * icon in the category colour. For category lists and pickers, not tables.
 */
export function CategoryIcon({ category, size = 28, className = '' }) {
  const emoji = category?.icon?.trim();
  const color = category ? categoryColor(category) : 'var(--ink-gray-4)';
  const Icon = categoryIcon(category);
  return (
    <span
      className={`category-icon ${className}`.trim()}
      style={{ width: size, height: size, '--category-color': color }}
      role={emoji ? 'img' : undefined}
      aria-label={emoji ? category?.name || 'Category' : undefined}
      aria-hidden={emoji ? undefined : true}
    >
      {emoji ? (
        <span className="category-icon__emoji" style={{ fontSize: Math.round(size * 0.5) }} aria-hidden>
          {emoji}
        </span>
      ) : (
        <Icon size={Math.round(size * 0.55)} strokeWidth={1.5} />
      )}
    </span>
  );
}
