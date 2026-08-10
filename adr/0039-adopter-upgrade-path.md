---
adr: 0039
title: Adopter upgrade path — one-click pin bump from the upgrade notice
status: Implemented
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0029, 0037, 0038]
tags: [distribution, onboarding, tooling, ux]
---

# ADR 0039 — Adopter upgrade path — one-click pin bump from the upgrade notice

## Context

The in-app notice (`adr/0038-*.md`) tells an adopter that a newer framework
version is published, and stops there: the panel's only action opens the tag on
GitHub. Acting on it is a manual edit of the `web-vault` pin in
`.web/package.json` plus a reinstall — the main friction point in living with the
framework. The notice therefore ends in a chore, which is the weakest possible
place for it to end.

Three properties of the existing system make the chore removable.

**The pin is a file in the adopter's own repository.** The shell pins the
framework as `github:marconucara/web-vault#vX.Y.Z`
(`adr/0029-cli-setup-and-distribution.md`). Upgrading is one line changing in one
tracked file — the same kind of change as editing a note.

**A commit already re-triggers the build.** The commit endpoint targets the
branch the deployment was built from, precisely so the push rebuilds that
deployment (`adr/0020-commit-target-deployment-branch.md`). A committed pin bump
therefore reinstalls the framework as a side effect of the rebuild the commit
already causes. There is no separate "reinstall" step to orchestrate — the
deploy substrate performs it (`adr/0040-*.md`).

**Write capability is already conditional.** Committing needs a GitHub token held
as a server-side secret (`adr/0018-edit-commit-via-pages-function.md`); a
deployment without one can read but not write. That is the same condition that
governs whether an adopter can edit a note at all, so the notice can adopt it
rather than invent a second notion of "may I write".

Two constraints shape the answer. First, the note-commit path deliberately
refuses this file: its path guard accepts only `.md` files and rejects any
segment beginning with `.`, which excludes `.web/` and `.git` by construction.
That guard is load-bearing — it keeps the note editor from reaching the
toolchain — so the upgrade must not widen it. Second, an adopter can *see* the
notice on a deployment that cannot write, so the upgrade action has to degrade to
the current behaviour rather than fail on click.

## Capability statement

An adopter with a writable deployment upgrades the framework from the upgrade
notice itself: one action rewrites the `web-vault` pin in the shell's
`package.json` to the newest published tag and commits it to the deployment's
branch, which rebuilds and reinstalls at that version. The action is explicit and
adopter-invoked, is offered only where the deployment can actually write, and
degrades to the existing "view the release" affordance where it cannot. It
changes the dependency pin and nothing else.

## User stories / scenarios

- As an adopter on a writable deployment, I see that a newer version is
  published and upgrade to it from the notice, without editing config by hand or
  running a reinstall.
- As a reader on a deployment with no token configured, the notice offers me the
  published version to look at and does not offer an action that cannot work.
- As an adopter who has just upgraded, the notice tells me the upgrade is
  building and tells me when the new version is live, so I am not left guessing
  whether the click did anything.
- As an adopter, the upgrade touches only the framework pin — never my vault
  notes, never my configuration values.

## Acceptance criteria

1. The running deployment exposes whether it can write, and the client reads that
   capability rather than inferring it from a failed commit.
2. With an update available and the deployment writable, the notice offers an
   upgrade action; with an update available and the deployment not writable, it
   offers the published-version link and no upgrade action.
3. Invoking the upgrade rewrites only the `web-vault` dependency pin in the
   shell's `package.json`, to the newest published tag, and commits it to the
   deployment's branch (`adr/0020-*.md`). Every other byte of the file, including
   key order and formatting, is preserved.
4. The upgrade is served by a dedicated endpoint whose write scope is that one
   file and that one field. The note path guard is unchanged, and the note-commit
   endpoint remains unable to write `.web/`.
5. The target version is validated as a published `vX.Y.Z` tag of the framework
   repository before anything is written; an unresolvable or malformed target
   writes nothing. The validation distinguishes a tag confirmed absent from a
   check that could not be completed — a refused, failed or unreachable request
   is reported as such rather than as an unpublished version, and neither
   writes.
6. An upgrade attempted when the pin already names the target version, or when
   the file has no resolvable pin, writes nothing and reports that plainly.
7. After a successful commit the notice reports that the upgrade is building, and
   resolves on its own to the new version being live once the rebuild has
   published it. The rebuild's install reconciles the shell lockfile with the
   committed pin; the shell does not require an install that refuses to do so.
8. A failed upgrade — no token, endpoint error, rejected commit — leaves the
   adopter with a stated failure and an unchanged deployment, never a silent
   no-op.
9. The upgrade never runs automatically; it happens only on an explicit adopter
   action.
10. The path is documented alongside install in the delivery docs.

## Out of scope

- Detecting that an upgrade is available: that is `adr/0038-*.md`, which this
  ADR consumes.
- Downgrading, or upgrading to any version other than the newest published tag.
- Migrating breaking configuration changes between versions. In `0.x` a breaking
  adopter-facing change rides the minor (`adr/0037-*.md`); an upgrade across one
  may still require adopter action, and this ADR does not automate that.
- Upgrading the local development shell. The action commits to the deployment's
  branch; a local checkout converges by pulling.
- Any write to `.web/` beyond the single `web-vault` pin — the rest of the shell
  configuration stays adopter-owned.
- Surfacing the write capability anywhere else in the UI. Editing keeps its
  current behaviour in this ADR; unifying the two is a later decision.

## Open questions

- None.

## References

- adr/0018-edit-commit-via-pages-function.md
- adr/0020-commit-target-deployment-branch.md
- adr/0029-cli-setup-and-distribution.md
- adr/0037-versioning-and-release-policy.md
- adr/0038-in-app-upgrade-notice.md
- adr/0040-cloudflare-workers-deploy-substrate.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |
| 2026-08-06 | r2 | marco | Reworded "latest release" as "newest published tag", following `adr/0037-*.md` r2 (editorial: no scope change). |
| 2026-08-06 | r3 | marco | Reshaped the capability from an out-of-band prompt/skill to a one-click action on the upgrade notice, gated by the deployment's write capability and served by a dedicated endpoint. Added the capability signal, the pin-only write scope, and the post-commit resolution as acceptance criteria. |
| 2026-08-06 | r4 | marco | Accepted and Implemented. Shipped in `v0.8.0`. The capability endpoint resolves the open question `adr/0034-*.md` had left for its own plan; that ADR now consumes it rather than defining it. |
| 2026-08-09 | r5 | marco | AC5 gains the failure distinction: the tag lookup sent no `User-Agent`, which GitHub refuses with a 403, and every non-OK response was read as "not published" — so the upgrade failed for every adopter on a Worker while blaming the release. A check that cannot be completed is now reported as such, and still writes nothing. |
| 2026-08-10 | r6 | marco | AC7 gains the install side: the pin-only write scope (AC3) is correct, but the shell's versioned `yarn.lock` still named the old tag, and CI installs immutably — so every upgrade committed the pin and then failed the rebuild at install (`YN0028`), leaving "building" unresolved and the vault to be fixed by hand. Only a real install can rewrite that lockfile, and the build already performs one, so the shell no longer demands an immutable install. Write scope unchanged. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Owner | marco | 2026-08-09 | approved |
