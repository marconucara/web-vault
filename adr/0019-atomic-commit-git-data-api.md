---
adr: 0019
title: Atomic multi-file commit via the GitHub Git Data API
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0018]
tags: [commit, github, concurrency]
---

# ADR 0019 — Atomic multi-file commit via the GitHub Git Data API

## Context

A single editor action can touch several notes (a batch commit, or a share that
also flushes a pending body edit), and they must land as **one** commit, not one
per file. GitHub's Contents API is simpler but makes a separate commit per file.
The Git Data API (blob → tree → commit → update ref) builds one commit over many
files atomically. The commit endpoint is GitHub-specific today
(`adr/0018-edit-commit-via-pages-function.md`, Open questions); this ADR records
the commit algorithm.

## Capability statement

The commit endpoint composes one atomic commit for N files using the GitHub Git
Data API: it fetches the branch tip's base commit and tree **just-in-time**
server-side (so the client tracks no base SHA), builds a new tree with the
changed/created/deleted entries, creates one commit with the chosen message, and
**fast-forwards** the ref with `force:false`. If the branch advanced meanwhile
(for example a commit made outside the web editor), the ref update fails and the
endpoint returns a conflict (409) telling the UI to reload — a rare,
lightly-handled case for a single user. New files are created only if absent
(409 on collision); deletions set the tree entry `sha` to null; unchanged files
are skipped as no-ops.

## User stories / scenarios

- As an editor-user, committing several changed notes produces a single commit
  with my message.
- As an editor-user, if the repo changed under me, I'm told to reload rather than
  clobbering it.
- As a maintainer, the client never has to track base SHAs; the endpoint reads
  the current state just in time.

## Acceptance criteria

1. N files commit as one commit via blob/tree/commit/update-ref, with the chosen
   message.
2. The base commit/tree SHA is fetched server-side at request time; the client
   does not supply it.
3. The ref is updated fast-forward-only (`force:false`); a non-fast-forward
   returns 409 and the UI prompts a reload.
4. Creation requires the file to be absent (409 on collision); deletion removes
   it via a null-sha tree entry; a file whose new content equals the current is a
   no-op.

## Out of scope

- Which branch is targeted (`adr/0020-commit-target-deployment-branch.md`).
- Supporting non-GitHub git backends (`adr/0018-edit-commit-via-pages-function.md`
  Open questions).

## Open questions

- None specific to this ADR beyond the GitHub-only scope noted in
  `adr/0018-edit-commit-via-pages-function.md`.

## References

- functions/commit.js
- adr/0018-edit-commit-via-pages-function.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
