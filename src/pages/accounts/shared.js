// Copy and formatting shared by the Accounts page (pages/Accounts.jsx) and
// its phone layout (AccountsPhone.jsx).
import { formatDate } from '../../utils/dateUtils.js';

export const ACCOUNTS_INTRO =
  'Name each account after the person who holds it. Fintrack shows the name instead of the account number everywhere.';

export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

/** "28 Oct 2026" from a `YYYY-MM-DD` day, read as a local date. */
export const fmtDay = (iso) => (iso ? formatDate(`${iso}T00:00:00`) : '');
