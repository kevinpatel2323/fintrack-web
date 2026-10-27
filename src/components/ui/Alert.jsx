import { forwardRef, isValidElement, useState } from 'react';
import { X } from 'lucide-react';
import Button from './Button.jsx';
import './Alert.css';

// Port of frappe-ui Alert.vue — an in-page status message.
//
// Layout is derived, not chosen: a single row (h-10) when there is only a
// title; a banner (title row, then description and buttons) when there is a
// `description` or a `secondaryAction`. The container looks the same for every
// theme; `theme` colours only the status icon and the row action's label.
//
//   theme            'gray' | 'blue' | 'green' | 'amber' | 'red'
//   icon             unset/true → theme's status glyph · false → none ·
//                    lucide component or element → that, in the theme colour
//   prefix           node replacing the icon area (e.g. a Spinner)
//   primaryAction    { label, onClick({ dismiss }), ...Button props }
//   secondaryAction  same; forces the banner layout
//   actions          node, or ({ dismiss }) => node, replacing both buttons
//   dismissible      shows ×; calls onDismiss. The parent hides the alert.
//
// An async onClick shows a spinner on its button and ignores re-clicks until
// it settles; an explicit `loading` on the action wins.

const THEMES = new Set(['gray', 'blue', 'green', 'amber', 'red']);
const cx = (...parts) => parts.filter(Boolean).join(' ');

// Frappe's solid status glyphs (frappe-ui/icons/*SolidIcon.vue), 16×16.
function AlertCircleSolid(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M8 1C11.866 1 15 4.13401 15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1ZM8 6.93652C7.72386 6.93652 7.5 7.16038 7.5 7.43652V11.1436C7.50005 11.4197 7.72389 11.6436 8 11.6436C8.27611 11.6436 8.49995 11.4197 8.5 11.1436V7.43652C8.5 7.16038 8.27614 6.93652 8 6.93652ZM8 4C7.51675 4 7.125 4.39175 7.125 4.875C7.125 5.35825 7.51675 5.75 8 5.75C8.48325 5.75 8.875 5.35825 8.875 4.875C8.875 4.39175 8.48325 4 8 4Z"
      />
    </svg>
  );
}

function SuccessSolid(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M8 1C11.866 1 15 4.13401 15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1ZM11.1055 5.28125C10.8924 5.10562 10.5771 5.13567 10.4014 5.34863L6.95215 9.53223L5.61035 7.79883C5.44143 7.58051 5.12757 7.54022 4.90918 7.70898C4.69088 7.8779 4.65061 8.19177 4.81934 8.41016L6.54395 10.6396C6.63696 10.7598 6.77972 10.8306 6.93164 10.833C7.08364 10.8354 7.22849 10.7687 7.3252 10.6514L11.1729 5.98438C11.3481 5.77144 11.3181 5.45689 11.1055 5.28125Z"
      />
    </svg>
  );
}

function AlertTriangleSolid(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.35174 1.97129C7.64143 1.47669 8.35697 1.47669 8.64666 1.97129L15.0519 12.9078C15.3447 13.4077 14.9847 14.0365 14.4055 14.0367H1.59295C1.0138 14.0364 0.653701 13.4077 0.946469 12.9078L7.35174 1.97129ZM7.9992 10.4117C7.51609 10.4118 7.12433 10.8036 7.1242 11.2867C7.1242 11.7699 7.51601 12.1617 7.9992 12.1617C8.48245 12.1617 8.8742 11.77 8.8742 11.2867C8.87408 10.8036 8.48238 10.4117 7.9992 10.4117ZM8.00018 5.50742C7.72411 5.50742 7.5003 5.73139 7.50018 6.00742V9.25742C7.50018 9.53356 7.72404 9.75742 8.00018 9.75742C8.27615 9.75723 8.50018 9.53344 8.50018 9.25742V6.00742C8.50006 5.73151 8.27608 5.50762 8.00018 5.50742Z"
      />
    </svg>
  );
}

function CloseCircleSolid(props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M8 1C11.866 1 15 4.13401 15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1ZM10.8535 5.14648C10.6583 4.95122 10.3417 4.95122 10.1465 5.14648L8 7.29297L5.85352 5.14648C5.65825 4.95122 5.34175 4.95122 5.14648 5.14648C4.95122 5.34175 4.95122 5.65825 5.14648 5.85352L7.29297 8L5.14648 10.1465C4.95122 10.3417 4.95122 10.6583 5.14648 10.8535C5.34175 11.0488 5.65825 11.0488 5.85352 10.8535L8 8.70703L10.1465 10.8535C10.3417 11.0488 10.6583 11.0488 10.8535 10.8535C11.0488 10.6583 11.0488 10.3417 10.8535 10.1465L8.70703 8L10.8535 5.85352C11.0488 5.65825 11.0488 5.34175 10.8535 5.14648Z"
      />
    </svg>
  );
}

const STATUS_ICONS = {
  gray: AlertCircleSolid,
  blue: AlertCircleSolid,
  green: SuccessSolid,
  amber: AlertTriangleSolid,
  red: CloseCircleSolid,
};

function renderStatusIcon(icon, theme) {
  if (icon === false || icon === null) return null;
  if (icon === true || icon === undefined) {
    const Glyph = STATUS_ICONS[theme];
    return <Glyph className="ui-alert__glyph" />;
  }
  if (isValidElement(icon)) return icon;
  const Icon = icon;
  return <Icon className="ui-alert__glyph" size={16} strokeWidth={1.5} aria-hidden="true" />;
}

