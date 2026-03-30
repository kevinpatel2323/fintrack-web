import { useCallback, useEffect, useMemo, useState } from 'react';
import MobileTransactionCard from '../components/MobileTransactionCard.jsx';
import TransactionFriendTagsPanel from '../components/TransactionFriendTagsPanel.jsx';
import './Calendar.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalIso(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function getTodayIso() {
  return toLocalIso(new Date());
}

function parseLocalDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

function formatDate(value) {
  if (!value) return '—';
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateCompact(value) {
  if (!value) return '—';
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
}

/** Short amounts for calendar cells so seven columns fit on narrow screens. */
function formatNetCompact(value) {
  const num = Math.abs(Number(value));
  if (Number.isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    return formatNumber(num);
  }
}

function monthBounds(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { startIso: toLocalIso(start), endIso: toLocalIso(end) };
}

function buildCalendarCells(viewYear, viewMonth) {
  const first = new Date(viewYear, viewMonth, 1);
  const pad = first.getDay();
  const cells = [];
  let dayCounter = 1 - pad;
  for (let i = 0; i < 42; i += 1) {
    const cur = new Date(viewYear, viewMonth, dayCounter);
    const iso = toLocalIso(cur);
    const inMonth = cur.getMonth() === viewMonth && cur.getFullYear() === viewYear;
    cells.push({
      iso,
      label: cur.getDate(),
      inMonth,
    });
    dayCounter += 1;
  }
  return cells;
}

function aggregateByDay(transactions) {
  const map = new Map();
  for (const t of transactions) {
    const raw = t.transactionDate;
    const d = typeof raw === 'string' ? raw.slice(0, 10) : '';
    if (!d) continue;
    const cur = map.get(d) || { net: 0, totalIn: 0, totalOut: 0, count: 0 };
    const w = Number(t.withdrawal || 0);
    const dep = Number(t.deposit || 0);
    cur.totalOut += w;
    cur.totalIn += dep;
    cur.net += dep - w;
    cur.count += 1;
    map.set(d, cur);
  }
  return map;
}

export default function Calendar() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [account, setAccount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountsStatus, setAccountsStatus] = useState('');
  const [friends, setFriends] = useState([]);
  const [friendsStatus, setFriendsStatus] = useState('');

  const [selectedIso, setSelectedIso] = useState(null);
  const [sheetMode, setSheetMode] = useState('menu');
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);

  const [manualStatus, setManualStatus] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualForm, setManualForm] = useState({
    narration: '',
    type: 'PAID',
    settlementDirection: 'WITHDRAWAL',
    amount: '',
    balance: '',
    upiName: '',
    upiDescription: '',
    upiBank: '',
  });

  const todayIso = getTodayIso();

  const { startIso, endIso } = useMemo(
    () => monthBounds(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setFetchStatus('');
    try {
      const accountQuery = account ? `&accountNumber=${encodeURIComponent(account)}` : '';
      const res = await fetch(
        `${API_BASE}/imports/transactions/range?start=${startIso}&end=${endIso}${accountQuery}`,
      );
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data.data || []);
    } catch (e) {
      setFetchStatus(e.message || 'Failed to load calendar data');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [startIso, endIso, account]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    async function fetchAccounts() {
      setAccountsStatus('');
      try {
        const res = await fetch(`${API_BASE}/imports/accounts`);
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const data = await res.json();
        setAccounts(data.data || []);
      } catch (e) {
        setAccountsStatus(e.message || 'Failed to fetch accounts');
      }
    }
    fetchAccounts();
  }, []);

  useEffect(() => {
    async function fetchFriends() {
      try {
        const res = await fetch(`${API_BASE}/friends`);
        if (!res.ok) throw new Error('Failed to fetch friends');
        const data = await res.json();
        setFriends(data.data || []);
      } catch (e) {
        setFriendsStatus(e.message || 'Failed to fetch friends');
      }
    }
    fetchFriends();
  }, []);

  const byDay = useMemo(() => aggregateByDay(transactions), [transactions]);
  const cells = useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth]);

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
        new Date(viewYear, viewMonth, 1),
      ),
    [viewYear, viewMonth],
  );

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function goThisMonth() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
  }

  function openDay(iso) {
    setSelectedIso(iso);
    setSheetMode('menu');
    setExpandedTransactionId(null);
    setManualStatus('');
    setManualForm((prev) => ({
      ...prev,
      narration: '',
      type: 'PAID',
      settlementDirection: 'WITHDRAWAL',
      amount: '',
      balance: '',
      upiName: '',
      upiDescription: '',
      upiBank: '',
    }));
  }

  function closeSheet() {
    setSelectedIso(null);
    setSheetMode('menu');
    setExpandedTransactionId(null);
  }

  const dayTxns = useMemo(() => {
    if (!selectedIso) return [];
    return transactions
      .filter((t) => {
        const d = typeof t.transactionDate === 'string' ? t.transactionDate.slice(0, 10) : '';
        return d === selectedIso;
      })
      .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  }, [transactions, selectedIso]);

  const selectedStats = selectedIso ? byDay.get(selectedIso) : null;

  async function handleManualSubmit(event) {
    event.preventDefault();
    if (!selectedIso) return;
    setManualStatus('');

    const narration = manualForm.narration.trim();
    const amountValue = Number(manualForm.amount);
    const balanceValue = manualForm.balance === '' ? undefined : Number(manualForm.balance);

    if (!narration) {
      setManualStatus('Enter a narration.');
      return;
    }
    if (!manualForm.amount || Number.isNaN(amountValue) || amountValue <= 0) {
      setManualStatus('Enter a valid amount.');
      return;
    }
    if (manualForm.type === 'SETTLEMENT' && !manualForm.settlementDirection) {
      setManualStatus('Select settlement direction.');
      return;
    }
    if (balanceValue !== undefined && (Number.isNaN(balanceValue) || balanceValue < 0)) {
      setManualStatus('Balance must be zero or positive.');
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/transactions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionDate: selectedIso,
          narration,
          type: manualForm.type,
          settlementDirection:
            manualForm.type === 'SETTLEMENT' ? manualForm.settlementDirection : undefined,
          amount: amountValue,
          balance: balanceValue,
          upiName: manualForm.upiName.trim() || undefined,
          upiDescription: manualForm.upiDescription.trim() || undefined,
          upiBank: manualForm.upiBank.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add manual transaction.');
      setManualStatus('Transaction added.');
      setManualForm((prev) => ({
        ...prev,
        narration: '',
        type: 'PAID',
        settlementDirection: 'WITHDRAWAL',
        amount: '',
        balance: '',
        upiName: '',
        upiDescription: '',
        upiBank: '',
      }));
      await loadMonth();
      setSheetMode('menu');
    } catch (e) {
      setManualStatus(e.message || 'Failed to add manual transaction.');
    } finally {
      setManualSubmitting(false);
    }
  }

  function toggleExpand(rowId) {
    setExpandedTransactionId((prev) => (prev === rowId ? null : rowId));
  }

  return (
    <>
      <section className="card calendar-card">
        <div className="glass-panel calendar-filters">
          <div className="card-header">
            <div>
              <h2>Filters</h2>
              <p>Same as transactions: pick an account and browse by month.</p>
            </div>
            <div className="select-wrap">
              <select value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option value={a} key={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {accountsStatus && <p className="status">{accountsStatus}</p>}
        {friendsStatus && <p className="status">{friendsStatus}</p>}

        <div className="glass-panel calendar-filters">
          <div className="calendar-toolbar">
            <h2>Calendar</h2>
            <div className="calendar-nav-cluster">
              <button className="secondary" type="button" onClick={goPrevMonth} aria-label="Previous month">
                ‹
              </button>
              <span className="calendar-month-label">{monthTitle}</span>
              <button className="secondary" type="button" onClick={goNextMonth} aria-label="Next month">
                ›
              </button>
              <button className="secondary" type="button" onClick={goThisMonth}>
                Today
              </button>
            </div>
          </div>
          {loading && <p className="status">Loading…</p>}
          {fetchStatus && <p className="status">{fetchStatus}</p>}

          <div className="calendar-grid-wrap">
            <div className="calendar-weekdays" aria-hidden>
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="calendar-grid" role="grid" aria-label={`Calendar for ${monthTitle}`}>
            {cells.map((cell) => {
              const stats = byDay.get(cell.iso);
              const hasData = stats && stats.count > 0;
              const isToday = cell.iso === todayIso;
              const net = stats?.net ?? 0;
              let netClass = 'calendar-cell__net--zero';
              if (net > 0.0001) netClass = 'calendar-cell__net--in';
              if (net < -0.0001) netClass = 'calendar-cell__net--out';

              const netLabel = hasData
                ? `${net > 0 ? '+' : net < 0 ? '−' : ''}${formatNetCompact(net)}`
                : '';

              return (
                <div
                  key={cell.iso}
                  role="gridcell"
                  className={[
                    'calendar-cell',
                    !cell.inMonth ? 'calendar-cell--muted' : '',
                    isToday && cell.inMonth ? 'calendar-cell--today' : '',
                    cell.inMonth ? 'calendar-cell--has-data' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  tabIndex={cell.inMonth ? 0 : -1}
                  onClick={() => cell.inMonth && openDay(cell.iso)}
                  onKeyDown={(e) => {
                    if (!cell.inMonth) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDay(cell.iso);
                    }
                  }}
                  aria-label={
                    cell.inMonth
                      ? `${cell.label} ${monthTitle.split(' ')[0]}, net ${hasData ? formatNumber(net) : 'no transactions'}`
                      : undefined
                  }
                  title={
                    cell.inMonth && hasData
                      ? `Net ${formatNumber(net)} · ${stats.count} transaction${stats.count === 1 ? '' : 's'}`
                      : undefined
                  }
                >
                  <span className="calendar-cell__dow-num">{cell.label}</span>
                  {cell.inMonth && hasData ? (
                    <>
                      <span className={`calendar-cell__net ${netClass}`}>{netLabel}</span>
                      <span className="calendar-cell__count">{stats.count} txn</span>
                    </>
                  ) : null}
                </div>
              );
            })}
            </div>
          </div>

          <div className="calendar-legend">
            <span>
              <i className="in" /> Net in (deposits − withdrawals)
            </span>
            <span>
              <i className="out" /> Net out
            </span>
            <span>
              <i /> Tap a date for actions
            </span>
          </div>
        </div>
      </section>

      {selectedIso && (
        <div
          className="calendar-sheet-backdrop"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closeSheet()}
        >
          <div className="calendar-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-sheet-title">
            <div className="calendar-sheet__header">
              <div>
                <h3 id="calendar-sheet-title">{formatDate(selectedIso)}</h3>
                <p>
                  {selectedStats
                    ? `${selectedStats.count} transaction${selectedStats.count === 1 ? '' : 's'} · net ${formatNumber(selectedStats.net)}`
                    : 'No transactions yet'}
                </p>
              </div>
              <button type="button" className="ghost calendar-sheet__close" onClick={closeSheet} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="calendar-sheet__body">
              {sheetMode === 'menu' && (
                <>
                  <div className="calendar-sheet__actions">
                    <button
                      type="button"
                      className="calendar-action-primary"
                      onClick={() => {
                        setManualStatus('');
                        setSheetMode('manual');
                      }}
                    >
                      Add manual transaction
                    </button>
                    <button
                      type="button"
                      className="calendar-action-secondary"
                      onClick={() => {
                        setExpandedTransactionId(null);
                        setSheetMode('manage');
                      }}
                    >
                      Manage transactions on this day
                    </button>
                  </div>
                  {selectedStats && (
                    <div className="calendar-summary-strip">
                      <div>
                        <span>Total in</span>
                        <strong>₹{formatNumber(selectedStats.totalIn)}</strong>
                      </div>
                      <div>
                        <span>Total out</span>
                        <strong>₹{formatNumber(selectedStats.totalOut)}</strong>
                      </div>
                      <div>
                        <span>Net</span>
                        <strong>
                          {selectedStats.net >= 0 ? '+' : '−'}₹{formatNumber(Math.abs(selectedStats.net))}
                        </strong>
                      </div>
                    </div>
                  )}
                </>
              )}

              {sheetMode === 'manual' && (
                <>
                  <div className="calendar-sheet__actions calendar-sheet__actions--single">
                    <button
                      type="button"
                      className="calendar-action-secondary"
                      onClick={() => setSheetMode('menu')}
                    >
                      ← Back to options
                    </button>
                  </div>
                  <form className="friend-form manual-form" onSubmit={handleManualSubmit}>
                    <div className="friend-tags-header">
                      <h3>Add manual transaction</h3>
                      <p>Posted to Wallet · date {formatDateCompact(selectedIso)}</p>
                    </div>
                    <div className="form-grid">
                      <label className="field">
                        <span>Type</span>
                        <select
                          value={manualForm.type}
                          onChange={(e) => setManualForm((p) => ({ ...p, type: e.target.value }))}
                        >
                          <option value="PAID">Paid</option>
                          <option value="RECEIVED">Received</option>
                          <option value="I_OWE">I owe</option>
                          <option value="SETTLEMENT">Settlement</option>
                        </select>
                      </label>
                      {manualForm.type === 'SETTLEMENT' && (
                        <label className="field">
                          <span>Settlement direction</span>
                          <select
                            value={manualForm.settlementDirection}
                            onChange={(e) =>
                              setManualForm((p) => ({ ...p, settlementDirection: e.target.value }))
                            }
                          >
                            <option value="WITHDRAWAL">Withdrawal</option>
                            <option value="DEPOSIT">Deposit</option>
                          </select>
                        </label>
                      )}
                      <label className="field">
                        <span>Amount</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={manualForm.amount}
                          onChange={(e) => setManualForm((p) => ({ ...p, amount: e.target.value }))}
                          placeholder="0.00"
                        />
                      </label>
                      <label className="field">
                        <span>Narration</span>
                        <input
                          type="text"
                          value={manualForm.narration}
                          onChange={(e) => setManualForm((p) => ({ ...p, narration: e.target.value }))}
                          placeholder="What was this for?"
                        />
                      </label>
                      <label className="field">
                        <span>Balance (optional)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={manualForm.balance}
                          onChange={(e) => setManualForm((p) => ({ ...p, balance: e.target.value }))}
                          placeholder="0.00"
                        />
                      </label>
                      <label className="field">
                        <span>UPI name (optional)</span>
                        <input
                          type="text"
                          value={manualForm.upiName}
                          onChange={(e) => setManualForm((p) => ({ ...p, upiName: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>UPI description (optional)</span>
                        <input
                          type="text"
                          value={manualForm.upiDescription}
                          onChange={(e) => setManualForm((p) => ({ ...p, upiDescription: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>UPI bank (optional)</span>
                        <input
                          type="text"
                          value={manualForm.upiBank}
                          onChange={(e) => setManualForm((p) => ({ ...p, upiBank: e.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="friend-actions">
                      <button className="secondary" type="submit" disabled={manualSubmitting}>
                        {manualSubmitting ? 'Adding…' : 'Add transaction'}
                      </button>
                      {manualStatus && <p className="status">{manualStatus}</p>}
                    </div>
                  </form>
                </>
              )}

              {sheetMode === 'manage' && (
                <>
                  <div className="calendar-sheet__actions calendar-sheet__actions--single">
                    <button
                      type="button"
                      className="calendar-action-secondary"
                      onClick={() => {
                        setSheetMode('menu');
                        setExpandedTransactionId(null);
                      }}
                    >
                      ← Back to options
                    </button>
                  </div>
                  {selectedStats && (
                    <div className="calendar-summary-strip" aria-label="Day totals">
                      <div>
                        <span>Total in</span>
                        <strong>₹{formatNumber(selectedStats.totalIn)}</strong>
                      </div>
                      <div>
                        <span>Total out</span>
                        <strong>₹{formatNumber(selectedStats.totalOut)}</strong>
                      </div>
                      <div>
                        <span>Net</span>
                        <strong>
                          {selectedStats.net >= 0 ? '+' : '−'}₹{formatNumber(Math.abs(selectedStats.net))}
                        </strong>
                      </div>
                    </div>
                  )}
                  <div className="calendar-manage-shell glass-panel">
                    <div className="calendar-manage-shell__head">
                      <h4 className="calendar-manage-shell__title">Transactions on this day</h4>
                      <p className="calendar-manage-shell__sub">
                        {dayTxns.length === 0
                          ? 'No entries yet — use “Add manual transaction” from the previous screen.'
                          : 'Expand a transaction to add or edit friend tags.'}
                      </p>
                    </div>
                    {dayTxns.length === 0 ? (
                      <p className="empty calendar-manage-shell__empty">Nothing to show for this date.</p>
                    ) : (
                      <div className="calendar-manage-list">
                        {dayTxns.map((row) => (
                          <MobileTransactionCard
                            key={row.id}
                            row={row}
                            expanded={expandedTransactionId === row.id}
                            onToggleExpand={() => toggleExpand(row.id)}
                            formatDateCompact={formatDateCompact}
                            formatNumber={formatNumber}
                          >
                            <TransactionFriendTagsPanel
                              transaction={row}
                              friends={friends}
                              formatDate={formatDate}
                              formatNumber={formatNumber}
                            />
                          </MobileTransactionCard>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
