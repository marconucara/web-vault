// Dev only: handle POST /api/commit locally by writing to the vault on disk.
//
// In production this endpoint is the Cloudflare Pages Function (functions/commit.js),
// which commits to GitHub via the Git Data API using a server-side token. The Vite
// dev server serves no Pages Functions and has no token, so without this the editor
// cannot persist anything under `wv dev`. This middleware reuses the Function's pure
// transforms (isSafeNotePath, applyOps) so dev matches production, but swaps the
// persistence: it writes the resulting .md straight to the vault — no git, no push,
// no token. Mirrors the sharedPagesDev pattern in lib/vite-config.mjs.
// See adr/0036-local-dev-edit-write-to-disk.md.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { isSafeNotePath, applyOps } from '../functions/commit.js';
import { VAULT_DIR } from './paths.mjs';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

export function commitDev() {
  return {
    name: 'commit-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (path !== '/api/commit' || req.method !== 'POST') return next();

        let payload;
        try {
          payload = JSON.parse(await readBody(req));
        } catch {
          return sendJson(res, 400, { error: 'invalid JSON body' });
        }

        const files = Array.isArray(payload?.files) ? payload.files : [];
        if (!files.length) return sendJson(res, 400, { error: 'no files to commit' });
        for (const f of files) {
          if (!isSafeNotePath(f?.path)) return sendJson(res, 400, { error: `invalid path: ${f?.path}` });
        }

        const committed = [];
        try {
          for (const f of files) {
            const abs = join(VAULT_DIR, f.path);
            if (f.isNew) {
              // Creation: must not clobber an existing note (matches the Function's 409).
              if (existsSync(abs)) return sendJson(res, 409, { error: `a note already exists at ${f.path}` });
              mkdirSync(dirname(abs), { recursive: true });
              writeFileSync(abs, String(f.content ?? ''), 'utf8');
              committed.push(f.path);
              continue;
            }
            if (f.delete) {
              if (!existsSync(abs)) continue; // already gone: no-op
              rmSync(abs);
              committed.push(f.path);
              continue;
            }
            if (!existsSync(abs)) return sendJson(res, 404, { error: `note does not exist: ${f.path}` });
            const rawCurrent = readFileSync(abs, 'utf8');
            const newContent = applyOps(rawCurrent, f);
            if (newContent === rawCurrent) continue; // no real change
            writeFileSync(abs, newContent, 'utf8');
            committed.push(f.path);
          }
        } catch (e) {
          return sendJson(res, 500, { error: `local write failed: ${e.message}` });
        }

        if (!committed.length) return sendJson(res, 200, { sha: 'dev-noop', committed: [], noop: true });
        return sendJson(res, 200, { sha: `dev-${Date.now().toString(16)}`, committed });
      });
    },
  };
}
