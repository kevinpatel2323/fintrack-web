// Single source of truth for talking to the API.
//
// The browser only ever calls the API through the same-origin `/api` prefix
// (Vite proxy in dev, Vercel rewrite in prod) so the session cookie is
// first-party. Default base is `/api`; an explicit VITE_API_BASE_URL can still
// override it (e.g. pointing dev straight at :3000 without the proxy).
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Thin wrapper around fetch. It is deliberately transparent — it does NOT set a
// Content-Type (callers send JSON or FormData themselves) and returns the raw
// Response so existing `.ok` / `.json()` handling keeps working. Its one added
// behaviour: a 401 broadcasts `fintrack:unauthorized` so AuthContext can flip
// the whole app to the login screen from a single place.
export async function apiFetch(input, init) {
  const response = await fetch(input, init);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('fintrack:unauthorized'));
  }
  return response;
}
