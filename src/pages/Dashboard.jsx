import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://00bnq4gw-3000.inc1.devtunnels.ms';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN').format(num);
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('');

  const [lastImport, setLastImport] = useState(null);
  const [lastAccount, setLastAccount] = useState('');

  const [imports, setImports] = useState([]);
  const [importsPage, setImportsPage] = useState(1);
  const [importsAccount, setImportsAccount] = useState('');
  const [importsLoading, setImportsLoading] = useState(false);
  const [importsError, setImportsError] = useState('');

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadResult, setUploadResult] = useState(null);

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
      setUploadStatus('Import completed.');
      setUploadFile(null);
      await refreshAfterUpload();
    } catch (error) {
      setUploadStatus(error.message || 'Upload failed');
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

  return (
    <>
      <section className="grid">
        <div className="card upload-card">
          <div className="card-header">
            <div>
              <h2>Upload statement</h2>
              <p>We extract the account number from cell E15 and import only new rows.</p>
            </div>
            <div className="pill">XLS only</div>
          </div>

          <form className="upload-form" onSubmit={handleUpload}>
            <label className="file-input">
              <input
                type="file"
                accept=".xls"
                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
              />
              <span>{uploadFile ? uploadFile.name : 'Choose statement file'}</span>
            </label>
            <button className="primary" type="submit">
              Import now
            </button>
          </form>

          {uploadStatus && <p className="status">{uploadStatus}</p>}
          {uploadResult && (
            <div className="upload-result">
              <div>
                <span>Account</span>
                <strong>{uploadResult.accountNumber || 'unknown'}</strong>
              </div>
              <div>
                <span>Inserted</span>
                <strong>{formatNumber(uploadResult.insertedRows)}</strong>
              </div>
              <div>
                <span>Period</span>
                <strong>
                  {formatDate(uploadResult.periodStart)} → {formatDate(uploadResult.periodEnd)}
                </strong>
              </div>
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
              <div>
                <span>Account</span>
                <strong>{lastImport.accountNumber || 'unknown'}</strong>
              </div>
              <div>
                <span>Inserted</span>
                <strong>{formatNumber(lastImport.insertedRows)}</strong>
              </div>
              <div>
                <span>Rows</span>
                <strong>{formatNumber(lastImport.totalRows)}</strong>
              </div>
              <div>
                <span>Period</span>
                <strong>
                  {formatDate(lastImport.periodStart)} → {formatDate(lastImport.periodEnd)}
                </strong>
              </div>
              <div>
                <span>Last date before</span>
                <strong>{formatDate(lastImport.lastTxDateBefore)}</strong>
              </div>
              <div>
                <span>Uploaded</span>
                <strong>{formatDate(lastImport.uploadedAt)}</strong>
              </div>
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
          <div className="imports-list">
            <div className="imports-head" aria-hidden="true">
              <span>Account</span>
              <span>Period</span>
              <span>Inserted</span>
              <span>Uploaded</span>
            </div>
            {imports.map((item) => (
              <article className="import-row" key={item.id}>
                <div>
                  <span className="label">Account</span>
                  <strong>{item.accountNumber || 'unknown'}</strong>
                </div>
                <div>
                  <span className="label">Period</span>
                  <strong>
                    {formatDate(item.periodStart)} → {formatDate(item.periodEnd)}
                  </strong>
                </div>
                <div>
                  <span className="label">Inserted</span>
                  <strong>{formatNumber(item.insertedRows)}</strong>
                </div>
                <div>
                  <span className="label">Uploaded</span>
                  <strong>{formatDate(item.uploadedAt)}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
