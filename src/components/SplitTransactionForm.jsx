import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import { Plus, X } from 'lucide-react';
import SettlementAllocator from './SettlementAllocator.jsx';
import {
  Amount, Avatar, Button, Combobox, ErrorMessage, FormControl, TabButtons, TextInput,
} from './ui';
import { fetchGroups } from '../services/friendsApi.js';
import { ledgerDirectionPhrase } from '../utils/ledgerParties.js';
import { draftToAllocations } from '../utils/settlementAllocation.js';
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
import { useIsCompact } from '../styles/breakpoints.js';
import './transaction-detail/SplitTransactionForm.css';

const METHODS = [
  { value: 'EQUAL', label: 'Equal' },
  { value: 'EXACT', label: 'Exact' },
  { value: 'PERCENT', label: 'Percent' },
  { value: 'SHARES', label: 'Shares' },
  { value: 'ADJUSTMENT', label: 'Adjust' },
];

// Same four directions (and payload values) as before; the common case first.
const DIRECTIONS = [
  { value: 'OWES_ME', label: 'They owe me' },
  { value: 'I_OWE', label: 'I owe them' },
  { value: 'SETTLEMENT', label: 'Settlement' },
  { value: 'NOTHING_OUTSTANDING', label: 'Nothing outstanding' },
];

const SPLIT_NOTE_MAX_LEN = 500;

/** Money in minor units, with paise shown only when there are any. */
function Money({ minor, minorPerMajor, tone = 'inherit' }) {
  return (
    <Amount
      value={minor / minorPerMajor}
      decimals={minor % minorPerMajor !== 0 ? 2 : 0}
      tone={tone}
    />
  );
}

/**
 * Split one transaction between friends. The maths (splitEngine), the checks
 * (splitValidation) and the payload handed to `onApplySplit` are unchanged;
 * this is only the form around them.
 *
 * Optional, for hosts that put the apply button in their own footer (the
 * manage sheet does): `hideApplyButton`, `onStateChange({ canApply })` and a
 * ref with `apply()`.
 *
 * @param {object} props
 * @param {number} props.totalAmount Transaction total in major units (e.g. rupees).
 * @param {{ id: string, name: string }[]} props.participants All friends to pick from.
 * @param {string[]} props.taggedFriendIds Friend ids that already have a tag on this transaction.
 * @param {string} [props.defaultDirection] Initial direction (same values as the tag form).
 * @param {boolean} [props.applying]
 * @param {number} [props.minorPerMajor]
 * @param {(args: { results: import('../utils/splitTypes.ts').SplitResult[], direction: string, note?: string, allocationsByParticipant: Record<string, object[]>, groupByParticipant: Record<string, string> }) => void | Promise<void>} [props.onApplySplit]
 * @param {boolean} [props.hideApplyButton]
 * @param {(state: { canApply: boolean }) => void} [props.onStateChange]
 */
