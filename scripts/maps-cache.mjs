// Shared helpers for the persistent, cross-build Google Maps resolver cache.
//
// Why this exists: resolving Maps links happens at build time (see
// resolve-maps.mjs). From datacenter IPs (CI) Google sometimes answers 429 for
// the whole build, so a deploy can ship with unresolved links until the next
// build. To survive that, each build can READ the previous build's resolved
// data and re-fetch only what's missing.
//
// Design (provider-agnostic, no Cloudflare lock-in):
//   - The build WRITES the cache to `dist/maps-cache.json` (a normal public
//     static file). It is ENCRYPTED (AES-256-GCM), so publishing it leaks
//     nothing: the file is opaque without the key.
//   - `MAP_CACHE_KEY` is the master switch. No key -> no cache is written at all
//     (never plaintext) and none can be read (can't decrypt).
//   - The build READS the cache from `<SITE_URL>/maps-cache.json`. `SITE_URL`
//     is the deploy origin; if unset we fall back to the host-provided var
//     (Cloudflare `CF_PAGES_URL`, Vercel, Netlify), so on those hosts only
//     `MAP_CACHE_KEY` needs setting.
//
// Only Node's built-in modules — no dependencies.
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CACHE_FILENAME = 'maps-cache.json';

// The 32-byte AES key, or null if MAP_CACHE_KEY is unset (caching disabled).
// Accepts a base64 32-byte key (what `yarn maps:genkey` prints); any other
// string is hashed to 32 bytes so an arbitrary passphrase also works.
export function getCacheKey() {
  const raw = process.env.MAP_CACHE_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length === 32) return buf;
  return createHash('sha256').update(raw, 'utf8').digest();
}

// AES-256-GCM. The auth tag makes tampering fail the decrypt instead of
// yielding garbage. Output is a small self-describing JSON envelope.
export function encryptJSON(obj, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const pt = Buffer.from(JSON.stringify(obj), 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ct.toString('base64'),
  });
}

// Returns the decrypted object, or null on any problem (wrong key, tampered,
// not our format). Never throws.
export function decryptJSON(str, key) {
  try {
    const o = JSON.parse(str);
    if (!o || o.alg !== 'aes-256-gcm') return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(o.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(o.tag, 'base64'));
    const pt = Buffer.concat([decipher.update(Buffer.from(o.data, 'base64')), decipher.final()]);
    return JSON.parse(pt.toString('utf8'));
  } catch {
    return null;
  }
}

// Deploy origin: explicit SITE_URL wins, else the host's own build var.
// Returns null if none is set. A bare host (no scheme) gets https://.
export function resolveSiteBase() {
  const base = (
    process.env.SITE_URL ||
    process.env.CF_PAGES_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.URL || // Netlify
    ''
  ).trim();
  if (!base) return null;
  const withScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  return withScheme.replace(/\/+$/, '');
}

// Where to read the previous cache from. An explicit MAP_CACHE_URL wins and may
// be an http(s) URL, a file:// URL, or a plain filesystem path (relative to the
// cwd) — the last two let you test the whole flow locally with no dev server.
// Otherwise it's <site>/maps-cache.json derived from SITE_URL / host var.
export function cacheSource() {
  const override = (process.env.MAP_CACHE_URL || '').trim();
  if (override) return override;
  const base = resolveSiteBase();
  return base ? `${base}/${CACHE_FILENAME}` : null;
}

// A source is a local file unless it's an http(s) URL (Node's fetch can't read
// file:// or bare paths, so those go through fs).
function isFileSource(src) {
  return !/^https?:\/\//i.test(src);
}

async function readSource(src) {
  if (isFileSource(src)) {
    const path = src.startsWith('file://') ? fileURLToPath(src) : resolve(process.cwd(), src);
    return readFile(path, 'utf8'); // throws ENOENT if missing -> handled by caller
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${src}?_=${Date.now()}`, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Read + decrypt the previous build's cache (from URL or local file). Returns {}
// on any failure (missing, unreachable, wrong key): the build then just resolves
// everything, so this is never fatal.
export async function fetchRemoteCache(key) {
  if (!key) return {};
  const src = cacheSource();
  if (!src) return {};
  let text;
  try {
    text = await readSource(src);
  } catch (e) {
    console.log(`[maps] cache: not read from ${src} (${String((e && e.message) || e)}); starting fresh`);
    return {};
  }
  const obj = decryptJSON(text, key);
  if (!obj) {
    console.log('[maps] cache: found but could not decrypt (wrong MAP_CACHE_KEY?)');
    return {};
  }
  console.log(`[maps] cache: ${Object.keys(obj).length} entr(ies) loaded from ${src}`);
  return obj;
}
