// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// The build this "site" was made with. Stubbed so each case states the running
// version explicitly.
let frameworkVersion = '0.6.1';
vi.mock('../content.js', () => ({
  get build() {
    return { frameworkVersion, short: 'abcdef1', repo: 'someone/their-vault' };
  },
  notes: [],
}));

const tag = (name) => ({ name });

let mod;
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  frameworkVersion = '0.6.1';
  mod = await import('./upgrade.js');
});
afterEach(() => vi.unstubAllGlobals());

const stubTags = (payload, { ok = true } = {}) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: async () => payload,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('version selection', () => {
  it('orders numerically, not lexicographically', () => {
    // The API returns tags in lexicographic order, where v0.10.0 precedes
    // v0.6.1. Taking the first entry — or comparing as strings — starts
    // failing silently at the tenth minor, long after this ships.
    expect(mod.highestVersion([tag('v0.10.0'), tag('v0.6.1'), tag('v0.9.9')])).toBe('0.10.0');
    expect(mod.compareVersions('0.10.0', '0.6.1')).toBe(1);
    expect(mod.highestVersion([tag('v1.0.0'), tag('v0.99.99')])).toBe('1.0.0');
    expect(mod.highestVersion([tag('v0.6.9'), tag('v0.6.10')])).toBe('0.6.10');
  });

  it('ignores tags that are not vX.Y.Z', () => {
    expect(mod.highestVersion([tag('v0.7.0-rc.1'), tag('v0.6.1')])).toBe('0.6.1');
    expect(mod.highestVersion([tag('latest'), tag('v1.2'), tag('nightly')])).toBe(null);
    expect(mod.parseVersion('v0.7.0-rc.1')).toBe(null);
  });

  it('survives a payload that is not a tag list', () => {
    expect(mod.highestVersion(null)).toBe(null);
    expect(mod.highestVersion({ message: 'API rate limit exceeded' })).toBe(null);
    expect(mod.highestVersion([{}, { name: null }])).toBe(null);
  });
});

describe('strictly newer', () => {
  it('reports only a genuinely newer version', () => {
    expect(mod.isNewer('0.7.0', '0.6.1')).toBe(true);
    expect(mod.isNewer('0.6.1', '0.6.1')).toBe(false);
  });

  it('stays quiet when the build is ahead of every tag', () => {
    // A maintainer running `main` after tagging. With an inequality test this
    // is where a permanent, wrong "update available" would appear.
    expect(mod.isNewer('0.6.1', '0.7.0')).toBe(false);
  });

  it('claims nothing when either side is unknown', () => {
    // A build predating adr/0037-*.md carries no version.
    expect(mod.isNewer('0.7.0', '')).toBe(false);
    expect(mod.isNewer('', '0.6.1')).toBe(false);
  });
});

describe('throttling', () => {
  it('fetches on the first check and not again within the hour', async () => {
    const f = stubTags([tag('v0.7.0')]);
    await mod.checkForUpdate();
    expect(f).toHaveBeenCalledTimes(1);
    await mod.checkForUpdate();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('fetches again once an hour has passed', async () => {
    const f = stubTags([tag('v0.7.0')]);
    await mod.checkForUpdate({ now: 0 });
    await mod.checkForUpdate({ now: mod.__test.AUTO_INTERVAL_MS + 1 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('refuses a manual re-check inside a minute, allows it after', async () => {
    const f = stubTags([tag('v0.7.0')]);
    await mod.checkForUpdate();
    const at = Date.now();
    await mod.checkForUpdate({ force: true, now: at + 1000 });
    expect(f).toHaveBeenCalledTimes(1);
    await mod.checkForUpdate({ force: true, now: at + mod.__test.MANUAL_INTERVAL_MS + 1 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('persists the timestamp so a reload does not re-fetch', async () => {
    const f = stubTags([tag('v0.7.0')]);
    await mod.checkForUpdate();
    expect(f).toHaveBeenCalledTimes(1);
    // Same localStorage, fresh module: what a page reload looks like.
    vi.resetModules();
    const reloaded = await import('./upgrade.js');
    await reloaded.checkForUpdate();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('queries the framework repository, not the adopter vault', async () => {
    // build.repo is 'someone/their-vault' in the stub above; querying it would
    // compare against the adopter's own tags.
    const f = stubTags([tag('v0.7.0')]);
    await mod.checkForUpdate();
    const url = f.mock.calls[0][0];
    expect(url).toContain('marconucara/web-vault');
    expect(url).not.toContain('their-vault');
  });
});

describe('failure is silent', () => {
  const expectQuiet = async () => {
    await mod.checkForUpdate();
    const stored = JSON.parse(localStorage.getItem(mod.__test.KEY));
    // The timestamp is still recorded, so a hard-down endpoint is not retried
    // on every render; but no version is claimed.
    expect(stored.checkedAt).toBeGreaterThan(0);
    expect(stored.latest).toBeUndefined();
  };

  it('swallows a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expectQuiet();
  });

  it('swallows a rate-limited response', async () => {
    stubTags({ message: 'API rate limit exceeded' }, { ok: false });
    await expectQuiet();
  });

  it('swallows a malformed payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    }));
    await expectQuiet();
  });

  it('swallows a tag list with nothing usable in it', async () => {
    stubTags([tag('nightly'), tag('latest')]);
    await expectQuiet();
  });
});

describe('release link', () => {
  it('points at the repository tree at that tag', () => {
    // Not /releases/tag/..., which is near-empty with no GitHub Release
    // published — and adr/0037-*.md publishes none.
    expect(mod.releaseUrl('0.7.0')).toBe('https://github.com/marconucara/web-vault/tree/v0.7.0');
  });
});
