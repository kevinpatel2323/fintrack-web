import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { cx } from './internal/dialogUtils.js';
import { normalizeOptions, renderIcon } from './internal/menuOptions.jsx';
import './ActionSheet.css';

/**
 * A menu as a bottom sheet — the phone form of Dropdown (frappe-ui
 * FilesMobile opens a row's actions this way). Dropdown switches to it on its
 * own below 768px; use it directly for a phone-only menu.
 *
 *   <ActionSheet open={open} onClose={close} title="Sort by" options={[
 *     { label: 'Date', selected: true, onClick: … },
 *     { group: 'Danger', items: [{ label: 'Delete', icon: Trash2, theme: 'red', onClick: … }] },
 *   ]} />
 *
 * Options are Dropdown's: items `{ label, icon, onClick, to, theme: 'red',
 * disabled, description, selected, condition }`, optionally in groups. Picking
 * an item runs it and closes the sheet; Cancel closes it.
 */
export default function ActionSheet({ open, onClose, title, description, options = [], cancelLabel = 'Cancel', className }) {
  const groups = normalizeOptions(options);

  function pick(item, e) {
    if (item.disabled) {
      e.preventDefault();
      return;
    }
    item.onClick?.(e);
    onClose?.();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      title={title}
      description={description}
      label={title ? undefined : 'Actions'}
      className={cx('ui-action-sheet', className)}
    >
      {groups.map((group) => (
        <div key={group.key} role="group" aria-label={group.label} className="ui-action-sheet__group">
          {group.label && <div className="ui-action-sheet__label">{group.label}</div>}
          {group.items.map((item, i) => {
            const props = {
              className: cx('ui-action-sheet__item', item.className),
              'data-tone': item.theme === 'red' ? 'red' : undefined,
              'data-disabled': item.disabled ? '' : undefined,
              'aria-disabled': item.disabled || undefined,
              'aria-current': item.selected ? 'true' : undefined,
              onClick: (e) => pick(item, e),
            };
            const content = (
              <span className="ui-action-sheet__inner">
                {item.icon && <span className="ui-action-sheet__icon">{renderIcon(item.icon, undefined, 20)}</span>}
                <span className="ui-action-sheet__text">
                  <span className="ui-action-sheet__item-label">{item.label}</span>
                  {item.description && <span className="ui-action-sheet__description">{item.description}</span>}
                </span>
                {item.selected && <Check className="ui-action-sheet__check" size={20} strokeWidth={1.75} aria-hidden="true" />}
              </span>
            );
            const key = item.key ?? item.label ?? i;
            if (item.to && !item.disabled) {
              return (
                <Link key={key} {...props} to={item.to} replace={item.replace} state={item.state}>
                  {content}
                </Link>
              );
            }
            return (
              <button key={key} type="button" {...props} disabled={item.disabled}>
                {content}
              </button>
            );
          })}
        </div>
      ))}
      <button type="button" className="ui-action-sheet__cancel" onClick={onClose}>
        {cancelLabel}
      </button>
    </Sheet>
  );
}
