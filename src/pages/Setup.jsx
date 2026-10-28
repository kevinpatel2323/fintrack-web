import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, ErrorMessage, FormControl } from '../components/ui';
import AuthLayout from './auth/AuthLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { browserSupportsWebAuthn, registerPasskey } from '../services/authApi.js';
import { useIsCompact } from '../styles/breakpoints.js';

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
  // Phones: 44px fields and button, the button pinned near the bottom (AuthLayout.css).
  const isMobile = useIsCompact();
  const fieldSize = isMobile ? 'lg' : undefined;

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
    <AuthLayout
      title={authed ? 'Add a passkey' : 'Set up your passkey'}
      description={
        authed
          ? 'Add another device so you always have a backup way in.'
          : 'Enter your setup token, then create a passkey on this device.'
      }
      footer={
        authed ? (
          <Link to="/security">Back to security</Link>
        ) : (
          <>
            Already set up? <Link to="/login">Sign in</Link>
          </>
        )
      }
    >
      {supported ? (
        <form className="auth-page__form" onSubmit={enroll}>
          {!authed && (
            <FormControl
              size={fieldSize}
              label="Setup token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              placeholder="Paste your setup token"
              required
            />
          )}
          <FormControl
            size={fieldSize}
            label="Device name"
            description="Optional. Helps you tell your passkeys apart."
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            placeholder="MacBook, iPhone…"
          />
          <Button
            type="submit"
            variant="solid"
            size={isMobile ? 'lg' : 'md'}
            className="auth-page__full"
            label={busy ? 'Creating passkey…' : 'Create passkey'}
            loading={busy}
            disabled={!authed && !token.trim()}
          />
        </form>
      ) : (
        <Alert
          theme="amber"
          title="Passkeys aren’t supported in this browser"
          description="Try a recent version of Safari, Chrome or Edge."
        />
      )}
      {error && <ErrorMessage message={error} />}
    </AuthLayout>
  );
}
