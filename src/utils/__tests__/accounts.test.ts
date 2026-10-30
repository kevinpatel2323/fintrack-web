import { describe, expect, it } from 'vitest';
import {
  accountChoices,
  accountHint,
  accountLabel,
  accountLast4,
  accountName,
  accountNameForLast4,
  accountNameIndex,
  linkedAccountMatch,
  linkedAccountName,
} from '../accounts.js';

const ACCOUNTS = [
  { id: '1', accountNumber: '50100123456714', holderName: 'Kevin Patel' },
  { id: '2', accountNumber: '50100999990031', holderName: '  Mom  ' },
  { id: '3', accountNumber: '50100555556001', holderName: null },
  { id: '4', accountNumber: 'Wallet', holderName: null },
];
const names = accountNameIndex(ACCOUNTS);

describe('accountLast4', () => {
  it('reads the last four digits of an account number only', () => {
    expect(accountLast4('50100123456714')).toBe('6714');
    expect(accountLast4('Wallet')).toBeNull();
    expect(accountLast4('6714')).toBeNull();
    expect(accountLast4(null)).toBeNull();
  });
});

describe('accountName', () => {
  it('gives the holder name of a named account, trimmed', () => {
    expect(accountName('50100123456714', names)).toBe('Kevin Patel');
    expect(accountName('50100999990031', names)).toBe('Mom');
  });

  it('is null for an account not named yet, an unknown one, or none', () => {
    expect(accountName('50100555556001', names)).toBeNull();
    expect(accountName('Wallet', names)).toBeNull();
    expect(accountName('123', names)).toBeNull();
    expect(accountName(null, names)).toBeNull();
    expect(accountName('50100123456714')).toBeNull();
  });

  it('adds the last four digits when one holder has more than one account', () => {
    const shared = accountNameIndex([
      { accountNumber: '50100123456714', holderName: 'Kevin Patel' },
      { accountNumber: '50100777770042', holderName: 'kevin patel' },
      { accountNumber: '50100999990031', holderName: 'Mom' },
    ]);
    expect(accountName('50100123456714', shared)).toBe('Kevin Patel ••6714');
    expect(accountName('50100777770042', shared)).toBe('kevin patel ••0042');
    expect(accountName('50100999990031', shared)).toBe('Mom');
  });
});

describe('accountNameForLast4', () => {
  it('finds the one named account ending in the digits', () => {
    expect(accountNameForLast4('6714', names)).toBe('Kevin Patel');
  });

  it('finds nothing for digits two accounts share, an unnamed account or no digits', () => {
    const twins = accountNameIndex([
      { accountNumber: '50100123456714', holderName: 'Kevin Patel' },
      { accountNumber: '60200000006714', holderName: 'Mom' },
    ]);
    expect(accountNameForLast4('6714', twins)).toBeNull();
    expect(accountNameForLast4('6001', names)).toBeNull();
    expect(accountNameForLast4('9999', names)).toBeNull();
    expect(accountNameForLast4(null, names)).toBeNull();
  });
});

describe('accountLabel', () => {
  it('shows the holder name, else the masked number, else the value as is', () => {
    expect(accountLabel('50100123456714', names)).toBe('Kevin Patel');
    expect(accountLabel('50100555556001', names)).toBe('Acct •• 6001');
    expect(accountLabel('Wallet', names)).toBe('Wallet');
    expect(accountLabel('', names)).toBe('—');
    expect(accountLabel('50100123456714')).toBe('Acct •• 6714');
  });
});

describe('accountHint', () => {
  it('shows the holder name, else ••last4, else the value as is', () => {
    expect(accountHint('50100123456714', names)).toBe('Kevin Patel');
    expect(accountHint('99990000006001')).toBe('••6001');
    expect(accountHint('Wallet')).toBe('Wallet');
    expect(accountHint(null)).toBe('');
  });

  it('names the Wallet once it has a name', () => {
    const named = accountNameIndex([{ accountNumber: 'Wallet', holderName: 'Cash' }]);
    expect(accountHint('Wallet', named)).toBe('Cash');
  });
});

describe('linkedAccountName', () => {
  it('matches a typed account number exactly', () => {
    expect(linkedAccountName('50100123456714', names)).toBe('Kevin Patel');
  });

  it('matches a typed label or bare digits by the last four', () => {
    expect(linkedAccountName('HDFC Savings ••6714', names)).toBe('Kevin Patel');
    expect(linkedAccountName('0031', names)).toBe('Mom');
  });

  it('is null when the text names no single named account', () => {
    expect(linkedAccountName('HDFC Savings', names)).toBeNull();
    expect(linkedAccountName('Savings ••6001', names)).toBeNull();
    expect(linkedAccountName('', names)).toBeNull();
    expect(linkedAccountName(null, names)).toBeNull();
  });
});

describe('linkedAccountMatch', () => {
  it('finds the account a typed linked account refers to, named or not', () => {
    expect(linkedAccountMatch('50100123456714', names)).toBe('50100123456714');
    expect(linkedAccountMatch('Savings ••6001', names)).toBe('50100555556001');
    expect(linkedAccountMatch('Wallet', names)).toBe('Wallet');
  });

  it('finds nothing for text that names no single account', () => {
    expect(linkedAccountMatch('Old account 1234', names)).toBeNull();
    expect(linkedAccountMatch('HDFC Savings', names)).toBeNull();
    expect(linkedAccountMatch('  ', names)).toBeNull();
  });
});

describe('accountChoices', () => {
  it('lists named accounts first by name, then the rest, valued by number', () => {
    expect(accountChoices(names)).toEqual([
      { label: 'Kevin Patel', value: '50100123456714' },
      { label: 'Mom', value: '50100999990031' },
      { label: 'Acct •• 6001', value: '50100555556001' },
      { label: 'Wallet', value: 'Wallet' },
    ]);
  });

  it('copes with nothing loaded yet', () => {
    expect(accountChoices(accountNameIndex(null))).toEqual([]);
    expect(accountChoices()).toEqual([]);
  });
});
