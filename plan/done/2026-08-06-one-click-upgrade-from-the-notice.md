# One-click upgrade from the version notice

**Owning ADR(s):** `adr/0039-adopter-upgrade-path.md`
**Dependencies:** `adr/0038-*.md` (shipped — the notice and the version
comparison it reads), `adr/0018-*.md` and `adr/0020-*.md` (the commit endpoint
and its branch resolution).

## Context

The notice shipped by `adr/0038-*.md` reports that a newer framework version is
published and offers exactly one action: open the tag on GitHub. Everything after
that is manual — edit the `web-vault` pin in `.web/package.json`, reinstall.

The pieces to close that loop already exist. The pin is one line in a tracked
file in the adopter's own repository. A commit targets the branch the deployment
was built from, so the push rebuilds the deployment and the rebuild reinstalls
the framework at the new pin — no separate reinstall step to orchestrate. And
writing at all is already conditional on a server-side GitHub token.

Two facts about the current code shape this work.

`isSafeNotePath` in `functions/commit.js:24` rejects `.web/package.json` three
times over: it requires `.md`, rejects any segment starting with `.`, and says so
in its comment (*"so .web/, .git, etc. are excluded"*). That guard keeps the note
editor away from the toolchain and must survive this item intact.

There is no client-side notion of "this deployment can write". Every caller of
`commitFiles` attempts the commit and learns of a missing token from a 500. That
is tolerable for an editor action the adopter deliberately invoked; it is not
tolerable for choosing which of two labels a panel renders before any click.

## Scope

- **Capability signal.** Expose whether the running deployment can write, and
  read it in the client. Server-side, not inferred from a failed commit
  (AC 1). Keep it to what this item needs — a read-only "can write" answer, no
  broader capability surface.
- **Upgrade endpoint.** A dedicated route, separate from `/api/commit`, whose
  entire write scope is the `web-vault` dependency pin in the shell's
  `package.json` (AC 4). It must:
  - resolve and validate the target as a published `vX.Y.Z` tag of the framework
    repository before writing anything (AC 5);
  - rewrite only the pin's version, preserving every other byte of the file
    including key order and formatting (AC 3) — a targeted rewrite, not a
    `JSON.parse`/`stringify` round trip, which would reformat the adopter's file;
  - commit to the deployment's branch via the existing branch resolution
    (`adr/0020-*.md`);
  - no-op with a plain report when the pin already names the target, or when no
    resolvable pin is present (AC 6).
- **Note guard untouched.** `isSafeNotePath` and `/api/commit` keep their current
  behaviour; add a test asserting the note endpoint still cannot write
  `.web/package.json` (AC 4).
- **Panel states.** With an update available: writable → the upgrade action;
  not writable → today's published-version link, and no action offered (AC 2).
  Both states keep the version comparison and copy from `adr/0038-*.md`.
- **Post-click resolution.** After a successful commit, report that the upgrade
  is building, then resolve on its own once the rebuild has published the new
  version (AC 7). The running version comes from the build, so this is a
  reload-aware check against the deployed version rather than an assumption that
  the build succeeded — a rebuild can fail, and the panel must not claim a
  version that never shipped.
- **Failure reporting.** Missing token, endpoint error, rejected commit: state
  the failure in the panel and leave the deployment unchanged (AC 8). No silent
  no-op.
- **Docs.** Document the upgrade alongside install in the delivery docs (AC 10).

## Out of scope

- Widening `isSafeNotePath`, or routing the pin bump through `/api/commit`.
  Rejected on ADR 0039: it would give every caller of the note endpoint write
  access to the toolchain.
- Any write to `.web/` other than the `web-vault` pin.
- Downgrade, or upgrade to a version other than the newest published tag.
- Migrating breaking configuration between versions (`adr/0037-*.md`: in `0.x` a
  breaking adopter-facing change rides the minor).
- Upgrading a local development shell.
- Using the new capability signal to gate editing, sharing, or delete. Editing
  keeps its current behaviour; unifying the two is a later decision.

## Exit criteria

1. The client reads a server-provided write capability; no code path infers it
   from a failed commit.
2. With an update available, a writable deployment renders the upgrade action and
   a non-writable one renders only the published-version link — both covered by
   tests.
3. A successful upgrade commits a `.web/package.json` differing from its input in
   the pin version and nothing else, asserted byte-for-byte in a test.
4. The upgrade endpoint refuses a target that is not a published `vX.Y.Z` tag,
   and writes nothing in that case.
5. Pin-already-current and no-resolvable-pin both no-op with a stated reason.
6. A test asserts `/api/commit` still rejects `.web/package.json`.
7. The post-commit state reports "building", then resolves to the new version
   once it is live; a rebuild that never publishes the new version does not
   produce a false success.
8. Every failure path leaves a stated error in the panel and no partial write.
9. Nothing upgrades without an explicit adopter action.
10. The upgrade path is documented next to install in the delivery docs.
11. `yarn verify` green.

## Shipped

Shipped in `18b4511`, released as `v0.8.0`.

**Where the deployed version had to come from.** The post-commit resolution
(exit criterion 7) needs to observe the rebuild landing, and there was nothing to
observe: the framework version is compiled into the bundle and invisible to a
fetch — no `build-info.json` exists. A client watching its own bundle would wait
forever, because that version is fixed at page load and cannot change underneath
it. The version is now build-injected into the Worker config
(`generate-worker.mjs`) and reported by the capability endpoint alongside
`canWrite`, so the poll asks the deployment rather than itself.

**What the capability signal settled elsewhere.** `adr/0034-*.md` had left the
mechanism as an explicit open question for its own plan (`build-info` flag vs a
runtime response). Implementing this item forced the answer — runtime, because
the token is a host secret added *after* deploying — so 0034 was updated to
consume the endpoint rather than define it. Its editor gating remains unbuilt and
is unaffected in scope.

**Local parity.** `wv dev` serves both endpoints (`capabilities-dev.mjs`,
`upgrade-dev.mjs`) so the flow is exercisable without a deployment. Two
deliberate differences from production: `canWrite` is true regardless of any
token, because local writes go to disk and no token authorizes them
(`adr/0036-*.md`); and the response carries `local: true`, so the client reports
"reinstall to pick it up" instead of polling for a rebuild that dev will never
perform. Tag validation is NOT skipped locally — dev must not accept a target
production would refuse.

Verified end-to-end against the live GitHub API before release: an unpublished
tag and a malformed version are both refused without writing, and a real tag
rewrites exactly one line with the rest of the manifest byte-identical.
