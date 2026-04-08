import { calculateAdjustmentSplit } from './splitEngine';
import type {
  AdjustmentEntry,
  AdjustmentRosterEntry,
  PercentEntry,
  ShareEntry,
  SplitResult,
  ValidationResult,
} from './splitTypes';

function err(errors: string[]): ValidationResult {
  return { valid: false, errors };
}

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

export function validateSelectedParticipants(ids: string[]): ValidationResult {
  const errors: string[] = [];
  if (ids.length === 0) {
    errors.push('Select at least one participant.');
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push('Duplicate participants are not allowed.');
      break;
    }
    seen.add(id);
  }
  return errors.length ? err(errors) : ok();
}

export function validateSplitTotal(entries: SplitResult[], total: number): ValidationResult {
  const t = Math.trunc(total);
  const sum = entries.reduce((a, e) => a + Math.trunc(e.amountMinor), 0);
  if (sum !== t) {
    return err([`Split amounts (${sum} minor) must equal the transaction total (${t} minor).`]);
  }
  return ok();
}

/** Accepts 100.00% as exactly 10_000 bps; allows ±1 bps float tolerance from UI rounding. */
export function validatePercentTotal(
  entries: PercentEntry[],
  toleranceBps: number = 0,
): ValidationResult {
  if (entries.length === 0) {
    return err(['Enter percentages for each participant.']);
  }
  const sum = entries.reduce((a, e) => a + Math.max(0, Math.trunc(e.percentBps)), 0);
  if (Math.abs(sum - 10_000) > toleranceBps) {
    return err([`Percentages must sum to 100% (is ${(sum / 100).toFixed(2)}%).`]);
  }
  if (entries.some((e) => e.percentBps < 0)) {
    return err(['Percentages cannot be negative.']);
  }
  return ok();
}

export function validateShares(entries: ShareEntry[]): ValidationResult {
  if (entries.length === 0) {
    return err(['Enter a share for each participant.']);
  }
  if (entries.some((e) => !Number.isFinite(e.shareWeight) || e.shareWeight <= 0)) {
    return err(['Each share must be a positive number.']);
  }
  return ok();
}

/**
 * Validates adjustment mode using the full roster (one row per participant in order).
 * `pinnedMinor === null` means that row absorbs an equal share of the remainder.
 */
export function validateAdjustmentSplit(total: number, roster: AdjustmentRosterEntry[]): ValidationResult {
  const errors: string[] = [];
  const t = Math.trunc(total);
  if (roster.length === 0) {
    return err(['Select participants before using adjustments.']);
  }

  const participantIds = roster.map((r) => r.participantId);
  const seen = new Set<string>();
  for (const id of participantIds) {
    if (seen.has(id)) {
      errors.push('Duplicate participants in adjustment roster.');
      return err(errors);
    }
    seen.add(id);
  }

  const pinnedRows = roster.filter((r) => r.pinnedMinor != null) as Array<
    AdjustmentRosterEntry & { pinnedMinor: number }
  >;
  const floaters = roster.filter((r) => r.pinnedMinor == null);

  for (const row of pinnedRows) {
    const v = Math.trunc(row.pinnedMinor);
    if (v < 0) {
      errors.push('Pinned amounts cannot be negative.');
      return err(errors);
    }
  }

  const pinned: AdjustmentEntry[] = pinnedRows.map((r) => ({
    participantId: r.participantId,
    amountMinor: Math.trunc(r.pinnedMinor),
  }));

  const sumPinned = pinned.reduce((a, p) => a + p.amountMinor, 0);

  if (floaters.length === 0) {
    if (sumPinned !== t) {
      errors.push(
        sumPinned > t
          ? 'All participants are fixed, but pinned amounts exceed the total.'
          : 'All participants are fixed; pinned amounts must exactly match the total.',
      );
    }
    return errors.length ? err(errors) : ok();
  }

  if (sumPinned > t) {
    errors.push('Pinned amounts exceed the total; remaining share would be negative.');
    return err(errors);
  }

  const remainder = t - sumPinned;
  if (remainder < 0) {
    errors.push('Pinned amounts exceed the total.');
    return err(errors);
  }

  const results = calculateAdjustmentSplit(t, participantIds, pinned);
  if (results.some((r) => r.amountMinor < 0)) {
    errors.push('A participant would be below zero after applying adjustments.');
  }

  return errors.length ? err(errors) : ok();
}

/** Ensures split line items only reference the given participant ids (e.g. after deselecting someone). */
export function validateEntriesMatchParticipants(
  entries: Array<{ participantId: string }>,
  selectedIds: string[],
): ValidationResult {
  const set = new Set(selectedIds);
  const orphan = entries.find((e) => !set.has(e.participantId));
  if (orphan) {
    return err(['Inputs reference a participant that is no longer selected.']);
  }
  return ok();
}
