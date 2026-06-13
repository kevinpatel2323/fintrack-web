// Pure auth state-machine helpers. Kept free of React/DOM so they run under the
// repo's node-env, .test.ts-only vitest setup.

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  expiresAt: string | null;
}

export interface SessionResponse {
  authenticated: boolean;
  expiresAt?: string | null;
}

export const initialAuthState: AuthState = {
  status: 'loading',
  expiresAt: null,
};

// Map a /auth/session response onto an AuthState.
export function fromSession(session: SessionResponse): AuthState {
  return session.authenticated
    ? { status: 'authenticated', expiresAt: session.expiresAt ?? null }
    : { status: 'unauthenticated', expiresAt: null };
}

export function unauthenticated(): AuthState {
  return { status: 'unauthenticated', expiresAt: null };
}

// True once an absolute expiry has passed. Null expiry never expires.
export function isExpired(
  expiresAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now;
}

// Milliseconds until expiry (clamped at 0). Null expiry → null (no timer).
export function msUntilExpiry(
  expiresAt: string | null,
  now: number = Date.now(),
): number | null {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, t - now);
}
