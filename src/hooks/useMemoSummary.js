import { fetchMemoSummary } from '../services/memosApi.js';
import { createSharedResource } from './createSharedResource.js';

/**
 * Captured bank SMS still without a memo (`withoutMemo`), the total and when
 * the last one arrived — badged on Memos. Anything that writes, clears or
 * deletes a memo calls `refreshMemoSummary()`.
 */
const summary = createSharedResource(fetchMemoSummary, {
  errorMessage: 'Could not load the memo count.',
});

export const useMemoSummary = summary.useResource;
export const refreshMemoSummary = summary.refresh;
