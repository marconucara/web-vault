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

- **Current tag: `v0.5.1`** (`8ac6fe0`) — the maps resolver cache-poisoning fix
  (ADR `0028` r2). A genuine patch by semver: bug fix, no API change. Pushed,
  signed, and pinned everywhere adopters look: `SETUP.md`, `README.md`, and the
  template repo's `.web/package.json` + `yarn.lock` + README links
  (`marconucara/web-vault-template@e1d9f63`), whose build was verified green
  against this tag.
- **`v0.5.0`** — the quality gate (ADR `0041`), `DEPLOY.md` hardening, and the
  template/ADR bookkeeping that had accumulated on `main` after `v0.4.0`.
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

- **ADR `0028` r2 — maps resolver cache poisoning (2026-08-02, `v0.5.1`).** A
  Google `429` was being cached as a resolved place: after the retries ran out
  `fetchPage` returned the blocked response, `extractCoords` harvested
  `@lat,lng` out of the `/sorry/` page's `continue=` parameter, and both the
  retry filter and the usable guard read `lat != null` as success — so the
  entry landed in `dist/maps-cache.json` and was never retried again. A link
  now counts as resolved only with a **title or an image**; blocked responses
  are failed fetches; unusable entries are kept out of both caches, so caches
  poisoned before the fix repair themselves on the next build with no
  `MAP_CACHE_KEY` rotation. Unresolved links log `UNRESOLVED` and do **not**
  fail the build — a `429` is transient and hits every link at once, so a gate
  would re-fatalise what the cache exists to absorb. Client-side surfacing
  (`mapsIssues`) is parked as an open question on ADR `0028`. Brought the first
  tests to `scripts/`. See
  `plan/done/2026-08-02-maps-resolver-reject-blocked-responses.md`.
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

`0001`–`0043` exist. All **Implemented** except: `0026` **Superseded** (by
`0040`), and `0030`, `0031`, `0032`, `0034`, `0037`, `0038`, `0039`, `0042`,
`0043` still **Proposed** — decisions drafted, not built. `INDEX.md` is
authoritative.

## Next item

- `plan/todo/0001-implement-brand-identity.md` (ADR `0042`) is the only queued
  item.
- Unbuilt decisions are the natural backlog: `0037` gates `0038`/`0039`.
- The starter template's three demo pins in `welcome.md` are `?q=` **search**
  URLs, not place links: Google answers some of them with the generic shell
  (`ogTitle="Google Maps"`, no photo), which `v0.5.1` correctly reports as
  `UNRESOLVED` where the old rule rendered a nameless coordinates-only pin.
  Flaky by nature — which of the three resolve varies per build. Not a
  regression; replacing them with real place links would make the demo stable.
- ADR `0043` (**Proposed**) — map link resolution diagnostics: classify
  unresolved links transient/permanent, carry them into the content artifact,
  surface them at the point of use, plus an opt-in strict gate that fails only
  on permanent failures. Drafted, not queued; it closes the open question 0028
  r3 handed off.

## Environment notes for a fresh agent

- Commits in THIS repo are **SSH-signed** (local config: `gpg.format=ssh`,
  `user.signingkey=~/.ssh/id_rsa.pub`; author Marco Nucara <marco.nucara@gmail.com>).
- **Never** add `Co-Authored-By: Claude` or `Claude-Session:` trailers to commits.
- Keep the package **vault-agnostic**: the consumer lives in a separate repo; no
  hardcoded vault identity here.
