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
 * Category as its tile and name — how a category reads in a table or list
 * row, the same as the Transactions table's category cell. `null` renders
 * "Uncategorised" in gray.
 */
export function CategoryBadge({ category, label, size = 'md', className = '', ...rest }) {
  const empty = !category && !label;
  return (
    <span className={`category-badge category-badge--${size}${empty ? ' is-empty' : ''} ${className}`.trim()} {...rest}>
      <CategoryIcon category={category} size={size === 'sm' ? 18 : 22} />
      <span className="category-badge__name truncate">{empty ? 'Uncategorised' : label ?? category.name}</span>
    </span>
  );
}

/**
 * Category choices for every category picker (Combobox or Select): the
 * category tile, then its name. `none` ({ label, value }) adds a first choice
 * for "no category" or "Uncategorised".
 */
export function categoryOptions(categories = [], none = null) {
  const list = categories.map((c) => ({
    label: c.name,
    value: String(c.id),
    icon: <CategoryIcon category={c} size={20} />,
  }));
  return none ? [{ ...none, icon: <CategoryIcon category={null} size={20} /> }, ...list] : list;
}

/**
 * Square category tile: the user's emoji if they set one, else the lucide
 * icon in the category colour. Used wherever a category is shown.
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
