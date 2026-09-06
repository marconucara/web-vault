import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Drift refusal under `wv dev` (adr/0050-*.md, adr/0036-*.md).
//
// Dev writes to the vault on disk instead of committing to GitHub, so it needs
// its own preflight — without one, the whole mechanism would be untestable
// locally and would only ever engage in production.
//
// The reference it compares against is the file's own hash on disk — the same
// identity `content.json` recorded when it was generated. Anchoring to HEAD
// instead would never see anything: a dev write creates no git commit, so HEAD
// stays put while the file changes underneath it.

/** A vault repo with one committed note. */
function vault() {
  const dir = mkdtempSync(join(tmpdir(), 'wv-dev-drift-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
    });
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, 'n.md'), '# N\n\ncommitted body\n');
  git('add', '.');
  git('commit', '-qm', 'first');
  return {
    dir,
    // What content.json records for the note: the hash of the file as it stands.
    baseOf: (name = 'n.md') =>
      execFileSync('git', ['hash-object', join(dir, name)], { encoding: 'utf8' }).trim(),
  };
}

/** Drive the middleware's request handler directly. */
async function post(handler, files) {
  const req = {
    url: '/api/commit',
    method: 'POST',
    on(evt, cb) {
      if (evt === 'data') cb(JSON.stringify({ message: 'm', files }));
      if (evt === 'end') cb();
      return this;
    },
  };
  let status = 0;
  let body = '';
  const res = {
    statusCode: 200,
    setHeader() {},
    end(payload) {
      status = res.statusCode;
      body = payload;
    },
  };
  await handler(req, res, () => {});
  return { status, body: JSON.parse(body) };
}

/** Load `commitDev` with VAULT_DIR pointed at `dir`, and pull out its handler. */
async function middleware(dir) {
  vi.resetModules();
  vi.doMock('../scripts/paths.mjs', async (orig) => ({
    ...(await orig()),
    VAULT_DIR: dir,
  }));
  const { commitDev } = await import('./commit-dev.mjs');
  let handler = null;
  commitDev().configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
  return handler;
}

describe('drift refusal in local dev', () => {
  beforeEach(() => vi.resetModules());

  it('writes the note when the edit started from what the vault holds', async () => {
    const v = vault();
    try {
      const handler = await middleware(v.dir);
      const r = await post(handler, [{ path: 'n.md', body: '\nmine\n', baseSha: v.baseOf() }]);
      expect(r.status).toBe(200);
      expect(readFileSync(join(v.dir, 'n.md'), 'utf8')).toContain('mine');
    } finally {
      rmSync(v.dir, { recursive: true, force: true });
    }
  });

  it('refuses a second commit made from a stale base, and returns what is there now', async () => {
    // The scenario the surface exists for: two browsers on one note. The first
    // commit lands; the second still holds the older base.
    const v = vault();
    try {
      const handler = await middleware(v.dir);
      const base = v.baseOf();
      await post(handler, [{ path: 'n.md', body: '\nfirst browser\n', baseSha: base }]);

      const r = await post(handler, [{ path: 'n.md', body: '\nsecond browser\n', baseSha: base }]);
      expect(r.status).toBe(409);
      expect(r.body.reason).toBe('drift');
      expect(r.body.drifted[0].path).toBe('n.md');
      expect(r.body.drifted[0].remote).toContain('first browser');
      // The second browser's text was NOT written.
      expect(readFileSync(join(v.dir, 'n.md'), 'utf8')).not.toContain('second browser');
    } finally {
      rmSync(v.dir, { recursive: true, force: true });
    }
  });

  it('accepts the retry once it carries the base it was shown', async () => {
    const v = vault();
    try {
      const handler = await middleware(v.dir);
      const base = v.baseOf();
      await post(handler, [{ path: 'n.md', body: '\nfirst\n', baseSha: base }]);
      const refused = await post(handler, [{ path: 'n.md', body: '\nsecond\n', baseSha: base }]);

      const r = await post(handler, [
        { path: 'n.md', body: '\nresolved\n', baseSha: refused.body.drifted[0].remoteSha },
      ]);
      expect(r.status).toBe(200);
      expect(readFileSync(join(v.dir, 'n.md'), 'utf8')).toContain('resolved');
    } finally {
      rmSync(v.dir, { recursive: true, force: true });
    }
  });

  it('refuses when the note was changed outside the app', async () => {
    // Edited in Obsidian, by a sync client, by anything: the base the client
    // holds is stale, and writing over it would lose that change. HEAD is not
    // involved — the file simply is not what the editor started from.
    const v = vault();
    try {
      const stale = v.baseOf();
      writeFileSync(join(v.dir, 'n.md'), '# N\n\nedited outside the app\n');
      const handler = await middleware(v.dir);
      const r = await post(handler, [{ path: 'n.md', body: '\nfrom the app\n', baseSha: stale }]);
      expect(r.status).toBe(409);
      expect(r.body.drifted[0].remote).toContain('edited outside the app');
    } finally {
      rmSync(v.dir, { recursive: true, force: true });
    }
  });

  it('protects an untracked note too', async () => {
    // A note created in the client is not in git, but it is in the vault — and
    // a second browser can overwrite it just as easily. Hashing the file rather
    // than reading HEAD is what makes this case covered at all.
    const v = vault();
    try {
      writeFileSync(join(v.dir, 'fresh.md'), '# Fresh\n\nfirst\n');
      const handler = await middleware(v.dir);
      const base = v.baseOf('fresh.md');
      await post(handler, [{ path: 'fresh.md', body: '\nbrowser one\n', baseSha: base }]);
      const r = await post(handler, [{ path: 'fresh.md', body: '\nbrowser two\n', baseSha: base }]);
      expect(r.status).toBe(409);
      expect(r.body.drifted[0].remote).toContain('browser one');
    } finally {
      rmSync(v.dir, { recursive: true, force: true });
    }
  });

  it('does not check an edit that carries no base', async () => {
    const v = vault();
    try {
      const handler = await middleware(v.dir);
      const r = await post(handler, [{ path: 'n.md', body: '\nno base\n' }]);
      expect(r.status).toBe(200);
    } finally {
      rmSync(v.dir, { recursive: true, force: true });
    }
  });
});
