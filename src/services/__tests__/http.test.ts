import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, apiFetch } from '../http.js';

describe('http service', () => {
  let dispatched: string[];

  beforeEach(() => {
    dispatched = [];
    // The util runs in a node-env test, so stub the browser globals it touches.
    (globalThis as { window?: unknown }).window = {
      dispatchEvent: (e: { type: string }) => {
        dispatched.push(e.type);
        return true;
      },
    };
    (globalThis as { CustomEvent?: unknown }).CustomEvent = class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { window?: unknown }).window;
  });

  it('defaults API_BASE to /api', () => {
    expect(API_BASE).toBe('/api');
  });

  it('dispatches fintrack:unauthorized on a 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 401 }) as never;
    await apiFetch('/api/anything');
    expect(dispatched).toContain('fintrack:unauthorized');
  });

  it('does not dispatch on a successful response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 200 }) as never;
    await apiFetch('/api/anything');
    expect(dispatched).toEqual([]);
  });

  it('returns the raw response untouched', async () => {
    const response = { status: 204 };
    globalThis.fetch = vi.fn().mockResolvedValue(response) as never;
    expect(await apiFetch('/api/anything')).toBe(response);
  });

  it('passes through method and body without forcing a Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    globalThis.fetch = fetchMock as never;
    const body = new FormData();
    await apiFetch('/api/upload', { method: 'POST', body });
    expect(fetchMock).toHaveBeenCalledWith('/api/upload', {
      method: 'POST',
      body,
    });
  });
});
