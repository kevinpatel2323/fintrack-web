import { API_BASE, apiFetch } from './http.js';
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

export { browserSupportsWebAuthn };

async function post(path, body, headers) {
  return apiFetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function errorFrom(res, fallback) {
  const detail = await res.json().catch(() => ({}));
  const msg = Array.isArray(detail.message)
    ? detail.message.join(', ')
    : detail.message;
  const err = new Error(msg || fallback);
  err.status = res.status;
  return err;
}

// App-boot check. Always resolves (the endpoint returns 200 with a flag).
export async function getSession() {
  const res = await apiFetch(`${API_BASE}/auth/session`);
  if (!res.ok) return { authenticated: false };
  return res.json();
}

export async function logout() {
  await post('/auth/logout');
}

export async function listCredentials() {
  const res = await apiFetch(`${API_BASE}/auth/credentials`);
  if (!res.ok) throw await errorFrom(res, 'Could not load passkeys');
  return res.json();
}

export async function deleteCredential(id) {
  const res = await apiFetch(`${API_BASE}/auth/credentials/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await errorFrom(res, 'Could not remove passkey');
  return res.json();
}

// ── Composite ceremonies (own the full browser WebAuthn dance) ──────────────

// Sign in with an existing passkey. Returns { verified, expiresAt }.
export async function loginWithPasskey() {
  const optRes = await post('/auth/login/options');
  if (!optRes.ok) throw await errorFrom(optRes, 'Could not start sign-in');
  const optionsJSON = await optRes.json();

  const credential = await startAuthentication({ optionsJSON });

  const verifyRes = await post('/auth/login/verify', { credential });
  if (!verifyRes.ok) throw await errorFrom(verifyRes, 'Sign-in failed');
  return verifyRes.json();
}

// Enroll a new passkey. Pass `setupToken` for first-device enrollment (no
// session yet); omit it when an authenticated user adds another device.
export async function registerPasskey({ setupToken, label } = {}) {
  const headers = setupToken ? { 'x-setup-token': setupToken } : undefined;

  const optRes = await post('/auth/register/options', undefined, headers);
  if (!optRes.ok) throw await errorFrom(optRes, 'Could not start enrollment');
  const optionsJSON = await optRes.json();

  const credential = await startRegistration({ optionsJSON });

  const verifyRes = await post(
    '/auth/register/verify',
    { credential, label },
    headers,
  );
  if (!verifyRes.ok) throw await errorFrom(verifyRes, 'Enrollment failed');
  return verifyRes.json();
}
