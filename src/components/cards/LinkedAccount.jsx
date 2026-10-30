import { useAccountNames } from '../../hooks/useAccounts.js';
import { linkedAccountName } from '../../utils/accounts.js';

/**
 * A debit card's linked account by its holder's name, or as typed while it
 * names no single named account. Text only, so it sits in any line or field.
 */
export default function LinkedAccount({ value }) {
  const accountNames = useAccountNames();
  return linkedAccountName(value, accountNames) || value;
}
