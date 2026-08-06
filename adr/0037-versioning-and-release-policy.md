---
adr: 0037
title: Versioning policy — semver over git tags, framework version in the build
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0005, 0012, 0029]
tags: [release, versioning, distribution]
---

# ADR 0037 — Versioning policy — semver over git tags, framework version in the build

## Context

The framework is distributed as a git-tag dependency: each adopter's thin shell
pins `web-vault` to `github:<owner>/web-vault#vX.Y.Z`
(`adr/0005-framework-package.md`, `adr/0029-cli-setup-and-distribution.md`).
Tags `v0.1.0`…`v0.6.1` already exist and `package.json` already carries a
`version`, but nothing states what a bump *means* for an adopter, and the
running app has no idea which framework version it is — the build bakes only the
vault's commit identity (`build { sha, short, dirty, builtAt, repo }`,
`adr/0012-build-version-chip.md`). That second gap blocks the in-app upgrade
notice (`adr/0038-*.md`): there is nothing local to compare a published version
against.

Two constraints, recorded so they are not re-litigated:

- A `#semver:^X.Y.Z` range on a git-tag dependency does not auto-upgrade an
  already-installed shell — the lockfile pins the resolved commit until an
  explicit update. Registry-style semver would require publishing to npm, a
  separate and larger decision, out of scope here.
- The git tag is already the thing adopters pin and is already public and
  machine-readable (`/repos/<owner>/<repo>/tags`). Introducing a parallel
  publication surface — GitHub Releases, or a moving `latest` ref — would add a
  per-release ceremony and a second source of truth that can drift from the
  tags, without answering any question the tags do not already answer. A moving
  ref resolves to a commit SHA, not a version, so it would still require reading
  the tag list to name the version. Release notes are the one thing Releases
  would add; nothing in the dependent ADRs requires them, and adding Releases
  later is additive to this decision.

## Capability statement

web-vault versions itself with semantic versioning, published solely as
annotated git tags `vX.Y.Z` — the tag list is the authoritative answer to "what
versions exist". The build bakes the running framework version into the content
artifact alongside the existing vault build identity, so the app knows its own
version, and the status bar shows that version next to the existing vault build
chip. The policy defines what each version component means to an adopter and
how they pin it.

### Semver policy

Applied to the **adopter-facing contract**: the `wv` CLI, the shell's
`package.json`/config surface, the vault layout the build expects, and the
deployment substrate it produces. Changes internal to the app that leave that
contract intact are not breaking.

- **major** — the adopter must change something to stay working: a renamed or
  removed config key, a changed vault-layout expectation, a dropped CLI flag or
  command, a deployment-substrate change requiring adopter action.
- **minor** — additive and backward compatible: new capability, new optional
  config, new CLI surface. An adopter upgrades without touching their shell.
- **patch** — fixes and internal changes with no contract change.

While the version is `0.x`, the shell contract is not yet frozen and breaking
changes ride the **minor** component (`0.6.z → 0.7.0`), per the ordinary 0.x
convention; `patch` keeps its meaning. Declaring a `1.0.0` — freezing the
contract so breaking changes require a major — is a future decision, not an
obligation created here.

## User stories / scenarios

- As an adopter, I read the policy and know whether bumping my pin to a given
  version can require me to change my shell.
- As an adopter, I can see which framework version I am running, in the status
  bar, next to (and distinguishable from) the vault commit already shown there.
- As the app, I can compare the version I was built from against the published
  tag list to tell whether a newer version exists (`adr/0038-*.md`).

## Acceptance criteria

1. The semver policy above is the documented contract: what major, minor and
   patch mean for adopters, including the 0.x rule that breaking changes ride
   the minor component.
2. Every published version is an annotated git tag named `vX.Y.Z`, matching the
   `version` in the framework's `package.json` at that commit. No other
   publication surface is required for a version to count as published.
3. Every place in the repository that names a version — the declared `version`,
   the tag, the adopter pin in the install docs, and the versioned link in the
   onboarding prompt — moves together with the tag, and the procedure for doing
   so is documented where a contributor or agent cutting a release will read it
   without being told (`AGENTS.md`).
4. The build bakes the framework's own `version` (read from the package's
   `package.json`, not the adopter's) into the content artifact's `build`
   object, distinct from the vault commit fields it already carries.
5. The status bar renders that version alongside the existing build chip
   (`adr/0012-build-version-chip.md`). The two are different identities — the
   framework's version and the adopter's vault commit — and the surface makes
   which is which unambiguous rather than presenting them as one value.
6. The recommended adopter pin style is an exact tag (`#vX.Y.Z`), not an
   auto-updating range, with the reason: the lockfile pins the resolved commit
   either way, so a range creates the illusion of tracking without the effect.

## Out of scope

- Publishing to the npm registry.
- GitHub Releases, release notes, and any moving `latest` ref (see Context).
- Declaring `1.0.0` / freezing the shell contract.
- The in-app upgrade notice (`adr/0038-*.md`) and the adopter upgrade mechanism
  (`adr/0039-*.md`) — this ADR only makes them possible.
- Any upgrade-available styling or affordance on the version indicator; the
  indicator states the running version unconditionally, and the notice built on
  top of it is `adr/0038-*.md`.

## Open questions

- None.

## References

- AGENTS.md (Cutting a release)
- adr/0005-framework-package.md
- adr/0012-build-version-chip.md
- adr/0029-cli-setup-and-distribution.md
- adr/0038-in-app-upgrade-notice.md
- adr/0039-adopter-upgrade-path.md
- scripts/build-content.mjs (gitBuildInfo)
- scripts/paths.mjs (PACKAGE_DIR)

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |
| 2026-08-06 | r2 | marco | Dropped GitHub Releases and the `1.0.0` commitment; git tags are the sole publication surface. Added the semver policy inline (incl. the 0.x rule) and the requirement to bake the framework version into the build. |
| 2026-08-06 | r3 | marco | Brought the status-bar version indicator into scope (new AC5), sitting beside the vault build chip and distinguishable from it. Added AC3: every version reference in the repo moves with the tag, with the procedure documented in `AGENTS.md`. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
