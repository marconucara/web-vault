# Current Focus

This file is the LIVE SNAPSHOT of any in-flight session. It is short on purpose
— the durable record lives in git (`git log`), `_agent/WORKLOG.md`, and
`plan/done/`. The queued work lives in `plan/todo/`.

If status files and git disagree, git is authoritative; correct this file.

## Active state

- **Branch:** main
- **Active item:** none in flight; `plan/todo/` is empty.
- **Blockers:** none.
- **Uncommitted work:** none.
- **Another session is working a separate bug.** This change was deliberately
  left **untagged and without a version bump** so the two ride the same release.
  Check what landed there before cutting one.

## Release state

- **Unreleased on `main`:** ADR `0015` r7 — the link passes now skip code. ADR
  `0038` r7–r9 — the manual update check is visible from click to answer, and
  the update marker is amber rather than green. Both are bug fixes with no
  adopter-facing contract change, so a **patch** when the next tag is cut. A
  parallel session has a further fix in flight; deliberately not tagged here so
  they release together.
- **Current tag: `v0.8.0`** — the upgrade loop closes. ADR `0039`: the notice
  from `0038` gains an action, so a deployment that can write upgrades itself.
  Also carries what had accumulated since `v0.6.1` and was queued for a `v0.7.0`
  that was never cut: the share-page task-list fix (ADR `0025`), ADR `0037`
  (versioning policy, framework version in the build and status bar) and ADR
  `0038` (the notice itself). A **minor**: the status bar gains visible elements
  adopters did not ask for, and the notice now acts on the adopter's repository.
  - **The pin bump is a commit, not a new mechanism.** It targets the branch the
    deployment was built from (`adr/0020-*.md`), so the push rebuilds and the
    rebuild reinstalls. No separate reinstall step exists to orchestrate.
  - **A dedicated endpoint, deliberately.** `isSafeNotePath` rejects
    `.web/package.json` three times over (needs `.md`, no dot-segments) and that
    guard is load-bearing — it keeps the note editor away from the toolchain.
    `/api/upgrade` has one file and one field in its entire write scope. A test
    asserts `/api/commit` still cannot reach the shell; if it ever fails, the
    editor has gained write access to the build config.
  - **The capability signal is runtime, and this is the trap.** The token is a
    host secret an adopter adds *after* deploying — the welcome note says so. A
    build-time flag would report `false` on a deployment that writes perfectly
    well, until the next rebuild. This also answers the open question
    `adr/0034-*.md` had parked for its own plan; 0034 now consumes the endpoint
    instead of defining it, its editor gating still unbuilt.
  - **The deployed version had to become fetchable.** The framework version is
    compiled into the bundle, so a client polling for "did the rebuild land?"
    would be watching a number that cannot change under it. It is now
    build-injected into the Worker config and reported beside `canWrite`.
  - Pinned in `SETUP.md`, `README.md`, `package.json`, and both consumer repos'
    `.web/`.
  - **Release process hit the tag/rebase trap, now written down.**
    `push --follow-tags` pushed `v0.8.0` while `main` was rejected (the remote
    had moved); the rebase that followed rewrote the commits and left the tag
    naming one no longer reachable from `main` — a version adopters could
    resolve and install that was never on the branch. Fixed by moving the tag
    (`tag -f` + `push --force` on that ref alone), not deleting it: deleting
    briefly removes a version the notice may already be resolving. `AGENTS.md`
    → "Tag last, and only after `main` is pushed" now states the ordering that
    makes it impossible, rather than the recovery.
- **`v0.6.1`** — round-trip fidelity for code fences and for blocks
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

