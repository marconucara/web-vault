# Cloudflare Workers deploy substrate (Pages → Workers)

Owning ADR: `adr/0040-cloudflare-workers-deploy-substrate.md`
(supersedes `adr/0026-cloudflare-pages-access.md`, unblocks
`adr/0035-cloudflare-template-onboarding.md`).

## Scope

Move the Cloudflare deploy from Pages to a single Worker with Static Assets.

Framework (`web-vault`):
- Add `functions/worker.js` — `makeWorker(config)` factory reusing
  `makeCommitHandler` (host-agnostic core untouched; `env.ASSETS` only in the
  adapter).
- Add `scripts/generate-worker.mjs` — generate the consumer Worker entry
  (`.wv/worker.js`, gitignored build artifact); detect repo + `WORKERS_CI_BRANCH`.
- Wire into `wv build` (replace `generate-functions.mjs`); remove the Pages
  generator. Keep `build-headers.mjs` (Workers Static Assets supports `_headers`).
- Export `./functions/worker.js`; bump package version; publish a tag.

Consumers:
- Convert `.web/wrangler.toml` (marconucaravault + template) from Pages shape
  (`pages_build_output_dir`) to Workers shape (`main`, `[assets]` with
  `directory`, `binding`, `not_found_handling = "404-page"`,
  `run_worker_first = ["/api/*"]`).
- Bump the `web-vault` dependency pin to the new tag.

Docs:
- Rewrite `DEPLOY.md` for Workers: git-connected Workers Builds, the
  deploy-command split (`npx wrangler deploy` prod / `npx wrangler versions
  upload` non-prod), secrets, and the Access syntax (exact host for prod,
  `*-<worker>` wildcard for preview, `/shared` Bypass on both).

Manual (owner, not code): create the git-connected Worker project on
marconucaravault, set `GITHUB_TOKEN` secret, recreate Access apps, delete the
old Pages project.

## Exit criteria

- `wv build` in `marconucaravault/.web` produces `dist/` + `.wv/worker.js`; the
  Worker serves `/`, `/shared/<id>/`, `/attachments/*`, `404.html`, and
  `POST /api/commit`.
- ADR 0040 → Implemented, 0026 → Superseded, INDEX regenerated.
- Verify gate green (`wv build` + dev-server smoke of `/` and `/shared/<id>/`),
  fast-forwarded onto `main`, pushed.

---
Shipped: web-vault v0.4.0 + marconucaravault .web/wrangler.toml migration. HEAD recorded in the shipping commit.
