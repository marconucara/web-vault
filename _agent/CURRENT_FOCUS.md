# Current Focus

This file is the LIVE SNAPSHOT of any in-flight session. It is short on purpose
— the durable record lives in git (`git log`), `_agent/WORKLOG.md`, and
`plan/done/`. The queued work lives in `plan/todo/`.

If status files and git disagree, git is authoritative; correct this file.

## Active state

- **Branch:** main
- **Active item:** none in flight. **The queue is empty** —
  `done/2026-08-11-one-tooltip-across-the-interface` is the most recent item.
- **Blockers:** none.
- **Uncommitted work:** none.
- **Unreleased on `main`:** the tooltip migration
  (`done/2026-08-11-one-tooltip-across-the-interface`). Deliberately not
  released — accumulating further changes before the next version. The four
  version locations still read `v0.11.1`, which is correct: that is the last
  *published* version, and they move together with the tag when one is cut.

## Release state

- **`main` is ahead of the last tag.** The tooltip migration sits on `main`
  unreleased, by choice. Whatever is cut next carries it, so its exit criteria
  are part of that release's manual check, not only of its own.
- **Current tag: `v0.11.1`** — ADR `0034` r5: commit actions hold their place.
  They are rendered whatever the deployment answers and go inert until write
  access is confirmed, tipped *Editing is off* once the answer is settled.
  - **A patch, not a minor.** Nothing in the adopter-facing contract moved —
    same CLI, same config, same vault layout, same endpoint. What changed is how
    one state is drawn.
  - **This reverses r4, which was three days old and deliberate.** The absence
    rule was sound on its own terms and wrong in the app: withholding a control
    until the probe answers makes it *arrive*, and arriving reflows every row
    below it. Criterion 10 already forbade exactly that for the note body; the
    controls had simply been left out of the reasoning. Found by using the
    shipped feature, not by reading it.
  - **`aria-disabled`, never `disabled`.** The attribute suppresses hover and
    focus, so a natively disabled control is mute exactly when it is asked to
    explain itself — which makes "disabled plus tooltip" impossible the obvious
    way. It is also advisory, so the handler must be swallowed explicitly.
  - **Three collisions with rules that already existed**, all invisible to the
    tests and all found by hand: `opacity` on a button dims its own `::after`
    tooltip; a class-based `:hover` outranks a bare attribute selector, so one
    `+` lit up and its twin did not; `.tt` without `data-tip` paints an empty
    bubble. Any CSS state added to an existing control wants a pass over what
    that control's classes already assert.
- **Previous tag: `v0.11.0`** — ADRs `0034` (client preferences) and `0047` (the
  UI language layer), released together: `0047` had been sitting unreleased on
  `main` and `0034` is what gives it a control.
  A modal opened from the status bar holds this browser's preferences —
  interface language, date and time format, whether the Inbox row is shown —
  and is where a deployment that cannot commit explains itself.
  - **The minor is for the contract, not the modal.** `src/locales/<code>.json`
    became a surface adopters can see and reason about, and preferences add
    `localStorage` keys plus the `/api/capabilities` answer becoming
    load-bearing for what the UI offers. Per `0037` a contract addition rides
    the minor in `0.x`.
  - **"Auto" is the ABSENCE of a stored key, never a sentinel.** A stored
    `"auto"` would satisfy every other requirement and still pin the language of
    someone who never chose one, the moment they changed their browser. Pinned
    by a test for that reason.
  - **Language and formatting are separate choices and stay separate.** One
    picks a catalogue and drops the region; the other is nothing but the region.
    Tying them would offer an `en-GB` reader only the American date order — the
    failure `0047` split them to prevent. The format list is curated
    (`FORMAT_LOCALES`, four entries) and extending it is a one-line change, not
    a decision.
  - **Commit actions are withheld until write access is CONFIRMED**, so the
    unanswered and the negative case collapse into one positive test and no cold
    load shows an action about to vanish. The note body is the opposite: always
    rendered, read-only until confirmed. Content and controls, different rules.
  - **Discarding a draft is not a commit**, so it is deliberately outside the
    gate — otherwise a draft made before a token was removed would be
    untouchable.

