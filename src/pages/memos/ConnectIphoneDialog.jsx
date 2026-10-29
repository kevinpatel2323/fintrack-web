import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Smartphone } from 'lucide-react';
import { Button, Dialog, ErrorMessage, Skeleton } from '../../components/ui';
import { createPairCode } from '../../services/memosApi.js';
import { fmtCountdown } from './memoModel.js';

/**
 * Pairs an iPhone: asks the API for a one-time code as the dialog opens and
 * shows it large, with the line to type into the Fintrack Memos shortcut,
 * a copy button and the time the code has left.
 */
export default function ConnectIphoneDialog({ open, onClose }) {
  const [pair, setPair] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  // One code per opening, even when StrictMode runs the effect twice.
  const startedRef = useRef(false);
  const requestRef = useRef(0);

  const generate = useCallback(async () => {
    const request = (requestRef.current += 1);
    setLoading(true);
    setError('');
    setPair(null);
    setCopied(false);
    try {
      const next = await createPairCode();
      if (request !== requestRef.current) return;
      setPair(next);
      setNow(Date.now());
    } catch (e) {
      if (request !== requestRef.current) return;
      setError(e.message || 'Could not get a pairing code');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    generate();
  }, [open, generate]);

  const expiresAt = pair?.expiresAt ? Date.parse(pair.expiresAt) : NaN;
  const hasExpiry = Number.isFinite(expiresAt);
  const remaining = hasExpiry ? expiresAt - now : null;
  const expired = hasExpiry && remaining <= 0;

  useEffect(() => {
    if (!open || !hasExpiry || expired) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open, hasExpiry, expired]);

  // The clipboard API needs a secure context (not a LAN address), so the
  // button only shows where it can work.
  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator.clipboard);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pair.setupText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  let body;
  if (loading) {
    body = (
      <div className="memos-pair" aria-busy="true">
        <Skeleton className="memos-pair__code-skeleton" height={40} width={220} />
        <Skeleton height={14} width={120} />
      </div>
    );
  } else if (error) {
    body = <ErrorMessage message={error} />;
  } else if (pair) {
    body = (
      <div className="memos-pair">
        <p className="memos-pair__code" aria-label={`Pairing code ${pair.code}`}>
          {pair.code}
        </p>
        <p className={`memos-pair__expiry${expired ? ' is-expired' : ''}`} aria-live="polite">
          {!hasExpiry ? null : expired ? 'This code has expired. Get a new one.' : `Valid for ${fmtCountdown(remaining)}`}
        </p>
        <div className="memos-pair__setup">
          <code className="memos-pair__setup-text">{pair.setupText}</code>
          {canCopy && (
            <Button
              variant="ghost"
              icon={copied ? Check : Copy}
              label={copied ? 'Copied' : 'Copy setup line'}
              tooltip={copied ? 'Copied' : 'Copy setup line'}
              onClick={copy}
            />
          )}
        </div>
        <ol className="memos-pair__steps">
          <li>Open the Fintrack Memos shortcut on your iPhone.</li>
          <li>When it asks for text, type the line above.</li>
          <li>Done — this window can be closed.</li>
        </ol>
      </div>
    );
  }

  const retry = expired || Boolean(error);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      icon={Smartphone}
      title="Connect iPhone"
      actions={
        retry
          ? [
              { label: 'Close' },
              { label: 'Get a new code', variant: 'solid', onClick: () => generate() },
            ]
          : [{ label: 'Done', variant: 'solid', disabled: loading }]
      }
    >
      {body}
    </Dialog>
  );
}
