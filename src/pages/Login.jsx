import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IcLogo } from '../components/ui/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { browserSupportsWebAuthn, loginWithPasskey } from '../services/authApi.js';
import './Login.css';

export default function Login() {
  const { status, authDisabled, refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supported = browserSupportsWebAuthn();

  // Auth disabled locally, or already signed in → go home.
  useEffect(() => {
    if (authDisabled || status === 'authenticated') navigate('/', { replace: true });
  }, [authDisabled, status, navigate]);

  async function signIn() {
    setBusy(true);
    setError('');
    try {
      await loginWithPasskey();
      await refresh();
      navigate('/', { replace: true });
    } catch (e) {
      setError(e?.message || 'Sign-in failed. Please try again.');
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
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">
          Sign in with your passkey — Touch ID, Face ID, or a security key.
        </p>

        {supported ? (
          <button
            className="auth-btn"
            type="button"
            onClick={signIn}
            disabled={busy}
          >
            {busy ? 'Waiting for passkey…' : 'Sign in with passkey'}
          </button>
        ) : (
          <p className="auth-error">
            This browser doesn’t support passkeys. Try a recent version of
            Safari, Chrome, or Edge.
          </p>
        )}

        {error && <p className="auth-error">{error}</p>}

        <p className="auth-foot">
          First time here? <Link to="/setup">Set up a passkey</Link>
        </p>
      </div>
    </div>
  );
}
