---
adr: 0050
title: Commit-time drift detection and conflict resolution
status: Accepted
date: 2026-09-06
owner: marco
supersedes: [0031]
superseded-by:
depends-on: [0019, 0021]
tags: [sync, editor, conflict, commit, ux]
---

# ADR 0050 — Commit-time drift detection and conflict resolution

## Context

A note edited in the web client can be changed elsewhere while the edit is in
progress — from a desktop Tolaria session, or from a second web client. Two web
clients on the same note (a phone and a desktop) is not an exotic case; it is the
ordinary one for a single user with more than one device.

Today that second change is lost. `functions/commit.js` reads the branch tip at
the start of the request (`refRes`), re-reads each file, applies the client's
operations, and fast-forwards. Nothing compares the file against the version the
editor started from. Three points make this concrete:

- **The 409 that exists is not this check.** The `force:false` fast-forward
  (step 6) fails only if the branch advances *between* the ref read and the
  `PATCH` — a window of milliseconds inside one request. It is a guard against a
  simultaneous race, not against an edit that began minutes ago. It also fires
  after the tree and commit objects have already been created, so it discards
  work rather than preventing it.
- **The write is asymmetric.** `applyOps` re-reads the remote file and keeps its
  frontmatter verbatim while replacing the body wholesale. Two opposite policies
  on two halves of one document, neither chosen by looking at what actually
  changed. Frontmatter is not safer than the body; it is broken less visibly.
- **The build snapshot is not a base.** `pending.js` treats `note.body` — the
  body bundled at build time — as the original, dropping the draft entry when the
  edit returns to it. That implicit base moves under the draft on every deploy.

The decision this ADR replaces (`adr/0031-edit-time-drift-policy.md`) rests on
the premise that the 409 fast-forward is "the authoritative backstop against
writing on a stale base". It is not, for the reason above, so the policy built on
it does not hold.

Background freshness detection (`adr/0030-background-freshness-detection.md`)
addresses the read side and remains valid, but it cannot own this: polling can
only *anticipate* drift, and any interval leaves a window — a phone edited for
half an hour with the screen off, then committed, passes through it. The commit
is the one point where the check cannot be bypassed, because the comparison
happens inside the request that writes. It is also the only point with all three
sides available — the base, the local version, and the remote one.

## Capability statement

Every note carries the identity of the content it was built from, and every edit
records the identity it started from. When a commit is attempted, the system
compares each file against the identity the editor started from and refuses to
write any file whose content has changed in the meantime, returning the current
remote content instead. The editing user is shown the two versions and resolves
the difference themselves; nothing is merged or discarded on their behalf. A
commit carrying no drift proceeds unchanged.

## User stories / scenarios

- As an editor, I edit a note on my phone while the same note is changed from my
  desktop; when I save, I am told the note moved and shown both versions rather
  than silently overwriting the other change.
- As an editor, I resolve the difference by hand and commit the result, and the
  version I approved is what lands in the vault.
- As an editor, I commit a batch of notes where one has drifted, and nothing is
  written until I have dealt with it — I never get a partial commit.
- As an editor, my in-progress work is never lost to a drift check: refusing the
  commit leaves my draft exactly as it was.
- As an editor committing notes nobody else has touched, I notice no change at
  all.

## Acceptance criteria

1. `content.json` carries, per note, the identity of the file content it was
   generated from (the Git blob SHA), emitted by `scripts/build-content.mjs`.
2. An edit recorded in the pending store retains the base identity of the note it
   started from, and that identity is persisted with the draft across reloads.
3. A commit request carries, per file, the base identity the edit started from.
4. Before building any tree or commit object, the Function compares each file's
   current content identity against the base the client sent, and rejects the
   request when they differ.
5. The rejection response carries, for each drifted file, the current remote
   content and identifies which files drifted; it is distinguishable by the
   client from the existing fast-forward rejection, which continues to serve the
   intra-request race.
6. A rejected commit writes nothing: no file in the batch is committed, and every
   draft in it is preserved intact.
7. On rejection the client presents, per drifted note, the local version and the
   remote version in a raw text conflict form, editable by the user, with an
   explicit action to commit the resolved text and an explicit action to
   abandon the resolution. Neither is taken automatically.
8. Committing a resolution succeeds against the remote content that was shown,
   and the note's recorded base advances to the committed result.
9. When an edit carries no base identity — a draft predating this mechanism, or a
   note created in the client — the commit is not refused for drift; note
   creation keeps its existing path-collision rejection.
10. A commit whose files have not drifted behaves exactly as before, with no
    additional round trip visible to the user.

## Out of scope

- **Automatic three-way merge.** The base makes drift *detectable*; resolving it
  is the user's, in this version. Auto-merging non-conflicting regions is a later
  improvement that would extend this ADR, not a requirement of it.
- **Drift checks on the immediate frontmatter operations** — the type panel's
  `icon`, `color`, `order`, `visible`, the type rename and the H1
  (`adr/0045-manage-types-from-the-ui.md`, `adr/0046-type-visibility.md`). These
  are not deferred drafts: the commit fires on the click, so the drift window is
  seconds and a check there does not repay its complexity. The base identity is
  defined over the whole file, so if those operations ever become deferred edits
  they enter this mechanism unchanged rather than needing a second model.
- **Fixing the frontmatter/body asymmetry in `applyOps`.** It is a defect in the
  current write path, tracked separately; this ADR makes the drift visible rather
  than changing how a non-drifted write is composed.
- Serving `content.json` as a runtime-fetchable asset, and any polling — the read
  side stays with `adr/0030-background-freshness-detection.md`.
- Detecting drift against changes that have not been pushed to the branch.

## Open questions

- None.

## References

- functions/commit.js, src/lib/pending.js, src/lib/commit.js
- scripts/build-content.mjs
- adr/0019-atomic-commit-git-data-api.md
- adr/0021-draft-state-optimistic-ui.md
- adr/0030-background-freshness-detection.md
- adr/0031-edit-time-drift-policy.md (superseded by this ADR)
- adr/0045-manage-types-from-the-ui.md, adr/0046-type-visibility.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-09-06 | r1 | marco | Initial draft. |
| 2026-09-06 | r2 | marco | Accepted; implementation authorised. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
