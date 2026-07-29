---
adr: 0021
title: Draft state in localStorage with optimistic commit UI
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0014, 0018]
tags: [editor, ux, state]
---

# ADR 0021 — Draft state in localStorage with optimistic commit UI

## Context

Editing should feel immediate and survive interruptions: a user may edit several
notes, close the tab, and come back expecting the drafts still there, and should
not have to wait for a build to keep working after committing. A commit round-trip
plus a rebuild takes time, so blocking the UI on it would make editing feel slow.

## Capability statement

Pending edits are kept per note in `localStorage` (note path, new body, base
info) and rehydrated on startup, so the "N notes changed" counter and the drafts
reappear after closing and reopening. Committing is **optimistic**: as soon as the
`/api/commit` POST returns success, the delta is dropped from the pending state
and the user continues — no waiting for the rebuild (the committed content
reappears on the next build). A bottom toolbar shows the change counter and a
"Commit (N)" action that opens the message field and posts the batch.

## User stories / scenarios

- As an editor-user, I edit several notes, close the tab, reopen, and my drafts
  and the change counter are still there.
- As an editor-user, after I commit I keep working immediately, without waiting
  for a build.
- As an editor-user, I commit a batch of changed notes with one message.

## Acceptance criteria

1. Pending edits persist per note in `localStorage` and rehydrate on startup,
   restoring the change counter and drafts.
2. On a successful commit the corresponding pending delta is removed without
   waiting for a rebuild (optimistic).
3. A toolbar shows the number of changed notes and a "Commit (N)" action that
   collects a message and posts the batch to the commit endpoint.

## Out of scope

- Waiting for the build — that is required only for Share, not for edits
  (`adr/0024-share-unshare-from-app.md`).
- In-app hot-refresh of a note's content after an edit commit (not implemented).

## Open questions

- None.

## References

- src/lib/pending.js, src/lib/drafts.js, src/lib/commit.js
- adr/0018-edit-commit-via-pages-function.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
