---
adr: 0039
title: Adopter upgrade path — prompt-driven pin bump and reinstall
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0029, 0037]
tags: [distribution, onboarding, tooling]
---

# ADR 0039 — Adopter upgrade path — prompt-driven pin bump and reinstall

## Context

Adopters onboard through an agent-driven prompt that scaffolds the thin shell and
pins `web-vault` to a tag (`adr/0029-cli-setup-and-distribution.md`). Upgrading
is today a manual edit of `.web/package.json` (change the `#vX.Y.Z` pin) plus a
reinstall — the main friction point in living with the framework. With a defined
release policy (`adr/0037-*.md`) the newest tag is well-known, so the upgrade can
be made as guided as the install.

## Capability statement

An adopter upgrades via a prompt/skill — the twin of the install prompt — that
resolves the latest published release, updates the shell's `web-vault` pin to
that tag, and reinstalls, leaving the adopter's vault content untouched. The
upgrade is an explicit, guided action, not an automatic background change.

## User stories / scenarios

- As an adopter who installed via a prompt, I run an upgrade prompt and my shell
  is bumped to the latest release and reinstalled, without hand-editing config.
- As an adopter, the upgrade changes only the framework pin, never my vault
  notes or my configuration values.

## Acceptance criteria

1. A documented prompt/skill upgrades an existing shell: resolve latest release
   (`adr/0037-*.md`), rewrite the `web-vault` pin in `.web/package.json`,
   reinstall.
2. Only the dependency pin changes; adopter config and vault content are
   untouched.
3. The upgrade is explicit (adopter-invoked); nothing upgrades automatically.
4. The path is documented alongside install in the delivery docs.

## Out of scope

- Detecting that an upgrade is available (`adr/0038-*.md`).
- Auto-upgrade / unattended updates.
- Migrating breaking config changes between majors (future ADR if needed).

## Open questions

- Whether the upgrade prompt reuses the install prompt (single prompt that
  installs-or-updates) or is a distinct one.

## References

- adr/0029-cli-setup-and-distribution.md
- adr/0037-versioning-and-release-policy.md
- adr/0038-in-app-upgrade-notice.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
