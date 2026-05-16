import { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DataTable from '../components/DataTable.jsx';
import { formatDate } from '../utils/dateUtils.js';
import { formatNumber } from '../utils/stringUtils.js';
import './StatementImport.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function isoDateMinusDays(isoDate, days) {
  if (!isoDate) return null;
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function StatementImport() {
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('');

  const [lastImport, setLastImport] = useState(null);
  const [lastAccount, setLastAccount] = useState('');

  const [imports, setImports] = useState([]);
  const [importsPage, setImportsPage] = useState(1);
  const [importsAccount, setImportsAccount] = useState('');
  const [importsLoading, setImportsLoading] = useState(false);
  const [importsError, setImportsError] = useState('');
  const [importsStatus, setImportsStatus] = useState('');
  const [revertingImportId, setRevertingImportId] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [previewFileKey, setPreviewFileKey] = useState('');

  function getFileKey(file) {
    if (!file) return '';
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  useEffect(() => {
    async function fetchAccounts() {
      setAccountsStatus('');
      try {
        const res = await fetch(`${API_BASE}/imports/accounts`);
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const data = await res.json();
        setAccounts(data.data || []);
      } catch (error) {
        setAccountsStatus(error.message || 'Failed to fetch accounts');
      }
    }

    fetchAccounts();
  }, []);

  useEffect(() => {
    async function fetchLast() {
      try {
        const accountQuery = lastAccount ? `?accountNumber=${encodeURIComponent(lastAccount)}` : '';
        const res = await fetch(`${API_BASE}/imports/last${accountQuery}`);
        if (res.status === 404) {
          setLastImport(null);
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch last import');
        const data = await res.json();
        setLastImport(data);
      } catch (error) {
        setImportsError(error.message || 'Failed to fetch last import');
      }
    }

    fetchLast();
  }, [lastAccount]);

  useEffect(() => {
    async function fetchImports() {
      setImportsLoading(true);
      setImportsError('');
      try {
        const accountQuery = importsAccount
          ? `&accountNumber=${encodeURIComponent(importsAccount)}`
          : '';
        const res = await fetch(`${API_BASE}/imports?page=${importsPage}&limit=6${accountQuery}`);
        if (!res.ok) throw new Error('Failed to fetch imports');
        const data = await res.json();
        setImports(data.data || []);
      } catch (error) {
        setImportsError(error.message || 'Failed to fetch imports');
      } finally {
        setImportsLoading(false);
      }
    }

    fetchImports();
  }, [importsPage, importsAccount]);

  async function handleUpload(event) {
    event.preventDefault();
    if (!uploadFile) {
      setUploadStatus('Please select a statement file.');
      return;
    }
    const currentFileKey = getFileKey(uploadFile);
    if (!uploadPreview || previewFileKey !== currentFileKey) {
      setUploadStatus('Please preview this statement before importing.');
      return;
    }

    setUploadStatus('Uploading...');
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('statement', uploadFile);
      const res = await fetch(`${API_BASE}/imports/hdfc`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      setUploadResult(data);
      setUploadPreview(null);
      setPreviewFileKey('');
      setUploadStatus('Import completed.');
      setUploadFile(null);
      await refreshAfterUpload();
    } catch (error) {
      setUploadStatus(error.message || 'Upload failed');
    }
  }

  async function handlePreview() {
    if (!uploadFile) {
      setUploadStatus('Please select a statement file.');
      return;
    }

    setUploadStatus('Preparing preview...');
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('statement', uploadFile);
      const res = await fetch(`${API_BASE}/imports/hdfc/preview`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Preview failed');
      }
      setUploadPreview(data);
      setPreviewFileKey(getFileKey(uploadFile));
      setUploadStatus('Preview ready. Verify entries and click Import now.');
    } catch (error) {
      setUploadStatus(error.message || 'Preview failed');
    }
  }

  async function refreshAfterUpload() {
    try {
      const res = await fetch(`${API_BASE}/imports/last`);
      if (res.ok) {
        const data = await res.json();
        setLastImport(data);
      }
    } catch (error) {
      // ignore
    }

    try {
      const res = await fetch(`${API_BASE}/imports?page=1&limit=6`);
      if (res.ok) {
        const data = await res.json();
        setImports(data.data || []);
        setImportsPage(1);
      }
    } catch (error) {
      // ignore
    }

    try {
      const res = await fetch(`${API_BASE}/imports/accounts`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.data || []);
      }
    } catch (error) {
      // ignore
    }
  }

  async function runRevertImport(importId) {
    setImportsError('');
    setImportsStatus('Reverting import...');
    setRevertingImportId(importId);
    try {
      const res = await fetch(`${API_BASE}/imports/${importId}/revert`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to revert import');
      }
      setImportsStatus(
        `Import #${importId} reverted. Removed ${formatNumber(data.removedTransactions)} transactions.`,
      );
      await refreshAfterUpload();
    } catch (error) {
      setImportsStatus('');
      setImportsError(error.message || 'Failed to revert import');
    } finally {
      setRevertingImportId(null);
    }
  }

  function handleRevertImport(importId) {
    setConfirmState({
      open: true,
      title: 'Revert import?',
      message: 'This will remove all transactions created by it.',
      confirmLabel: 'Revert',
      onConfirm: async () => {
        setConfirmState({ open: false });
        await runRevertImport(importId);
      },
      onCancel: () => setConfirmState({ open: false }),
    });
  }

  const previewColumns = [
    {
      id: 'date',
      header: 'Date',
      defaultWidth: 120,
      sortable: true,
      accessor: (row) => new Date(row.transactionDate).getTime(),
      trim: true,
      title: (row) => formatDate(row.transactionDate),
      cellClassName: 'data-table-cell--span-mobile',
      cell: (row) => <strong className="transaction-date">{formatDate(row.transactionDate)}</strong>,
    },
    {
      id: 'account',
      header: 'Account',
      defaultWidth: 180,
      sortable: true,
      accessor: (row) => row.accountNumber || '',
      trim: true,
      cell: (row) => (
        <span className="transaction-account-badge">
          {row.accountNumber || uploadPreview?.accountNumber || 'unknown'}
        </span>
      ),
    },
    {
      id: 'upiName',
      header: 'UPI name',
      defaultWidth: 200,
      sortable: true,
      accessor: (row) => row.upiName || '',
      trim: true,
      title: (row) => row.upiName || '—',
      cellClassName: 'data-table-cell--span-mobile',
      cell: (row) => <strong>{row.upiName || '—'}</strong>,
    },
    {
      id: 'upiDescription',
      header: 'UPI description',
      defaultWidth: 220,
      sortable: true,
      accessor: (row) => row.upiDescription || '',
      trim: true,
      title: (row) => row.upiDescription || '—',
      cellClassName: 'data-table-cell--span-mobile',
      cell: (row) => <strong>{row.upiDescription || '—'}</strong>,
    },
    {
      id: 'upiBank',
      header: 'UPI bank',
      defaultWidth: 160,
      sortable: true,
      accessor: (row) => row.upiBank || '',
      trim: true,
      title: (row) => row.upiBank || '—',
      cellClassName: 'data-table-cell--span-mobile',
      cell: (row) => <strong>{row.upiBank || '—'}</strong>,
    },
    {
      id: 'amount',
      header: 'Amount',
      defaultWidth: 120,
      sortable: true,
      accessor: (row) => {
        const w = Number(row.withdrawal || 0);
        const d = Number(row.deposit || 0);
        return w > 0 ? -w : d;
      },
      trim: true,
      cell: (row) => {
        const withdrawal = Number(row.withdrawal || 0);
        const deposit = Number(row.deposit || 0);
        const amount = withdrawal > 0 ? withdrawal : deposit;
        const isWithdrawal = withdrawal > 0;
        return (
          <strong className={`transaction-amount ${isWithdrawal ? 'amount-withdrawal' : 'amount-deposit'}`}>
            {isWithdrawal ? '-' : '+'}
            {formatNumber(amount)}
          </strong>
        );
      },
    },
    {
      id: 'balance',
      header: 'Balance',
      defaultWidth: 130,
      sortable: true,
      accessor: (row) => Number(row.balance) || 0,
      trim: true,
      title: (row) => formatNumber(row.balance),
      cell: (row) => <strong>{formatNumber(row.balance)}</strong>,
    },
  ];

  const importColumns = [
    {
      id: 'account',
      header: 'Account',
      defaultWidth: 140,
      sortable: true,
      accessor: (row) => row.accountNumber || '',
      trim: true,
      title: (row) => row.accountNumber || 'unknown',
      cell: (row) => <strong>{row.accountNumber || 'unknown'}</strong>,
    },
    {
      id: 'inserted',
      header: 'Inserted',
      defaultWidth: 110,
      sortable: true,
      accessor: (row) => Number(row.insertedRows) || 0,
      trim: true,
      cell: (row) => <strong>{formatNumber(row.insertedRows)}</strong>,
    },
    {
      id: 'period',
      header: 'Period',
      defaultWidth: 220,
      sortable: true,
      accessor: (row) => new Date(row.periodStart).getTime(),
      trim: true,
      title: (row) =>
        `${formatDate(row.periodStart)} → ${formatDate(row.periodEnd)}`,
      cellClassName: 'data-table-cell--span-mobile',
      cell: (row) => (
        <strong>
          {formatDate(row.periodStart)} → {formatDate(row.periodEnd)}
        </strong>
      ),
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      defaultWidth: 130,
      sortable: true,
      accessor: (row) => new Date(row.uploadedAt).getTime(),
      trim: true,
      title: (row) => formatDate(row.uploadedAt),
      cell: (row) => <strong>{formatDate(row.uploadedAt)}</strong>,
    },
    {
      id: 'actions',
      header: 'Actions',
      defaultWidth: 120,
      minWidth: 96,
      hideable: false,
      sortable: false,
      cellClassName: 'data-table-cell--actions',
      cell: (row) => (
        <button
          className="ghost"
          type="button"
          onClick={() => handleRevertImport(row.id)}
          disabled={revertingImportId === row.id}
        >
          {revertingImportId === row.id ? 'Reverting...' : 'Revert'}
        </button>
      ),
    },
  ];

  return (
    <>
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={confirmState.onCancel}
      />

      <section className="statement-import-intro">
        <h2 className="statement-import-title">Statement import</h2>
        <p className="statement-import-lead">
          Upload HDFC XLS statements, preview rows, and manage past imports.
        </p>
      </section>

      <section className="statement-import-top">
        <div className="card upload-card">
          <div className="card-header">
            <div>
              <h2>Upload statement</h2>
            </div>
            <div className="pill">XLS only</div>
          </div>

          <form className="upload-form" onSubmit={handleUpload}>
            <label className="file-input">
              <input
                type="file"
                accept=".xls"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  setUploadFile(nextFile);
                  setUploadPreview(null);
                  setPreviewFileKey('');
                  setUploadResult(null);
                  setUploadStatus('');
                }}
              />
              <span>{uploadFile ? uploadFile.name : 'Choose statement file'}</span>
            </label>
            <div className="upload-actions">
              <button className="secondary" type="button" onClick={handlePreview} disabled={!uploadFile}>
                Preview import
              </button>
              <button className="primary" type="submit" disabled={!uploadFile}>
                Import now
              </button>
            </div>
          </form>

          {uploadStatus && <p className="status">{uploadStatus}</p>}
          {uploadPreview && (
            <div className="upload-preview">
              <div className="upload-result">
                <table className="friend-tag-mini-table">
                  <tbody>
                    <tr>
                      <th scope="row">Account</th>
                      <td>
                        <strong>{uploadPreview.accountNumber || 'unknown'}</strong>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Will insert</th>
                      <td>
                        <strong>{formatNumber(uploadPreview.willInsert)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Skipped</th>
                      <td>
                        <strong>{formatNumber(uploadPreview.skippedRows)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Total parsed</th>
                      <td>
                        <strong>{formatNumber(uploadPreview.totalParsed)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Last date before</th>
                      <td>
                        <strong>{formatDate(uploadPreview.lastDateBefore)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Period</th>
                      <td>
                        <strong>
                          {formatDate(uploadPreview.periodStart)} → {formatDate(uploadPreview.periodEnd)}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {uploadPreview.previewRows.length === 0 ? (
                <p className="empty">No new entries will be inserted from this statement.</p>
              ) : (
                <DataTable
                  columns={previewColumns}
                  rows={uploadPreview.previewRows}
                  getRowKey={(row, index) => `${row.transactionDate}-${index}`}
                  scrollClassName="data-table-scroll transactions-table"
                  mobileHeroColumnIds={['date', 'amount', 'balance']}
                  aria-label="Statement import preview"
                  rowClassName={(row) => {
                    const withdrawal = Number(row.withdrawal || 0);
                    return withdrawal > 0 ? 'transaction-withdrawal' : 'transaction-deposit';
                  }}
                />
              )}
            </div>
          )}
          {uploadResult && (
            <div className="upload-result">
              <table className="friend-tag-mini-table">
                <tbody>
                  <tr>
                    <th scope="row">Account</th>
                    <td>
                      <strong>{uploadResult.accountNumber || 'unknown'}</strong>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Inserted</th>
                    <td>
                      <strong>{formatNumber(uploadResult.insertedRows)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Period</th>
                    <td>
                      <strong>
                        {formatDate(uploadResult.periodStart)} → {formatDate(uploadResult.periodEnd)}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>Last import</h2>
              <p>Select an account to see the most recent import.</p>
            </div>
            <div className="select-wrap">
              <select value={lastAccount} onChange={(e) => setLastAccount(e.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option value={account} key={account}>
                    {account}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {accountsStatus && <p className="status">{accountsStatus}</p>}
          {lastImport ? (
            <div className="stat-grid">
              <table className="friend-tag-mini-table">
                <tbody>
                  <tr>
                    <th scope="row">Account</th>
                    <td>
                      <strong>{lastImport.accountNumber || 'unknown'}</strong>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Inserted</th>
                    <td>
                      <strong>{formatNumber(lastImport.insertedRows)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Rows</th>
                    <td>
                      <strong>{formatNumber(lastImport.totalRows)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Period</th>
                    <td>
                      <strong>
                        {formatDate(lastImport.periodStart)} → {formatDate(lastImport.periodEnd)}
                      </strong>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Last date before</th>
                    <td>
                      <strong>{formatDate(lastImport.lastTxDateBefore)}</strong>
                    </td>
                  </tr>
                  {lastImport.periodEnd && (
                    <tr>
                      <th scope="row">Next statement start</th>
                      <td>
                        <strong className="import-next-start-hint">
                          On or before {formatDate(isoDateMinusDays(lastImport.periodEnd, 2))}
                        </strong>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <th scope="row">Uploaded</th>
                    <td>
                      <strong>{formatDate(lastImport.uploadedAt)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">No imports yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Recent imports</h2>
            <p>Filter by account to review historical uploads.</p>
          </div>
          <div className="controls">
            <div className="select-wrap">
              <select value={importsAccount} onChange={(e) => setImportsAccount(e.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option value={account} key={account}>
                    {account}
                  </option>
                ))}
              </select>
            </div>
            <div className="pager">
              <button
                className="ghost"
                type="button"
                onClick={() => setImportsPage((prev) => Math.max(1, prev - 1))}
                disabled={importsPage === 1}
              >
                Prev
              </button>
              <span>Page {importsPage}</span>
              <button className="ghost" type="button" onClick={() => setImportsPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </div>

        {importsLoading ? (
          <p className="status">Loading imports...</p>
        ) : importsError ? (
          <p className="status error">{importsError}</p>
        ) : imports.length === 0 ? (
          <p className="empty">No imports found.</p>
        ) : (
          <DataTable
            className="statement-imports-table"
            storageKey="fintrack-imports-v1"
            columns={importColumns}
            rows={imports}
            getRowKey={(row) => row.id}
            aria-label="Recent statement imports"
          />
        )}
        {importsStatus && <p className="status">{importsStatus}</p>}
      </section>
    </>
  );
}