- **Previous tag: `v0.10.0`** — ADR `0046`, type visibility (plan
  `done/2026-08-11-type-visibility`).
  A type document carrying `visible: false` is kept out of the sidebar, and a
  manager opened from the Types heading lists every type, hidden included, with
  a switch each. `visible` was already Tolaria's key and already present in real
  vaults, so this makes web-vault honour a format it was ignoring rather than
  inventing one; a vault that never carried the key renders exactly as before
  and is not written to until a toggle is used.
  - **The tag is a minor because of `0044`, not because of this.** Type
    visibility on its own is a patch — nothing in the adopter-facing contract
    moves. It does not travel alone: the heading anchors had been sitting
    unreleased on `main` since 2026-08-11, and `0037` puts a contract addition
    on the minor, so the first tag cut after them carries that weight.
  - **The key is bare `visible`, and `_visible` is deliberately NOT an alias**,
    unlike `icon`/`color`/`order`. Tolaria writes and reads only the bare
    spelling — confirmed by toggling from its own UI and reading the file — so
    accepting the underscore form would hide a type here that stays visible
    there. A test pins the asymmetry so it reads as a decision.
  - **Visibility is a surface of its own, not a field in the type panel.** A
    checkbox there would put the control that removes a sidebar row inside that
    row's only route: hide a type and it becomes uneditable from the app. The
    manager is reachable whatever is hidden, and makes "hidden" a state you read
    rather than an absence you must remember. This is why Tolaria has the same
    split, understood only after finding its menu.
  - **Showing removes the key rather than writing `visible: true`**, so
    hide-then-show returns the file byte-identical (pinned by a test) and files
    are never littered with a key stating the default.
- **Also in `v0.10.0`:** ADR `0044`, heading anchors in the URL (plan
  `done/2026-08-11-heading-anchors-in-the-url`). The hash now addresses a note
  and, optionally, a heading within it (`#/n/<id>#<slug>`), on the same slug
  rule in the editor and on the share pages, with a hover affordance that copies
  the link. **This is what makes the tag a minor** per `0037`: `#/n/<id>` is
  unchanged and every existing link still resolves, but the anchor half of the
  grammar and the slug rule become a compatibility surface the moment a vault
  author writes one, so it is a contract addition rather than a fix.
  - Two divergences are deliberate and pinned by tests, not defects to chase:
    duplicate headings share an id in the editor (its `render` sees one block
    and has no document-wide counter) while the share pages number them
    `-1`, `-2`; and a heading opening with `🗺️` slugs to a leading invisible
    character, because `github-slugger` keeps the U+FE0F variation selector.
    That is GitHub's own output and is matched deliberately — a reason to avoid
    emoji in headings meant to be linked, not to diverge from the ecosystem.
  - The copy affordance is **not keyboard reachable**: it is a CSS `::after`,
    which cannot hold focus. Accepted so the editor DOM stays untouched; a
    focusable control would have to live outside it, and is deferred in `0044`
    along with the same affordance on the share pages.
- **`v0.9.1`** — a wikilink inside a table cell is a link again
  (plan `done/2026-08-10-wikilinks-inside-a-table`). A table's content is a
  `tableContent` object, not an inline array, so the guard that maps a block's
  inline content skipped every cell: the ‹…› token showed on screen verbatim
  and was written back on save, so correcting it by hand did not hold. Fixing
  that exposed a second defect on the way out — the alias pipe was restored
  before the row was compacted, and `compactTableLine` split the cell on it.
  Carries what was unreleased since `v0.9.0`: the icon chunk grouping (plan
  `done/2026-08-10-prune-the-dynamic-icon-chunk-map`), which took `dist/` from
  ~1,760 files to ~34 with every icon still resolving. A **patch** per `0037`:
  nothing in the adopter-facing contract moves.
- **`v0.9.0`** — ADR `0045`, manage note types from the UI: a
  create/edit/delete panel for types, an icon picker over the whole lucide
  catalogue, and a type derivation that reads the live note set instead of a
  build-time constant.
- **`v0.8.3`** — the one-click upgrade actually works. ADR `0039`
  r5: the tag lookup sent no `User-Agent`, which GitHub refuses with a 403, and
  every non-OK response was read as "not published" — so the action failed for
  every adopter on a Worker while blaming the release. A **patch**: the
  endpoint's contract is unchanged, it merely works now.
  - **Adopters on `v0.8.2` or earlier cannot upgrade from the UI**, because the
    broken validator is the one running. They need the pin moved by hand once;
    from `v0.8.3` on, the button works.
- **`v0.8.2`** — three fixes, no adopter-facing contract change, so a **patch**
  per `0037`. ADR `0016` r2: an editor link chip opens on a plain click or tap
  instead of Cmd/Ctrl+click, which a touch device cannot produce at all, so on
  mobile a wikilink could not be followed; a resolved chip is now an anchor and
  modifier/middle click opens a new tab. Plus the build chip using the app's own
  tooltip, and a command that regenerates the README hero animation.
