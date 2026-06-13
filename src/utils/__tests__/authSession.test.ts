import { describe, expect, it } from 'vitest';
import {
  fromSession,
  initialAuthState,
  isExpired,
  msUntilExpiry,
  unauthenticated,
} from '../authSession';

describe('authSession', () => {
  it('starts in the loading state', () => {
    expect(initialAuthState).toEqual({ status: 'loading', expiresAt: null });
  });

  it('maps an authenticated session response', () => {
    expect(
      fromSession({ authenticated: true, expiresAt: '2099-01-01T00:00:00Z' }),
    ).toEqual({ status: 'authenticated', expiresAt: '2099-01-01T00:00:00Z' });
  });

  it('maps an authenticated response with no expiry', () => {
    expect(fromSession({ authenticated: true })).toEqual({
      status: 'authenticated',
      expiresAt: null,
    });
  });

  it('maps an unauthenticated session response', () => {
    expect(fromSession({ authenticated: false })).toEqual({
      status: 'unauthenticated',
      expiresAt: null,
    });
  });

  it('builds an unauthenticated state', () => {
    expect(unauthenticated()).toEqual({
      status: 'unauthenticated',
      expiresAt: null,
    });
  });

  describe('isExpired', () => {
    it('is true once the expiry has passed', () => {
      expect(isExpired('2000-01-01T00:00:00Z')).toBe(true);
    });
    it('is false before expiry', () => {
      expect(isExpired('2999-01-01T00:00:00Z')).toBe(false);
    });
    it('treats null/garbage as not expired', () => {
      expect(isExpired(null)).toBe(false);
      expect(isExpired('not-a-date')).toBe(false);
    });
  });

  describe('msUntilExpiry', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    it('returns the remaining milliseconds', () => {
      expect(msUntilExpiry('2026-01-01T00:01:00Z', now)).toBe(60_000);
    });
    it('clamps past expiries to zero', () => {
      expect(msUntilExpiry('2025-01-01T00:00:00Z', now)).toBe(0);
    });
    it('returns null when there is no expiry', () => {
      expect(msUntilExpiry(null, now)).toBeNull();
    });
  });
});
