// Build-time resolver for Google Maps links (no API key, no runtime function).
//
// Short links like https://maps.app.goo.gl/… are opaque: the browser can't
// follow them (CORS). Here, at build time in Node, we resolve them and extract
// a place preview, then bake the result into content.json. The client only
// reads pre-resolved data.
//
// Key trick (no API key, "the WhatsApp way"): fetched with a SOCIAL-CRAWLER
// User-Agent (facebookexternalhit), Google Maps serves the full Open Graph
// preview — real photo (og:image), name + address (og:title) and rating +
// category (og:description). A normal browser UA only gets a JS consent page.
//
// Results are cached on disk (scripts/.maps-cache.json, gitignored) so repeated
// local builds don't re-hit the network. Set MAPS_NO_CACHE=1 to bypass.
//
// A second, persistent cache survives BETWEEN builds/hosts: when MAP_CACHE_KEY
// is set, each build reads the previous build's encrypted cache from the deploy
// (see maps-cache.mjs) and re-fetches only the missing links. This is what makes
// a transient Google 429 in CI non-fatal (links resolved once stay resolved).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { mapUrlInLine } from '../src/lib/mdLinks.js';
import { getCacheKey, fetchRemoteCache } from './maps-cache.mjs';
import { GEN_DIR } from './paths.mjs';

// Resolver cache. Gitignored (never committed): the resolution must happen in
// CI so that notes edited via the web editor — which never pass through local —
// also work. `MAPS_CACHE_DIR` lets the CI point this at a directory that
// persists between builds; otherwise it goes in the project's gitignored .wv/.
const CACHE_FILE = join(process.env.MAPS_CACHE_DIR || GEN_DIR, '.maps-cache.json');
// Social-crawler UA: unlocks the Open Graph preview on Google Maps.
const UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
// Pre-accepted Google consent cookie: from datacenter IPs (CI) Google otherwise
// serves a consent interstitial with no Open Graph data. This bypasses it.
const CONSENT_COOKIE = 'CONSENT=YES+cb.20210328-17-p0.en+FX+000; SOCS=CAISHAgBEhJnd3NfMjAyMzA4MDEtMF9SQzIaAmVuIAEaBgiA_LyoBg';
const TIMEOUT_MS = 10000;
// How many links to resolve in parallel. The Google fetches parallelize freely;
// Nominatim stays serialized separately (see geocode). Override with MAPS_CONCURRENCY.
const CONCURRENCY = Math.max(1, Number(process.env.MAPS_CONCURRENCY) || 8);
// Extra attempts on a transient Google response (429 or network error). A 429 is
// usually IP-sticky within a build, so retries stay few and jittered, not aggressive.
const RETRIES = Math.max(0, Number(process.env.MAPS_RETRIES ?? 2));

// Run `fn` over `items` with at most `limit` promises in flight at once.
async function mapLimit(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Reads a <meta property|name="key" content="…"> value regardless of attribute
// order. Returns null if absent.
function ogMeta(html, key) {
  const tags = html.match(/<meta[^>]*>/gi) || [];
  const re = new RegExp(`(?:property|name)=["']${key}["']`, 'i');
  for (const tag of tags) {
    if (re.test(tag)) {
      const c = tag.match(/content=["']([^"']*)["']/i);
      return c ? decodeEntities(c[1]) : null;
    }
  }
  return null;
}

// Coordinates from the resolved place URL (most precise: the !3d/!4d pin).
function extractCoords(u) {
  let m;
  if ((m = u.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/))) return { lat: +m[1], lng: +m[2] };
  if ((m = u.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/))) return { lat: +m[1], lng: +m[2] };
  return { lat: null, lng: null };
}

// Keyless coordinate fallback that avoids Nominatim (blocked from CI/datacenter
// IPs): when Google serves the non-social shell, its og:image is a Static Maps
// URL whose `center=lat,lng` is the place location. Pull that from the HTML.
function centerFromStaticmap(html) {
  const m = html.match(/staticmap\?[^"'\\]*?center=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/i);
  return m ? { lat: +m[1], lng: +m[2] } : { lat: null, lng: null };
}

// og:title on Maps is "Name · Address". Split on the first " · ".
function splitTitle(ogTitle) {
  if (!ogTitle) return { name: null, address: null };
  const i = ogTitle.indexOf(' · ');
  if (i === -1) return { name: ogTitle.trim(), address: null };
  return { name: ogTitle.slice(0, i).trim(), address: ogTitle.slice(i + 3).trim() };
}

// og:description on Maps is e.g. "★★★★★ · Ristorante" (rating stars · category).
function parseDescription(ogDesc) {
  if (!ogDesc) return { ratingStars: null, category: null };
  const stars = (ogDesc.match(/★/g) || []).length;
  const parts = ogDesc.split(' · ').map((s) => s.trim());
  const category = parts.filter((p) => !/^[★☆]+$/.test(p) && p).pop() || null;
  return { ratingStars: stars || null, category };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Keyless geocoding fallback (OpenStreetMap Nominatim) for links whose resolved
// URL carries only a place id (e.g. ?ftid=… or /data=!1s0x…) and thus no
// coordinates. A valid User-Agent is required by Nominatim's usage policy.
async function geocodeImpl(query) {
  if (!query) return { lat: null, lng: null };
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    await sleep(1100); // be polite: max ~1 request/second
    const res = await fetch(u, {
      signal: ctrl.signal,
      headers: {
        'user-agent': 'web-vault/1.0 (Markdown vault site build)',
        'accept-language': 'it,en',
      },
    });
    const arr = await res.json();
    if (Array.isArray(arr) && arr[0] && arr[0].lat && arr[0].lon) {
      return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
    }
  } catch {
    /* ignore: leave without coordinates */
  } finally {
    clearTimeout(timer);
  }
  return { lat: null, lng: null };
}

// Nominatim must stay serialized (its policy is ~1 req/s) even while the Google
// fetches run in parallel: chain every geocode call so they never overlap.
let geocodeChain = Promise.resolve();
function geocode(query) {
  const run = geocodeChain.then(() => geocodeImpl(query));
  geocodeChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

// Fetch the Google page, retrying with a jittered backoff on 429/network errors.
async function fetchPage(url) {
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt) await sleep(400 * attempt + Math.floor(Math.random() * 300));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'user-agent': UA, 'accept-language': 'it,en;q=0.8', cookie: CONSENT_COOKIE },
      });
      const html = await res.text();
      if (res.status === 429 && attempt < RETRIES) continue; // transient: back off and retry
      return { res, html };
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('fetch failed');
}