- **Previous tag: `v0.8.1`** — type icons bundled at build time.
- **`v0.8.0`** — the upgrade loop closes. ADR `0039`: the notice
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

- **ADR `0047` — UI language, i18n layer and locale selection (2026-08-11,
  `7cfa1e6`, unreleased).** Every string the shell rendered was an inlined
  English literal with no seam a translation could enter. Now i18next +
  react-i18next over JSON catalogues committed at `src/locales/` (`en`, `it`),
  bundled statically, swept across `App.jsx` and 12 components including the
  `title`/`aria-label`/`placeholder` attributes.
  - **The layer persists nothing, deliberately.** It exposes
    `initI18n({ locale, formatLocale })` at boot and `setLocale`/
    `setFormatLocale` at runtime, and reads no storage. That keeps `0034` the
    single owner of the preferences and their `localStorage`, so the settings
    modal is an additive change rather than a rework of this.
  - **The two resolutions disagree about region subtags, and that is the whole
    point.** Picking a catalogue drops the region (one Italian catalogue,
    reachable from `it-CH`); formatting keeps it. Driving `Intl` from a bare
    `en` would have turned a UK reader's `11 Aug 2026` into `Aug 11, 2026` — a
    regression shipped inside the feature meant to improve localisation. Found
    by reading the three date call sites *before* implementing (two hardcoded
    `en-GB`, one system default); `formats.test.js` pins the exact strings.
  - **Missing keys render the key, never the English string.** A silent English
    fallback makes a half-translated catalogue look finished. Safe only because
    the gate enforces parity — key sets, plus no blank values and matching
    `{{placeholders}}`, since a translation that drops `{{name}}` still renders
    a sentence, just without the thing it was about.
  - **Two silent bugs, both caught by tests rather than by review.** `initI18n`
    applied its argument conditionally, leaving the *previous* language standing
    when the injected one was unsupported; `parseMissingKeyHandler` had the wrong
    arity (i18next calls it `(key, value)`), returned `undefined`, and i18next
    rendered `{}` — making the gap invisible, which is exactly what that handler
    exists to prevent.
  - **The suite is pinned to `en`/`en-GB` in `src/testSetup.js`, not merely
    initialised.** Node has its own `navigator`, so an Italian machine would
    render Italian and fail the gate for a reason unrelated to the change under
    test.
  - `t` was shadowed twice, in `Sidebar` and `TypeVisibility`, both mapping over
    types with `t` as the loop variable. Renamed to `name` with a comment: the
    symptom is a label quietly becoming a type name.
  - 396 → 444 tests. See `plan/done/2026-08-11-ui-language-i18n-layer.md`.
- **ADR `0046` — type visibility (2026-08-11, `f528ce3`, `v0.10.0`).** `Type`, the
  meta-type every type document carries, had become a sidebar row that could
  never be populated: `0045` made the list the union of declared and used types,
  and `contentOnly` excludes `type: Type` notes from every list, so selecting it
  showed an empty list *by construction*. Tolaria hides it with `visible: false`;
  web-vault read no such key. **How the format was established matters more than
  the format**, because two early readings were wrong and each would have
  produced a different ADR: Tolaria does **not** re-read a type document's
  frontmatter without a restart, so three tests run against a refresh proved
  nothing; and a note that was never indexed is invisible for that reason alone —
  a probe created from outside a running Tolaria read exactly like a hidden one,
  and briefly convinced both of us that `visible` worked on ordinary notes. It
  does not. Every later test started from something already visible, so that
  "it disappeared" had one meaning. What survived: `visible` is type metadata
  only; the key is bare, never `_visible`; a hidden type keeps its notes in every
  list and count; absent means visible. The manager is a surface of its own for
  the reason Tolaria's is — a checkbox in the type panel would hide the row that
  is the only way back to that panel. `functions/commit.js` had to learn
  `visible` in its closed `SETTABLE_KEYS` allowlist; the `CommitFile` typedef had
  to admit booleans. 367 → 396 tests. See
  `plan/done/2026-08-11-type-visibility.md`.
