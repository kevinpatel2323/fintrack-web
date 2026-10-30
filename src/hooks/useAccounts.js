import { useMemo } from 'react';
import { fetchAccounts } from '../services/accountsApi.js';
import { accountNameIndex } from '../utils/accounts.js';
import { createSharedResource } from './createSharedResource.js';

/**
 * The bank accounts and their holder names, shared by every view that shows
 * an account. Anything that names an account or adds one (an import) calls
 * `refreshAccounts()`, and every account on screen shows the new name.
 */
const accounts = createSharedResource(fetchAccounts, {
  errorMessage: 'Could not load accounts.',
});

export const useAccounts = accounts.useResource;
export const refreshAccounts = accounts.refresh;

/** The lookup the `utils/accounts.js` helpers take, to show accounts by name. */
export function useAccountNames() {
  const { data } = useAccounts();
  return useMemo(() => accountNameIndex(data), [data]);
}
