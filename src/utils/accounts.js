// Account names. A bank account is shown by its holder's name ("Kevin Patel")
// wherever the app would otherwise print its number; until it is named, the
// number (or a short form of it) shows as before. Every account display goes
// through these helpers, with the lookup from `useAccountNames()`.

/** The last four digits of a bank account number; null for "Wallet". */
export function accountLast4(accountNumber) {
  const value = String(accountNumber ?? '').trim();
  return value.length > 4 && /\d{4}$/.test(value) ? value.slice(-4) : null;
}

/**
 * The lookup the helpers below take: every account (`list`), and account
 * number → the name to show for it, for the named accounts. A holder
 * with more than one account gets the last four digits after the name
 * ("Kevin Patel ••6714"), so two accounts never read the same. `byLast4`
 * finds the one account that ends in four digits, for text that carries only
 * those (a bank SMS, a card's typed linked account); digits shared by two
 * accounts find neither.
 */
export function accountNameIndex(accounts) {
  const list = (Array.isArray(accounts) ? accounts : []).filter((a) => a?.accountNumber);
  const named = list.filter((a) => String(a.holderName ?? '').trim());
  const holderKey = (a) => String(a.holderName).trim().toLowerCase();
  const perHolder = new Map();
  for (const a of named) perHolder.set(holderKey(a), (perHolder.get(holderKey(a)) || 0) + 1);

  const byNumber = new Map();
  for (const a of named) {
    const name = String(a.holderName).trim();
    const last4 = accountLast4(a.accountNumber);
    byNumber.set(a.accountNumber, perHolder.get(holderKey(a)) > 1 && last4 ? `${name} ••${last4}` : name);
  }

  const byLast4 = new Map();
  for (const a of list) {
    const last4 = accountLast4(a.accountNumber);
    if (last4) byLast4.set(last4, byLast4.has(last4) ? null : a.accountNumber);
  }
  return { list, byNumber, byLast4 };
}

const NO_NAMES = accountNameIndex([]);

/** The holder name for an account number, or null while it isn't named. */
export function accountName(accountNumber, names = NO_NAMES) {
  if (!accountNumber) return null;
  return names.byNumber.get(String(accountNumber).trim()) ?? null;
}

/**
 * The holder name for an account known only by its last four digits, or null
 * unless exactly one account ends in them and it is named.
 */
export function accountNameForLast4(last4, names = NO_NAMES) {
  const number = last4 ? names.byLast4.get(String(last4)) : null;
  return number ? accountName(number, names) : null;
}

/**
 * "Kevin Patel"; "Acct •• 6714" for an account not named yet; anything else
 * (e.g. "Wallet") as is.
 */
export function accountLabel(accountNumber, names = NO_NAMES) {
  if (!accountNumber) return '—';
  const name = accountName(accountNumber, names);
  if (name) return name;
  return /^\d{5,}$/.test(accountNumber) ? `Acct •• ${accountNumber.slice(-4)}` : accountNumber;
}

/**
 * Short account hint for a phone row: "Kevin Patel"; "••6001" for an account
 * not named yet; the name itself for a named account ("Wallet").
 */
export function accountHint(accountNumber, names = NO_NAMES) {
  const value = String(accountNumber ?? '').trim();
  if (!value) return '';
  const name = accountName(value, names);
  if (name) return name;
  const last4 = accountLast4(value);
  return last4 ? `••${last4}` : value;
}

/**
 * The account a card's linked account refers to, as its number. The field is
 * typed text: the account number, or a label ending in the last four digits
 * ("HDFC Savings ••4221"). Null when it finds no single account.
 */
export function linkedAccountMatch(text, names = NO_NAMES) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  if (names.list.some((a) => a.accountNumber === value)) return value;
  const last4 = /^\d{4}$/.test(value) ? value : accountLast4(value);
  return (last4 && names.byLast4.get(last4)) || null;
}

/** A card's linked account by its holder's name; null unless it finds a named account. */
export function linkedAccountName(text, names = NO_NAMES) {
  return accountName(linkedAccountMatch(text, names), names);
}

/**
 * Every account as a picker option (`{ label, value }`, value = the account
 * number): named ones first by name, then the rest.
 */
export function accountChoices(names = NO_NAMES) {
  return names.list
    .map((a) => ({
      label: accountLabel(a.accountNumber, names),
      value: a.accountNumber,
      named: Boolean(accountName(a.accountNumber, names)),
    }))
    .sort((x, y) => Number(y.named) - Number(x.named) || x.label.localeCompare(y.label))
    .map(({ named, ...option }) => option);
}
