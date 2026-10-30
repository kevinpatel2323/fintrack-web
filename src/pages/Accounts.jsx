import { useState } from 'react';
import { Landmark, Pencil, Upload } from 'lucide-react';
import { Button, EmptyState, ListView, PageBody, PageHeader, toast } from '../components/ui';
import { refreshAccounts, useAccounts } from '../hooks/useAccounts.js';
import { updateAccountHolder } from '../services/accountsApi.js';
import { useIsCompact } from '../styles/breakpoints.js';
import AccountNameDialog from './accounts/AccountNameDialog.jsx';
import AccountsPhone from './accounts/AccountsPhone.jsx';
import { ACCOUNTS_INTRO, fmtDay, plural } from './accounts/shared.js';
import './Accounts.css';

/**
 * Accounts (/accounts): every bank account a statement was imported for, plus
 * the Wallet for manual entries, each named after the person who holds it.
 * The name is what every other page shows in place of the account number; an
 * account not named yet shows its number. A row opens the name dialog. The
 * list is the shared `useAccounts()` copy, so a new name shows everywhere at
 * once.
 */
export default function Accounts() {
  const isMobile = useIsCompact();
  const { data, error, loading, refresh } = useAccounts();
  const accounts = data ?? [];
  const firstLoad = loading && !data;
  // The account stays set while the dialog animates closed.
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openEdit = (account) => {
    setEditing(account);
    setDialogOpen(true);
  };

  async function saveName(holderName) {
    const saved = await updateAccountHolder(editing.id, holderName);
    setDialogOpen(false);
    toast.success(saved?.holderName ? 'Account named' : 'Name removed');
    await refreshAccounts();
  }

  const dialog = (
    <AccountNameDialog
      open={dialogOpen}
      account={editing}
      onClose={() => setDialogOpen(false)}
      onSubmit={saveName}
    />
  );

  // Phones: a pushed page under You, as its own layout.
  if (isMobile) {
    return (
      <>
        <PageHeader title="Accounts" />
        <AccountsPhone
          accounts={accounts}
          loading={firstLoad}
          error={data ? '' : error}
          onRetry={refresh}
          onEdit={openEdit}
        />
        {dialog}
      </>
    );
  }

  const columns = [
    {
      key: 'holder',
      label: 'Account holder',
      width: 'minmax(180px, 2fr)',
      flex: true,
      sortable: true,
      sortValue: (a) => (a.holderName || '').toLowerCase(),
      render: (a) =>
        a.holderName ? (
          <span className="accts-holder truncate">{a.holderName}</span>
        ) : (
          <span className="accts-unnamed">Not named</span>
        ),
    },
    {
      key: 'number',
      label: 'Account number',
      width: 200,
      minWidth: 140,
      sortable: true,
      sortValue: (a) => a.accountNumber,
      render: (a) => <span className="accts-number truncate">{a.accountNumber}</span>,
    },
    {
      key: 'count',
      label: 'Transactions',
      width: 112,
      align: 'right',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (a) => a.transactionCount,
      render: (a) => <span className="tabular-nums">{a.transactionCount.toLocaleString('en-IN')}</span>,
    },
    {
      key: 'last',
      label: 'Last transaction',
      width: 140,
      sortable: true,
      sortFirst: 'desc',
      sortValue: (a) => a.lastTransactionDate || '',
      render: (a) =>
        a.lastTransactionDate ? (
          <span className="tabular-nums">{fmtDay(a.lastTransactionDate)}</span>
        ) : (
          <span className="accts-unnamed">—</span>
        ),
    },
    {
      key: 'actions',
      label: <span className="sr-only">Actions</span>,
      width: 40,
      align: 'right',
      render: (a) => (
        <Button
          variant="ghost"
          icon={Pencil}
          label={a.holderName ? `Rename ${a.holderName}` : `Name account ${a.accountNumber}`}
          onClick={() => openEdit(a)}
        />
      ),
    },
  ];

  const unnamed = accounts.filter((a) => !a.holderName).length;
  const summary = accounts.length
    ? `${plural(accounts.length, 'account')}${unnamed ? ` · ${unnamed} not named` : ''}`
    : '';

  let list;
  if (error && !data) {
    list = (
      <EmptyState
        icon={Landmark}
        title="Could not load accounts"
        description={error}
        action={<Button label="Try again" onClick={refresh} />}
      />
    );
  } else if (!firstLoad && accounts.length === 0) {
    list = (
      <EmptyState
        icon={Landmark}
        title="No bank accounts yet"
        description="Import a bank statement to add one."
        action={<Button iconLeft={Upload} label="Import statement" to="/import" />}
      />
    );
  } else {
    list = (
      <ListView
        className="accts-list"
        aria-label="Accounts"
        columns={columns}
        rows={accounts}
        rowKey="id"
        storageKey="fintrack.accounts"
        loading={firstLoad}
        onRowClick={openEdit}
      />
    );
  }

  return (
    <>
      <PageHeader title="Accounts" />
      <PageBody width="medium" className="accts-page">
        <div className="accts-head">
          <p className="accts-intro">{ACCOUNTS_INTRO}</p>
          {summary && <span className="accts-summary">{summary}</span>}
        </div>
        {list}
      </PageBody>
      {dialog}
    </>
  );
}
