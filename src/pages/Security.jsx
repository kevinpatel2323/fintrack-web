import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import {
  Card,
  GhostBtn,
  PrimaryBtn,
  SectionTitle,
} from '../components/ui/primitives.jsx';
import { IcPlus, IcTrash, IcLogout, IcCommand } from '../components/ui/Icon.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useAuth } from '../context/AuthContext.jsx';
import { deleteCredential, listCredentials } from '../services/authApi.js';
import './Security.css';

function fmtDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

export default function Security() {
  const isMobile = useMediaQuery('(max-width: 720px)');
  const navigate = useNavigate();
  const { logout, authDisabled } = useAuth();

  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false });

  const load = useCallback(async () => {
    setLoading(true);
    setStatus('');
    try {
      setCredentials(await listCredentials());
    } catch (err) {
      setStatus(err?.message || 'Could not load passkeys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authDisabled) {
      navigate('/', { replace: true });
      return;
    }
    load();
  }, [authDisabled, load, navigate]);

  function askDelete(cred) {
    setConfirmState({
      open: true,
      title: 'Remove this passkey?',
      message:
        'This device will no longer be able to sign in, and its active session ends immediately.',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        setConfirmState({ open: false });
        setStatus('');
        try {
          await deleteCredential(cred.id);
          await load();
        } catch (err) {
          setStatus(err?.message || 'Could not remove passkey');
        }
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  async function signOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  const onlyOne = credentials.length <= 1;

  const passkeyList = (
    <Card pad={14}>
      <SectionTitle
        action={
          <GhostBtn onClick={() => navigate('/setup')}>
            <IcPlus size={14} /> Add passkey
          </GhostBtn>
        }
      >
        Your passkeys
      </SectionTitle>
      {loading ? (
        <p className="sec-empty">Loading…</p>
      ) : credentials.length === 0 ? (
        <p className="sec-empty">No passkeys yet.</p>
      ) : (
        <div className="sec-list">
          {credentials.map((c) => {
            const created = fmtDate(c.createdAt);
            const used = fmtDate(c.lastUsedAt);
            return (
              <div className="sec-row" key={c.id}>
                <span className="sec-icon">
                  <IcCommand size={18} />
                </span>
                <div className="sec-meta">
                  <div className="sec-name">
                    {c.label || 'Unnamed passkey'}
                    {c.backedUp && <span className="sec-badge">Synced</span>}
                  </div>
                  <div className="sec-sub">
                    {created ? `Added ${created}` : 'Added recently'}
                    {used ? ` · Last used ${used}` : ' · Not used yet'}
                  </div>
                </div>
                <button
                  type="button"
                  className="ft-mobile__icon-btn"
                  style={{
                    width: 32,
                    height: 32,
                    color: onlyOne ? 'var(--ft-text-faint)' : 'var(--ft-spend)',
                  }}
                  onClick={() => askDelete(c)}
                  disabled={onlyOne}
                  aria-label="Remove passkey"
                  title={
                    onlyOne ? 'Add another passkey before removing this one' : 'Remove'
                  }
                >
                  <IcTrash size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {status && <p className="auth-error">{status}</p>}
    </Card>
  );

  const sessionCard = (
    <Card pad={18}>
      <SectionTitle>Session</SectionTitle>
      <p style={{ color: 'var(--ft-text-dim)', fontSize: 13, margin: '0 0 14px' }}>
        Sessions last one hour, then you’ll sign in again with a tap.
      </p>
      <PrimaryBtn onClick={signOut} tint="var(--ft-spend)">
        <IcLogout size={16} /> Sign out
      </PrimaryBtn>
    </Card>
  );

  return (
    <>
      <ConfirmDialog {...confirmState} />
      {isMobile ? (
        <>
          <header className="ft-mobile__header">
            <h1 className="ft-mobile__title">Security</h1>
            <span style={{ width: 40 }} />
          </header>
          <main className="ft-mobile__content">
            {passkeyList}
            {sessionCard}
          </main>
        </>
      ) : (
        <>
          <header className="ft-page-header">
            <div>
              <p className="ft-page-header__sub">Passkeys & sign-out</p>
              <h1 className="ft-page-header__title">Security</h1>
            </div>
          </header>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            {passkeyList}
            <div>{sessionCard}</div>
          </div>
        </>
      )}
    </>
  );
}
