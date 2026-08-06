---
adr: 0038
title: In-app upgrade notice — fetch published tags, compare, notify
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0012, 0037]
tags: [ux, release, distribution]
---

# ADR 0038 — In-app upgrade notice — fetch published tags, compare, notify

## Context

An adopter running an older framework version has no way to learn a newer one
exists short of checking the repository. The versioning policy
(`adr/0037-*.md`) makes both halves of the comparison available: the published
versions are the repository's `vX.Y.Z` git tags, readable from a public,
token-free endpoint, and the running framework version is baked into the build
and shown in the status bar beside the vault build chip
(`adr/0012-build-version-chip.md`). That indicator is where this notice
attaches: the version is already displayed, so the notice marks it rather than
introducing a second surface.

Two properties of that data shape the decision. The tag list is returned in
lexicographic order, not semver or chronological order — `v0.10.0` sorts before
`v0.6.1` — so "the newest version" requires sorting the list by semver rather
than taking the first entry. And a build can legitimately be *ahead* of every
published tag (a maintainer working on `main` after tagging), so the comparison
must be "strictly newer", not "different": inequality would show a permanent,
wrong upgrade notice in that case.

## Capability statement

While the portal is open it fetches web-vault's published tag list from the
GitHub API, resolves the highest `vX.Y.Z` by semver comparison, compares it to
the running build's framework version, and — when the published one is strictly
newer — surfaces a non-blocking "update available" indicator naming that
version. It is **read-only**: it notifies, it does not upgrade anything.
Performing the upgrade is `adr/0039-*.md`.

## User stories / scenarios

- As an adopter, I see an unobtrusive notice when a newer web-vault version is
  published, so I know an update exists.
- As a maintainer running a build ahead of the newest tag, I see no notice.

## Acceptance criteria

1. The portal fetches web-vault's published tags from GitHub without any secret
   or token (public endpoint), against the framework's own repository — not a
   repository derived from the adopter's environment.
2. Tags are filtered to the `vX.Y.Z` form and the highest is selected by
   numeric semver comparison of the three components, never by the order the
   API returns or by string comparison.
3. The notice is shown only when that version is strictly newer than the
   running build's framework version; an equal or older one shows nothing.
4. The notice attaches to the status-bar version indicator
   (`adr/0037-*.md`), which keeps showing the running version whether or not an
   update exists.
5. The notice is non-blocking and dismissible; it never auto-upgrades or reloads.
6. A network/API failure is silent — no error surfaced, no notice shown.
7. The check is throttled so that ordinary use stays well inside the
   unauthenticated GitHub rate limit (60 requests/hour per IP).

## Out of scope

- Performing the upgrade (`adr/0039-*.md`).
- Notifying about anything other than the framework version (e.g. vault
  content freshness — that is `adr/0030-*.md`).
- Showing release notes / a changelog in the notice: no notes surface is
  published (`adr/0037-*.md`).
- Pre-release or non-`vX.Y.Z` tags.

## Open questions

- Poll cadence and cache lifetime for the throttle in AC6 (once per session vs.
  a stored timestamp).
- Whether the notice is a marker on the version indicator alone or also links
  out to the repository's tag/compare view.

## References

- adr/0012-build-version-chip.md
- adr/0037-versioning-and-release-policy.md
- adr/0039-adopter-upgrade-path.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |
| 2026-08-06 | r2 | marco | Retargeted from GitHub Releases to the published tag list, following `adr/0037-*.md` r2. Made semver sorting and the strictly-newer comparison explicit, dropped release notes from the notice, added a rate-limit criterion. |
| 2026-08-06 | r3 | marco | Anchored the notice to the status-bar version indicator introduced by `adr/0037-*.md` r3 (new AC4), closing the placement open question. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