// Resolve one URL to a place preview. Never throws. Any field may be null.
async function resolveOne(url) {
  try {
    const { res, html } = await fetchPage(url);
    const finalUrl = res.url || url;
    const ogTitle = ogMeta(html, 'og:title');
    const { name, address } = splitTitle(ogTitle);
    const rawImage = ogMeta(html, 'og:image');
    // Skip the generic staticmap fallback (served to non-social clients).
    const image = rawImage && !/\/maps\/api\/staticmap/.test(rawImage) ? rawImage : null;
    const { ratingStars, category } = parseDescription(ogMeta(html, 'og:description'));
    // og:title "Google Maps" means we only got the generic shell (no place).
    const title = name && name !== 'Google Maps' ? name : null;
    let { lat, lng } = extractCoords(finalUrl);
    let coordSrc = lat != null ? 'url' : null;
    // Keyless fallback #1: coordinates from the static-map og:image (no network).
    if (lat == null) {
      const c = centerFromStaticmap(html);
      if (c.lat != null) {
        lat = c.lat;
        lng = c.lng;
        coordSrc = 'staticmap';
      }
    }
    // Keyless fallback #2: geocode the ADDRESS (Nominatim). Blocked from some
    // CI/datacenter IPs, so it's the last resort. Nominatim is an address search,
    // not a POI-name search: including the business name tends to return nothing.
    if (lat == null || lng == null) {
      const q = address || title;
      ({ lat, lng } = await geocode(q));
      if (lat != null) coordSrc = 'geocode';
    }
    // Diagnostic (visible in CI build logs): reveals whether Google served the
    // Open Graph data or a consent/robot shell, and where coords came from.
    console.log(
      `[maps] status=${res.status} htmlLen=${html.length} ogTitle=${JSON.stringify((ogTitle || '').slice(0, 40))} ` +
        `img=${image ? 'yes' : 'no'} coords=${coordSrc || 'none'} final=${finalUrl.slice(0, 70)}`
    );
    return { title, address, image, ratingStars, category, lat, lng };
  } catch (e) {
    console.log(`[maps] ERROR ${url.slice(0, 60)} -> ${String((e && e.message) || e)}`);
    return { title: null, address: null, image: null, ratingStars: null, category: null, lat: null, lng: null, error: String((e && e.message) || e) };
  }
}

function loadCache() {
  if (process.env.MAPS_NO_CACHE) return {};
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    /* best-effort */
  }
}

// Collect every unique Google Maps URL that appears as a "map card line" (a
// line that is, optionally after a list marker, a maps link + optional text),
// skipping fenced code blocks.
export function collectMapUrls(bodies) {
  const urls = new Set();
  for (const body of bodies) {
    if (!body) continue;
    let inFence = false;
    for (const line of body.split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const url = mapUrlInLine(line);
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

// Returns { [url]: { title, address, image, ratingStars, category, lat, lng } }
// for every map card link found, using the disk cache when available. Only
// entries that resolved to something useful are returned; total failures are
// omitted (the widget then shows a plain link fallback).
export async function resolveMapsForBodies(bodies) {
  const urls = collectMapUrls(bodies);
  if (!urls.length) return {};
  const cache = loadCache();
  // Seed from the persistent cross-build cache (previous deploy) when enabled:
  // fill only entries the local disk cache doesn't already have resolved, so a
  // fresh local resolution still wins. This is what lets a transient CI 429 on
  // already-known links be harmless.
  const key = getCacheKey();
  if (key && !process.env.MAPS_NO_CACHE) {
    const remote = await fetchRemoteCache(key);
    for (const [url, val] of Object.entries(remote)) {
      const c = cache[url];
      const localGood = c && (c.title || c.lat != null);
      if (!localGood && val && (val.title || val.lat != null)) cache[url] = val;
    }
  }
  // Resolve if missing, or retry a fully-failed entry (no title and no coords)
  // so a transient CI failure doesn't get stuck in the persistent cache.
  const toResolve = urls.filter((url) => {
    const c = cache[url];
    return !c || (!c.title && c.lat == null);
  });
  // Resolve in parallel (bounded); each worker writes its own cache key.
  await mapLimit(toResolve, CONCURRENCY, async (url) => {
    cache[url] = await resolveOne(url);
  });
  const resolvedCount = toResolve.length;
  saveCache(cache);
  const maps = {};
  for (const url of urls) {
    const r = cache[url];
    if (r && (r.title || r.image || r.lat != null)) {
      maps[url] = {
        title: r.title || null,
        address: r.address || null,
        image: r.image || null,
        ratingStars: r.ratingStars ?? null,
        category: r.category || null,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
      };
    }
  }
  console.log(
    `[gen] maps: ${urls.length} link(s), ${resolvedCount} resolved now, ${Object.keys(maps).length} usable`
  );
  return maps;
}
