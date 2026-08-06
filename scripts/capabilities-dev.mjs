// Dev only: answer GET /api/capabilities locally.
//
// The Vite dev server serves no Worker, so without this the client's capability
// probe 404s under `wv dev` and the UI would degrade to read-only on the one
// setup that is always writable.
//
// `canWrite` is TRUE here regardless of any token, and that is not a shortcut:
// local edits are written straight to the vault on disk, with no git and no
// token involved (adr/0036-local-dev-edit-write-to-disk.md). Deriving it from
// GITHUB_TOKEN — the production rule (functions/capabilities.js) — would be the
// wrong question locally, because the token is not what authorizes the write.
// Mirrors the commitDev pattern in scripts/commit-dev.mjs.
export function capabilitiesDev() {
  return {
    name: 'capabilities-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (path !== '/api/capabilities') return next();
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET');
          return res.end('Method Not Allowed');
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.end(JSON.stringify({ canWrite: true }));
      });
    },
  };
}
