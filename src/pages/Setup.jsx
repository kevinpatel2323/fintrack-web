import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IcLogo } from '../components/ui/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  browserSupportsWebAuthn,
  registerPasskey,
} from '../services/authApi.js';
import './Login.css';
import './Setup.css';

// First-time enrollment requires the SETUP_TOKEN break-glass. The same page is
// reused (without a token) by an authenticated user adding another device.
export default function Setup() {
  const { status, authDisabled, refresh } = useAuth();
  const navigate = useNavigate();
  const authed = status === 'authenticated';

  const [token, setToken] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supported = browserSupportsWebAuthn();

  useEffect(() => {
    if (authDisabled) navigate('/', { replace: true });
  }, [authDisabled, navigate]);

  async function enroll(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await registerPasskey({
        setupToken: authed ? undefined : token.trim(),
        label: label.trim() || undefined,
      });
      await refresh();
      navigate(authed ? '/security' : '/', { replace: true });
    } catch (e2) {
      setError(e2?.message || 'Enrollment failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <IcLogo size={34} />
          <span>Fintrack</span>
        </div>
        <h1 className="auth-title">
          {authed ? 'Add a passkey' : 'Set up your passkey'}
        </h1>
        <p className="auth-sub">
          {authed
            ? 'Enroll another device so you always have a backup way in.'
            : 'Enter your setup token, then create a passkey on this device.'}
        </p>

        {supported ? (
          <form className="auth-form" onSubmit={enroll}>
            {!authed && (
              <label className="auth-field">
                <span>Setup token</span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                  placeholder="Paste your setup token"
                  required
                />
              </label>
            )}
            <label className="auth-field">
              <span>
                Device name <em>(optional)</em>
              </span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                placeholder="e.g. MacBook, iPhone"
              />
            </label>
            <button
              className="auth-btn"
              type="submit"
              disabled={busy || (!authed && !token.trim())}
            >
              {busy ? 'Creating passkey…' : 'Create passkey'}
            </button>
          </form>
        ) : (
          <p className="auth-error">
            This browser doesn’t support passkeys. Try a recent version of
            Safari, Chrome, or Edge.
          </p>
        )}

        {error && <p className="auth-error">{error}</p>}

        {!authed && (
          <p className="auth-foot">
            Already set up? <Link to="/login">Sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
