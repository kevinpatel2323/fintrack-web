/** Minor units (e.g. paise per rupee). */
export const MINOR_PER_MAJOR = 100;

export type SplitResult = {
  participantId: string;
  amountMinor: number;
};

export type SplitEntry = {
  participantId: string;
  amountMinor: number;
};

/** Basis points: 10_000 = 100%. */
export type PercentEntry = {
  participantId: string;
  percentBps: number;
};

/** Positive integer weight (e.g. 1, 2, 3). Parsed from user decimals in the UI layer. */
export type ShareEntry = {
  participantId: string;
  shareWeight: number;
};

/** Fixed overrides only; unfixed participants absorb equal remainder. */
export type AdjustmentEntry = {
  participantId: string;
  amountMinor: number;
};

/**
 * Full roster row for adjustment validation: `pinnedMinor === null` means this participant
 * receives an equal share of the remainder after pinned amounts.
 */
export type AdjustmentRosterEntry = {
  participantId: string;
  pinnedMinor: number | null;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export type SplitMethod = 'EQUAL' | 'EXACT' | 'PERCENT' | 'SHARES' | 'ADJUSTMENT';

export type SerializedSplitPayloadV1 = {
  v: 1;
  method: SplitMethod;
  payerId: string;
  participantIds: string[];
  totalMinor: number;
  results: SplitResult[];
  /** Method-specific inputs for round-tripping the form (all minor where monetary). */
  meta?: Record<string, unknown>;
};

export const SPLIT_META_PREFIX = 'fintrack.split:v1:';
