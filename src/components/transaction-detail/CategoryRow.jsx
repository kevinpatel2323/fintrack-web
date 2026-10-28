import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Combobox, Spinner } from '../ui';
import { CategoryIcon, categoryOptions } from '../common/Category.jsx';
import './CategoryRow.css';

const NO_CATEGORY = '__none__';

/**
 * Category as a phone row: "Category" on the left, the tile and name on the
 * right with a chevron (a spinner while a save is in flight). Tapping it
 * opens the shared category picker, which the kit Combobox shows as a bottom
 * sheet on phones (search on top, a check on the current one). It is a list
 * item, so it sits first in an inset MobileList of fields.
 *
 * `onChange(id)` gets the picked category id, or `''` for none, and only
 * when it differs from `value`.
 */
export function CategoryRow({ categories = [], value, onChange, saving = false }) {
  const options = useMemo(
    () => categoryOptions(categories, { label: 'No category', value: NO_CATEGORY }),
    [categories],
  );
  const current = value != null && value !== '' ? String(value) : '';
  const category = current ? categories.find((c) => String(c.id) === current) || null : null;
  const name = category?.name || 'No category';

  return (
    <div role="listitem" className="txd-m-catrow">
      <Combobox
        className="txd-m-catrow__combo"
        triggerClassName="txd-m-catrow__btn"
        options={options}
        value={current || NO_CATEGORY}
        onChange={(next) => {
          const id = next == null || next === NO_CATEGORY ? '' : String(next);
          if (id !== current) onChange?.(id);
        }}
        sheetTitle="Category"
        searchPlaceholder="Search categories"
        aria-label={`Category: ${name}. Change category`}
        disabled={saving}
        renderTrigger={() => (
          <>
            <span className="txd-m-catrow__label">Category</span>
            <span className={`txd-m-catrow__value${category ? '' : ' is-empty'}`}>
              <CategoryIcon category={category} size={22} />
              <span className="txd-m-catrow__name">{name}</span>
              {saving
                ? <Spinner size="sm" aria-label="Saving category" />
                : <ChevronRight className="txd-m-catrow__chevron" size={16} strokeWidth={1.5} aria-hidden="true" />}
            </span>
          </>
        )}
      />
    </div>
  );
}
