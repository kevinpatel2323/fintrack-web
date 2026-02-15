import { useEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const MIN_COL_WIDTH = 80;
const PREVIEW_COL_WIDTHS = [120, 180, 220, 180, 110, 130, 130];

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
  const [importsStatus, setImportsStatus] = useState('');
  const [revertingImportId, setRevertingImportId] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [previewFileKey, setPreviewFileKey] = useState('');
  const [previewColWidths, setPreviewColWidths] = useState(PREVIEW_COL_WIDTHS);
  const [previewResizeLineX, setPreviewResizeLineX] = useState(null);
  const previewColWidthsRef = useRef(previewColWidths);
  const previewResizeStateRef = useRef(null);

  const previewGridTemplate = useMemo(
    () => previewColWidths.map((width) => `${width}px`).join(' '),
    [previewColWidths],
  );

  useEffect(() => {
    previewColWidthsRef.current = previewColWidths;
  }, [previewColWidths]);

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

  function handlePreviewResizeStart(index, event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const widths = previewColWidthsRef.current;
    const nextIndex = index + 1;
    if (nextIndex >= widths.length) return;

    previewResizeStateRef.current = {
      index,
      startX: event.clientX,
      startWidth: widths[index],
      nextStartWidth: widths[nextIndex],
    };
    setPreviewResizeLineX(event.clientX);

    window.addEventListener('mousemove', handlePreviewResizeMove);
    window.addEventListener('mouseup', handlePreviewResizeEnd);
  }

  function handlePreviewResizeMove(event) {
    const state = previewResizeStateRef.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const total = state.startWidth + state.nextStartWidth;
    const newWidth = Math.max(MIN_COL_WIDTH, state.startWidth + dx);
    const newNextWidth = Math.max(MIN_COL_WIDTH, total - newWidth);

    setPreviewResizeLineX(event.clientX);
    setPreviewColWidths((prev) => {
      const updated = [...prev];
      updated[state.index] = newWidth;
      updated[state.index + 1] = newNextWidth;
      return updated;
    });
  }

  function handlePreviewResizeEnd() {
    previewResizeStateRef.current = null;
    setPreviewResizeLineX(null);
    window.removeEventListener('mousemove', handlePreviewResizeMove);
    window.removeEventListener('mouseup', handlePreviewResizeEnd);
  }

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
      <section className="dashboard-top">
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
                <div>
                  <span>Account</span>
                  <strong>{uploadPreview.accountNumber || 'unknown'}</strong>
                </div>
                <div>
                  <span>Will insert</span>
                  <strong>{formatNumber(uploadPreview.willInsert)}</strong>
                </div>
                <div>
                  <span>Skipped</span>
                  <strong>{formatNumber(uploadPreview.skippedRows)}</strong>
                </div>
                <div>
                  <span>Total parsed</span>
                  <strong>{formatNumber(uploadPreview.totalParsed)}</strong>
                </div>
                <div>
                  <span>Last date before</span>
                  <strong>{formatDate(uploadPreview.lastDateBefore)}</strong>
                </div>
                <div>
                  <span>Period</span>
                  <strong>
                    {formatDate(uploadPreview.periodStart)} → {formatDate(uploadPreview.periodEnd)}
                  </strong>
                </div>
              </div>

              <div className="transactions-table">
                {previewResizeLineX !== null && (
                  <>
                    <div className="table-resize-overlay" />
                    <div className="table-resize-line" style={{ left: previewResizeLineX }} />
                  </>
                )}
                <div className="table" style={{ '--tx-grid-columns': previewGridTemplate }}>
                  <div className="table-head" aria-hidden="true">
                    {[
                      'Date',
                      'Account',
                      'UPI name',
                      'UPI description',
                      'UPI bank',
                      'Amount',
                      'Balance',
                    ].map((label, index) => (
                      <span className="table-head-cell" key={label}>
                        {label}
                        {index < previewColWidths.length - 1 && (
                          <button
                            type="button"
                            className="col-resizer"
                            aria-label="Resize column"
                            onMouseDown={(event) => handlePreviewResizeStart(index, event)}
                          />
                        )}
                      </span>
                    ))}
                  </div>
                  {uploadPreview.previewRows.length === 0 ? (
                    <p className="empty">No new entries will be inserted from this statement.</p>
                  ) : (
                    uploadPreview.previewRows.map((row, idx) => {
                      const withdrawal = Number(row.withdrawal || 0);
                      const deposit = Number(row.deposit || 0);
                      const amount = withdrawal > 0 ? withdrawal : deposit;
                      const isWithdrawal = withdrawal > 0;

                      return (
                        <div className={`table-row ${isWithdrawal ? 'transaction-withdrawal' : 'transaction-deposit'}`} key={`${row.transactionDate}-${idx}`}>
                          <div className="table-cell">
                            <span className="table-cell-label">Date</span>
                            <strong className="transaction-date">{formatDate(row.transactionDate)}</strong>
                          </div>
                          <div className="table-cell">
                            <span className="table-cell-label">Account</span>
                            <span className="transaction-account-badge">{row.accountNumber || uploadPreview.accountNumber || 'unknown'}</span>
                          </div>
                          <div className="table-cell table-upi-name">
                            <span className="table-cell-label">UPI name</span>
                            <strong>{row.upiName || '—'}</strong>
                          </div>
                          <div className="table-cell table-upi-desc">
                            <span className="table-cell-label">UPI description</span>
                            <strong title={row.upiDescription || '—'}>{row.upiDescription || '—'}</strong>
                          </div>
                          <div className="table-cell table-upi-bank">
                            <span className="table-cell-label">UPI bank</span>
                            <strong>{row.upiBank || '—'}</strong>
                          </div>
                          <div className="table-cell">
                            <span className="table-cell-label">Amount</span>
                            <strong className={`transaction-amount ${isWithdrawal ? 'amount-withdrawal' : 'amount-deposit'}`}>
                              {isWithdrawal ? '-' : '+'}{formatNumber(amount)}
                            </strong>
                          </div>
                          <div className="table-cell">
                            <span className="table-cell-label">Balance</span>
                            <strong>{formatNumber(row.balance)}</strong>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
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
              <span>Actions</span>
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
                <div className="import-actions">
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => handleRevertImport(item.id)}
                    disabled={revertingImportId === item.id}
                  >
                    {revertingImportId === item.id ? 'Reverting...' : 'Revert'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {importsStatus && <p className="status">{importsStatus}</p>}
      </section>
    </>
  );
}
