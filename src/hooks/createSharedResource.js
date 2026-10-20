import { useEffect, useState } from 'react';

/**
 * One module-level copy of a fetched value, shared by every component that
 * shows it — the nav badges and the page on screen share a single request
 * instead of each firing their own. Anything that changes the underlying data
 * calls `refresh()` and every mounted view updates.
 *
 * Returns `{ useResource, refresh }`; `useResource()` gives
 * `{ data, error, loading, refresh }` and refetches when its copy is older
 * than `staleAfterMs`.
 */
export function createSharedResource(fetcher, { staleAfterMs = 60_000, errorMessage = 'Could not load.' } = {}) {
  let snapshot = { data: null, error: '', loading: false };
  let loadedAt = 0;
  let inflight = null;
  const listeners = new Set();

  function publish(next) {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener(snapshot));
  }

  function refresh() {
    if (inflight) return inflight;
    publish({ loading: true });
    inflight = fetcher()
      .then((data) => {
        loadedAt = Date.now();
        publish({ data, error: '', loading: false });
      })
      .catch((e) => {
        publish({ error: e.message || errorMessage, loading: false });
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  function useResource() {
    const [state, setState] = useState(snapshot);

    useEffect(() => {
      listeners.add(setState);
      if (Date.now() - loadedAt > staleAfterMs) refresh();
      else setState(snapshot);
      return () => listeners.delete(setState);
    }, []);

    return { ...state, refresh };
  }

  return { useResource, refresh };
}
