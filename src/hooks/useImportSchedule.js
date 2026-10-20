import { fetchImportSchedule } from '../services/cardsApi.js';
import { createSharedResource } from './createSharedResource.js';

/**
 * Which card statement to import next, shared by everything that shows it —
 * the nav badges, the import page and the cards page. Anything that changes
 * what has been imported calls `refreshImportSchedule()`.
 */
// A statement lands at most once a day; a minute is plenty fresh between
// navigations and stops each page mount from refetching.
const schedule = createSharedResource(fetchImportSchedule, {
  errorMessage: 'Could not load the statement schedule.',
});

export const useImportSchedule = schedule.useResource;
export const refreshImportSchedule = schedule.refresh;
