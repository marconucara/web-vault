---
adr: 0037
title: Versioning and release policy — semver, 1.0.0, GitHub Releases
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0005, 0029]
tags: [release, versioning, distribution]
---

# ADR 0037 — Versioning and release policy — semver, 1.0.0, GitHub Releases

## Context

The framework is distributed as a git-tag dependency: each adopter's thin shell
pins `web-vault` to `github:<owner>/web-vault#vX.Y.Z`
(`adr/0005-framework-package.md`, `adr/0029-cli-setup-and-distribution.md`).
There is no declared versioning contract, no "latest" endpoint, and no
release-notes surface. That blocks two downstream capabilities — an in-app
upgrade notice (`adr/0038-*.md`) and an adopter upgrade path (`adr/0039-*.md`) —
which both need a well-defined "what is the latest version, and what changed".

Note (constraint, not to be re-litigated here): a `#semver:^1.0.0` range on a
git-tag dependency does not auto-upgrade an already-installed shell — the
lockfile pins the resolved commit until an explicit update. True registry-style
semver would require publishing to npm, which is a separate, larger decision and
out of scope here.

## Capability statement

web-vault follows semantic versioning, cuts a stable `1.0.0`, and publishes each
release as a **GitHub Release** (tag + release notes) so that "latest version"
and "what changed" are machine-readable from a stable endpoint. Adopters keep
pinning by tag; the release policy defines how versions are numbered and what an
adopter and the app can rely on being published.

## User stories / scenarios

- As an adopter, I can tell which web-vault version I run and read what changed
  between it and the latest.
- As the app, I can fetch the latest published version and its notes from a
  stable endpoint to drive an upgrade notice.

## Acceptance criteria

1. A documented semver policy states what major/minor/patch mean for this
   framework (breaking shell/config change vs. additive vs. fix).
2. A `1.0.0` GitHub Release exists, with the running version discoverable from
   the build (ties to `adr/0012-build-version-chip.md`).
3. Each release is a GitHub Release with human-readable notes, exposing
   `latest` via the GitHub API.
4. The recommended adopter pin style is documented (tag pin, not a bare
   auto-updating range), with the reason.

## Out of scope

- Publishing to the npm registry.
- The in-app upgrade notice (`adr/0038-*.md`) and the adopter upgrade
  mechanism (`adr/0039-*.md`) — this ADR only makes them possible.

## Open questions

- Whether release notes are hand-written or generated from Conventional Commits.

## References

- adr/0005-framework-package.md
- adr/0012-build-version-chip.md
- adr/0029-cli-setup-and-distribution.md
- adr/0038-in-app-upgrade-notice.md
- adr/0039-adopter-upgrade-path.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
