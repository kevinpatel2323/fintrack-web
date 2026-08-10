import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getSession, logout as apiLogout } from '../services/authApi.js';
import {
  fromSession,
  initialAuthState,
  msUntilExpiry,
  unauthenticated,
} from '../utils/authSession.ts';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialAuthState);

  // Re-check the session with the server (used on mount and after a ceremony).
  const refresh = useCallback(async () => {
    try {
      setState(fromSession(await getSession()));
    } catch {
      setState(unauthenticated());
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setState(unauthenticated());
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Single global 401 → unauthenticated path. apiFetch dispatches this whenever
  // any request comes back 401, so individual call sites never handle it.
  useEffect(() => {
    const onUnauthorized = () => setState(unauthenticated());
    window.addEventListener('fintrack:unauthorized', onUnauthorized);
    return () =>
      window.removeEventListener('fintrack:unauthorized', onUnauthorized);
  }, []);

  // Absolute sessions: when expiry passes, flip to unauthenticated locally so
  // the app redirects to /login without waiting for the next failed request.
  useEffect(() => {
    if (state.status !== 'authenticated' || state.authDisabled) return undefined;
    const ms = msUntilExpiry(state.expiresAt);
    if (ms === null) return undefined;
    const timer = setTimeout(() => setState(unauthenticated()), ms);
    return () => clearTimeout(timer);
  }, [state.status, state.expiresAt]);

  const value = {
    status: state.status,
    expiresAt: state.expiresAt,
    authDisabled: state.authDisabled ?? false,
    refresh,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
