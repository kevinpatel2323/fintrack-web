import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs.jsx';
import Button from './Button.jsx';
import { usePhoneChrome } from './internal/phoneChrome.js';
import { useIsCompact } from '../../styles/breakpoints.js';
import './PageHeader.css';

/**
 * The bar at the top of every page (frappe-ui PageHeader / PageHeaderMobile).
 *
 * Desktop: 48px, breadcrumbs (or the title) on the left, actions on the right.
 * It sticks to the top of the shell's scroll area.
 *
 * Phone: 52px, a centred one-line title between a leading control and up to
 * two icon actions (`mobileActions`). It renders into the phone shell's fixed
 * header slot, so it never scrolls. The leading control is, in order: `back`;
 * the shell's You button on a tab's own page; otherwise Back.
 *
 *   <PageHeader
 *     title="Yash Patel"
 *     breadcrumbs={[{ label: 'People', to: '/friends' }, { label: 'Yash Patel' }]}
 *     back="/friends"
 *     actions={<Button variant="solid" iconLeft={Plus} label="Add entry" />}
 *     mobileActions={<Button variant="ghost" icon={Plus} label="Add entry" />}
 *   />
 *
 * `back` is a path, `true` or a handler; phones only — on desktop the
 * breadcrumbs are the way back. Back returns to the previous screen when the
 * app has one (keeping its scroll and filters), else goes to the path (or the
 * shell's fallback).
 */
function useBack(back, fallback) {
  const navigate = useNavigate();
  if (typeof back === 'function') return back;
  return () => {
    const idx = typeof window !== 'undefined' ? window.history.state?.idx : 0;
    if (idx > 0) navigate(-1);
    else navigate(typeof back === 'string' ? back : fallback || '/', { replace: true });
  };
}

function MobilePageHeader({ title, back, mobileActions, className }) {
  const { headerNode, rootPrefix, fallbackBack } = usePhoneChrome();
  const onBack = useBack(back, fallbackBack);
  const prefix = back || !rootPrefix
    ? <Button variant="ghost" size="md" icon={ChevronLeft} label="Back" onClick={onBack} className="ui-page-header__back" />
    : rootPrefix;

  const header = (
    <header className={`ui-page-header ui-page-header--mobile ${className}`.trim()}>
      <div className="ui-page-header__prefix">{prefix}</div>
      <h1 className="ui-page-header__mobile-title truncate">{title}</h1>
      {mobileActions && <div className="ui-page-header__suffix">{mobileActions}</div>}
    </header>
  );
  return headerNode ? createPortal(header, headerNode) : header;
}

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

  if (isMobile) {
    return <MobilePageHeader title={title} back={back} mobileActions={mobileActions} className={className} />;
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