const SplitTransactionForm = forwardRef(function SplitTransactionForm({
  totalAmount,
  participants,
  taggedFriendIds = [],
  defaultDirection = 'OWES_ME',
  applying = false,
  minorPerMajor = 100,
  onApplySplit,
  hideApplyButton = false,
  onStateChange,
}, ref) {
  const isMobile = useIsCompact();
  const [method, setMethod] = useState('EQUAL');
  const [selectedIds, setSelectedIds] = useState([]);
  const [splitDirection, setSplitDirection] = useState(defaultDirection);
  const [exactById, setExactById] = useState({});
  const [percentById, setPercentById] = useState({});
  const [shareById, setShareById] = useState({});
  const [adjAmountById, setAdjAmountById] = useState({});
  const [splitNote, setSplitNote] = useState('');
  // Settlement only: per participant, which of their entries this payment pays
  // off and by how much (see SettlementAllocator), and whether that is valid.
  const [allocationDrafts, setAllocationDrafts] = useState({});
  const [allocationStatuses, setAllocationStatuses] = useState({});
  // Not a settlement: per participant, one of their entry groups to put the
  // new entry in ("Ketul's wedding"), and each friend's groups to pick from.
  const [groupByParticipant, setGroupByParticipant] = useState({});
  const [groupsByFriend, setGroupsByFriend] = useState({});
  const requestedGroups = useRef(new Set());
  // After an apply: the people just split with. Once they all show up as
  // tagged, the split went through and the form starts over.
  const [pendingResetIds, setPendingResetIds] = useState(null);

  useEffect(() => {
    setSplitDirection(defaultDirection);
  }, [defaultDirection]);

  const totalMinor = useMemo(() => {
    const n = Number(totalAmount);
    if (!Number.isFinite(n)) return null;
    return roundCurrencyToMinor(n, minorPerMajor);
  }, [totalAmount, minorPerMajor]);

  const toggleFriend = useCallback((id) => {
    setPendingResetIds(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  const orderedSelected = useMemo(() => {
    const order = participants.map((p) => String(p.id));
    return selectedIds.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [selectedIds, participants]);

  const nameOf = useCallback(
    (id) => participants.find((p) => String(p.id) === String(id))?.name || id,
    [participants],
  );

  const results = useMemo(() => {
    if (totalMinor == null || orderedSelected.length === 0) return [];
    if (splitDirection === 'NOTHING_OUTSTANDING') {
      return orderedSelected.map((id) => ({ participantId: id, amountMinor: 0 }));
    }
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
    splitDirection,
  ]);

  const taggedSet = useMemo(() => new Set(taggedFriendIds.map(String)), [taggedFriendIds]);

  const validation = useMemo(() => {
    const errors = [];
    // Shown elsewhere (the summary line), so left out of the inline list.
    const quiet = [];
    if (totalMinor == null) errors.push('Invalid transaction total.');
    const sel = validateSelectedParticipants(selectedIds);
    if (!sel.valid) {
      errors.push(...sel.errors);
      if (selectedIds.length === 0) quiet.push(...sel.errors);
    }

    const align = validateEntriesMatchParticipants(
      orderedSelected.map((participantId) => ({ participantId })),
      selectedIds,
    );
    if (!align.valid) errors.push(...align.errors);

    if (splitDirection !== 'NOTHING_OUTSTANDING') {
      if (totalMinor != null && results.length > 0) {
        const t = validateSplitTotal(results, totalMinor);
        if (!t.valid) {
          errors.push(...t.errors);
          quiet.push(...t.errors);
        }
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

    if (splitDirection === 'SETTLEMENT') {
      for (const id of orderedSelected) {
        const draft = allocationDrafts[id];
        const status = allocationStatuses[id];
        if (!draft || Object.keys(draft).length === 0 || !status || status.valid) continue;
        const name = participants.find((p) => String(p.id) === id)?.name || id;
        errors.push(`${name}: ${status.errors[0]}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      shown: errors.filter((e) => !quiet.includes(e)),
    };
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
    allocationDrafts,
    allocationStatuses,
  ]);

  const sumResultsMinor = useMemo(
    () => results.reduce((a, r) => a + r.amountMinor, 0),
    [results],
  );

  const deltaMinor = totalMinor != null ? totalMinor - sumResultsMinor : 0;

  useEffect(() => {
    if (splitDirection === 'SETTLEMENT') return;
    for (const id of orderedSelected) {
      if (requestedGroups.current.has(id)) continue;
      requestedGroups.current.add(id);
      fetchGroups(id)
        .then((res) => setGroupsByFriend((prev) => ({ ...prev, [id]: res?.data || [] })))
        .catch(() => setGroupsByFriend((prev) => ({ ...prev, [id]: [] })));
    }
  }, [orderedSelected, splitDirection]);

  const groupPickIds = splitDirection === 'SETTLEMENT'
    ? []
    : orderedSelected.filter((id) => groupsByFriend[id]?.length > 0);

  const canApply = validation.valid && Boolean(onApplySplit) && !applying;

  const handleApply = async () => {
    if (!validation.valid || !onApplySplit || applying) return;
    const note = splitNote.trim();
    const allocationsByParticipant = {};
    if (splitDirection === 'SETTLEMENT') {
      for (const id of orderedSelected) {
        const draft = allocationDrafts[id];
        if (draft && Object.keys(draft).length > 0) {
          allocationsByParticipant[id] = draftToAllocations(draft);
        }
      }
    }
    const groupPicks = {};
    for (const id of groupPickIds) {
      if (groupByParticipant[id]) groupPicks[id] = groupByParticipant[id];
    }
    const appliedIds = orderedSelected.slice();
    await onApplySplit({
      results,
      direction: splitDirection,
      ...(note ? { note } : {}),
      allocationsByParticipant,
      groupByParticipant: groupPicks,
    });
    setPendingResetIds(appliedIds);
  };

  // Start over once the split has landed, so the people just tagged don't
  // stay selected and trip "Already tagged on this transaction".
  useEffect(() => {
    if (!pendingResetIds || pendingResetIds.length === 0) return;
    if (!pendingResetIds.every((id) => taggedSet.has(String(id)))) return;
    setSelectedIds([]);
    setExactById({});
    setPercentById({});
    setShareById({});
    setAdjAmountById({});
    setSplitNote('');
    setAllocationDrafts({});
    setAllocationStatuses({});
    setGroupByParticipant({});
    setPendingResetIds(null);
  }, [pendingResetIds, taggedSet]);

  const applyRef = useRef(handleApply);
  applyRef.current = handleApply;
  useImperativeHandle(ref, () => ({ apply: () => applyRef.current() }), []);

  useEffect(() => {
    onStateChange?.({ canApply });
  }, [canApply, onStateChange]);

  const tracksAmounts = splitDirection !== 'NOTHING_OUTSTANDING';

  const addOptions = useMemo(
    () => participants
      .filter((p) => !selectedIds.includes(String(p.id)))
      .map((p) => {
        const tagged = taggedSet.has(String(p.id));
        return {
          label: p.name,
          value: String(p.id),
          disabled: tagged,
          description: tagged ? 'Already on this transaction' : undefined,
        };
      }),
    [participants, selectedIds, taggedSet],
  );

  function amountInput(id, name, size) {
    if (!tracksAmounts) return null;
    if (method === 'EXACT') {
      const raw = exactById[id] ?? '';
      return (
        <TextInput
          className="txs-person__input"
          size={size}
          inputMode="decimal"
          prefix={<span className="txs-affix">₹</span>}
          placeholder="0.00"
          aria-label={`${name} amount`}
          value={raw}
          invalid={raw.trim() !== '' && roundCurrencyToMinor(raw, minorPerMajor) == null}
          onChange={(e) => setExactById((prev) => ({ ...prev, [id]: e.target.value }))}
        />
      );
    }
    if (method === 'PERCENT') {
      const raw = percentById[id] ?? '';
      return (
        <TextInput
          className="txs-person__input"
          size={size}
          inputMode="decimal"
          suffix={<span className="txs-affix">%</span>}
          placeholder="0"
          aria-label={`${name} percent`}
          value={raw}
          invalid={raw.trim() !== '' && parsePercentStringToBps(raw) == null}
          onChange={(e) => setPercentById((prev) => ({ ...prev, [id]: e.target.value }))}
        />
      );
    }
    if (method === 'SHARES') {
      const raw = shareById[id] ?? '';
      return (
        <TextInput
          className="txs-person__input"
          size={size}
          inputMode="decimal"
          placeholder="1"
          aria-label={`${name} shares`}
          value={raw}
          invalid={raw.trim() !== '' && parseShareStringToWeight(raw) == null}
          onChange={(e) => setShareById((prev) => ({ ...prev, [id]: e.target.value }))}
        />
      );
    }
    if (method === 'ADJUSTMENT') {
      const raw = adjAmountById[id] ?? '';
      return (
        <TextInput
          className="txs-person__input"
          size={size}
          inputMode="decimal"
          prefix={<span className="txs-affix">₹</span>}
          placeholder="Auto"
          aria-label={`${name} fixed amount; leave blank for auto`}
          value={raw}
          invalid={raw.trim() !== '' && roundCurrencyToMinor(raw, minorPerMajor) == null}
          onChange={(e) => setAdjAmountById((prev) => ({ ...prev, [id]: e.target.value }))}
        />
      );
    }
    return null;
  }

  const balanced = deltaMinor === 0;
  const hasPeople = orderedSelected.length > 0;

  let summary;
  if (!tracksAmounts) {
    summary = 'No amount is tracked for these tags.';
  } else if (totalMinor == null || !hasPeople) {
    summary = 'Select participants to preview the split.';
  } else {
    summary = (
      <>
        <Money minor={sumResultsMinor} minorPerMajor={minorPerMajor} />
        {' of '}
        <Money minor={totalMinor} minorPerMajor={minorPerMajor} />
        {' assigned'}
        {deltaMinor > 0 && (
          <>
            {' · '}
            <Money minor={deltaMinor} minorPerMajor={minorPerMajor} />
            {' left to assign'}
          </>
        )}
        {deltaMinor < 0 && (
          <>
            {' · over by '}
            <Money minor={-deltaMinor} minorPerMajor={minorPerMajor} />
          </>
        )}
      </>
    );
  }
  const summaryOff = tracksAmounts && hasPeople && totalMinor != null && !balanced;

  if (isMobile) {
    return (
      <SplitFormPhone
        directions={DIRECTIONS}
        methods={METHODS}
        splitDirection={splitDirection}
        setSplitDirection={setSplitDirection}
        tracksAmounts={tracksAmounts}
        method={method}
        setMethod={setMethod}
        orderedSelected={orderedSelected}
        nameOf={nameOf}
        results={results}
        amountInput={amountInput}
        minorPerMajor={minorPerMajor}
        toggleFriend={toggleFriend}
        participants={participants}
        addOptions={addOptions}
        allocationDrafts={allocationDrafts}
        setAllocationDrafts={setAllocationDrafts}
        setAllocationStatuses={setAllocationStatuses}
        groupPickIds={groupPickIds}
        groupsByFriend={groupsByFriend}
        groupByParticipant={groupByParticipant}
        setGroupByParticipant={setGroupByParticipant}
        splitNote={splitNote}
        setSplitNote={setSplitNote}
        summary={summary}
        summaryOff={summaryOff}
        errors={hasPeople ? validation.shown : []}
        hideApplyButton={hideApplyButton}
        applying={applying}
        canApply={canApply}
        onApply={() => void handleApply()}
      />
    );
  }

  return (
    <div className="txs-form">
      <FormControl
        type="select"
        label="Who owes whom"
        options={DIRECTIONS}
        value={splitDirection}
        onChange={(e) => setSplitDirection(e.target.value)}
      />

      {tracksAmounts && (
        <div className="txs-field">
          <span className="txs-label">Split method</span>
          <TabButtons
            fluid
            aria-label="Split method"
            options={METHODS}
            value={method}
            onChange={setMethod}
          />
        </div>
      )}

      <div className="txs-field">
        <span className="txs-label">Participants</span>
        {hasPeople && (
          <ul className="txs-people" aria-label="Selected participants">
            {orderedSelected.map((id) => {
              const name = nameOf(id);
              const amountMinor = results.find((r) => r.participantId === id)?.amountMinor;
              const showComputed = tracksAmounts && method !== 'EXACT' && amountMinor != null;
              return (
                <li key={id} className={`txs-person${tracksAmounts && method !== 'EQUAL' ? ' has-input' : ''}`}>
                  <Avatar label={name} size="lg" aria-hidden />
                  <span className="txs-person__text">
                    <span className="txs-person__name truncate">{name}</span>
                    <span className="txs-person__phrase truncate">
                      {ledgerDirectionPhrase(splitDirection, name)}
                    </span>
                  </span>
                  {amountInput(id, name)}
                  {showComputed && (
                    <span className="txs-person__amount">
                      <Money minor={amountMinor} minorPerMajor={minorPerMajor} />
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    icon={X}
                    label={`Remove ${name}`}
                    className="txs-person__remove"
                    onClick={() => toggleFriend(id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {participants.length === 0 ? (
          <p className="txs-muted">No friends yet.</p>
        ) : (
          <Combobox
            className="txs-add"
            options={addOptions}
            value={null}
            onChange={(value) => value != null && toggleFriend(String(value))}
            placeholder="Add person"
            prefix={Plus}
            searchPlaceholder="Search by name…"
            emptyText="No friends match"
          />
        )}
      </div>

      {splitDirection === 'SETTLEMENT' && hasPeople && (
        <div className="txs-field">
          <span className="txs-label">Apply to their entries</span>
          <p className="txs-muted">Optional. Anything not applied stays on account.</p>
          {orderedSelected.map((id) => {
            const name = nameOf(id);
            const amountMinor = results.find((r) => r.participantId === id)?.amountMinor ?? 0;
            return (
              <div key={id} className="txs-settle">
                <p className="txs-settle__name">
                  {name}
                  {' · '}
                  <Money minor={amountMinor} minorPerMajor={minorPerMajor} />
                </p>
                {amountMinor > 0 ? (
                  <SettlementAllocator
                    friendId={id}
                    friendName={name}
                    amountMinor={amountMinor}
                    draft={allocationDrafts[id] || {}}
                    onDraftChange={(draft) =>
                      setAllocationDrafts((prev) => ({ ...prev, [id]: draft }))
                    }
                    onStatusChange={(status) =>
                      setAllocationStatuses((prev) => ({ ...prev, [id]: status }))
                    }
                  />
                ) : (
                  <p className="txs-muted">Give {name || 'them'} an amount in the split first.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {groupPickIds.length > 0 && (
        <div className="txs-field">
          <span className="txs-label">Add to a group</span>
          <p className="txs-muted">Optional.</p>
          <div className="txs-groups">
            {groupPickIds.map((id) => (
              <FormControl
                key={id}
                type="select"
                label={nameOf(id)}
                options={[
                  { label: 'Not in a group', value: '' },
                  ...groupsByFriend[id].map((g) => ({ label: g.title, value: String(g.id) })),
                ]}
                value={groupByParticipant[id] || ''}
                onChange={(e) => setGroupByParticipant((prev) => ({ ...prev, [id]: e.target.value }))}
              />
            ))}
          </div>
        </div>
      )}

      <FormControl
        type="textarea"
        label={<>Note <span className="txs-optional">(optional)</span></>}
        rows={2}
        maxLength={SPLIT_NOTE_MAX_LEN}
        placeholder="Same note on each tag created by this split"
        value={splitNote}
        onChange={(e) => setSplitNote(e.target.value)}
        description={`${splitNote.length}/${SPLIT_NOTE_MAX_LEN}`}
      />

      <div className="txs-check">
        <p className={`txs-summary${summaryOff ? ' is-off' : ''}`} aria-live="polite">
          {summary}
        </p>
        {hasPeople && validation.shown.length > 0 && <ErrorMessage message={validation.shown} />}
      </div>

      {!hideApplyButton && (
        <div className="txs-actions">
          <Button
            variant="solid"
            label="Add split"
            loading={applying}
            loadingText="Adding…"
            disabled={!canApply}
            onClick={() => void handleApply()}
          />
        </div>
      )}
    </div>
  );
});

/**
 * The form on a phone. Same state and checks as the desktop form (passed in);
 * only the layout differs: 36px fields with 16px text, a compact segmented
 * method switch, person rows with the amount input at the right, and the
 * running total pinned at the bottom of the sheet, right above its buttons.
 */
function SplitFormPhone({
  directions,
  methods,
  splitDirection,
  setSplitDirection,
  tracksAmounts,
  method,
  setMethod,
  orderedSelected,
  nameOf,
  results,
  amountInput,
  minorPerMajor,
  toggleFriend,
  participants,
  addOptions,
  allocationDrafts,
  setAllocationDrafts,
  setAllocationStatuses,
  groupPickIds,
  groupsByFriend,
  groupByParticipant,
  setGroupByParticipant,
  splitNote,
  setSplitNote,
  summary,
  summaryOff,
  errors,
  hideApplyButton,
  applying,
  canApply,
  onApply,
}) {
  const hasPeople = orderedSelected.length > 0;
  return (
    <div className="txs-form txs-m">
      <FormControl
        type="select"
        size="md"
        label="Who owes whom"
        options={directions}
        value={splitDirection}
        onChange={(e) => setSplitDirection(e.target.value)}
      />

      {tracksAmounts && (
        <div className="txs-field">
          <span className="txs-label">Split method</span>
          <TabButtons
            fluid
            className="txs-m-methods"
            aria-label="Split method"
            options={methods}
            value={method}
            onChange={setMethod}
          />
        </div>
      )}

      <div className="txs-field">
        <span className="txs-label">People</span>
        {hasPeople && (
          <ul className="txs-m-people" aria-label="Selected participants">
            {orderedSelected.map((id) => {
              const name = nameOf(id);
              const amountMinor = results.find((r) => r.participantId === id)?.amountMinor;
              const input = method !== 'EQUAL' ? amountInput(id, name, 'md') : null;
              const computed = tracksAmounts && method !== 'EXACT' && amountMinor != null
                ? <Money minor={amountMinor} minorPerMajor={minorPerMajor} />
                : null;
              const phrase = ledgerDirectionPhrase(splitDirection, name);
              return (
                <li key={id} className="txs-m-person">
                  <Avatar label={name} size="xl" aria-hidden />
                  <span className="txs-m-person__text">
                    <span className="txs-m-person__name">{name}</span>
                    <span className="txs-m-person__sub">
                      {/* With an input on the right, its result reads here. */}
                      {input && computed ? <>{computed} · </> : null}
                      {phrase}
                    </span>
                  </span>
                  {input ?? (computed ? <span className="txs-m-person__amount">{computed}</span> : null)}
                  <Button
                    variant="ghost"
                    size="md"
                    icon={X}
                    label={`Remove ${name}`}
                    className="txs-m-person__remove"
                    onClick={() => toggleFriend(id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {participants.length === 0 ? (
          <p className="txs-muted">No friends yet.</p>
        ) : (
          <Combobox
            className="txs-add"
            size="md"
            options={addOptions}
            value={null}
            onChange={(value) => value != null && toggleFriend(String(value))}
            placeholder="Add person"
            prefix={Plus}
            searchPlaceholder="Search by name…"
            emptyText="No friends match"
          />
        )}
      </div>

      {splitDirection === 'SETTLEMENT' && hasPeople && (
        <div className="txs-field">
          <span className="txs-label">Apply to their entries</span>
          <p className="txs-muted">Optional. Anything not applied stays on account.</p>
          {orderedSelected.map((id) => {
            const name = nameOf(id);
            const amountMinor = results.find((r) => r.participantId === id)?.amountMinor ?? 0;
            return (
              <div key={id} className="txs-settle txs-m-settle">
                <p className="txs-settle__name">
                  {name}
                  {' · '}
                  <Money minor={amountMinor} minorPerMajor={minorPerMajor} />
                </p>
                {amountMinor > 0 ? (
                  <SettlementAllocator
                    friendId={id}
                    friendName={name}
                    amountMinor={amountMinor}
                    draft={allocationDrafts[id] || {}}
                    onDraftChange={(draft) =>
                      setAllocationDrafts((prev) => ({ ...prev, [id]: draft }))
                    }
                    onStatusChange={(status) =>
                      setAllocationStatuses((prev) => ({ ...prev, [id]: status }))
                    }
                  />
                ) : (
                  <p className="txs-muted">Give {name || 'them'} an amount in the split first.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {groupPickIds.length > 0 && (
        <div className="txs-field">
          <span className="txs-label">Add to a group</span>
          <p className="txs-muted">Optional.</p>
          <div className="txs-m-groups">
            {groupPickIds.map((id) => (
              <FormControl
                key={id}
                type="select"
                size="md"
                label={nameOf(id)}
                options={[
                  { label: 'Not in a group', value: '' },
                  ...groupsByFriend[id].map((g) => ({ label: g.title, value: String(g.id) })),
                ]}
                value={groupByParticipant[id] || ''}
                onChange={(e) => setGroupByParticipant((prev) => ({ ...prev, [id]: e.target.value }))}
              />
            ))}
          </div>
        </div>
      )}

      <FormControl
        type="textarea"
        label={<>Note <span className="txs-optional">(optional)</span></>}
        rows={2}
        maxLength={SPLIT_NOTE_MAX_LEN}
        placeholder="Same note on each tag created by this split"
        value={splitNote}
        onChange={(e) => setSplitNote(e.target.value)}
        description={`${splitNote.length}/${SPLIT_NOTE_MAX_LEN}`}
      />

      <div className="txs-m-check">
        <p className={`txs-summary${summaryOff ? ' is-off' : ''}`} aria-live="polite">
          {summary}
        </p>
        {errors.length > 0 && <ErrorMessage message={errors} />}
      </div>

      {!hideApplyButton && (
        <Button
          size="lg"
          variant="solid"
          label="Add split"
          loading={applying}
          loadingText="Adding…"
          disabled={!canApply}
          onClick={onApply}
        />
      )}
    </div>
  );
}

export default SplitTransactionForm;
