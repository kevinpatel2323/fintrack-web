import Logo from '../../components/shell/Logo.jsx';
import './AuthLayout.css';

/** Frame for the shell-less sign-in screens: logo, title, a bordered panel. */
export default function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-page__inner">
        <div className="auth-page__brand">
          <Logo size={36} />
        </div>
        <h1 className="auth-page__title">{title}</h1>
        {description && <p className="auth-page__description">{description}</p>}
        <div className="auth-page__panel">{children}</div>
        {footer && <p className="auth-page__footer">{footer}</p>}
      </div>
    </div>
  );
}
