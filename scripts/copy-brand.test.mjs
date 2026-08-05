import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyBrand } from './copy-brand.mjs';
import { faviconDataUri } from './brand-inline.mjs';

const BRAND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'brand');

let tmp, dist, publicDir;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'wv-brand-'));
  dist = join(tmp, 'dist');
  publicDir = join(tmp, 'public');
  mkdirSync(dist);
  mkdirSync(publicDir);
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('copyBrand', () => {
  it('copies every shipped icon into dist', () => {
    const { copied } = copyBrand({ dist, publicDir });
    // Everything the head tags and the manifest reference must land in dist.
    for (const name of [
      'favicon.ico',
      'favicon.svg',
      'apple-touch-icon.png',
      'safari-pinned-tab.svg',
      'site.webmanifest',
      'icon-192.png',
      'icon-512.png',
      'icon-maskable-512.png',
    ]) {
      expect(copied, name).toContain(name);
      expect(existsSync(join(dist, name)), name).toBe(true);
    }
  });

  it('deploys the whole brand folder except the authoring notes', () => {
    const { copied } = copyBrand({ dist, publicDir });
    const shipped = readdirSync(BRAND_DIR).filter((n) => n !== 'ASSETS.md');
    expect(copied.sort()).toEqual(shipped.sort());
    expect(existsSync(join(dist, 'ASSETS.md'))).toBe(false);
  });

  it('keeps a consumer public/ override instead of clobbering it', () => {
    // `vite build` copies the consumer's public/ into dist before this step.
    writeFileSync(join(publicDir, 'favicon.svg'), '<svg id="theirs"/>');
    writeFileSync(join(dist, 'favicon.svg'), '<svg id="theirs"/>');

    const { copied, kept } = copyBrand({ dist, publicDir });

    expect(kept).toContain('favicon.svg');
    expect(copied).not.toContain('favicon.svg');
    expect(readFileSync(join(dist, 'favicon.svg'), 'utf8')).toBe('<svg id="theirs"/>');
    // Overriding one file does not cost the adopter the rest of the set.
    expect(copied).toContain('favicon.ico');
  });

  it('places one favicon inside /shared/, the Access-bypassed prefix', () => {
    copyBrand({ dist, publicDir });
    // Exactly one copy for all share pages — not one per /shared/<uuid>/.
    expect(readFileSync(join(dist, 'shared', 'favicon.svg'))).toEqual(
      readFileSync(join(BRAND_DIR, 'favicon.svg')),
    );
    expect(readdirSync(join(dist, 'shared'))).toEqual(['favicon.svg']);
  });

  it('mirrors a consumer override into /shared/ too', () => {
    writeFileSync(join(publicDir, 'favicon.svg'), '<svg id="theirs"/>');
    writeFileSync(join(dist, 'favicon.svg'), '<svg id="theirs"/>');

    copyBrand({ dist, publicDir });

    expect(readFileSync(join(dist, 'shared', 'favicon.svg'), 'utf8')).toBe('<svg id="theirs"/>');
  });

  it('copies files byte-identically', () => {
    copyBrand({ dist, publicDir });
    expect(readFileSync(join(dist, 'favicon.svg'))).toEqual(readFileSync(join(BRAND_DIR, 'favicon.svg')));
  });
});

describe('faviconDataUri', () => {
  // Used by the 404 only; every other page links a file.
  it('encodes the same source SVG the app links as a file', () => {
    const uri = faviconDataUri();
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    // A data: URI is inert only if it carries no raw quote that could close the
    // href attribute of the <link> it is inlined into.
    expect(uri).not.toMatch(/["'<>]/);
    // Decoding returns the committed asset, so the two cannot drift.
    const decoded = decodeURIComponent(uri.slice('data:image/svg+xml,'.length));
    expect(decoded).toBe(readFileSync(join(BRAND_DIR, 'favicon.svg'), 'utf8').replace(/\n\s*/g, ''));
  });
});
