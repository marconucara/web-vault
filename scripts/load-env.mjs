// Minimal .env loader (zero-dep) for the build scripts. Vite only reads .env for
// VITE_-prefixed client vars; our standalone Node scripts (build-content,
// build-maps-cache) run in separate processes and wouldn't see it. This loads
// .web/.env and .web/.env.local into process.env so secrets like MAP_CACHE_KEY
// can live in an (uncommitted) file instead of inline on every command.
//
// Precedence: real environment > .env.local > .env. A var already set in the
// real environment is never overridden (so CI env always wins). Import this
// FIRST, before any module that reads env at import time.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_DIR as WEB } from './paths.mjs';

function apply(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // real env (and earlier file) wins
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

// .env.local first so it wins over .env; neither overrides the real environment.
apply(join(WEB, '.env.local'));
apply(join(WEB, '.env'));
