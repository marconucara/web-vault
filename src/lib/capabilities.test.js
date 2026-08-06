// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { loadCapabilities, __test } from './capabilities.js';

// The store is module state; reset between cases so one does not seed the next.
beforeEach(() => __test.reset());
afterEach(() => vi.restoreAllMocks());

const stub = (impl) => vi.stubGlobal('fetch', vi.fn(impl));

describe('reading what the deployment can do', () => {
  it('starts at "not asked yet", which is not "cannot write"', () => {
    // The third state is load-bearing: it lets a caller hold back a read-only
    // fallback that would otherwise flash on every load.
    expect(__test.snapshot().canWrite).toBe(null);
  });

  it('reports a writable deployment', async () => {
    stub(async () => ({ ok: true, json: async () => ({ canWrite: true }) }));
    await loadCapabilities();
    expect(__test.snapshot().canWrite).toBe(true);
  });

  it('lands on read-only when the probe throws', async () => {
    // A deployment we cannot ask about is one we must not offer write actions
    // for: an action that then fails is worse than one never shown.
    stub(async () => { throw new Error('offline'); });
    await loadCapabilities();
    expect(__test.snapshot().canWrite).toBe(false);
  });

  it('lands on read-only on a non-2xx answer', async () => {
    stub(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await loadCapabilities();
    expect(__test.snapshot().canWrite).toBe(false);
  });

  it('treats a missing or junk field as read-only, not as permission', async () => {
    stub(async () => ({ ok: true, json: async () => ({}) }));
    await loadCapabilities();
    expect(__test.snapshot().canWrite).toBe(false);
  });

  it('coalesces concurrent probes into one request', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ canWrite: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([loadCapabilities(), loadCapabilities(), loadCapabilities()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never sends the token anywhere: it only ever asks', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ canWrite: true }) }));
    vi.stubGlobal('fetch', fetchMock);
    await loadCapabilities();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = /** @type {any[]} */ (fetchMock.mock.calls[0]);
    expect(url).toBe(__test.URL_PATH);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(JSON.stringify(init ?? {})).not.toMatch(/token/i);
  });
});
