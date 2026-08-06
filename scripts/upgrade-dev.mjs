// Dev only: handle POST /api/upgrade locally by writing the pin to disk.
//
// Mirrors commit-dev.mjs (adr/0036-local-dev-edit-write-to-disk.md): reuses the
// Worker's pure transforms so dev matches production, and swaps the persistence
// — the new `.web/package.json` is written straight to disk, no git, no push, no
// token. That makes the whole upgrade flow exercisable under `wv dev`: click,
// see the pin change on disk, see the panel move to its "building" state.
//
// The tag IS still validated against the framework repository here. Skipping it
// locally would let dev accept a target production refuses, which is exactly the
// kind of divergence this file exists to avoid.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPin, setPin, isPublishedTag } from '../functions/upgrade.js';
import { PROJECT_DIR } from './paths.mjs';

// The shell IS the dev server's own project directory — `wv dev` runs from
// `.web/`. Resolving `.web/package.json` under the vault (production's path)
// would look for `.web/.web/` here.
const MANIFEST = join(PROJECT_DIR, 'package.json');

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

export function upgradeDev() {
  return {
    name: 'upgrade-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (path !== '/api/upgrade') return next();
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          return res.end('Method Not Allowed');
        }

        let payload;
        try {
          payload = JSON.parse(await readBody(req));
        } catch {
          return sendJson(res, 400, { error: 'invalid JSON body' });
        }
        const version = String(payload?.version ?? '').trim();
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
          return sendJson(res, 400, { error: `invalid version: ${version}` });
        }
        if (!(await isPublishedTag(version))) {
          return sendJson(res, 400, { error: `version ${version} is not published` });
        }

        if (!existsSync(MANIFEST)) {
          return sendJson(res, 404, { error: 'no shell manifest to update' });
        }
        let source;
        try {
          source = readFileSync(MANIFEST, 'utf8');
        } catch (e) {
          return sendJson(res, 500, { error: `local read failed: ${e.message}` });
        }

        const from = readPin(source);
        if (!from) return sendJson(res, 200, { noop: true, reason: 'no version pin to update' });
        if (from === version) {
          return sendJson(res, 200, { noop: true, reason: 'already up to date', from });
        }

        const updated = setPin(source, version);
        if (updated === null || updated === source) {
          return sendJson(res, 200, { noop: true, reason: 'no version pin to update', from });
        }
        try {
          writeFileSync(MANIFEST, updated, 'utf8');
        } catch (e) {
          return sendJson(res, 500, { error: `local write failed: ${e.message}` });
        }
        // No rebuild follows locally — the adopter reinstalls when they choose.
        // Reported so the client does not sit waiting for a version bump that
        // dev will never serve.
        return sendJson(res, 200, { committed: true, from, to: version, local: true });
      });
    },
  };
}
