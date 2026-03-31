import './BaseWidget.css';

export default function BaseWidget({ title, loading, error, children, actions, className = '' }) {
  return (
    <div className={`base-widget ${className}`}>
      <div className="base-widget-header">
        <h3 className="base-widget-title">{title}</h3>
        {actions && <div className="base-widget-actions">{actions}</div>}
      </div>
      <div className="base-widget-content">
        {loading ? (
          <div className="base-widget-loading">
            <div className="spinner" />
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="base-widget-error">
            <p className="error-message">{error}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