function usePendingAction(action, dismiss) {
  const [pending, setPending] = useState(false);
  const onClick = async () => {
    if (!action?.onClick || pending) return;
    setPending(true);
    try {
      await action.onClick({ dismiss });
    } finally {
      setPending(false);
    }
  };
  return { loading: action?.loading ?? pending, onClick };
}

const Alert = forwardRef(function Alert(
  {
    title,
    description,
    theme = 'gray',
    icon,
    prefix,
    primaryAction,
    secondaryAction,
    actions,
    dismissible = false,
    onDismiss,
    className,
    ...rest
  },
  ref,
) {
  const t = THEMES.has(theme) ? theme : 'gray';
  const dismiss = () => onDismiss?.();
  const primary = usePendingAction(primaryAction, dismiss);
  const secondary = usePendingAction(secondaryAction, dismiss);

  const hasDescription = description !== undefined && description !== null && description !== '';
  const layout = hasDescription || secondaryAction ? 'banner' : 'row';
  // Urgent themes interrupt assistive tech; the rest announce politely.
  const role = t === 'red' || t === 'amber' ? 'alert' : 'status';

  const iconNode = prefix ?? renderStatusIcon(icon, t);
  const customActions = typeof actions === 'function' ? actions({ dismiss }) : actions;

  // onClick and loading are wired by usePendingAction; the rest are Button props.
  const buttonProps = (action) => {
    const { onClick: _onClick, loading: _loading, className: actionClass, ...props } = action;
    return { props, actionClass };
  };

  const prefixEl = iconNode ? (
    <div className={cx('ui-alert__prefix', `ui-alert__prefix--${t}`)} data-slot="prefix">
      {iconNode}
    </div>
  ) : null;

  const titleEl =
    title !== undefined && title !== null && title !== '' ? (
      <div className="ui-alert__title" data-slot="title">
        {title}
      </div>
    ) : null;

  if (layout === 'row') {
    let rowAction = null;
    if (primaryAction) {
      const { props, actionClass } = buttonProps(primaryAction);
      // Ghost gray reads ink-gray-8; the design tints the label with the
      // theme's -6 ink unless the caller restyles the button.
      const tinted = !primaryAction.variant && !primaryAction.theme;
      rowAction = (
        <Button
          variant="ghost"
          size="sm"
          {...props}
          data-slot="action"
          loading={primary.loading}
          onClick={primary.onClick}
          className={cx(tinted && `ui-alert__row-action ui-alert__row-action--${t}`, actionClass)}
        />
      );
    }
    const hasActions = customActions || rowAction;
    return (
      <div
        ref={ref}
        role={role}
        data-layout="row"
        data-color={t}
        className={cx('ui-alert', 'ui-alert--row', className)}
        {...rest}
      >
        {prefixEl}
        {titleEl}
        {hasActions && (
          <div className="ui-alert__actions ui-alert__actions--row" data-slot="actions">
            {customActions ?? rowAction}
          </div>
        )}
        {dismissible && (
          <Button
            variant="ghost"
            theme="gray"
            size="sm"
            icon={X}
            label="Dismiss"
            data-slot="dismiss"
            className={cx('ui-alert__dismiss', hasActions ? 'ui-alert__dismiss--after-actions' : null)}
            onClick={dismiss}
          />
        )}
      </div>
    );
  }

  let bannerButtons = null;
  if (primaryAction || secondaryAction) {
    let p = null;
    let s = null;
    if (primaryAction) {
      const { props, actionClass } = buttonProps(primaryAction);
      // The design's elevated neutral button: white surface + shadow, no border.
      const elevated = !primaryAction.variant;
      p = (
        <Button
          variant="outline"
          theme="gray"
          size="md"
          {...props}
          data-slot="action"
          loading={primary.loading}
          onClick={primary.onClick}
          className={cx(elevated && 'ui-alert__banner-primary', actionClass)}
        />
      );
    }
    if (secondaryAction) {
      const { props, actionClass } = buttonProps(secondaryAction);
      const muted = !secondaryAction.variant && !secondaryAction.theme;
      s = (
        <Button
          variant="ghost"
          theme="gray"
          size="md"
          {...props}
          data-slot="action"
          loading={secondary.loading}
          onClick={secondary.onClick}
          className={cx(muted && 'ui-alert__banner-secondary', actionClass)}
        />
      );
    }
    bannerButtons = (
      <>
        {p}
        {s}
      </>
    );
  }
  const bannerActions = customActions ?? bannerButtons;

  return (
    <div
      ref={ref}
      role={role}
      data-layout="banner"
      data-color={t}
      className={cx('ui-alert', 'ui-alert--banner', className)}
      {...rest}
    >
      <div className={cx('ui-alert__head', dismissible && 'ui-alert__head--dismissible')}>
        {prefixEl}
        {titleEl}
      </div>
      {(hasDescription || bannerActions) && (
        <div className="ui-alert__body">
          {hasDescription && (
            <p className="ui-alert__description" data-slot="description">
              {description}
            </p>
          )}
          {bannerActions && (
            <div className="ui-alert__actions" data-slot="actions">
              {bannerActions}
            </div>
          )}
        </div>
      )}
      {dismissible && (
        <Button
          variant="ghost"
          theme="gray"
          size="xs"
          icon={X}
          label="Dismiss"
          data-slot="dismiss"
          className="ui-alert__dismiss ui-alert__dismiss--corner"
          onClick={dismiss}
        />
      )}
    </div>
  );
});

export default Alert;
