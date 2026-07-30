---
adr: 0031
title: Edit-time drift policy — warn on a stale base, no auto-merge
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0030, 0021, 0019]
tags: [sync, editor, ux, conflict]
---

# ADR 0031 — Edit-time drift policy — warn on a stale base, no auto-merge

## Context

Background freshness detection (`adr/0030-background-freshness-detection.md`)
keeps read-only surfaces current, but it deliberately **exempts** a note with an
unsaved draft: soft re-fetched content is not applied to a note the user is
editing. That leaves an open question this ADR answers — what the editing user is
told, and offered, when the vault advances underneath their draft.

Two safety nets already exist and bound the problem. Drafts are durable: pending
edits live per note in `localStorage` and survive reload
(`adr/0021-draft-state-optimistic-ui.md`), so a stale base never silently loses
work. And the commit path is protected: `functions/commit.js` fast-forwards the
ref with `force:false`, so a commit onto an advanced branch is rejected with a 409
(`adr/0019-atomic-commit-git-data-api.md`) — the hard backstop against writing on
a stale base.

Because v1's freshness signal is the coarse build SHA, the client knows *the
vault advanced* while a draft is open, but not whether the drafted note itself
changed. This ADR fixes the v1 policy at that resolution: **warn, do not act for
the user.** Auto-discarding the draft or attempting a content merge are rejected
for v1 — a merge on a note whose remote change is unknown at note granularity
risks silent corruption, and the durable draft plus the 409 make a blocking
resolution unnecessary.

## Capability statement

When the freshness signal reports that the vault has advanced while a note with an
active or dirty draft is open, the client surfaces a non-blocking **warning** on
that editing surface: the base has moved, and the user's in-progress edits are
preserved. The user keeps editing and decides for themselves whether to continue
or discard; nothing is merged or discarded automatically. If they proceed to
commit on a base that has since advanced, the existing 409 fast-forward rejection
remains the authoritative backstop and is surfaced as a clear, recoverable error.

## User stories / scenarios

- As an editor, while I have a draft open someone pushes a change to the branch;
  I see a warning that the vault moved and that my edits are safe, and I choose
  whether to keep going or discard.
- As an editor, I am never surprised by a background action that rewrites or drops
  my draft on my behalf.
- As an editor, if I commit onto a base that advanced, I get a clear "the branch
  moved, reload and retry" message rather than a silent overwrite.

## Acceptance criteria

1. When the freshness signal indicates the vault advanced and a note with an
   active or dirty draft is open, a non-blocking warning appears on that editing
   surface indicating the base moved and the draft is preserved.
2. The draft / working copy is neither discarded nor merged automatically; the
   user's edits remain intact and editable.
3. The warning offers the user a manual choice to continue editing or to discard
   their draft; neither is taken without an explicit action.
4. A commit attempted on a base that has advanced is rejected via the existing 409
   fast-forward path and surfaced as a clear, recoverable error (reload and retry),
   with the draft still preserved.
5. When no draft is open, this policy does not engage — background refresh
   (`adr/0030`) applies unimpeded.

## Out of scope

- Automatic content merging of local and remote changes to the same note. Deferred;
  revisiting it would supersede this ADR.
- Note-level ("did *this* note change?") drift detection — depends on a finer
  freshness signal than v1 exposes (`adr/0030` out-of-scope).
- Automatic discard of a stale draft without an explicit user action.

## Open questions

- None.

## References

- adr/0030-background-freshness-detection.md
- adr/0021-draft-state-optimistic-ui.md
- adr/0019-atomic-commit-git-data-api.md
- adr/0018-edit-commit-via-pages-function.md
- functions/commit.js

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
