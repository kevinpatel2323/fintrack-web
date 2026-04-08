import type { AdjustmentEntry, SerializedSplitPayloadV1, SplitResult } from './splitTypes';
import { MINOR_PER_MAJOR, SPLIT_META_PREFIX } from './splitTypes';

/**
 * Round a major-unit decimal string or number to minor units using string parsing
 * (no float accumulation in the conversion path).
 */
export function roundCurrencyToMinor(
  value: string | number,
  minorPerMajor: number = MINOR_PER_MAJOR,
): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    if (value === 0) return 0;
    return roundCurrencyToMinor(String(value), minorPerMajor);
  }
  const s = value.trim();
  if (!s) return null;
  const neg = s.startsWith('-');
  const raw = neg ? s.slice(1) : s;
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const [intPart, frac = ''] = raw.split('.');
  const fracPadded = (frac + '00').slice(0, String(minorPerMajor).length - 1);
  const minorLen = String(minorPerMajor).length - 1;
  const fracFinal = fracPadded.padEnd(minorLen, '0').slice(0, minorLen);
  const majorMinor = parseInt(intPart, 10) * minorPerMajor + parseInt(fracFinal || '0', 10);
  if (!Number.isFinite(majorMinor)) return null;
  return neg ? -majorMinor : majorMinor;
}

/**
 * Parse user percent text (up to 4 decimal places) into basis points (10_000 = 100%).
 * Integer math: bps = floor((intPart * 10^L + frac) * 100 / 10^L).
 */
export function parsePercentStringToBps(value: string): number | null {
  const s = value.trim();
  if (!s) return null;
  const [intPart, frac = ''] = s.split('.');
  if (!/^\d+$/.test(intPart)) return null;
  if (frac && (!/^\d+$/.test(frac) || frac.length > 4)) return null;
  const L = frac.length;
  const scale = 10 ** L;
  const fracNum = L ? parseInt(frac, 10) : 0;
  const pScaled = parseInt(intPart, 10) * scale + fracNum;
  const bps = Math.floor((pScaled * 100) / scale);
  if (!Number.isFinite(bps) || bps < 0) return null;
  return bps;
}

/**
 * Parse a positive share from user text; supports decimals (scaled by 1e6) without float in storage.
 */
export function parseShareStringToWeight(value: string): number | null {
  const s = value.trim();
  if (!s) return null;
  if (!/^\d+(\.\d{0,6})?$/.test(s)) return null;
  const [intPart, frac = ''] = s.split('.');
  const frac6 = (frac + '000000').slice(0, 6);
  const w = parseInt(intPart, 10) * 1_000_000 + parseInt(frac6, 10);
  if (!Number.isFinite(w) || w <= 0) return null;
  return w;
}

export function minorToMajorString(amountMinor: number, minorPerMajor: number = MINOR_PER_MAJOR): string {
  const neg = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const whole = Math.floor(abs / minorPerMajor);
  const frac = abs % minorPerMajor;
  const fracStr = String(minorPerMajor + frac).slice(1);
  return `${neg ? '-' : ''}${whole}.${fracStr}`;
}

/** Normalize minor amount: integer clamp (caller ensures minorPerMajor alignment). */
export function normalizeMoneyMinor(amountMinor: number): number {
  if (!Number.isFinite(amountMinor)) return 0;
  return Math.trunc(amountMinor);
}

/** Alias for {@link normalizeMoneyMinor}. */
export const normalizeMoney = normalizeMoneyMinor;

/** Convert major-unit input to minor units (alias of {@link roundCurrencyToMinor}). */
export const roundCurrency = roundCurrencyToMinor;

/**
 * Distribute `remainder` extra minor units across the first `remainder` slots (each +1),
 * after everyone already has `baseEach`.
 */
function applyRemainderDeterministic(
  orderedIds: string[],
  baseEach: number,
  remainder: number,
): SplitResult[] {
  const n = orderedIds.length;
  if (n === 0) return [];
  const r = Math.max(0, remainder);
  return orderedIds.map((participantId, i) => ({
    participantId,
    amountMinor: baseEach + (i < r ? 1 : 0),
  }));
}

/** Prefer +1 on earlier participants; if leftover > n, repeat passes in order. */
function addMinorRemainderToOrderedBases(baseAmounts: number[], leftover: number): number[] {
  const n = baseAmounts.length;
  if (n === 0) return baseAmounts;
  const out = [...baseAmounts];
  let left = Math.max(0, leftover);
  let i = 0;
  while (left > 0) {
    out[i % n] += 1;
    left -= 1;
    i += 1;
  }
  return out;
}

