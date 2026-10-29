import { useCallback, useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import {
  Badge, Button, ConfirmDialog, Dialog, EmptyState, ErrorMessage, Skeleton, toast,
} from '../../components/ui';
import { fetchMemoDevices, revokeMemoDevice } from '../../services/memosApi.js';
import { deviceStatusOf, fmtRelative } from './memoModel.js';

const deviceName = (d) => (typeof d?.name === 'string' && d.name.trim()) || 'iPhone';

/** "Last contact 5 min ago · 3 waiting", or when it was revoked. */
function deviceMeta(d) {
  if (d.status === 'revoked') {
    const when = fmtRelative(d.revokedAt);
    return when ? `Revoked ${when}` : 'Revoked';
  }
  const parts = [];
  const contact = fmtRelative(d.lastUsedAt);
  parts.push(contact ? `Last contact ${contact}` : 'No contact yet');
  const waiting = Number(d.outboxCount);
  if (Number.isFinite(waiting) && waiting > 0) parts.push(`${waiting} waiting`);
  return parts.join(' · ');
}

/**
 * The iPhones paired to send bank SMS: status, last contact and how many
 * messages each says are waiting to send. Active (or still pairing) devices
 * can be revoked. A short list, like the passkeys on Security, not a table.
 */
export default function DevicesDialog({ open, onClose, onConnect }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchMemoDevices();
      setDevices(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError(e.message || 'Could not load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function confirmRevoke() {
    const device = revoking;
    await revokeMemoDevice(device.id);
    setRevoking(null);
    toast.success(`${deviceName(device)} revoked`);
    await load();
  }

  let body;
  if (loading && devices.length === 0) {
    body = (
      <div className="memos-devices" aria-busy="true">
        {[0, 1].map((i) => (
          <div className="memos-device" key={i}>
            <Skeleton height={16} width="60%" />
          </div>
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <div className="memos-devices__error">
        <ErrorMessage message={error} />
        <Button label="Try again" onClick={load} />
      </div>
    );
  } else if (devices.length === 0) {
    body = (
      <EmptyState
        size="sm"
        icon={Smartphone}
        title="No iPhone connected"
        description="Connect your iPhone to start capturing bank SMS."
      />
    );
  } else {
    body = (
      <ul className="memos-devices" aria-label="Paired iPhones">
        {devices.map((d) => {
          const status = deviceStatusOf(d.status);
          const canRevoke = d.status === 'active' || d.status === 'pairing';
          const name = deviceName(d);
          return (
            <li className={`memos-device${canRevoke ? '' : ' is-inactive'}`} key={d.id}>
              <span className="memos-device__icon">
                <Smartphone size={16} strokeWidth={1.5} aria-hidden />
              </span>
              <div className="memos-device__text">
                <div className="memos-device__name">
                  <span className="truncate">{name}</span>
                  <Badge size="sm" theme={status.theme} label={status.label} />
                </div>
                <div className="memos-device__meta">{deviceMeta(d)}</div>
              </div>
              {canRevoke && (
                <Button variant="ghost" theme="red" label="Revoke" aria-label={`Revoke ${name}`} onClick={() => setRevoking(d)} />
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        title="Devices"
        description="iPhones that send your bank SMS to Fintrack."
        actions={[
          { label: 'Close' },
          { label: 'Connect iPhone', variant: 'solid', onClick: () => onConnect() },
        ]}
      >
        {body}
      </Dialog>

      <ConfirmDialog
        open={Boolean(revoking)}
        title={revoking ? `Revoke ${deviceName(revoking)}?` : 'Revoke this iPhone?'}
        message="It can no longer send bank SMS to Fintrack. Memos it already sent stay. To use it again, connect it with a new code."
        confirmLabel="Revoke"
        onConfirm={confirmRevoke}
        onCancel={() => setRevoking(null)}
      />
    </>
  );
}
