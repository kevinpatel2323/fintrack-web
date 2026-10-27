import { forwardRef, isValidElement } from 'react';
import './EmptyState.css';

// Frappe CRM-style empty state (not a frappe-ui component): a centred column
// with a muted icon, a title, a line of description and an optional action.
//   icon         lucide component (or an element)
//   title, description, action (node — usually a Button)
//   size         'md' (page / panel) | 'sm' (inside a card or list)

const cx = (...parts) => parts.filter(Boolean).join(' ');
const ICON_PX = { md: 32, sm: 24 };

const EmptyState = forwardRef(function EmptyState(
  { icon, title, description, action, size = 'md', className, ...rest },
  ref,
) {
  const s = size === 'sm' ? 'sm' : 'md';
  let iconNode = null;
  if (icon) {
    if (isValidElement(icon)) iconNode = icon;
    else {
      const Icon = icon;
      iconNode = <Icon size={ICON_PX[s]} strokeWidth={1.5} />;
    }
  }

  return (
    <div ref={ref} className={cx('ui-empty-state', `ui-empty-state--${s}`, className)} {...rest}>
      {iconNode && (
        <div className="ui-empty-state__icon" aria-hidden="true">
          {iconNode}
        </div>
      )}
      {title && <p className="ui-empty-state__title">{title}</p>}
      {description && <p className="ui-empty-state__description">{description}</p>}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  );
});

export default EmptyState;
