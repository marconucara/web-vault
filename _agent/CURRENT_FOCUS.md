# Current Focus

This file is the LIVE SNAPSHOT of any in-flight session. It is short on purpose
— the durable record lives in git (`git log`), `_agent/WORKLOG.md`, and
`plan/done/`. The queued work lives in `plan/todo/`.

If status files and git disagree, git is authoritative; correct this file.

## Active state

- **Branch:** main
- **Active item:** none in flight.
- **Blockers:** none.
- **Uncommitted work:** none.

## Release state

- **Current tag: `v0.5.0`** — the quality gate (ADR `0041`), `DEPLOY.md`
  hardening, and the template/ADR bookkeeping that had accumulated on `main`
  after `v0.4.0`. This is what adopters pin: `SETUP.md`, `README.md`, and the
  starter template's `.web/package.json` all say `v0.5.0`.
- **What `v0.5.0` contains.** No user-facing features and no bug fixes — by
  strict semver this was a patch, cut as a minor deliberately rather than
  leaving `main` untagged. Two runtime-touching side effects rode along with
  the typecheck: `bin/wv.mjs` now applies `configFile: false` *after* the
  spread rather than before (so it always wins), and `@codemirror/view` became
  a direct dependency with `Editor.jsx` importing `EditorView` from it instead
  of via `@uiw/react-codemirror`.
- **Previous tag `v0.4.0`** (`975b74e`) — the Workers substrate migration
  (ADR `0040`).
- **No release policy yet.** ADR `0037` (semver, 1.0.0, GitHub Releases) is
  still **Proposed**, and `0038`/`0039` depend on it. Until it lands there is
  no written rule for when a tag gets cut.

## Last shipped

- **ADR `0035` — starter template (2026-08-01).** The one-click entry point is
  the standalone `marconucara/web-vault-template` repository, not a subfolder
  here: the deploy button rejects a subfolder with no root `wrangler.toml`,
  failing before the screen where **Path** is set. `templates/base/` was tried
  and reverted (`c3098da`). ADR 0035 gained acceptance criteria 6 and 7 — the
  one-click path does not reshape the product, and the template is a real vault.
  See `plan/done/2026-08-01-template-separate-repo.md`.
- **ADR `0041` — automated quality gate (2026-07-31).** `yarn verify` =
  `yarn typecheck` + `yarn test`. Self-contained: runnable from a bare clone,
  never needs a vault outside the repo. See
  `plan/done/2026-07-31-automated-quality-gate.md`.
- **`v0.4.0` — ADR `0040`, Workers substrate (2026-07-31).** Cloudflare Pages →
  Workers; `0040` supersedes `0026`. `DEPLOY.md` rewritten. See
  `plan/done/2026-07-31-cloudflare-workers-deploy.md`.
- **`v0.3.0`** — dev-server CJS/ESM interop fix for the editor stack: `wv dev`
  was blanking with "does not provide an export named ..." for plain-CJS
  transitive deps (`style-to-js` via react-markdown; `use-sync-external-store`
  via zustand/BlockNote). Fixed by pre-bundling the affected libraries in Vite
  `optimizeDeps.include` (`lib/vite-config.mjs`). Dev-only; the Rollup build was
  never affected. See `plan/done/2026-07-30-dev-editor-cjs-interop.md`.
- **`v0.2.0`** — ADR `0029` delivery: agent-driven onboarding spec (`SETUP.md`),
  user-facing `README.md`, single-source `DEPLOY.md`; product name **WebVault**;
  AGPL-3.0. The build now generates `dist/_headers` (ADR `0026` r2,
  consumer-overridable) rather than scaffolding it.

## ADR state

`0001`–`0041` exist. All **Implemented** except: `0026` **Superseded** (by
`0040`), and `0030`, `0031`, `0032`, `0034`, `0037`, `0038`, `0039` still
**Proposed** — decisions drafted, not built. `INDEX.md` is authoritative.

## Next item

- Queue empty (`plan/todo/` has no items). No work in flight.
- Unbuilt decisions are the natural backlog: `0037` gates `0038`/`0039`.

## Environment notes for a fresh agent

- Commits in THIS repo are **SSH-signed** (local config: `gpg.format=ssh`,
  `user.signingkey=~/.ssh/id_rsa.pub`; author Marco Nucara <marco.nucara@gmail.com>).
- **Never** add `Co-Authored-By: Claude` or `Claude-Session:` trailers to commits.
- Keep the package **vault-agnostic**: the consumer lives in a separate repo; no
  hardcoded vault identity here.
