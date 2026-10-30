import { useCallback, useEffect, useState } from 'react';
import { Ban, Smartphone } from 'lucide-react';
import {
  Badge, Button, ConfirmDialog, Dialog, EmptyState, ErrorMessage, MobileList, MobileListItem, Skeleton, toast,
} from '../../components/ui';
import { fetchMemoDevices, revokeMemoDevice } from '../../services/memosApi.js';
import { useIsCompact } from '../../styles/breakpoints.js';
import { deviceStatusOf, fmtRelative } from './memoModel.js';

const deviceName = (d) => (typeof d?.name === 'string' && d.name.trim()) || 'iPhone';
const canRevoke = (d) => d.status === 'active' || d.status === 'pairing';

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

function DeviceIcon({ className }) {
  return (
    <span className={className}>
      <Smartphone size={16} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

/**
 * The iPhones paired to send bank SMS: status, last contact and how many
 * messages each says are waiting to send. Active (or still pairing) devices
 * can be revoked, after a red confirmation. A short list laid out like the
 * passkeys on Security — a bordered list of rows on desktop, an inset group
 * with a `…` per row on phones — not a table.
 */
export default function DevicesDialog({ open, onClose, onConnect }) {
  const isMobile = useIsCompact();
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
    try {
      await revokeMemoDevice(device.id);
      setRevoking(null);
      toast.success(`${deviceName(device)} revoked`);
      await load();
    } catch (e) {
      setRevoking(null);
      toast.error({ title: `Could not revoke ${deviceName(device)}`, description: e.message });
    }
  }

  let body;
  if (loading && devices.length === 0) {
    body = isMobile ? (
      <div className="memos-devices-m-skeleton" aria-busy="true">
        {[0, 1].map((i) => (
          <div className="memos-devices-m-skeleton__row" key={i}>
            <Skeleton width={32} height={32} />
            <span className="memos-devices-m-skeleton__text">
              <Skeleton height={14} width="50%" />
              <Skeleton height={11} width="70%" />
            </span>
          </div>
        ))}
      </div>
    ) : (
      <div className="memos-devices" aria-busy="true">
        {[0, 1].map((i) => (
          <div className="memos-device" key={i}>
            <Skeleton className="memos-device__skeleton" />
          </div>
        ))}
      </div>
    );
  } else if (devices.length === 0) {
    // A failed load says so under the list instead.
    body = error ? null : (
      <EmptyState
        size="sm"
        icon={Smartphone}
        title="No iPhone connected"
        description="Connect your iPhone to start capturing bank SMS."
      />
    );
  } else if (isMobile) {
    body = (
      <MobileList variant="inset" aria-label="Paired iPhones">
        {devices.map((d) => {
          const status = deviceStatusOf(d.status);
          const name = deviceName(d);
          return (
            <MobileListItem
              key={d.id}
              leading={<DeviceIcon className="memos-devices-m-icon" />}
              title={name}
              subtitle={deviceMeta(d)}
              value={<Badge theme={status.theme} label={status.label} />}
              actionsLabel={`Actions for ${name}`}
              actions={canRevoke(d) ? [
                { label: 'Revoke', icon: Ban, theme: 'red', onClick: () => setRevoking(d) },
              ] : undefined}
            />
          );
        })}
      </MobileList>
    );
  } else {
    body = (
      <div className="memos-devices" role="list" aria-label="Paired iPhones">
        {devices.map((d) => {
          const status = deviceStatusOf(d.status);
          const name = deviceName(d);
          return (
            <div className={`memos-device${canRevoke(d) ? '' : ' is-inactive'}`} role="listitem" key={d.id}>
              <DeviceIcon className="memos-device__icon" />
              <div className="memos-device__text">
                <div className="memos-device__name">
                  <span className="truncate">{name}</span>
                  <Badge theme={status.theme} label={status.label} />
                </div>
                <div className="memos-device__meta">{deviceMeta(d)}</div>
              </div>
              {canRevoke(d) && (
                <Button
                  variant="ghost"
                  theme="red"
                  icon={Ban}
                  label={`Revoke ${name}`}
                  tooltip="Revoke"
                  onClick={() => setRevoking(d)}
                />
              )}
            </div>
          );
        })}
      </div>
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
        {error && (
          <div className="memos-devices__error">
            <ErrorMessage message={error} />
            <Button size={isMobile ? 'md' : undefined} label="Try again" onClick={load} />
          </div>
        )}
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
