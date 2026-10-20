import { fetchReviewSummary } from '../services/friendsApi.js';
import { createSharedResource } from './createSharedResource.js';

/**
 * Settlements saved before amounts existed that do not match their entries,
 * per friend — badged on People. Anything that reviews them calls
 * `refreshReviewSummary()`.
 */
const summary = createSharedResource(fetchReviewSummary, {
  errorMessage: 'Could not load the settlement review.',
});

export const useReviewSummary = summary.useResource;
export const refreshReviewSummary = summary.refresh;
