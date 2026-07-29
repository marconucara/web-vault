---
adr: 0010
title: Reliable created/modified dates derived from git
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002]
tags: [content, build, sorting]
---

# ADR 0010 — Reliable created/modified dates derived from git

## Context

Sorting notes by "created" or "modified" needs trustworthy per-file dates. The
filesystem mtime/ctime is unreliable here: on the CI/CDN build the vault is a
fresh git clone, so every file's mtime is approximately the build time and all
notes look modified at once, which breaks date sorting.

## Capability statement

At build time the client derives each note's `created` (first commit that
introduced it) and `modified` (most recent commit that touched it) from a single
`git log` over the vault, and bakes them into the content artifact. If git is
unavailable or the clone is shallow (best-effort `git fetch --unshallow` first),
it falls back to filesystem mtime/ctime. These dates drive list sorting and the
Properties panel's Info section.

## User stories / scenarios

- As a reader, sorting by modified/created reflects the real edit history, not
  the build time.
- As an operator, dates are correct on the CI build even though it is a fresh
  clone.

## Acceptance criteria

1. The build computes, per note, `created` from the earliest commit and
   `modified` from the latest commit touching the file, via one `git log`.
2. When git history is unavailable or shallow (after a best-effort unshallow),
   the build falls back to filesystem mtime/ctime without failing.
3. The dates are stored in the content artifact and used for list sorting and
   the Properties Info section (`adr/0011-read-only-properties-panel.md`).

## Out of scope

- The last-commit subject/sha shown in the Properties panel is related build-time
  git metadata but is covered alongside the panel
  (`adr/0011-read-only-properties-panel.md`).

## Open questions

- None.

## References

- scripts/build-content.mjs (gitDateMaps)
- adr/0002-build-time-content-pipeline.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
