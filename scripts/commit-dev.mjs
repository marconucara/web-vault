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
import { execFileSync } from 'node:child_process';
import { isSafeNotePath, applyOps, bodyOf } from '../functions/commit.js';
import { VAULT_DIR } from './paths.mjs';

// The dev counterpart of the `contents` read the Function does against the
// branch (adr/0050-*.md): the identity the note has right now.
//
// Here the vault on disk IS the store, so "right now" is the file's own hash —
// the same thing `content.json` recorded when it was generated, which is what
// makes the comparison meaningful. A dev write creates no git commit, so
// anything anchored to HEAD would sit still while the file moved underneath it
// and no drift would ever be seen.
function diskSha(abs) {
  try {
    return execFileSync('git', ['hash-object', abs], { encoding: 'utf8' }).trim();
  } catch {
    return null; // no git: nothing to compare against, so nothing is refused
  }
}

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

        // Drift preflight, before anything is written: one changed note refuses
        // the whole batch, so a refused commit leaves the vault untouched.
        const drifted = [];
        for (const f of files) {
          if (!f?.baseSha || f.isNew || f.delete) continue;
          const abs = join(VAULT_DIR, f.path);
          if (!existsSync(abs)) continue;
          const sha = diskSha(abs);
          if (sha && sha !== f.baseSha) {
            // The body only: the client edits and sends the body, so the two
            // sides of the comparison have to be the same thing.
            drifted.push({ path: f.path, remote: bodyOf(readFileSync(abs, 'utf8')), remoteSha: sha });
          }
        }
        if (drifted.length) {
          return sendJson(res, 409, {
            reason: 'drift',
            error: 'some notes changed elsewhere since you started editing',
            drifted,
          });
        }

        const committed = [];
        // path -> blob SHA after the write, so the client's next edit on this
        // note starts from a base again (adr/0050-*.md).
        const newBases = {};
        try {
          for (const f of files) {
            const abs = join(VAULT_DIR, f.path);
            if (f.isNew) {
              // Creation: must not clobber an existing note (matches the Function's 409).
              if (existsSync(abs)) return sendJson(res, 409, { reason: 'exists', error: `a note already exists at ${f.path}` });
              mkdirSync(dirname(abs), { recursive: true });
              writeFileSync(abs, String(f.content ?? ''), 'utf8');
              newBases[f.path] = diskSha(abs);
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
            newBases[f.path] = diskSha(abs);
            committed.push(f.path);
          }
        } catch (e) {
          return sendJson(res, 500, { error: `local write failed: ${e.message}` });
        }

        if (!committed.length) return sendJson(res, 200, { sha: 'dev-noop', committed: [], noop: true });
        return sendJson(res, 200, { sha: `dev-${Date.now().toString(16)}`, committed, bases: newBases });
      });
    },
  };
}