export function calculateEqualSplit(total: number, participantIds: string[]): SplitResult[] {
  const t = normalizeMoneyMinor(total);
  const ids = [...participantIds];
  const n = ids.length;
  if (n === 0) return [];
  if (t === 0) return ids.map((participantId) => ({ participantId, amountMinor: 0 }));

  const base = Math.floor(t / n);
  const remainder = t - base * n;
  return applyRemainderDeterministic(ids, base, remainder);
}

export function calculateExactSplit(total: number, entries: { participantId: string; amountMinor: number }[]): SplitResult[] {
  const t = normalizeMoneyMinor(total);
  void t;
  return entries.map(({ participantId, amountMinor }) => ({
    participantId,
    amountMinor: normalizeMoneyMinor(amountMinor),
  }));
}

export function calculatePercentageSplit(
  total: number,
  entries: { participantId: string; percentBps: number }[],
): SplitResult[] {
  const t = normalizeMoneyMinor(total);
  const n = entries.length;
  if (n === 0) return [];
  if (t === 0) return entries.map((e) => ({ participantId: e.participantId, amountMinor: 0 }));

  const floors = entries.map((e) => {
    const p = Math.max(0, Math.trunc(e.percentBps));
    return Math.floor((t * p) / 10_000);
  });
  const sumFloors = floors.reduce((a, b) => a + b, 0);
  const remainder = Math.max(0, t - sumFloors);
  const adjusted = addMinorRemainderToOrderedBases(floors, remainder);
  return entries.map((e, i) => ({
    participantId: e.participantId,
    amountMinor: adjusted[i] ?? 0,
  }));
}

export function calculateSharesSplit(
  total: number,
  entries: { participantId: string; shareWeight: number }[],
): SplitResult[] {
  const t = normalizeMoneyMinor(total);
  const n = entries.length;
  if (n === 0) return [];
  if (t === 0) return entries.map((e) => ({ participantId: e.participantId, amountMinor: 0 }));

  const weights = entries.map((e) => Math.max(0, Math.trunc(e.shareWeight)));
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) {
    return entries.map((e) => ({ participantId: e.participantId, amountMinor: 0 }));
  }

  const floors = weights.map((w) => Math.floor((t * w) / sumW));
  const sumFloors = floors.reduce((a, b) => a + b, 0);
  const remainder = Math.max(0, t - sumFloors);
  const adjusted = addMinorRemainderToOrderedBases(floors, remainder);

  return entries.map((e, i) => ({
    participantId: e.participantId,
    amountMinor: adjusted[i] ?? 0,
  }));
}

export function calculateAdjustmentSplit(
  total: number,
  participants: string[],
  adjustedEntries: AdjustmentEntry[],
): SplitResult[] {
  const t = normalizeMoneyMinor(total);
  const order = [...participants];
  const pinnedMap = new Map<string, number>();
  for (const row of adjustedEntries) {
    pinnedMap.set(row.participantId, normalizeMoneyMinor(row.amountMinor));
  }

  const unfixed = order.filter((id) => !pinnedMap.has(id));
  const sumPinned = [...pinnedMap.values()].reduce((a, b) => a + b, 0);
  const remainder = t - sumPinned;

  if (unfixed.length === 0) {
    return order.map((participantId) => ({
      participantId,
      amountMinor: pinnedMap.get(participantId) ?? 0,
    }));
  }

  if (remainder < 0) {
    return order.map((participantId) => ({
      participantId,
      amountMinor: pinnedMap.get(participantId) ?? 0,
    }));
  }

  const base = Math.floor(remainder / unfixed.length);
  const rem = remainder - base * unfixed.length;
  const extraById = new Map<string, number>();
  unfixed.forEach((id, i) => {
    extraById.set(id, base + (i < rem ? 1 : 0));
  });

  return order.map((participantId) => ({
    participantId,
    amountMinor: (pinnedMap.get(participantId) ?? 0) + (extraById.get(participantId) ?? 0),
  }));
}

export function serializeSplitPayload(payload: SerializedSplitPayloadV1): string {
  return SPLIT_META_PREFIX + JSON.stringify(payload);
}

export function parseSplitPayload(field: string | null | undefined): SerializedSplitPayloadV1 | null {
  if (!field || !field.startsWith(SPLIT_META_PREFIX)) return null;
  try {
    const raw = JSON.parse(field.slice(SPLIT_META_PREFIX.length)) as SerializedSplitPayloadV1;
    if (raw?.v !== 1 || !raw.method || !Array.isArray(raw.results)) return null;
    return raw;
  } catch {
    return null;
  }
}