- **Icon chunks grouped into buckets (2026-08-10, `0ee05f6`, `v0.9.1`).** lucide's
  dynamic entry point states the whole catalogue as a map of ~1,750 `import()`s,
  so Rollup emitted one chunk per icon — nothing slow at runtime, but a `dist/`
  full of noise. `0045` settled the shape by landing a picker over the full
  catalogue: the set must stay reachable, so the icons are **grouped, not
  removed**. Buckets key on a **hash of the name**, not the first letter:
  alphabetical groups are lopsided (`s` 146 KB, `c` 144 KB against a ~40 KB
  mean), and the path that pays is not the picker but `Icon.jsx`'s step-3
  fallback — a type icon chosen in the running app, painted in the sidebar —
  where the rest of the letter is dead weight. ~1,760 → 34 assets on a real
  vault. **Both rendering paths were checked, because they fail differently:**
  the vault's type icons are still eager in the main bundle (the 2026-08-06
  bundling item untouched, first paint unchanged), and the dynamic map still
  resolves 2,007 names across 24 buckets. That second check greps the
  *minified* bundle, where the map reads
  `s(()=>import("./lucide-NN-*.js").then(t=>t.aq))` — two plausible regexes
  matched nothing and read as "the map is gone" before the real shape was
  inspected; re-verify by looking at the emitted code, not by trusting a
  pattern. 327 → 333 tests. See
  `plan/done/2026-08-10-prune-the-dynamic-icon-chunk-map.md`.
- **ADR `0015` r7 — the link passes must skip code (2026-08-06, `c2cd6e0`, `v0.8.1`).**
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
- **ADR `0038` — in-app upgrade notice (2026-08-06, `07173a2`, `v0.8.0`).** The portal
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
  `d8cb7c2`, `v0.8.0`).** The decision was rewritten before being built. It had
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

`0001`–`0047` exist. All **Implemented** except: `0026` **Superseded** (by
`0040`), and `0030`, `0031`, `0032`, `0034`, `0043` still **Proposed** —
decisions drafted, not built. `INDEX.md` is authoritative.

## Next item

**The queue is empty.** The UI language layer
(`done/2026-08-11-ui-language-i18n-layer`, queue slot `0008`) was the last item
to ship, 2026-08-11.

**`0034` is the obvious next one, and it is now cheap.** It was already
`Proposed` with a language selector among its preferences; `0047` deliberately
built the seam and left the storage alone, so the modal supplies
`{ locale, formatLocale }` at boot and calls `setLocale`/`setFormatLocale` at
runtime. Two selectors, not three — a separate date/time format setting was
considered and rejected in `0047`, because owning the patterns is a different
and much larger decision than choosing two locales. `0034` also still carries
the editor gating and the Inbox toggle, so it is not a one-line item.

Numbers in `plan/todo/` are reused once an item ships — the `0003`, `0004` and
`0005` slots have each been used more than once, so a new item takes the lowest
free number, not the next unused one.

## Backlog — not queued, and why

- **`bodyHasUnsafeForBlockNote` does not skip code.** It runs `MD_LINK` over the
  whole body, so a note that merely *mentions* a media link inside a fence is
  routed to the raw editor rather than the block editor. Found while fixing ADR
  `0015` r7 and left alone: it is a false positive in the safe direction (the
  note is still editable) and the function answers a different question than the
  pre-processors do — "could this note lose data in BlockNote?" is reasonably
  answered conservatively. Worth an item only if a real note trips it.

- **The heading-anchor copy affordance is not keyboard reachable.** It is a CSS
  `::after` on the rendered heading, which cannot hold focus. Accepted in `0044`
  so the editor DOM stays untouched — a focusable control has to live outside it
  — and deferred there alongside the same affordance on the share pages. A small,
  already-scoped item whenever it is wanted.
- **ADR `0042` left the wordmark's typeface unsettled**, and whether the brand
  accent eventually replaces the UI's generic blue. The rest shipped in `v0.6.0`.
  `brand/mark.svg` is authoritative for the form; `src/components/BrandMark.jsx`
  is that geometry inlined so it can take `currentColor` — if the drawing is
  refined, both move together, and `adr/assets/0042-brand-components.jsx` holds
  the design-tool source it was settled in.
- **Build-time surfaces are still English**, by decision in `0047`: the public
  share pages (`0025`) and the real 404 (`0027`) render outside the app shell,
  and their locale cannot be read from the visitor's browser at build time.
  Choosing it per build or per share is a separate decision, not an oversight.
  The same goes for commit messages the app writes — those are git history, read
  by other tools and other people, and stay English on purpose.
- **BlockNote's dictionary falls back to English** for a language it ships none
  for. Unlike our own missing-key rule this is correct: that catalogue is not
  ours to complete, so there is no gap for anyone to act on. Only becomes a
  question if we add a locale BlockNote lacks.
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
