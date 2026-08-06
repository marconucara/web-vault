// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { pollForVersion, requestUpgrade } from './upgradeAction.js';

afterEach(() => vi.restoreAllMocks());

// Real Response objects rather than duck-typed stubs: the code under test reads
// `ok` and `json()`, and a real one keeps the fixtures honest about both.
const ok = (body) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const fail = (status, body) =>
  new Response(body === undefined ? 'not json' : JSON.stringify(body), {
    status,
    headers: { 'content-type': body === undefined ? 'text/plain' : 'application/json' },
  });

describe('requesting the upgrade', () => {
  it('asks for the target version and returns the result', async () => {
    const fetchMock = vi.fn(async () => ok({ committed: true, from: '0.6.1', to: '0.7.0' }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await requestUpgrade('0.7.0');
    expect(res.to).toBe('0.7.0');
    const [url, init] = /** @type {any[]} */ (fetchMock.mock.calls[0]);
    expect(url).toBe('/api/upgrade');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ version: '0.7.0' });
  });

  it('raises the endpoint error rather than reporting a silent success', async () => {
    vi.stubGlobal('fetch', async () =>
      fail(403, { error: 'This deployment has no write access configured.' })
    );
    await expect(requestUpgrade('0.7.0')).rejects.toThrow(/no write access/);
  });

  it('still raises when the body is not JSON', async () => {
    // An error page instead of a payload must not be swallowed into a success.
    vi.stubGlobal('fetch', async () => fail(502));
    await expect(requestUpgrade('0.7.0')).rejects.toThrow(/502/);
  });
});

describe('waiting for the rebuild to land', () => {
  it('resolves once the deployment reports the target version', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return ok({ frameworkVersion: calls < 3 ? '0.6.1' : '0.7.0' });
    };
    const { promise } = pollForVersion('0.7.0', { intervalMs: 0, fetchImpl });
    await expect(promise).resolves.toEqual({ live: true });
    expect(calls).toBe(3);
  });

  it('keeps waiting while the deployment is unreachable mid-rebuild', async () => {
    // A failed probe is not a failed upgrade: the site is very likely briefly
    // down while it redeploys.
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls < 3) throw new Error('connection refused');
      return ok({ frameworkVersion: '0.7.0' });
    };
    const { promise } = pollForVersion('0.7.0', { intervalMs: 0, fetchImpl });
    await expect(promise).resolves.toEqual({ live: true });
  });

  it('gives up with a stated timeout rather than waiting forever', async () => {
    // A rebuild can fail. An unbounded poll would leave the panel claiming
    // "building" for the rest of the session.
    let t = 0;
    const { promise } = pollForVersion('0.7.0', {
      intervalMs: 0,
      timeoutMs: 100,
      now: () => (t += 60),
      fetchImpl: async () => ok({ frameworkVersion: '0.6.1' }),
    });
    await expect(promise).resolves.toEqual({ live: false, timedOut: true });
  });

  it('never reports live for a version that was never served', async () => {
    let t = 0;
    const { promise } = pollForVersion('0.7.0', {
      intervalMs: 0,
      timeoutMs: 100,
      now: () => (t += 60),
      // The rebuild failed: the old version keeps being served.
      fetchImpl: async () => ok({ frameworkVersion: '0.6.1' }),
    });
    expect((await promise).live).toBe(false);
  });

  it('stops probing once cancelled', async () => {
    let calls = 0;
    const handle = pollForVersion('0.7.0', {
      intervalMs: 5,
      fetchImpl: async () => {
        calls += 1;
        return ok({ frameworkVersion: '0.6.1' });
      },
    });
    await Promise.resolve();
    handle.cancel();
    const after = calls;
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBe(after);
  });
});
