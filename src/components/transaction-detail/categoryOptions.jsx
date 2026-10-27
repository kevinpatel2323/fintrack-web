import { CategoryIcon } from '../common/Category.jsx';

/** Category options for a Combobox: the category tile, then its name. */
export function categoryOptions(categories = []) {
  return categories.map((c) => ({
    label: c.name,
    value: String(c.id),
    icon: <CategoryIcon category={c} size={18} />,
  }));
}
