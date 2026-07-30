---
adr: 0038
title: In-app upgrade notice — fetch latest release, compare, notify
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0012, 0037]
tags: [ux, release, distribution]
---

# ADR 0038 — In-app upgrade notice — fetch latest release, compare, notify

## Context

An adopter running an older framework version has no way to learn a newer one
exists short of checking the repository. The build already carries a version
identity surfaced by the toolbar chip (`adr/0012-build-version-chip.md`), and
the release policy (`adr/0037-*.md`) publishes a machine-readable "latest" via
GitHub Releases. Together they make a passive upgrade notice possible.

## Capability statement

While the portal is open it fetches the latest published web-vault release from
GitHub, compares it to the running build's version, and — when a newer version
exists — surfaces a non-blocking "update available" indicator (with the new
version and, if available, its notes). It is **read-only**: it notifies, it does
not upgrade anything. Performing the upgrade is `adr/0039-*.md`.

## User stories / scenarios

- As an adopter, I see an unobtrusive notice when a newer web-vault version is
  published, so I know an update exists.
- As an adopter, I can read what changed before deciding to upgrade.

## Acceptance criteria

1. The portal fetches the latest release version from GitHub without any secret
   or token (public endpoint).
2. It compares that version to the running build's version and shows the notice
   only when the latest is strictly newer (semver comparison).
3. The notice is non-blocking and dismissible; it never auto-upgrades or reloads.
4. A network/API failure is silent — no error surfaced, no notice shown.

## Out of scope

- Performing the upgrade (`adr/0039-*.md`).
- Notifying about anything other than the framework version (e.g. vault
  content freshness — that is `adr/0030-*.md`).

## Open questions

- Poll cadence and whether to cache the last check to avoid rate limits.
- Whether the notice links to the release notes or renders them inline.

## References

- adr/0012-build-version-chip.md
- adr/0037-versioning-and-release-policy.md
- adr/0039-adopter-upgrade-path.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
