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

- **Unreleased on `main` since `v0.6.1`:** the share-page task-list fix
  (ADR `0025`) and ADR `0037` — the versioning policy plus the framework version
  in the build and status bar. The next tag is a **minor** (`v0.7.0`): the status
  bar gains a visible element adopters did not ask for, which is not a patch.
  When cutting it, follow `AGENTS.md` → "Cutting a release": four places name a
  version and none of them fails loudly when stale.
- **Current tag: `v0.6.1`** — round-trip fidelity for code fences and for blocks
  nested under a list item (ADR `0015` r5/r6). A patch by semver: bug fixes, no
  API change. Two defects with one shape — the block model drops something about
  how the markdown was written, and the exporter re-invents it — but different
  consequences. The fence one rewrote bytes (an unlabelled fence came back
  ```` ```text ````); the nesting one changed the document, since the indent is
  what holds a block inside its list item. Pinned in `SETUP.md`, `README.md`,
  `package.json`, and both consumer repos' `.web/`.
- **`v0.6.0`** — the brand identity (ADR `0042`, now Implemented).
  A minor, not a patch: adopters get a visible change they did not ask for —
  the sidebar reads `WebVault` behind the mark instead of `Vault`, and the tab
  carries an icon. The icon set is committed pre-rendered under `brand/` and
  copied into `dist/` by `scripts/copy-brand.mjs`, per-file overridable from the
  consumer's `public/`. Two non-obvious placements, both forced by Cloudflare
  Access: the share pages link one shared copy at `dist/shared/favicon.svg`
  (only `/shared/*` is bypassed), and the 404 inlines the mark as a `data:` URI
  because it answers unmatched paths at any depth. Pinned in `SETUP.md`,
  `README.md`, `package.json`, and both consumer repos' `.web/`.
- **`v0.5.4`** — a dev-only Leaflet fix plus the ADR `0028` r3
  clarification. `optimizeDeps.include` was missing `leaflet`: it is a UMD
  bundle with no detectable `default` export, and because the map view is
  lazily imported Vite's dev scanner never saw it at startup, so opening that
  view for the first time threw `does not provide an export named 'default'`.
  Production (Rollup) was never affected. ADR `0028` r3 states what r2 left
  implicit — every Maps link is supported and survives into the note; only the
  fetched extras degrade — with four `collectPoints` tests pinning it. Pinned
  in `SETUP.md`, `README.md`, `package.json`, and the template's welcome note.
- **`v0.5.1`** (`8ac6fe0`) — the maps resolver cache-poisoning fix
  (ADR `0028` r2). A genuine patch by semver: bug fix, no API change. Pushed,
  signed, and pinned everywhere adopters look: `SETUP.md`, `README.md`, and the
  template repo's `.web/package.json` + `yarn.lock` + README links
  (`marconucara/web-vault-template@e1d9f63`), whose build was verified green
  against this tag. The reference vault `marconucara/marconucaravault@5486405`
  was bumped too — it was still on `v0.4.0`, two releases behind — and its
  build confirmed the fix on real data: the one poisoned link was re-fetched
  and resolved properly (13 links, 13 usable, no `UNRESOLVED`).
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

- **ADR `0025` — task lists on a share page (2026-08-06, `25135db`).** A note
  with checkboxes rendered on its public page with **both** a bullet and a
  checkbox. The share page is built by the standalone renderer, which carries
  its own inline copy of the stylesheet; that copy styled `.markdown ul`/`li`
  generically and had no rule for the `contains-task-list` / `task-list-item`
  classes `remark-gfm` emits, so nothing suppressed the `ul` marker. Four CSS
  rules, no logic change: the markup was already correct (`checked` and
  `disabled` both emitted), so the read-only guarantee and the done/not-done
  state were never the defect. Two cases surfaced only by reading the real
  output — a checked item that **nests a sub-list** would have struck its
  children too, since remark nests the child `ul` inside the parent `li` (also
  why the item stays in flow layout, not flex), and a **loose list** wraps each
  label in a `<p>`, moving the checkbox to `li > p > input` where the first
  selector missed it entirely. `scripts/shared-render.test.mjs` is new — the
  renderer had none; it asserts against the returned page, which carries markup
  and stylesheet in one string, so the rules are verifiable without a browser.
  121 → 130 tests. No version bump — rides along with a later release. See
  `plan/done/2026-08-06-shared-task-lists-show-bullet-and-checkbox.md`.
- **ADR `0037` — versioning policy and framework version (2026-08-06, `7f192d8`,
  `d8cb7c2`, unreleased).** The decision was rewritten before being built. It had
  called for GitHub Releases and a `1.0.0`; both are gone. A parallel publication
  surface — Releases, or a moving `latest` ref — buys nothing the tags do not
  already give: they are public, machine-readable, and already what adopters pin,
  while a moving ref resolves to a commit SHA rather than a version, so naming the
  version still means reading the tag list. Release notes were the one genuine
  addition and nothing downstream needs them. The `1.0.0` went because the major
  has no mechanical consequence here — a git-tag dependency's lockfile pins a
  resolved commit either way — so freezing the contract is a decision for when it
  is wanted, not a promise made in advance. What is left is a policy (semver, 0.x
  breaking changes on the minor) plus the missing local half of the upgrade
  comparison. **The trap worth remembering:** `frameworkVersion` must come from
  `PACKAGE_DIR`, this package's own root. `PROJECT_DIR` is the consumer's `.web`
  and would bake the adopter's shell version — wrong, and *invisible here*, since
  in this repo's checkout the two coincide. That is why it was verified against a
  throwaway consumer with a `portal:` link rather than from this root, and why the
  test drives `paths.mjs` from a foreign cwd. The status bar shows the version as
  its own element outside the commit anchor: two identities, and the version is
  not a property of that commit. Both tooltips now name what they describe.
  Rendering confirmed in a browser by the owner. 130 → 137 tests. See
  `plan/done/2026-08-06-framework-version-in-build-and-status-bar.md`.
- **ADR `0015` r6 — nested block indent (2026-08-06, `1f81806`, `v0.6.1`).** A
  paragraph, blockquote, table or heading indented under a list item came back at
  column zero. Worse than the fence rewrite it followed: the indent is what holds
  the block *inside* the item, so the block left the list. Replacing
  `blocksToMarkdownLossy`, as the plan item assumed, proved unnecessary — each
  block exports correctly alone and only the composition was wrong, so the export
  walks the block tree and indents each child under its parent, calling the stock
  exporter on the parts. Three constraints, all found by testing: a run of items
  goes through the exporter in **one** call (per-item calls restart every ordered
  list at 1); the run **stops at a change of list type**, because the exporter
  separates two lists with a blank line and one emitted line then stops pairing
  with one item — the first attempt paired them anyway and **dropped a whole
  list**, caught by diffing edge cases against the unmodified tree rather than by
  a failing test; and a child indents to the width of the marker emitted (four
  for `10. `). The checklist case had a separate cause, in the dependency:
  BlockNote's markdown parser counts a task item's content column *including* the
  `[ ] ` marker, so a child at the idiomatic column 2 reads as a sibling — those
  children are re-indented to the column the parser expects before the parse.
  91 → 121 tests, 16 confirmed failing against the unmodified tree. Verified
  against a real vault. See
  `plan/done/2026-08-06-nested-blocks-flattened-on-export.md`.
- **ADR `0015` r5 — code fence shape (2026-08-06, `1243c86`).** Four differences
  turned out to be one defect: a BlockNote code block keeps only its
  `language`, so an unlabelled fence gained `text`, a marker longer than three
  characters was shortened, a `~~~` fence became a backtick fence, and a fence
  under a list item was flattened to column zero. The `text` case was the
  unrecoverable one — it is BlockNote's default, so a bare fence and one that
  really declares `text` parse to the *same* block, and no export-side rule
  could tell them apart. All four are carried across the parse in the one field
  that survives it, by rewriting the opening fence into a `wv-fence-<kind>
  <len>i<indent>-<info>` sentinel and restoring it after export — a fourth
  pre/post pair beside the wikilink, media-link and map-link ones. The indent
  had to travel the same way: `blocksToHTMLLossy` lifts every non-list child out
  of its `<li>`, keeping the depth only in a `data-nesting-level` attribute the
  markdown step never reads, and in the emitted markdown a fence that *follows*
  a list is indistinguishable from one nested *inside* it. That flattening
  affects every nested block type and was fixed next, in r6. 78 → 91 tests,
  15 confirmed failing against the unmodified tree. See
  `plan/done/2026-08-06-fence-shape-lost-on-round-trip.md`.
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

The queue holds one item.

1. **`plan/todo/0003`** — *rewritten by the 2026-08-05 audit and deprioritised.*
   The bug it originally described no longer reproduces: `preProcessWikilinks`
   still builds a malformed token across a code span, but `postProcessWikilinks`
   reverses it symmetrically, so the round trip is clean end to end. Nothing
   enforces that symmetry, so the item is now test coverage, not a fix.

Three round-trip items shipped in a row on 2026-08-05/06 (emphasis around inline
code, fence shape, nested block indent), all under ADR `0015`, followed by the
share-page task-list fix under ADR `0025`. The `0004` and `0005` slots have each
been used three times; numbers are reused once an item ships.
Not queued, because it needs a decision first: **ADR `0044`** — what the URL
addresses. Written by the 2026-08-05 audit, promoted from
`_agent/prompts/routing-adr.md` (now removed) where it had been invisible to
both `INDEX.md` and the queue. `Proposed`: it fixes the slug rule as a
compatibility surface and settles that heading anchors are addressable while
sidebar/view selection stays out of the URL. Implementation is queued once it
is `Accepted`.

## Backlog — not queued, and why

- **ADR `0042` (brand identity) is `Implemented` as of 2026-08-05 (r4),
  shipped in `v0.6.0`.** The artwork was produced with an external design tool
  and the ADR's advice held: the judgement was isolated — the icons went in
  first and were reviewed in a browser by the owner, and only then did the
  sidebar mark follow in the same item. `brand/mark.svg` is authoritative for
  the form; `src/components/BrandMark.jsx` is that geometry inlined so it can
  take `currentColor`. If the drawing is ever refined, both move together, and
  `adr/assets/0042-brand-components.jsx` holds the design-tool source it was
  settled in. What r4 did **not** settle: the wordmark's typeface, and whether
  the brand accent eventually replaces the UI's generic blue.
- **`0037` gates `0038`/`0039`.** Still no written release policy; tags
  `v0.5.0`–`v0.6.0` were all cut by judgement. `v0.6.0` was called a minor
  because adopters see the rename and the mark without asking for them.
- **ADR `0043`** — map link resolution diagnostics. `Proposed` and deliberately
  not queued; it closes the open question `0028` r3 handed off. `Proposed` is a
  valid resting state, not a defect.
- **The starter template's three demo pins in `welcome.md`** are `?q=` **search**
  URLs, not place links: Google answers some of them with the generic shell
  (`ogTitle="Google Maps"`, no photo), which `v0.5.1` correctly reports as
  `UNRESOLVED` where the old rule rendered a nameless coordinates-only pin.
  Flaky by nature — which of the three resolve varies per build. Not a
  regression; replacing them with real place links would make the demo stable.
  Lives in the template repo, not here.

## Environment notes for a fresh agent

- Commits in THIS repo are **SSH-signed** (local config: `gpg.format=ssh`,
  `user.signingkey=~/.ssh/id_rsa.pub`; author Marco Nucara <marco.nucara@gmail.com>).
- **Never** add `Co-Authored-By: Claude` or `Claude-Session:` trailers to commits.
- Keep the package **vault-agnostic**: the consumer lives in a separate repo; no
  hardcoded vault identity here.
