import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// MAPS_CACHE_DIR redirects the on-disk resolver cache into a temp dir, and must
// be set before the module is imported (CACHE_FILE is computed at module load).
const CACHE_DIR = mkdtempSync(join(tmpdir(), 'wv-maps-'));
process.env.MAPS_CACHE_DIR = CACHE_DIR;
process.env.MAPS_RETRIES = '0'; // keep the blocked-path tests fast
delete process.env.MAP_CACHE_KEY; // no cross-build cache in these tests

const { extractCoords, isBlockedUrl, isUsableEntry, resolveMapsForBodies } = await import(
  './resolve-maps.mjs'
);
const { encryptJSON } = await import('./maps-cache.mjs');

const CACHE_FILE = join(CACHE_DIR, '.maps-cache.json');
const readDiskCache = () => (existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {});

// Google's rate-limit interstitial: no Open Graph data, and a `continue=` that
// echoes back the maps URL we asked for (coordinates included).
const SORRY_URL =
  'https://www.google.com/sorry/index?continue=https://www.google.it/maps/@45.4642,9.19,17z';

describe('maps resolver — blocked responses (ADR 0028)', () => {
  let logSpy;
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never takes coordinates from a rate-limit page', () => {
    expect(isBlockedUrl(SORRY_URL)).toBe(true);
    // The bug: @45.4642,9.19 lives in the `continue=` payload, not in a place URL.
    expect(extractCoords(SORRY_URL)).toEqual({ lat: null, lng: null });
    // A real place URL still resolves, by !3d/!4d and by @lat,lng.
    expect(extractCoords('https://www.google.com/maps/place/X/@1.5,2.5,17z')).toEqual({
      lat: 1.5,
      lng: 2.5,
    });
    expect(extractCoords('https://www.google.com/maps/place/X/data=!3d10.25!4d20.5')).toEqual({
      lat: 10.25,
      lng: 20.5,
    });
  });

  it('requires a name or a photo to consider a link resolved', () => {
    expect(isUsableEntry({ title: 'Bar Luce', image: null })).toBe(true);
    expect(isUsableEntry({ title: null, image: 'https://x/photo.jpg' })).toBe(true);
    // Bare coordinates are not a place: this is the shape the 429 produced.
    expect(isUsableEntry({ title: null, image: null, lat: 45.46, lng: 9.19 })).toBe(false);
    expect(isUsableEntry(undefined)).toBe(false);
  });

  it('drops a 429 instead of caching it as a place, and reports it as UNRESOLVED', async () => {
    const url = 'https://maps.app.goo.gl/blocked1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 429,
        ok: false,
        url: SORRY_URL,
        text: async () => '<html><body>unusual traffic</body></html>',
      }))
    );
    const logs = [];
    logSpy.mockImplementation((m) => logs.push(String(m)));

    const maps = await resolveMapsForBodies([`- ${url}\n`]);

    // Not offered to the client, and not written to the on-disk cache, so the
    // next build retries it rather than inheriting the bogus entry.
    expect(maps[url]).toBeUndefined();
    expect(readDiskCache()[url]).toBeUndefined();
    expect(logs.some((l) => l.includes('UNRESOLVED') && l.includes(url))).toBe(true);
    vi.unstubAllGlobals();
  });

  // Regression guard for caches written BEFORE this fix: a deployed
  // maps-cache.json can still hold entries that are only bogus coordinates
  // harvested from a /sorry/ page. Those must be ignored on read and re-fetched,
  // so an existing vault repairs itself without rotating MAP_CACHE_KEY.
  it('invalidates pre-fix cache entries that are not real places', async () => {
    const poisoned = 'https://maps.app.goo.gl/poisoned1';
    const good = 'https://maps.app.goo.gl/cachedgood1';
    const key = Buffer.alloc(32, 7).toString('base64');
    const cachePath = join(CACHE_DIR, 'remote-cache.json');
    writeFileSync(
      cachePath,
      encryptJSON(
        {
          // Exactly what the 429 used to persist: coords, nothing else.
          [poisoned]: { title: null, address: null, image: null, lat: 45.4642, lng: 9.19 },
          [good]: { title: 'Trattoria', address: 'Via Roma 1', image: null, lat: 41.9, lng: 12.5 },
        },
        Buffer.from(key, 'base64')
      )
    );
    process.env.MAP_CACHE_KEY = key;
    process.env.MAP_CACHE_URL = cachePath;

    // The poisoned link gets re-fetched; this time Google answers properly.
    const fetchMock = vi.fn(async () => ({
      status: 200,
      ok: true,
      url: 'https://www.google.com/maps/place/Pizzeria/@40.85,14.26,17z',
      text: async () =>
        '<html><head><meta property="og:title" content="Pizzeria · Via Napoli 3"></head></html>',
    }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const maps = await resolveMapsForBodies([`- ${poisoned}\n- ${good}\n`]);

      // Refetched and repaired — not the stale bogus coordinates.
      expect(maps[poisoned]).toMatchObject({ title: 'Pizzeria', lat: 40.85, lng: 14.26 });
      // The usable cached entry was trusted: no network call for it.
      expect(maps[good]).toMatchObject({ title: 'Trattoria' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.MAP_CACHE_KEY;
      delete process.env.MAP_CACHE_URL;
      vi.unstubAllGlobals();
    }
  });

  it('keeps a genuine place and caches it', async () => {
    const url = 'https://maps.app.goo.gl/good1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        ok: true,
        url: 'https://www.google.com/maps/place/Bar+Luce/@45.4642,9.19,17z',
        text: async () =>
          '<html><head>' +
          '<meta property="og:title" content="Bar Luce · Largo Isarco 2, Milano">' +
          '<meta property="og:image" content="https://lh3.googleusercontent.com/p/photo">' +
          '<meta property="og:description" content="★★★★☆ · Bar">' +
          '</head></html>',
      }))
    );

    const maps = await resolveMapsForBodies([`- ${url}\n`]);

    expect(maps[url]).toMatchObject({
      title: 'Bar Luce',
      address: 'Largo Isarco 2, Milano',
      category: 'Bar',
      lat: 45.4642,
      lng: 9.19,
    });
    expect(readDiskCache()[url]).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
