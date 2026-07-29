// Writes the persistent Maps resolver cache to dist/maps-cache.json, ENCRYPTED,
// so the next run (here or on any host) can read it and skip re-fetching links
// Google already resolved. Runs after build-content.mjs, in both `yarn build`
// (after `vite build`) and `yarn dev` — it only needs content.json, not dist,
// which it creates if missing.
//
// Master switch: without MAP_CACHE_KEY nothing is written (never plaintext).
// The payload is content.json's `maps` (only the usable, resolved entries),
// keyed by URL. See maps-cache.mjs for the why and the read side.
import './load-env.mjs'; // first: populate process.env from .env before other modules read it
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCacheKey, encryptJSON, CACHE_FILENAME } from './maps-cache.mjs';
import { CONTENT_JSON as CONTENT, DIST_DIR as DIST } from './paths.mjs';

const key = getCacheKey();
if (!key) {
  console.log('[maps-cache] MAP_CACHE_KEY unset: no cache written.');
  process.exit(0);
}
if (!existsSync(CONTENT)) {
  console.error('[maps-cache] content.json missing: run build-content.mjs first.');
  process.exit(1);
}

const { maps = {} } = JSON.parse(readFileSync(CONTENT, 'utf8'));
mkdirSync(DIST, { recursive: true }); // dev has no `vite build`, so dist may not exist yet
const out = join(DIST, CACHE_FILENAME);
writeFileSync(out, encryptJSON(maps, key));
console.log(`[maps-cache] ${Object.keys(maps).length} entr(ies) -> dist/${CACHE_FILENAME} (encrypted).`);
