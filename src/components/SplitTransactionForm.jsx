import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateAdjustmentSplit,
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  parsePercentStringToBps,
  parseShareStringToWeight,
  roundCurrencyToMinor,
} from '../utils/splitEngine.ts';
import {
  validateAdjustmentSplit,
  validateEntriesMatchParticipants,
  validatePercentTotal,
  validateSelectedParticipants,
  validateShares,
  validateSplitTotal,
} from '../utils/splitValidation.ts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const METHODS = [
  { id: 'EQUAL', label: 'Equal' },
  { id: 'EXACT', label: 'Exact' },
  { id: 'PERCENT', label: 'Percent' },
  { id: 'SHARES', label: 'Shares' },
  { id: 'ADJUSTMENT', label: 'Adjust' },
];

function SplitMethodIcon({ methodId }) {
  switch (methodId) {
    case 'EQUAL':
      return (
        <span className="split-txn-method__icon" aria-hidden>
          =
        </span>
      );
    case 'EXACT':
      return (
        <span className="split-txn-method__icon split-txn-method__icon--exact" aria-hidden>
          1.23
        </span>
      );
    case 'PERCENT':
      return (
        <span className="split-txn-method__icon" aria-hidden>
          %
        </span>
      );
    case 'SHARES':
      return (
        <span className="split-txn-method__icon split-txn-method__icon--shares" aria-hidden>
          <svg className="split-txn-method__bars" viewBox="0 0 20 16" width="20" height="16">
            <rect x="1.5" y="9" width="4.5" height="7" rx="0.75" fill="currentColor" />
            <rect x="7.75" y="5" width="4.5" height="11" rx="0.75" fill="currentColor" />
            <rect x="14" y="2" width="4.5" height="14" rx="0.75" fill="currentColor" />
          </svg>
        </span>
      );
    case 'ADJUSTMENT':
      return (
        <span className="split-txn-method__icon split-txn-method__icon--adjust" aria-hidden>
          +/−
        </span>
      );
    default:
      return null;
  }
}

function formatSettlementDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatSettlementAmount(value) {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-IN').format(num);
}

function formatInr(minor, minorPerMajor) {
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / minorPerMajor);
  const frac = abs % minorPerMajor;
  const fracStr = String(minorPerMajor + frac).slice(1);
  const num = Number(`${whole}.${fracStr}`);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return `${neg ? '−' : ''}₹${formatted}`;
}

/**
 * @param {object} props
 * @param {number} props.totalAmount Transaction total in major units (e.g. rupees).
 * @param {{ id: string, name: string }[]} props.participants All friends to pick from.
 * @param {string[]} props.taggedFriendIds Friend ids that already have a tag on this transaction.
 * @param {string} [props.defaultDirection] Initial direction (same values as the tag form).
 * @param {boolean} [props.applying]
 * @param {number} [props.minorPerMajor]
 * @param {(args: { results: import('../utils/splitTypes.ts').SplitResult[], direction: string, note?: string }) => void | Promise<void>} [props.onApplySplit]
 */
const SPLIT_NOTE_MAX_LEN = 500;

