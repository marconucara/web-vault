// The pin rewrite that the upgrade action commits (adr/0039-*.md).
//
// The manifest under test is the ADOPTER's file, so the property that matters
// most is not "the version changed" but "nothing else did".
import { describe, expect, it } from 'vitest';
import { readPin, setPin, tagStatus, TAG, makeUpgradeHandler } from '../functions/upgrade.js';
import { isSafeNotePath } from '../functions/commit.js';

// A realistic shell manifest, verbatim from SETUP.md.
const MANIFEST = `{
  "name": "vault-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wv dev",
    "build": "wv build"
  },
  "dependencies": {
    "web-vault": "github:marconucara/web-vault#v0.6.1"
  },
  "packageManager": "yarn@4.5.3"
}
`;

describe('reading the pin', () => {
  it('finds the pinned version', () => {
    expect(readPin(MANIFEST)).toBe('0.6.1');
  });

  it('tolerates the github: prefix being absent', () => {
    expect(readPin('"web-vault": "marconucara/web-vault#v1.2.3"')).toBe('1.2.3');
  });

  it('returns null when there is no resolvable pin', () => {
    // A branch pin, a local link, or a missing dependency are all "nothing to
    // upgrade" rather than an error to raise.
    expect(readPin('"web-vault": "github:marconucara/web-vault#main"')).toBe(null);
    expect(readPin('"web-vault": "portal:../web-vault"')).toBe(null);
    expect(readPin('{}')).toBe(null);
  });
});

describe('rewriting the pin', () => {
  it('changes the version and NOTHING else, byte for byte', () => {
    const out = setPin(MANIFEST, '0.7.0');
    expect(out).toBe(MANIFEST.replace('#v0.6.1', '#v0.7.0'));
    // Stated separately because this is the whole point: a JSON round trip
    // would reformat the adopter's file and turn one line into a full diff.
    expect(out.split('\n').length).toBe(MANIFEST.split('\n').length);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('leaves other dependencies untouched', () => {
    const src = MANIFEST.replace(
      '"web-vault": "github:marconucara/web-vault#v0.6.1"',
      '"web-vault": "github:marconucara/web-vault#v0.6.1",\n    "other": "github:marconucara/web-vault#v0.1.0"'
    );
    const out = setPin(src, '0.7.0');
    expect(out).toContain('"other": "github:marconucara/web-vault#v0.1.0"');
    expect(out).toContain('"web-vault": "github:marconucara/web-vault#v0.7.0"');
  });

  it('refuses a malformed target version', () => {
    for (const bad of ['main', 'v0.7.0', '0.7', '', null, '0.7.0; rm -rf /']) {
      expect(setPin(MANIFEST, bad)).toBe(null);
    }
  });

  it('returns null when there is no pin to rewrite', () => {
    expect(setPin('{"dependencies":{}}', '0.7.0')).toBe(null);
  });

  it('normalises a prefix-less pin rather than leaving it ambiguous', () => {
    const out = setPin('"web-vault": "marconucara/web-vault#v1.2.3"', '1.3.0');
    expect(out).toBe('"web-vault": "github:marconucara/web-vault#v1.3.0"');
  });
});

describe('validating the target tag', () => {
  const reply = (status) => async () => ({ ok: status >= 200 && status < 300, status });

  it('accepts a tag the framework repository publishes', async () => {
    expect(await tagStatus('0.7.0', reply(200))).toBe(TAG.published);
  });

  // GitHub refuses any REST call with no User-Agent — a browser sets one, a
  // Worker does not. Nothing observed the request before, so a missing header
  // read as "your release is not published" and no test could see it.
  it('sends a User-Agent, which GitHub refuses the request without', async () => {
    let sent = /** @type {any} */ (null);
    const fake = async (_url, init) => { sent = init; return { ok: true, status: 200 }; };
    await tagStatus('0.7.0', fake);
    // Asserted before the header, so "never called" cannot pass as "has a UA".
    expect(sent).not.toBe(null);
    expect(sent.headers['User-Agent']).toBeTruthy();
  });

  it('asks the framework repository, not the adopter vault', async () => {
    let url = null;
    const fake = async (u) => { url = u; return { ok: true, status: 200 }; };
    await tagStatus('0.7.0', fake);
    expect(url).toContain('marconucara/web-vault');
    expect(url).toContain('/git/ref/tags/v0.7.0');
  });

  it('reads a 404 as the tag being absent', async () => {
    expect(await tagStatus('99.0.0', reply(404))).toBe(TAG.absent);
  });

  // The three below are the distinction the endpoint turns on: the question went
  // unanswered, which is not the same as the tag being missing.
  it('does not read a refused request as an absent tag', async () => {
    expect(await tagStatus('0.7.0', reply(403))).toBe(TAG.unknown);
  });

  it('does not read a server error as an absent tag', async () => {
    expect(await tagStatus('0.7.0', reply(500))).toBe(TAG.unknown);
  });

  it('does not read a network failure as an absent tag', async () => {
    // Network down must not become "upgrade to an unverified tag" either.
    const fake = async () => { throw new Error('offline'); };
    expect(await tagStatus('0.7.0', fake)).toBe(TAG.unknown);
  });

  it('does not call out at all for a malformed version', async () => {
    let called = false;
    const fake = async () => { called = true; return { ok: true, status: 200 }; };
    expect(await tagStatus('main', fake)).toBe(TAG.absent);
    expect(called).toBe(false);
  });
});

// The guard's purpose is that nothing is written until the target is confirmed.
// Widening the failure handling must not open a path around that, so these drive
// the whole handler and watch for writes rather than only reading the status.
describe('the endpoint when the tag lookup does not answer', () => {
  const env = { GITHUB_TOKEN: 't', GITHUB_REPO: 'someone/vault', GITHUB_BRANCH: 'main' };
  const request = { json: async () => ({ version: '0.9.9' }) };

  // Records every non-GET call so a write cannot pass unnoticed.
  const harness = (tagReply) => {
    const writes = [];
    const fetchImpl = async (url, init = {}) => {
      if (String(url).includes('/git/ref/tags/')) return tagReply;
      if (init.method && init.method !== 'GET') writes.push(init.method);
      return { ok: true, status: 200, json: async () => ({ content: '', sha: 'x' }) };
    };
    return { writes, fetchImpl };
  };

  it('answers 502 and writes nothing when the request is refused', async () => {
    const { writes, fetchImpl } = harness({ ok: false, status: 403 });
    const original = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
      const res = await makeUpgradeHandler()({ request, env });
      expect(res.status).toBe(502);
      // The old message named the one cause that was not happening.
      expect((await res.json()).error).not.toContain('not published');
      expect(writes).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('still answers 400 "not published" for a genuinely absent tag', async () => {
    const { writes, fetchImpl } = harness({ ok: false, status: 404 });
    const original = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
      const res = await makeUpgradeHandler()({ request, env });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('not published');
      expect(writes).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('the note endpoint still cannot reach the shell', () => {
  // The upgrade exists as a separate endpoint precisely so this stays true
  // (adr/0039-*.md). If this test ever fails, the note editor has gained write
  // access to the build configuration.
  it('rejects the shell manifest and anything else under a dot directory', () => {
    expect(isSafeNotePath('.web/package.json')).toBe(false);
    expect(isSafeNotePath('.web/wrangler.toml')).toBe(false);
    expect(isSafeNotePath('.github/workflows/deploy.yml')).toBe(false);
    expect(isSafeNotePath('notes/../.web/package.json')).toBe(false);
  });
});
