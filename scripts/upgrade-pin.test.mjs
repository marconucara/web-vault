// The pin rewrite that the upgrade action commits (adr/0039-*.md).
//
// The manifest under test is the ADOPTER's file, so the property that matters
// most is not "the version changed" but "nothing else did".
import { describe, expect, it } from 'vitest';
import { readPin, setPin, isPublishedTag } from '../functions/upgrade.js';
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
  it('accepts a tag the framework repository publishes', async () => {
    const fake = async () => ({ ok: true });
    expect(await isPublishedTag('0.7.0', fake)).toBe(true);
  });

  it('rejects a tag that does not exist', async () => {
    const fake = async () => ({ ok: false });
    expect(await isPublishedTag('99.0.0', fake)).toBe(false);
  });

  it('rejects rather than throws when the lookup fails', async () => {
    // Network down must not become "upgrade to an unverified tag".
    const fake = async () => { throw new Error('offline'); };
    expect(await isPublishedTag('0.7.0', fake)).toBe(false);
  });

  it('does not call out at all for a malformed version', async () => {
    let called = false;
    const fake = async () => { called = true; return { ok: true }; };
    expect(await isPublishedTag('main', fake)).toBe(false);
    expect(called).toBe(false);
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