export default function SplitTransactionForm({
  totalAmount,
  participants,
  taggedFriendIds = [],
  defaultDirection = 'OWES_ME',
  applying = false,
  minorPerMajor = 100,
  onApplySplit,
}) {
  const [method, setMethod] = useState('EQUAL');
  const [selectedIds, setSelectedIds] = useState([]);
  const [splitDirection, setSplitDirection] = useState(defaultDirection);
  const [exactById, setExactById] = useState({});
  const [percentById, setPercentById] = useState({});
  const [shareById, setShareById] = useState({});
  const [adjAmountById, setAdjAmountById] = useState({});
  const [splitNote, setSplitNote] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [linkableByParticipant, setLinkableByParticipant] = useState({});
  const [linkableLoadingByParticipant, setLinkableLoadingByParticipant] = useState({});
  const [linkedTagsByParticipant, setLinkedTagsByParticipant] = useState({});
  const fetchedLinkableIds = useRef(new Set());

  useEffect(() => {
    setSplitDirection(defaultDirection);
  }, [defaultDirection]);

  const totalMinor = useMemo(() => {
    const n = Number(totalAmount);
    if (!Number.isFinite(n)) return null;
    return roundCurrencyToMinor(n, minorPerMajor);
  }, [totalAmount, minorPerMajor]);

  const toggleFriend = useCallback((id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  const orderedSelected = useMemo(() => {
    const order = participants.map((p) => String(p.id));
    return selectedIds.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [selectedIds, participants]);

  useEffect(() => {
    if (splitDirection !== 'SETTLEMENT') return;
    for (const id of orderedSelected) {
      if (fetchedLinkableIds.current.has(id)) continue;
      fetchedLinkableIds.current.add(id);
      setLinkableLoadingByParticipant((prev) => ({ ...prev, [id]: true }));
      fetch(`${API_BASE}/friends/${id}/linkable-transactions`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => setLinkableByParticipant((prev) => ({ ...prev, [id]: data.data || [] })))
        .catch(() => setLinkableByParticipant((prev) => ({ ...prev, [id]: [] })))
        .finally(() =>
          setLinkableLoadingByParticipant((prev) => ({ ...prev, [id]: false })),
        );
    }
  }, [splitDirection, orderedSelected]);

  const filteredParticipants = useMemo(() => {
    if (participants.length === 0) return [];
    const q = participantSearch.trim().toLowerCase();
    const selected = new Set(selectedIds);
    if (!q) return participants;
    // Only names that match the query. Selected people who don't match stay on chips only,
    // so they don't jump to the top of the list and steal Enter / visual order.
    const list = participants.filter((p) => p.name && p.name.toLowerCase().includes(q));
    return list.slice().sort((a, b) => {
      const aSel = selected.has(String(a.id));
      const bSel = selected.has(String(b.id));
      if (aSel !== bSel) return aSel ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
  }, [participants, participantSearch, selectedIds]);

  const handleParticipantSearchKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = filteredParticipants[0];
      if (!first) return;
      toggleFriend(String(first.id));
    },
    [filteredParticipants, toggleFriend],
  );

  const results = useMemo(() => {
    if (totalMinor == null || orderedSelected.length === 0) return [];
    try {
      if (method === 'EQUAL') return calculateEqualSplit(totalMinor, orderedSelected);
      if (method === 'EXACT') {
        const entries = orderedSelected.map((id) => ({
          participantId: id,
          amountMinor: roundCurrencyToMinor(exactById[id] ?? '0', minorPerMajor) ?? 0,
        }));
        return calculateExactSplit(totalMinor, entries);
      }
      if (method === 'PERCENT') {
        const entries = orderedSelected.map((id) => ({
          participantId: id,
          percentBps: parsePercentStringToBps(percentById[id] ?? '') ?? 0,
        }));
        return calculatePercentageSplit(totalMinor, entries);
      }
      if (method === 'SHARES') {
        const entries = orderedSelected.map((id) => ({
          participantId: id,
          shareWeight: parseShareStringToWeight(shareById[id] ?? '') ?? 0,
        }));
        return calculateSharesSplit(totalMinor, entries);
      }
      if (method === 'ADJUSTMENT') {
        const pinned = [];
        for (const id of orderedSelected) {
          const raw = (adjAmountById[id] ?? '').trim();
          if (!raw) continue;
          const m = roundCurrencyToMinor(raw, minorPerMajor);
          if (m != null) pinned.push({ participantId: id, amountMinor: m });
        }
        return calculateAdjustmentSplit(totalMinor, orderedSelected, pinned);
      }
    } catch {
      return [];
    }
    return [];
  }, [
    method,
    totalMinor,
    orderedSelected,
    exactById,
    percentById,
    shareById,
    adjAmountById,
    minorPerMajor,
  ]);

  const taggedSet = useMemo(() => new Set(taggedFriendIds.map(String)), [taggedFriendIds]);

  const validation = useMemo(() => {
    const errors = [];
    if (totalMinor == null) errors.push('Invalid transaction total.');
    const sel = validateSelectedParticipants(selectedIds);
    if (!sel.valid) errors.push(...sel.errors);

    const align = validateEntriesMatchParticipants(
      orderedSelected.map((participantId) => ({ participantId })),
      selectedIds,
    );
    if (!align.valid) errors.push(...align.errors);

    if (totalMinor != null && results.length > 0) {
      const t = validateSplitTotal(results, totalMinor);
      if (!t.valid) errors.push(...t.errors);
    }

    if (method === 'PERCENT') {
      const entries = orderedSelected.map((id) => ({
        participantId: id,
        percentBps: parsePercentStringToBps(percentById[id] ?? '') ?? 0,
      }));
      const p = validatePercentTotal(entries);
      if (!p.valid) errors.push(...p.errors);
    }

    if (method === 'SHARES') {
      const entries = orderedSelected.map((id) => ({
        participantId: id,
        shareWeight: parseShareStringToWeight(shareById[id] ?? '') ?? 0,
      }));
      const s = validateShares(entries);
      if (!s.valid) errors.push(...s.errors);
    }

    if (method === 'ADJUSTMENT') {
      const badAmount = orderedSelected.some((id) => {
        const raw = (adjAmountById[id] ?? '').trim();
        if (!raw) return false;
        return roundCurrencyToMinor(raw, minorPerMajor) == null;
      });
      if (badAmount) {
        errors.push('Enter a valid amount for each filled field, or leave blank for auto split.');
      } else {
        const roster = orderedSelected.map((id) => {
          const raw = (adjAmountById[id] ?? '').trim();
          if (!raw) return { participantId: id, pinnedMinor: null };
          return {
            participantId: id,
            pinnedMinor: roundCurrencyToMinor(raw, minorPerMajor),
          };
        });
        const a = validateAdjustmentSplit(totalMinor ?? 0, roster);
        if (!a.valid) errors.push(...a.errors);
      }
    }

    if (method === 'EXACT' && totalMinor != null && orderedSelected.length > 0) {
      const incomplete = orderedSelected.some((id) => {
        const m = roundCurrencyToMinor(exactById[id] ?? '', minorPerMajor);
        return m == null;
      });
      if (incomplete) errors.push('Enter an exact amount for every selected participant.');
    }

    if (splitDirection === 'NOTHING_OUTSTANDING' && results.some((r) => r.amountMinor > 0)) {
        errors.push('Choose who owes whom when the split has a positive amount.');
    }

    const clash = results.filter((r) => taggedSet.has(String(r.participantId)));
    if (clash.length > 0) {
      const names = clash
        .map((r) => participants.find((p) => String(p.id) === r.participantId)?.name || r.participantId)
        .join(', ');
      errors.push(`Already tagged on this transaction: ${names}. Remove those tags first.`);
    }

    if (splitNote.length > SPLIT_NOTE_MAX_LEN) {
      errors.push(`Note must be at most ${SPLIT_NOTE_MAX_LEN} characters.`);
    }

    return { valid: errors.length === 0, errors };
  }, [
    totalMinor,
    selectedIds,
    orderedSelected,
    results,
    method,
    percentById,
    shareById,
    adjAmountById,
    exactById,
    minorPerMajor,
    splitDirection,
    taggedSet,
    participants,
    splitNote,
  ]);

  const sumResultsMinor = useMemo(
    () => results.reduce((a, r) => a + r.amountMinor, 0),
    [results],
  );

  const deltaMinor = totalMinor != null ? totalMinor - sumResultsMinor : 0;

  const handleApply = async () => {
    if (!validation.valid || !onApplySplit || applying) return;
    const note = splitNote.trim();
    await onApplySplit({
      results,
      direction: splitDirection,
      ...(note ? { note } : {}),
      linkedTagsByParticipant,
    });
  };

  return (
    <div className="split-txn-form">
      <h4 className="split-txn-form__title">Split transaction</h4>

      <div className="split-txn-form__total">
        <span>Total</span>
        <strong>
          {totalMinor != null ? formatInr(totalMinor, minorPerMajor) : '—'}
        </strong>
      </div>

      <label className="split-txn-label">Who owes whom</label>
      <select
        className="split-txn-direction"
        value={splitDirection}
        onChange={(e) => setSplitDirection(e.target.value)}
        aria-label="Who owes whom for tags created from split"
      >
        <option value="NOTHING_OUTSTANDING">Nothing outstanding</option>
        <option value="I_OWE">I owe them</option>
        <option value="OWES_ME">They owe me</option>
        <option value="SETTLEMENT">Settlement</option>
      </select>

      <label className="split-txn-label" htmlFor="split-txn-note">
        Note <span className="split-txn-label-optional">(optional)</span>
      </label>
      <textarea
        id="split-txn-note"
        className="split-txn-note"
        rows={3}
        maxLength={SPLIT_NOTE_MAX_LEN}
        placeholder="Same note on each tag created by this split"
        value={splitNote}
        onChange={(e) => setSplitNote(e.target.value)}
        aria-describedby="split-txn-note-hint"
      />
      <p id="split-txn-note-hint" className="split-txn-note-hint">
        {splitNote.length}/{SPLIT_NOTE_MAX_LEN}
      </p>

      <div className="split-txn-method-row" role="tablist" aria-label="Split method">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`split-txn-method${method === m.id ? ' split-txn-method--active' : ''}`}
            onClick={() => setMethod(m.id)}
            role="tab"
            aria-selected={method === m.id}
            aria-label={m.label}
            title={m.label}
          >
            <SplitMethodIcon methodId={m.id} />
            <span className="split-txn-method__label">{m.label}</span>
          </button>
        ))}
      </div>

      <label className="split-txn-label" htmlFor="split-txn-participant-search">
        Participants
      </label>
      {participants.length > 0 && (
        <div className="split-txn-participant-search-wrap">
          <input
            id="split-txn-participant-search"
            type="search"
            enterKeyHint="done"
            className="split-txn-participant-search"
            placeholder="Search by name…"
            value={participantSearch}
            onChange={(e) => setParticipantSearch(e.target.value)}
            onKeyDown={handleParticipantSearchKeyDown}
            autoComplete="off"
            spellCheck={false}
            aria-label="Filter friends by name"
          />
          {orderedSelected.length > 0 && (
            <div className="split-txn-participant-chips" role="list" aria-label="Selected participants">
              {orderedSelected.map((id) => {
                const p = participants.find((x) => String(x.id) === id);
                const label = p?.name || id;
                return (
                  <span key={id} className="split-txn-chip" role="listitem">
                    <span className="split-txn-chip__name" title={label}>
                      {label}
                    </span>
                    <button
                      type="button"
                      className="split-txn-chip__remove"
                      aria-label={`Remove ${label}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggleFriend(id);
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className="split-txn-friend-list">
        {participants.length === 0 ? (
          <p className="empty">No friends yet.</p>
        ) : filteredParticipants.length === 0 ? (
          <p className="empty split-txn-friend-empty">
            No friends match &ldquo;{participantSearch.trim()}&rdquo;. Try a different name or clear the
            search.
          </p>
        ) : (
          filteredParticipants.map((f) => {
            const id = String(f.id);
            const checked = selectedIds.includes(id);
            return (
              <button
                key={id}
                type="button"
                className={`split-txn-friend-row settlement-link-item split-txn-friend-item${
                  checked ? ' settlement-link-item--selected' : ''
                }`}
                onClick={() => toggleFriend(id)}
                aria-pressed={checked}
                aria-label={`${checked ? 'Deselect' : 'Select'} ${f.name}`}
              >
                <span className="split-txn-friend-name">{f.name}</span>
              </button>
            );
          })
        )}
      </div>

      {method === 'EXACT' && orderedSelected.length > 0 && (
        <div className="split-txn-grid">
          {orderedSelected.map((id) => {
            const p = participants.find((x) => String(x.id) === id);
            return (
              <label key={id} className="field split-txn-field">
                <span>{p?.name || id}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={exactById[id] ?? ''}
                  onChange={(e) => setExactById((prev) => ({ ...prev, [id]: e.target.value }))}
                  placeholder="0.00"
                />
              </label>
            );
          })}
        </div>
      )}

      {method === 'PERCENT' && orderedSelected.length > 0 && (
        <div className="split-txn-grid">
          {orderedSelected.map((id) => {
            const p = participants.find((x) => String(x.id) === id);
            return (
              <label key={id} className="field split-txn-field">
                <span>{p?.name || id}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={percentById[id] ?? ''}
                  onChange={(e) => setPercentById((prev) => ({ ...prev, [id]: e.target.value }))}
                  placeholder="0"
                />
              </label>
            );
          })}
        </div>
      )}

      {method === 'SHARES' && orderedSelected.length > 0 && (
        <div className="split-txn-grid">
          {orderedSelected.map((id) => {
            const p = participants.find((x) => String(x.id) === id);
            return (
              <label key={id} className="field split-txn-field">
                <span>{p?.name || id}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={shareById[id] ?? ''}
                  onChange={(e) => setShareById((prev) => ({ ...prev, [id]: e.target.value }))}
                  placeholder="1"
                />
              </label>
            );
          })}
        </div>
      )}

      {method === 'ADJUSTMENT' && orderedSelected.length > 0 && (
        <div className="split-txn-grid">
          {orderedSelected.map((id) => {
            const p = participants.find((x) => String(x.id) === id);
            return (
              <label key={id} className="field split-txn-field">
                <span>{p?.name || id}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={adjAmountById[id] ?? ''}
                  onChange={(e) =>
                    setAdjAmountById((prev) => ({ ...prev, [id]: e.target.value }))
                  }
                  placeholder="Auto"
                  aria-label={`${p?.name || id} fixed amount; leave blank for auto`}
                />
              </label>
            );
          })}
        </div>
      )}

      {orderedSelected.length > 0 && results.length > 0 && (
        <div className="split-txn-results">
          <p className="split-txn-results__title">Final split</p>
          <ul className="split-txn-results__list">
            {results.map((r) => {
              const p = participants.find((x) => String(x.id) === r.participantId);
              return (
                <li key={r.participantId}>
                  <span>{p?.name || r.participantId}</span>
                  <strong>{formatInr(r.amountMinor, minorPerMajor)}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {splitDirection === 'SETTLEMENT' && orderedSelected.length > 0 && (
        <div className="split-txn-settlement-section">
          <p className="split-txn-label">Link settled entries <span className="split-txn-label-optional">(optional)</span></p>
          {orderedSelected.map((id) => {
            const p = participants.find((x) => String(x.id) === id);
            const loading = linkableLoadingByParticipant[id];
            const entries = linkableByParticipant[id] || [];
            const selectedLinked = linkedTagsByParticipant[id] || [];
            return (
              <div key={id} className="split-txn-settlement-participant">
                <p className="split-txn-settlement-participant__name">{p?.name || id}</p>
                {loading ? (
                  <p className="status">Loading linkable entries…</p>
                ) : entries.length === 0 ? (
                  <p className="empty">No linkable entries for {p?.name || id}.</p>
                ) : (
                  <div className="settlement-link-list">
                    {entries.map((tag) => {
                      const isSelected = selectedLinked.includes(String(tag.id));
                      const dirClass =
                        tag.direction === 'I_OWE'
                          ? 'settlement-dir-pill--owe'
                          : tag.direction === 'OWES_ME'
                            ? 'settlement-dir-pill--me'
                            : 'settlement-dir-pill--none';
                      return (
                        <label
                          key={tag.id}
                          className={`settlement-link-item${isSelected ? ' settlement-link-item--selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="settlement-link-item__check"
                            checked={isSelected}
                            onChange={() => {
                              const next = isSelected
                                ? selectedLinked.filter((x) => x !== String(tag.id))
                                : [...selectedLinked, String(tag.id)];
                              setLinkedTagsByParticipant((prev) => ({ ...prev, [id]: next }));
                            }}
                          />
                          <div className="settlement-link-item__body">
                            <div className="settlement-link-item__top">
                              <span className="settlement-link-item__date">
                                {formatSettlementDate(tag.transaction?.transactionDate)}
                              </span>
                              <span className={`settlement-dir-pill ${dirClass}`}>
                                {tag.direction === 'I_OWE'
                                  ? 'I owe'
                                  : tag.direction === 'OWES_ME'
                                    ? 'They owe me'
                                    : 'Nothing'}
                              </span>
                              <span className="settlement-link-item__amount">
                                ₹{formatSettlementAmount(tag.amount)}
                              </span>
                            </div>
                            {tag.transaction?.upiName ? (
                              <span className="settlement-link-item__upi">
                                {tag.transaction.upiName}
                              </span>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`split-txn-delta${deltaMinor === 0 ? ' split-txn-delta--ok' : ''}${
          deltaMinor < 0 ? ' split-txn-delta--over' : ''
        }`}
      >
        {totalMinor == null || orderedSelected.length === 0 ? (
          <span>Select participants to preview the split.</span>
        ) : deltaMinor === 0 ? (
          <span>Balanced</span>
        ) : deltaMinor > 0 ? (
          <span>
            Left to assign: {formatInr(deltaMinor, minorPerMajor)}
          </span>
        ) : (
          <span>
            Over by {formatInr(-deltaMinor, minorPerMajor)}
          </span>
        )}
      </div>

      {!validation.valid && validation.errors.length > 0 && (
        <ul className="split-txn-errors">
          {validation.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="split-txn-actions">
        <button
          type="button"
          className="secondary"
          disabled={!validation.valid || !onApplySplit || applying}
          onClick={() => void handleApply()}
        >
          {applying ? 'Adding…' : 'Add split'}
        </button>
      </div>
    </div>
  );
}
