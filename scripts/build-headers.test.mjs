import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildHeaders, HEADERS_TEXT } from './build-headers.mjs';

// Parses the _headers format (a path line, then indented "Name: value" lines)
// into { path: { header: value } }, so the assertions below talk about rules
// rather than about substrings of a blob.
function parseHeaders(text) {
  const rules = {};
  let current = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = raw.trim();
      rules[current] = {};
    } else if (current) {
      const [name, ...rest] = raw.trim().split(':');
      rules[current][name.trim()] = rest.join(':').trim();
    }
  }
  return rules;
}

let tmp, dist, publicDir;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'wv-headers-'));
  dist = join(tmp, 'dist');
  publicDir = join(tmp, 'public');
  mkdirSync(dist);
  mkdirSync(publicDir);
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('buildHeaders', () => {
  it('writes dist/_headers when the consumer ships none', () => {
    const { generated } = buildHeaders({ dist, publicDir });
    expect(generated).toBe(true);
    expect(existsSync(join(dist, '_headers'))).toBe(true);
  });

  // The pairing that keeps a deploy survivable: the entry is always revalidated,
  // the content-hashed assets are cached forever. Either half alone is wrong —
  // a cached entry points at deleted chunks, and a revalidated asset set throws
  // away the whole benefit of hashing.
  it('never serves the HTML entry stale', () => {
    buildHeaders({ dist, publicDir });
    const rules = parseHeaders(readFileSync(join(dist, '_headers'), 'utf8'));
    for (const path of ['/', '/index.html']) {
      expect(rules[path], path).toBeDefined();
      expect(rules[path]['Cache-Control'], path).toBe('no-cache');
    }
  });

  it('keeps the hashed assets immutable', () => {
    buildHeaders({ dist, publicDir });
    const rules = parseHeaders(readFileSync(join(dist, '_headers'), 'utf8'));
    expect(rules['/assets/*']['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });

  it('keeps the site-wide security headers', () => {
    buildHeaders({ dist, publicDir });
    const rules = parseHeaders(readFileSync(join(dist, '_headers'), 'utf8'));
    expect(rules['/*']).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex',
    });
  });

  // The escape hatch stays: a consumer's own file wins untouched. The build
  // warns about it (see the script's CLI branch) but must not overwrite it.
  it('leaves a consumer public/_headers in charge', () => {
    writeFileSync(join(publicDir, '_headers'), '/*\n  X-Custom: 1\n');
    const { generated } = buildHeaders({ dist, publicDir });
    expect(generated).toBe(false);
    expect(existsSync(join(dist, '_headers'))).toBe(false);
  });

  it('exports the same text it writes', () => {
    buildHeaders({ dist, publicDir });
    expect(readFileSync(join(dist, '_headers'), 'utf8')).toBe(HEADERS_TEXT);
  });
});