- **ADR `0015` r7 — the link passes must skip code (2026-08-06, unreleased).**
  An unmatched `[[` inside a code span — what a note documenting the wikilink
  syntax naturally contains — started a match that ran to the next `]]` anywhere
  later in the note, because the matcher's character classes admitted newlines.
  Every heading and paragraph in between collapsed into one inline token: four
  blocks became two, and the code span never closed. **Why two audits missed it,
  and the lesson worth keeping:** each post pass reverses its own pre pass
  symmetrically, so the *bytes* round-trip perfectly. The 2026-08-05 audit
  checked exactly that, found no diff, and downgraded the item to "test coverage,
  not a fix" — the reasoning recorded in this file until today. The loss was in
  the block structure the editor *displays*, and it became permanent the moment
  the user edited the mangled block and committed the encoded blob as literal
  text. Fixed by bounding both matchers (`WIKILINK`, `MD_LINK`) to a single line
  and routing both pre-passes through a new `outsideCode` helper that skips
  fenced blocks and inline code spans. **The pipeline order did not move, against
  what the plan item assumed:** `preProcessFences` rewrites only the *opening
  fence line* into a sentinel and leaves the block body untouched, so running it
  first would never have protected fence content — and nothing marks an inline
  code span, so no ordering could protect one either. The pass had to learn both
  itself. ADR `0015` gains **criterion 7** so the rule is stated rather than
  rediscovered: a note must parse to the structure its markdown describes, and a
  byte-identical round trip does not demonstrate that on its own. Exit criterion
  5 verified by breaking it (a broken inverse fails 10 tests); the three
  structural tests confirmed failing against the unmodified tree. 190 → 210
  tests. See `plan/done/2026-08-06-wikilink-preprocess-skips-inline-code.md`.
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
- **ADR `0038` — in-app upgrade notice (2026-08-06, unreleased).** The portal
  reads the framework repo's `/tags`, takes the highest by numeric semver, and
  reports only a strictly-newer one. Both halves matter and **neither fails
  locally**: `/tags` is lexicographic, so today's order is right only because
  every minor is one digit — it breaks at `v0.10.0` — and a build can be *ahead*
  of every tag (a maintainer on `main` after tagging), where an inequality test
  shows a permanent false notice. **Two defects the tests caught, both invisible
  by hand:** the throttle guard collapsed "never checked" into "checked at the
  epoch", so the first check was refused and on a fresh install the notice would
  never have appeared; and `run()` recorded `Date.now()` over the injected clock,
  making the cadence untestable. One automatic check per hour, manual floor of a
  minute, all failure paths silent. The Dismiss button was **removed after seeing
  it run** — it persisted the dismissal and hid the dot for good; dismissing now
  closes the panel and the dot stays (ADR r5 clarifies criterion 5, which always
  meant the panel). The feature is live but inert until a tag newer than an
  adopter's build exists. 137 → 159 tests. See
  `plan/done/2026-08-06-in-app-upgrade-notice.md`.
  **Reopened 2026-08-06 (r7, back to Accepted).** The whole build was tested
  against the update-available path, which is the rare one. In the common path —
  an adopter clicking the version to confirm they are current — the click
  renders *nothing*: a check finding no update writes only `checkedAt`, and
  `VersionIndicator` never reads it, so the store re-renders an identical tree.
  Refused-by-throttle and in-flight are equally invisible. Same blind spot as the
  Dismiss button above: the mechanism was verified, the moment of use was not.
  Two more fell out with it — AC6's blanket silence would have made a *failed*
  check report "up to date", and the update dot is **green**, the colour this app
  uses for `In sync`.
  **Closed 2026-08-06 (r9, Implemented).** The store models the *outcome* now,
  not the result: `{ ok, latest }` instead of `latest | null`, which had
  collapsed "GitHub answered and you are current" together with "nothing
  answered". The two timestamps had to split — `attemptedAt` throttles,
  `checkedAt` records the last success and is the only one shown; sharing one
  forces a choice between hammering a dead endpoint every render and calling a
  failed check fresh. Pending state has a 450ms floor started *alongside* the
  fetch, so it never delays a slow check, only stops a fast one flashing. Marker
  is amber; green is now only the transient confirmation. Verified in a browser
  for the two things unit tests cannot settle — the upward tooltip staying on
  screen and the pending state being legible on a cached check. 210 → 228 tests.
  See `plan/done/2026-08-06-upgrade-check-feedback.md`.
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

**The queue is empty.**

Four round-trip items shipped in a row on 2026-08-05/06 (emphasis around inline
code, fence shape, nested block indent, and now the link passes skipping code),
all under ADR `0015`, plus the share-page task-list fix under ADR `0025`. The
`0003`, `0004` and `0005` slots have each been used more than once; numbers are
reused once an item ships.
Not queued, because it needs a decision first: **ADR `0044`** — what the URL
addresses. Written by the 2026-08-05 audit, promoted from
`_agent/prompts/routing-adr.md` (now removed) where it had been invisible to
both `INDEX.md` and the queue. `Proposed`: it fixes the slug rule as a
compatibility surface and settles that heading anchors are addressable while
sidebar/view selection stays out of the URL. Implementation is queued once it
is `Accepted`.

## Backlog — not queued, and why

- **`bodyHasUnsafeForBlockNote` does not skip code.** It runs `MD_LINK` over the
  whole body, so a note that merely *mentions* a media link inside a fence is
  routed to the raw editor rather than the block editor. Found while fixing ADR
  `0015` r7 and left alone: it is a false positive in the safe direction (the
  note is still editable) and the function answers a different question than the
  pre-processors do — "could this note lose data in BlockNote?" is reasonably
  answered conservatively. Worth an item only if a real note trips it.

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
