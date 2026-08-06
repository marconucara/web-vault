# In-app upgrade notice — fetch published tags, compare, notify

**Owning ADR(s):** `adr/0038-in-app-upgrade-notice.md`
**Dependencies:** `adr/0037-*.md`, shipped 2026-08-06 (`d8cb7c2`) — the build now
carries `build.frameworkVersion` and the status bar shows it. That is the local
half of the comparison this item completes.

## Context

The status bar states the running WebVault version but nothing tells an adopter
that a newer one exists. `adr/0037-*.md` made both halves available: published
versions are the framework repository's `vX.Y.Z` git tags, readable from a
public token-free endpoint, and the running version is baked into the build.

Two properties of that data drive the implementation and are easy to get wrong
in ways that look fine locally:

- `GET /repos/<owner>/<repo>/tags` returns tags in **lexicographic** order, not
  semver and not chronological. `v0.10.0` sorts before `v0.6.1`, so taking the
  first entry silently starts failing at the tenth minor.
- A build can legitimately be **ahead** of every published tag — a maintainer
  running `main` after tagging. The comparison must be strictly-newer, not
  inequality, or that maintainer sees a permanent false notice.

Both are already acceptance criteria in the ADR; they are repeated here because
neither reproduces in a fresh install where the version equals the newest tag.

The repository to query is **web-vault's own** and belongs in framework code as
a constant. `build.repo` is the *adopter's vault* repo — the same identity
confusion as `PACKAGE_DIR`/`PROJECT_DIR` in the previous item, and it would
resolve to the adopter's own tags.

## Decisions taken (settled with the owner, 2026-08-06)

- **Poll cadence.** On page open, fetch if `localStorage` holds no previous
  check or one older than **1 hour**. Well inside the unauthenticated limit of
  60 requests/hour per IP.
- **Manual re-check.** Clicking the version indicator triggers a check, rate
  limited to one per **minute**. This applies only in the normal state — when an
  update is already known the click opens the popover instead, and there is no
  "check again" action there: the answer is already on screen.
- **Notice surface.** A green dot next to the version, and a popover anchored
  above the indicator when clicked. Not a modal: the notice is passive and
  non-blocking (ADR criterion 5). `.statuspanel` is the existing anchored-panel
  pattern in this component to follow.
- **Link out.** `https://github.com/<owner>/web-vault/tree/vX.Y.Z` — the repo at
  the new tag, whose README renders. Deliberately not `/releases/tag/...`, which
  is near-empty when no GitHub Release is published, and none are
  (`adr/0037-*.md`).
- **Dot colour: green**, chosen by the owner. Note `.status-item.sync` already
  uses green (`#2f9e57`) for "In sync" in the same bar; the two are adjacent and
  mean different things. Keep them visually separable by shape and position
  rather than colour, and check the result in both light and dark.

## Scope

- A module that fetches the tag list, filters to `vX.Y.Z`, and selects the
  highest by **numeric** comparison of the three components. Not string
  comparison, not API order. Non-matching and pre-release tags are ignored.
- Strictly-newer comparison against `build.frameworkVersion`. Equal or older
  shows nothing. A build with no `frameworkVersion` (predating `adr/0037-*.md`)
  shows nothing rather than guessing.
- `localStorage` cache holding the last check timestamp and its result, driving
  both the 1-hour automatic cadence and the 1-minute manual floor.
- Green dot on the version indicator when an update exists; click opens an
  anchored popover naming the new version, the running one, and a link to the
  tag on GitHub. Dismissible.
- In the normal state the click performs a manual check, no-op if the last one
  was under a minute ago.
- Every failure path silent: network error, non-2xx, rate limit, malformed
  payload, no usable tags. No error surfaced, no notice, nothing logged to the
  user (ADR criterion 6).
- Tests over the comparison and selection logic with the fetch stubbed —
  ordering (including a `v0.10.0` vs `v0.6.1` case), strictly-newer including
  the build-ahead-of-tag case, the missing-version case, and each failure path
  staying silent.

## Out of scope

- Performing the upgrade — `adr/0039-*.md`.
- Release notes or a changelog in the popover; no notes surface is published.
- Notifying about vault content freshness (`adr/0030-*.md`).
- Any server-side or build-time check: this is a runtime client fetch.
- Authenticated GitHub requests or a token of any kind (ADR criterion 1).

## Exit criteria

1. Highest published tag selected by numeric semver comparison; a fixture
   containing `v0.10.0` and `v0.6.1` proves order is not lexicographic.
2. The notice appears only when the published version is strictly newer;
   equal, older, and absent-`frameworkVersion` cases show nothing, each covered
   by a test.
3. The query targets the framework's own repository, not one derived from the
   adopter's environment or from `build.repo`.
4. Automatic check runs at most once an hour; the manual re-check is refused
   inside a minute. Both driven by the persisted timestamp.
5. Every failure path is silent and leaves the indicator in its normal state.
6. The popover is anchored and dismissible, never blocks the UI, and never
   reloads or upgrades anything.
7. The update dot and the "In sync" indicator remain distinguishable in both
   light and dark; confirmed in a browser, since no test settles this.
8. `yarn verify` green.
