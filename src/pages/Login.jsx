import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { Alert, Button, ErrorMessage } from '../components/ui';
import AuthLayout from './auth/AuthLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { browserSupportsWebAuthn, loginWithPasskey } from '../services/authApi.js';

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
    <AuthLayout
      title="Sign in to Fintrack"
      description="Use the passkey on this device: Touch ID, Face ID or a security key."
      footer={
        <>
          First time here? <Link to="/setup">Set up a passkey</Link>
        </>
      }
    >
      {supported ? (
        <Button
          variant="solid"
          size="md"
          className="auth-page__full"
          iconLeft={KeyRound}
          label={busy ? 'Waiting for passkey…' : 'Sign in with passkey'}
          loading={busy}
          onClick={signIn}
        />
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
