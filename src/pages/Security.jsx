import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Plus, Trash2 } from 'lucide-react';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorMessage, PageBody, PageHeader, Skeleton, Tooltip, toast,
} from '../components/ui';
import { useAuth } from '../context/AuthContext.jsx';
import { deleteCredential, listCredentials } from '../services/authApi.js';
import { useIsCompact } from '../styles/breakpoints.js';
import SecurityPhone from './security/SecurityPhone.jsx';
import './Security.css';

function fmtDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

export default function Security() {
  const navigate = useNavigate();
  const { logout, authDisabled } = useAuth();
  const isMobile = useIsCompact();

  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCredentials(await listCredentials());
    } catch (err) {
      setError(err?.message || 'Could not load passkeys');
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

  async function confirmRemove() {
    const cred = removing;
    try {
      await deleteCredential(cred.id);
      setRemoving(null);
      toast.success('Passkey removed');
      await load();
    } catch (err) {
      setRemoving(null);
      toast.error(err?.message || 'Could not remove passkey');
    }
  }

  async function signOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  const onlyOne = credentials.length <= 1;

  const confirm = (
    <ConfirmDialog
      open={Boolean(removing)}
      title="Remove this passkey?"
      message="This device will no longer be able to sign in, and its active session ends immediately."
      confirmLabel="Remove"
      onConfirm={confirmRemove}
      onCancel={() => setRemoving(null)}
    />
  );

  // Phones: a pushed page under You, as its own layout (security/SecurityPhone.jsx).
  if (isMobile) {
    return (
      <>
        <PageHeader title="Security" />
        <SecurityPhone
          credentials={credentials}
          loading={loading}
          error={error}
          fmtDate={fmtDate}
          onAdd={() => navigate('/setup')}
          onRemove={setRemoving}
          onSignOut={signOut}
        />
        {confirm}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Security" />
      <PageBody width="narrow" className="security-page">
        <section className="security-section">
          <div className="security-section__head">
            <div>
              <h2 className="security-section__title">Passkeys</h2>
              <p className="security-section__description">
                Devices that can sign in to Fintrack. Keep at least two so you always have a way back in.
              </p>
            </div>
            <Button iconLeft={Plus} label="Add passkey" onClick={() => navigate('/setup')} />
          </div>

          <div className="security-list">
            {loading ? (
              [0, 1].map((i) => (
                <div className="security-row" key={i}>
                  <Skeleton className="security-row__skeleton" />
                </div>
              ))
            ) : credentials.length === 0 ? (
              <EmptyState
                size="sm"
                icon={KeyRound}
                title="No passkeys yet"
                description="Add one to sign in with Touch ID, Face ID or a security key."
              />
            ) : (
              credentials.map((c) => {
                const created = fmtDate(c.createdAt);
                const used = fmtDate(c.lastUsedAt);
                return (
                  <div className="security-row" key={c.id}>
                    <span className="security-row__icon">
                      <KeyRound size={16} strokeWidth={1.5} aria-hidden />
                    </span>
                    <div className="security-row__text">
                      <div className="security-row__name">
                        <span className="truncate">{c.label || 'Unnamed passkey'}</span>
                        {c.backedUp && <Badge label="Synced" />}
                      </div>
                      <div className="security-row__meta">
                        {created ? `Added ${created}` : 'Added recently'}
                        {used ? ` · Last used ${used}` : ' · Not used yet'}
                      </div>
                    </div>
                    <Tooltip text={onlyOne ? 'Add another passkey before removing this one' : 'Remove passkey'}>
                      <span>
                        <Button
                          variant="ghost"
                          theme="red"
                          icon={Trash2}
                          label="Remove passkey"
                          disabled={onlyOne}
                          onClick={() => setRemoving(c)}
                        />
                      </span>
                    </Tooltip>
                  </div>
                );
              })
            )}
          </div>
          {error && <ErrorMessage message={error} />}
        </section>

        <section className="security-section">
          <div className="security-section__head">
            <div>
              <h2 className="security-section__title">Session</h2>
              <p className="security-section__description">
                Sessions last one hour, then you sign in again with your passkey.
              </p>
            </div>
            <Button variant="outline" theme="red" iconLeft={LogOut} label="Log out" onClick={signOut} />
          </div>
        </section>
      </PageBody>

      {confirm}
    </>
  );
}
