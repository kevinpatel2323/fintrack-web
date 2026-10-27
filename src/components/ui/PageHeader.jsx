import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs.jsx';
import Button from './Button.jsx';
import { useIsCompact } from '../../styles/breakpoints.js';
import './PageHeader.css';

/**
 * The bar at the top of every page (frappe-ui PageHeader / PageHeaderMobile).
 *
 * Desktop: 48px, breadcrumbs (or the title) on the left, actions on the right.
 * Phone: 52px, centred title with an optional back button and compact actions.
 * It sticks to the top of the shell's scroll area.
 *
 *   <PageHeader
 *     title="Yash Patel"
 *     breadcrumbs={[{ label: 'People', to: '/friends' }, { label: 'Yash Patel' }]}
 *     back="/friends"
 *     actions={<Button variant="solid" iconLeft={Plus} label="Add entry" />}
 *     mobileActions={<Button variant="ghost" icon={Plus} label="Add entry" />}
 *   />
 *
 * `back` is a path, `true` (history back) or a handler; shown on phones only —
 * on desktop the breadcrumbs are the way back.
 */
export default function PageHeader({
  title,
  breadcrumbs,
  back,
  actions,
  mobileActions,
  children,
  className = '',
}) {
  const isMobile = useIsCompact();
  const navigate = useNavigate();

  if (isMobile) {
    const onBack =
      typeof back === 'function' ? back : back === true ? () => navigate(-1) : back ? () => navigate(back) : null;
    return (
      <header className={`ui-page-header ui-page-header--mobile ${className}`.trim()}>
        {onBack && (
          <div className="ui-page-header__prefix">
            <Button variant="ghost" size="md" icon={ChevronLeft} label="Back" onClick={onBack} />
          </div>
        )}
        <h1 className="ui-page-header__mobile-title truncate">{title}</h1>
        {mobileActions && <div className="ui-page-header__suffix">{mobileActions}</div>}
      </header>
    );
  }

  return (
    <header className={`ui-page-header ${className}`.trim()}>
      <div className="ui-page-header__lead">
        {children ??
          (breadcrumbs ? (
            <Breadcrumbs items={breadcrumbs} />
          ) : (
            <h1 className="ui-page-header__title truncate">{title}</h1>
          ))}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  );
}

/** Standard page content padding under a PageHeader. `width="narrow"` caps
 *  forms and settings pages at a readable measure. */
export function PageBody({ width = 'full', className = '', children, ...rest }) {
  return (
    <div className={`ui-page-body ui-page-body--${width} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
