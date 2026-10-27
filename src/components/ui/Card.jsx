import { forwardRef, useId } from 'react';
import './Card.css';

// The panel every dashboard widget and detail-page section sits in. Modelled
// on frappe-ui's ChartCard (the Insights widget surface): 1px outline-gray-1,
// px-4 py-3, no shadow; on the base surface with 10px corners per DESIGN.md.
//
//   title, description   compact header (text-base-medium ink-gray-9 / text-sm ink-gray-5)
//   actions              node right of the title, centred on the title line
//   footer               node in a full-bleed strip under a 1px rule
//   padding              'none' | 'sm' | 'md' (default) — 'none' lets lists and
//                        tables run edge to edge (the header keeps its inset)
//   as                   root element or component (default 'div')
//   titleAs              heading element for the title (default 'h2')

const cx = (...parts) => parts.filter(Boolean).join(' ');
const PADDINGS = new Set(['none', 'sm', 'md']);
const LANDMARKS = new Set(['section', 'article', 'aside']);

const Card = forwardRef(function Card(
  {
    title,
    description,
    actions,
    footer,
    padding = 'md',
    as: As = 'div',
    titleAs: TitleAs = 'h2',
    className,
    children,
    ...rest
  },
  ref,
) {
  const titleId = useId();
  const p = PADDINGS.has(padding) ? padding : 'md';
  const hasTitle = title !== undefined && title !== null && title !== false && title !== '';
  const hasHeader = hasTitle || description || actions;
  const labelled =
    hasTitle && typeof As === 'string' && LANDMARKS.has(As) && !rest['aria-label'] && !rest['aria-labelledby'];

  return (
    <As
      ref={ref}
      className={cx('ui-card', `ui-card--pad-${p}`, className)}
      aria-labelledby={labelled ? titleId : undefined}
      {...rest}
    >
      {hasHeader && (
        <div className="ui-card__header">
          {(hasTitle || description) && (
            <div className="ui-card__heading">
              {hasTitle && (
                <TitleAs id={titleId} className="ui-card__title">
                  {title}
                </TitleAs>
              )}
              {description && <p className="ui-card__description">{description}</p>}
            </div>
          )}
          {actions && <div className="ui-card__actions">{actions}</div>}
        </div>
      )}
      {children !== undefined && children !== null && children !== false && (
        <div className="ui-card__body">{children}</div>
      )}
      {footer && <div className="ui-card__footer">{footer}</div>}
    </As>
  );
});

export default Card;
